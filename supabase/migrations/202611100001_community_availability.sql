-- Horários publicados pela comunidade; visitantes só consultam os que ainda têm vagas.
create table public.experience_slots (
  id uuid primary key default extensions.gen_random_uuid(),
  experience_id text not null references public.experiences(id) on delete restrict,
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 100),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint experience_slot_unique_start unique (experience_id, starts_at)
);

create index experience_slots_public_schedule_idx
  on public.experience_slots (experience_id, starts_at)
  where is_active;

create function public.validate_experience_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  experience_limit integer;
begin
  if new.starts_at <= now() then
    raise exception 'O horário precisa estar no futuro.';
  end if;

  select e.max_participants into experience_limit
  from public.experiences e
  where e.id = new.experience_id and e.is_active;

  if not found then
    raise exception 'Esta experiência não está disponível.';
  end if;

  if experience_limit is not null and new.capacity > experience_limit then
    raise exception 'A capacidade excede o limite indicado para esta experiência.';
  end if;

  return new;
end;
$$;

create trigger experience_slots_validate
before insert or update on public.experience_slots
for each row execute function public.validate_experience_slot();

alter table public.bookings
  add column availability_slot_id uuid references public.experience_slots(id) on delete restrict,
  add column accessibility_needs text
    check (accessibility_needs is null or char_length(accessibility_needs) <= 500),
  add column dietary_restrictions text
    check (dietary_restrictions is null or char_length(dietary_restrictions) <= 500),
  add column privacy_consent_at timestamptz;

create index bookings_availability_slot_idx on public.bookings (availability_slot_id, status);

alter table public.experience_slots enable row level security;
revoke all on public.experience_slots from anon, authenticated;
grant select, insert, update on public.experience_slots to authenticated;
grant select on public.experience_slots to anon;

create policy experience_slots_public_read
on public.experience_slots for select to anon, authenticated
using (
  (is_active and starts_at > now())
  or (select public.is_community_admin())
);

create policy experience_slots_admin_manage
on public.experience_slots for all to authenticated
using ((select public.is_community_admin()))
with check ((select public.is_community_admin()));

drop policy bookings_customer_create_own_request on public.bookings;

-- A reserva bloqueia o horário enquanto confere a capacidade, evitando excesso de vagas.
create function public.request_experience_slot(
  target_slot_id uuid,
  participant_count integer,
  visitor_note text default null,
  visitor_accessibility_needs text default null,
  visitor_dietary_restrictions text default null,
  visitor_privacy_consent boolean default false
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_slot public.experience_slots;
  experience_limit integer;
  reserved_participants integer;
  new_booking public.bookings;
  visitor_id uuid := (select auth.uid());
begin
  if visitor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = visitor_id and p.role = 'visitor'
  ) then
    raise exception 'Entre com um perfil de visitante para solicitar uma visita.';
  end if;

  if not visitor_privacy_consent then
    raise exception 'Confirme o aviso de privacidade para continuar.';
  end if;

  if participant_count is null or participant_count < 1 or participant_count > 100 then
    raise exception 'Informe um número válido de participantes.';
  end if;

  if char_length(coalesce(visitor_note, '')) > 1000
     or char_length(coalesce(visitor_accessibility_needs, '')) > 500
     or char_length(coalesce(visitor_dietary_restrictions, '')) > 500 then
    raise exception 'Um dos campos informados ultrapassou o tamanho permitido.';
  end if;

  select s.* into chosen_slot
  from public.experience_slots s
  where s.id = target_slot_id
    and s.is_active
    and s.starts_at > now()
  for update;

  if chosen_slot.id is null then
    raise exception 'Este horário não está mais disponível. Atualize a lista e escolha outro.';
  end if;

  select e.max_participants into experience_limit
  from public.experiences e
  where e.id = chosen_slot.experience_id and e.is_active;

  if not found then
    raise exception 'Esta experiência não está disponível.';
  end if;

  if experience_limit is not null and participant_count > experience_limit then
    raise exception 'O número de participantes excede o limite indicado para esta experiência.';
  end if;

  select coalesce(sum(b.participants), 0)::integer into reserved_participants
  from public.bookings b
  where b.availability_slot_id = chosen_slot.id
    and b.status in ('requested', 'confirmed');

  if participant_count > chosen_slot.capacity - reserved_participants then
    raise exception 'Não há vagas suficientes neste horário. Atualize a lista e escolha outro.';
  end if;

  insert into public.bookings (
    customer_id, experience_id, availability_slot_id, scheduled_for,
    participants, customer_note, accessibility_needs, dietary_restrictions,
    privacy_consent_at
  )
  values (
    visitor_id, chosen_slot.experience_id, chosen_slot.id, chosen_slot.starts_at,
    participant_count, nullif(btrim(visitor_note), ''),
    nullif(btrim(visitor_accessibility_needs), ''),
    nullif(btrim(visitor_dietary_restrictions), ''), now()
  )
  returning * into new_booking;

  return new_booking;
end;
$$;

revoke all on function public.request_experience_slot(uuid, integer, text, text, text, boolean) from public;
grant execute on function public.request_experience_slot(uuid, integer, text, text, text, boolean) to authenticated;

-- O visitante cancela pela própria conta apenas pedidos que ainda aguardam resposta.
create function public.cancel_own_booking(target_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  cancelled_booking public.bookings;
  visitor_id uuid := (select auth.uid());
begin
  if visitor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = visitor_id and p.role = 'visitor'
  ) then
    raise exception 'Entre com seu perfil de visitante para cancelar o pedido.';
  end if;

  update public.bookings b
  set status = 'cancelled'
  where b.id = target_booking_id
    and b.customer_id = visitor_id
    and b.status = 'requested'
  returning b.* into cancelled_booking;

  if cancelled_booking.id is null then
    raise exception 'Somente pedidos pendentes podem ser cancelados pelo visitante.';
  end if;

  return cancelled_booking;
end;
$$;

revoke all on function public.cancel_own_booking(uuid) from public;
grant execute on function public.cancel_own_booking(uuid) to authenticated;

-- A lista contém apenas horários agregados; nunca expõe dados pessoais dos pedidos.
create function public.get_available_experience_slots()
returns table (
  id uuid,
  experience_id text,
  starts_at timestamptz,
  capacity integer,
  remaining integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.experience_id, s.starts_at, s.capacity,
    s.capacity - coalesce((
      select sum(b.participants)::integer
      from public.bookings b
      where b.availability_slot_id = s.id
        and b.status in ('requested', 'confirmed')
    ), 0) as remaining
  from public.experience_slots s
  join public.experiences e on e.id = s.experience_id and e.is_active
  where s.is_active
    and s.starts_at > now()
    and (
      s.capacity - coalesce((
        select sum(b.participants)::integer
        from public.bookings b
        where b.availability_slot_id = s.id
          and b.status in ('requested', 'confirmed')
      ), 0)
    ) > 0
  order by s.starts_at;
$$;

revoke all on function public.get_available_experience_slots() from public;
grant execute on function public.get_available_experience_slots() to anon, authenticated;
