-- Este arquivo cria o banco que conecta o app dos visitantes ao painel comunitário.
-- As permissões ficam no Postgres, para continuarem valendo mesmo que uma tela seja alterada.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Os papéis separam visitantes, guias e pessoas da comunidade que administram o sistema.
create type public.app_role as enum ('visitor', 'guide', 'community_admin');
create type public.booking_status as enum ('requested', 'confirmed', 'cancelled', 'completed');

-- O perfil guarda dados de contato e função; a senha fica protegida no Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'visitor',
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) between 1 and 120),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 30)
);

-- O catálogo ativo é compartilhado pelo app e pelo site público.
create table public.experiences (
  id text primary key,
  title text not null,
  category text not null,
  summary text not null,
  duration text not null,
  max_participants integer check (max_participants is null or max_participants between 1 and 100),
  image_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Um guia pode conduzir uma ou várias experiências por meio deste vínculo.
create table public.guide_experiences (
  guide_id uuid not null references public.profiles(id) on delete cascade,
  experience_id text not null references public.experiences(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (guide_id, experience_id)
);

-- Cada pedido liga um cliente, uma experiência, uma data e, depois, um guia responsável.
create table public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  experience_id text not null references public.experiences(id) on delete restrict,
  guide_id uuid references public.profiles(id) on delete set null,
  scheduled_for timestamptz not null,
  participants integer not null check (participants between 1 and 100),
  customer_note text check (customer_note is null or char_length(customer_note) <= 1000),
  status public.booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_customer_not_guide check (customer_id <> guide_id)
);

-- Índices ajudam a localizar pedidos rapidamente por cliente, guia, atividade e data.
create index bookings_customer_created_idx on public.bookings (customer_id, created_at desc);
create index bookings_guide_date_idx on public.bookings (guide_id, scheduled_for);
create index bookings_experience_date_idx on public.bookings (experience_id, scheduled_for);
create index guide_experiences_experience_idx on public.guide_experiences (experience_id, guide_id);

-- Atualiza a data de modificação do pedido sem depender do aplicativo de origem.
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

-- Após um cadastro no Auth, cria o perfil correspondente com o menor acesso inicial.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role public.app_role := 'visitor';
begin
  if new.raw_app_meta_data ->> 'role' = 'guide' then
    assigned_role := 'guide';
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    assigned_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Visitante'),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Funções auxiliares resumem as verificações de papel usadas pelas políticas de acesso.
create function public.is_community_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'community_admin'
  );
$$;

create function public.is_guide_for_experience(target_experience_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guide_experiences ge
    where ge.guide_id = (select auth.uid())
      and ge.experience_id = target_experience_id
  );
$$;

grant execute on function public.is_community_admin() to anon, authenticated;
grant execute on function public.is_guide_for_experience(text) to authenticated;

-- Protege o papel do perfil para impedir que uma pessoa se promova a guia ou administradora.
create function public.protect_profile_role()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_community_admin() then
    raise exception 'Somente a administração da comunidade pode alterar o papel do perfil.';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- O guia pode mudar a situação somente de pedidos atribuídos à própria conta.
create function public.guide_update_booking_status(target_booking_id uuid, next_status public.booking_status)
returns public.bookings
language plpgsql security definer
set search_path = ''
as $$
declare
  updated_booking public.bookings;
begin
  if next_status not in ('confirmed', 'cancelled', 'completed') then
    raise exception 'Esta situação não pode ser usada.';
  end if;

  update public.bookings b
  set status = next_status
  where b.id = target_booking_id
    and b.guide_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'guide'
    )
  returning b.* into updated_booking;

  if updated_booking.id is null then
    raise exception 'Pedido não encontrado ou não atribuído a este guia.';
  end if;
  return updated_booking;
end;
$$;

grant execute on function public.guide_update_booking_status(uuid, public.booking_status) to authenticated;

-- Ativa a segurança por linha antes de liberar qualquer operação para os aplicativos.
alter table public.profiles enable row level security;
alter table public.experiences enable row level security;
alter table public.guide_experiences enable row level security;
alter table public.bookings enable row level security;

-- Remove permissões implícitas e libera apenas as operações que app e painel precisam.
revoke all on public.profiles, public.experiences, public.guide_experiences, public.bookings from anon, authenticated;
grant select on public.experiences to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.guide_experiences to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;

-- Visitantes leem o catálogo ativo; administradores também podem gerenciar as experiências.
create policy experiences_public_read
on public.experiences for select to anon, authenticated
using (is_active or (select public.is_community_admin()));

create policy experiences_admin_manage
on public.experiences for all to authenticated
using ((select public.is_community_admin()))
with check ((select public.is_community_admin()));

-- Clientes veem seu perfil, a administração vê todos e guias veem clientes de seus pedidos.
create policy profiles_read_own_admin_or_assigned_customer
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select public.is_community_admin())
  or exists (
    select 1 from public.bookings b
    where b.customer_id = profiles.id and b.guide_id = (select auth.uid())
  )
);

-- Clientes atualizam seus contatos sem alterar o próprio papel; administração pode corrigi-los.
create policy profiles_update_own_visitor_or_admin
on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_community_admin()))
with check (
  (id = (select auth.uid()) and role = 'visitor')
  or (select public.is_community_admin())
);

-- A administração distribui experiências; cada guia consulta somente suas próprias atribuições.
create policy guide_experiences_admin_manage
on public.guide_experiences for all to authenticated
using ((select public.is_community_admin()))
with check (
  (select public.is_community_admin())
  and exists (select 1 from public.profiles p where p.id = guide_id and p.role = 'guide')
);

create policy guide_experiences_guide_read_own
on public.guide_experiences for select to authenticated
using (guide_id = (select auth.uid()));

-- Cada visitante consulta somente os pedidos que criou.
create policy bookings_customer_read_own
on public.bookings for select to authenticated
using (customer_id = (select auth.uid()));

-- O app aceita pedidos futuros do cliente conectado, inicialmente sem guia e pendentes.
create policy bookings_customer_create_own_request
on public.bookings for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and guide_id is null
  and status = 'requested'
  and scheduled_for > now()
  and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'visitor'
  )
  and exists (
    select 1 from public.experiences e
    where e.id = experience_id
      and e.is_active
      and (e.max_participants is null or participants <= e.max_participants)
  )
);

-- O guia lê apenas pedidos que lhe foram atribuídos para uma atividade autorizada.
create policy bookings_guide_read_assigned
on public.bookings for select to authenticated
using (
  guide_id = (select auth.uid())
  and (select public.is_guide_for_experience(experience_id))
);

-- A administração organiza todos os pedidos e só pode escolher guias aptos para a atividade.
create policy bookings_admin_manage
on public.bookings for all to authenticated
using ((select public.is_community_admin()))
with check (
  (select public.is_community_admin())
  and (
    guide_id is null
    or (select public.is_guide_for_experience(experience_id))
  )
);

-- Carrega as dez experiências descritas no catálogo comunitário enviado pelo usuário.
insert into public.experiences (id, title, category, summary, duration, max_participants, image_key) values
('cachoeira', 'Trilha cultural da Cachoeira da Raposa', 'Natureza', 'Caminhada com condutores locais, histórias da comunidade e banho de cachoeira.', '2h30', 20, 'cachoeira'),
('arcoiris', 'Caminhada na Serra do Arco-Íris', 'Natureza', 'Subida curta com vista para as serras, a paisagem e a vila da Raposa I.', '1h30', 15, 'serra'),
('panela', 'Panela de barro: a alma do povo Macuxi', 'Saberes', 'Conheça as paneleiras e modele uma peça com barro e saberes locais.', 'Etapas em mais de um dia', 12, 'barro'),
('beiju', 'Produção Macuxi de beiju e farinha', 'Gastronomia', 'Acompanhe o preparo da mandioca, beiju e farinha e prove as iguarias.', '2–3h', 10, 'beiju'),
('caxiri', 'Caxiri: conheça e deguste', 'Gastronomia', 'Conheça a bebida fermentada Macuxi, seu preparo e presença comunitária.', '2h30', 10, 'caxiri'),
('lago', 'Passeio e pesca no Lago da Barragem', 'Natureza', 'Passeio de barco e pesca artesanal acompanhada por anfitriões locais.', '4h', 4, 'lago'),
('parixara', 'A tradição milenar da dança Parixara', 'Saberes', 'Conheça os preparativos, cantos e significado do Parixara com anfitriãs.', '1h', 5, 'parixara'),
('arco', 'Tradição milenar do arco e flecha', 'Saberes', 'História, materiais e demonstração de prática transmitida entre gerações.', '2h', null, 'arco'),
('damurida', 'Damurida: gastronomia indígena', 'Gastronomia', 'Participe do preparo deste prato Macuxi à base de pimenta.', '2h', 10, 'damurida'),
('trancados', 'Mundo dos trançados Macuxi', 'Saberes', 'Veja fibras e palhas se transformarem em cestos, tipitis e peneiras.', '1–2h', 10, 'trancados')
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  summary = excluded.summary,
  duration = excluded.duration,
  max_participants = excluded.max_participants,
  image_key = excluded.image_key;
