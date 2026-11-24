-- Contato público da gestão; a administração altera o número sem publicar uma nova versão do app.
-- A chave booleana limitada a true garante que exista uma única configuração da comunidade.
create table public.community_settings (
  id boolean primary key default true check (id),
  whatsapp_phone text not null
    check (whatsapp_phone ~ '^[1-9][0-9]{9,14}$'),
  updated_at timestamptz not null default now()
);

-- Cria o primeiro contato apenas na instalação; reexecutar a migração não sobrescreve ajustes.
insert into public.community_settings (id, whatsapp_phone)
values (true, '559584262222')
on conflict (id) do nothing;

-- O telefone pode ser lido publicamente, mas somente a administração autenticada pode alterá-lo.
alter table public.community_settings enable row level security;
revoke all on public.community_settings from anon, authenticated;
grant select on public.community_settings to anon, authenticated;
grant update (whatsapp_phone) on public.community_settings to authenticated;

create policy community_settings_public_read
on public.community_settings for select to anon, authenticated
using (true);

create policy community_settings_admin_update
on public.community_settings for update to authenticated
using ((select public.is_community_admin()))
with check ((select public.is_community_admin()));
