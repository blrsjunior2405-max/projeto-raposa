-- Habilita o calendário da gestão a receber alterações de pedidos em tempo real.
-- Verifica a publicação antes de incluir a tabela e evita adicioná-la duas vezes.
do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'A publicação supabase_realtime não existe neste projeto.';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end
$$;
