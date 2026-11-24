-- Agrupa várias atividades numa programação e permite publicar regras sazonais.
-- O acesso às alterações continua restrito às funções e políticas do Supabase.

create sequence public.customer_code_seq;
grant usage on sequence public.customer_code_seq to authenticated;

alter table public.profiles
  add column customer_code text;

update public.profiles
set customer_code = 'RAP-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')
where customer_code is null;

alter table public.profiles
  alter column customer_code set default ('RAP-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')),
  alter column customer_code set not null,
  add constraint profiles_customer_code_unique unique (customer_code);

create table public.visit_programs (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column program_id uuid references public.visit_programs(id) on delete restrict;

create index bookings_program_id_idx on public.bookings (program_id, scheduled_for);

-- Preserva pedidos anteriores em programações individuais, pois eles não eram agrupados.
with legacy_bookings as (
  select id, customer_id, created_at, updated_at, extensions.gen_random_uuid() as program_id
  from public.bookings
  where program_id is null
),
created_programs as (
  insert into public.visit_programs (id, customer_id, created_at, updated_at)
  select program_id, customer_id, created_at, updated_at
  from legacy_bookings
  returning id
)
update public.bookings booking
set program_id = legacy.program_id
from legacy_bookings legacy
join created_programs created on created.id = legacy.program_id
where booking.id = legacy.id;

create table public.experience_availability_rules (
  experience_id text not null references public.experiences(id) on delete cascade,
  month smallint not null check (month between 1 and 12),
  weekday smallint not null check (weekday between 0 and 6),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (experience_id, month, weekday)
);

create table public.experience_availability_exceptions (
  id uuid primary key default extensions.gen_random_uuid(),
  experience_id text not null references public.experiences(id) on delete cascade,
  available_on date not null,
  is_available boolean not null,
  note text check (note is null or char_length(note) <= 500),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (experience_id, available_on)
);

create index experience_availability_exceptions_date_idx
  on public.experience_availability_exceptions (available_on, experience_id);

-- Uma exceção explícita prevalece; sem exceção, vale o mês e dia da semana cadastrados.
create function public.is_experience_available(target_experience_id text, target_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select exception.is_available
      from public.experience_availability_exceptions exception
      where exception.experience_id = target_experience_id
        and exception.available_on = target_date
    ),
    exists (
      select 1
      from public.experience_availability_rules rule
      where rule.experience_id = target_experience_id
        and rule.month = extract(month from target_date)::smallint
        and rule.weekday = extract(dow from target_date)::smallint
    )
  );
$$;

revoke all on function public.is_experience_available(text, date) from public;
grant execute on function public.is_experience_available(text, date) to anon, authenticated;

alter table public.experience_availability_rules enable row level security;
alter table public.experience_availability_exceptions enable row level security;
alter table public.visit_programs enable row level security;

revoke all on public.experience_availability_rules,
  public.experience_availability_exceptions,
  public.visit_programs
from anon, authenticated;

grant select, insert, update, delete on public.experience_availability_rules to authenticated;
grant select, insert, update, delete on public.experience_availability_exceptions to authenticated;
grant select on public.visit_programs to authenticated;

create policy experience_availability_rules_admin_read
on public.experience_availability_rules for select to authenticated
using ((select public.is_community_admin()));

create policy experience_availability_rules_admin_write
on public.experience_availability_rules for all to authenticated
using ((select public.is_community_admin()))
with check ((select public.is_community_admin()));

create policy experience_availability_exceptions_admin_read
on public.experience_availability_exceptions for select to authenticated
using ((select public.is_community_admin()));

create policy experience_availability_exceptions_admin_write
on public.experience_availability_exceptions for all to authenticated
using ((select public.is_community_admin()))
with check ((select public.is_community_admin()));

create policy visit_programs_customer_admin_guide_read
on public.visit_programs for select to authenticated
using (
  customer_id = (select auth.uid())
  or (select public.is_community_admin())
  or exists (
    select 1
    from public.bookings booking
    join public.guide_experiences assignment
      on assignment.guide_id = (select auth.uid())
      and assignment.experience_id = booking.experience_id
    where booking.program_id = visit_programs.id
      and booking.guide_id = (select auth.uid())
  )
);

-- Registra quem solicitou ou alterou cada item sem remover o histórico quando ele é cancelado.
create table public.booking_events (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  action text not null check (action in ('created', 'status_changed', 'item_updated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index booking_events_booking_created_idx on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;

create policy booking_events_customer_admin_guide_read
on public.booking_events for select to authenticated
using (
  (select public.is_community_admin())
  or exists (
    select 1 from public.bookings booking
    where booking.id = booking_events.booking_id
      and booking.customer_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.bookings booking
    join public.guide_experiences assignment
      on assignment.guide_id = (select auth.uid())
      and assignment.experience_id = booking.experience_id
    where booking.id = booking_events.booking_id
      and booking.guide_id = (select auth.uid())
  )
);

create function public.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, actor_id, action, details)
    values (new.id, auth.uid(), 'created', jsonb_build_object(
      'program_id', new.program_id,
      'status', new.status,
      'experience_id', new.experience_id,
      'scheduled_for', new.scheduled_for
    ));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.booking_events (booking_id, actor_id, action, details)
    values (new.id, auth.uid(), 'status_changed', jsonb_build_object(
      'from', old.status,
      'to', new.status
    ));
  elsif old.experience_id is distinct from new.experience_id
     or old.scheduled_for is distinct from new.scheduled_for
     or old.participants is distinct from new.participants
     or old.guide_id is distinct from new.guide_id then
    insert into public.booking_events (booking_id, actor_id, action, details)
    values (new.id, auth.uid(), 'item_updated', jsonb_build_object(
      'experience_changed', old.experience_id is distinct from new.experience_id,
      'date_changed', old.scheduled_for is distinct from new.scheduled_for,
      'participants_changed', old.participants is distinct from new.participants,
      'guide_changed', old.guide_id is distinct from new.guide_id
    ));
  end if;
  return new;
end;
$$;

create trigger bookings_record_event
after insert or update on public.bookings
for each row execute function public.record_booking_event();

-- A gestão substitui a grade de um mês/dia de semana numa única operação.
create function public.save_experience_availability_rules(
  target_experience_id text,
  target_months smallint[],
  target_weekdays smallint[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_community_admin()) then
    raise exception 'Somente a gestão da comunidade pode configurar épocas.';
  end if;
  if not exists (
    select 1 from public.experiences
    where id = target_experience_id and is_active
  ) then
    raise exception 'Esta experiência não está disponível.';
  end if;
  if exists (
    select 1 from unnest(coalesce(target_months, '{}'::smallint[])) month_value
    where month_value not between 1 and 12
  ) or exists (
    select 1 from unnest(coalesce(target_weekdays, '{}'::smallint[])) weekday_value
    where weekday_value not between 0 and 6
  ) then
    raise exception 'Selecione meses e dias da semana válidos.';
  end if;

  delete from public.experience_availability_rules
  where experience_id = target_experience_id;

  insert into public.experience_availability_rules (experience_id, month, weekday, created_by)
  select target_experience_id, selected_month, selected_weekday, auth.uid()
  from (
    select distinct unnest(coalesce(target_months, '{}'::smallint[])) as selected_month
  ) months
  cross join (
    select distinct unnest(coalesce(target_weekdays, '{}'::smallint[])) as selected_weekday
  ) weekdays;
end;
$$;

revoke all on function public.save_experience_availability_rules(text, smallint[], smallint[]) from public;
grant execute on function public.save_experience_availability_rules(text, smallint[], smallint[]) to authenticated;

create function public.save_experience_availability_exception(
  target_experience_id text,
  target_date date,
  target_is_available boolean,
  target_note text default null
)
returns public.experience_availability_exceptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_exception public.experience_availability_exceptions;
begin
  if not (select public.is_community_admin()) then
    raise exception 'Somente a gestão da comunidade pode alterar datas excepcionais.';
  end if;
  if target_date < (now() at time zone 'America/Boa_Vista')::date then
    raise exception 'A exceção precisa ser hoje ou uma data futura.';
  end if;
  if char_length(coalesce(target_note, '')) > 500 then
    raise exception 'A observação pode ter no máximo 500 caracteres.';
  end if;

  insert into public.experience_availability_exceptions (
    experience_id, available_on, is_available, note, updated_by, updated_at
  )
  values (
    target_experience_id, target_date, target_is_available,
    nullif(btrim(target_note), ''), auth.uid(), now()
  )
  on conflict (experience_id, available_on) do update
  set is_available = excluded.is_available,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  returning * into saved_exception;

  return saved_exception;
end;
$$;

revoke all on function public.save_experience_availability_exception(text, date, boolean, text) from public;
grant execute on function public.save_experience_availability_exception(text, date, boolean, text) to authenticated;

create function public.remove_experience_availability_exception(target_exception_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_community_admin()) then
    raise exception 'Somente a gestão da comunidade pode remover exceções.';
  end if;
  delete from public.experience_availability_exceptions where id = target_exception_id;
end;
$$;

revoke all on function public.remove_experience_availability_exception(uuid) from public;
grant execute on function public.remove_experience_availability_exception(uuid) to authenticated;

-- A inscrição de um horário só é válida quando a época ou uma exceção permite a atividade.
create or replace function public.validate_experience_slot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  experience_limit integer;
  local_date date;
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

  local_date := (new.starts_at at time zone 'America/Boa_Vista')::date;
  if not public.is_experience_available(new.experience_id, local_date) then
    raise exception 'A experiência não está disponível nesta data. Ajuste as épocas ou cadastre uma exceção.';
  end if;

  return new;
end;
$$;

-- Cria uma programação com uma ou mais atividades e reserva vagas numa transação.
create function public.request_experience_program(
  target_slot_ids uuid[],
  participant_count integer,
  visitor_note text default null,
  visitor_accessibility_needs text default null,
  visitor_dietary_restrictions text default null,
  visitor_privacy_consent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_slot public.experience_slots;
  experience_limit integer;
  reserved_participants integer;
  found_slot_count integer;
  new_program_id uuid;
  visitor_id uuid := (select auth.uid());
begin
  if visitor_id is null or not exists (
    select 1 from public.profiles p
    where p.id = visitor_id and p.role = 'visitor'
  ) then
    raise exception 'Entre com um perfil de visitante para solicitar uma programação.';
  end if;
  if not visitor_privacy_consent then
    raise exception 'Confirme o aviso de privacidade para continuar.';
  end if;
  if participant_count is null or participant_count < 1 or participant_count > 100 then
    raise exception 'Informe um número válido de participantes.';
  end if;
  if target_slot_ids is null or cardinality(target_slot_ids) < 1 or cardinality(target_slot_ids) > 10
     or cardinality(target_slot_ids) <> (select count(distinct slot_id) from unnest(target_slot_ids) slot_id)
  then
    raise exception 'Selecione de uma a dez atividades diferentes para a programação.';
  end if;
  if char_length(coalesce(visitor_note, '')) > 1000
     or char_length(coalesce(visitor_accessibility_needs, '')) > 500
     or char_length(coalesce(visitor_dietary_restrictions, '')) > 500 then
    raise exception 'Um dos campos informados ultrapassou o tamanho permitido.';
  end if;

  select count(*) into found_slot_count
  from public.experience_slots slot
  where slot.id = any(target_slot_ids);
  if found_slot_count <> cardinality(target_slot_ids) then
    raise exception 'Uma ou mais atividades não possuem horário válido.';
  end if;

  insert into public.visit_programs (customer_id)
  values (visitor_id)
  returning id into new_program_id;

  for chosen_slot in
    select slot.*
    from public.experience_slots slot
    where slot.id = any(target_slot_ids)
    order by slot.id
    for update
  loop
    if not chosen_slot.is_active or chosen_slot.starts_at <= now() then
      raise exception 'Um dos horários não está mais disponível. Atualize as opções.';
    end if;
    if not public.is_experience_available(
      chosen_slot.experience_id,
      (chosen_slot.starts_at at time zone 'America/Boa_Vista')::date
    ) then
      raise exception 'Uma das atividades não está disponível nesta época.';
    end if;

    select e.max_participants into experience_limit
    from public.experiences e
    where e.id = chosen_slot.experience_id and e.is_active;
    if not found then
      raise exception 'Uma das experiências não está mais disponível.';
    end if;
    if experience_limit is not null and participant_count > experience_limit then
      raise exception 'O número de participantes excede o limite de uma das experiências.';
    end if;

    select coalesce(sum(booking.participants), 0)::integer into reserved_participants
    from public.bookings booking
    where booking.availability_slot_id = chosen_slot.id
      and booking.status in ('requested', 'confirmed');
    if participant_count > chosen_slot.capacity - reserved_participants then
      raise exception 'Não há vagas suficientes em um dos horários. Atualize a programação.';
    end if;

    insert into public.bookings (
      customer_id, program_id, experience_id, availability_slot_id, scheduled_for,
      participants, customer_note, accessibility_needs, dietary_restrictions, privacy_consent_at
    )
    values (
      visitor_id, new_program_id, chosen_slot.experience_id, chosen_slot.id, chosen_slot.starts_at,
      participant_count, nullif(btrim(visitor_note), ''),
      nullif(btrim(visitor_accessibility_needs), ''),
      nullif(btrim(visitor_dietary_restrictions), ''), now()
    );
  end loop;

  return new_program_id;
end;
$$;

revoke all on function public.request_experience_program(uuid[], integer, text, text, text, boolean) from public;
grant execute on function public.request_experience_program(uuid[], integer, text, text, text, boolean) to authenticated;

-- Mantém compatibilidade com versões do app que ainda enviam um único horário.
create or replace function public.request_experience_slot(
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
  new_program_id uuid;
  new_booking public.bookings;
begin
  new_program_id := public.request_experience_program(
    array[target_slot_id], participant_count, visitor_note,
    visitor_accessibility_needs, visitor_dietary_restrictions, visitor_privacy_consent
  );
  select * into new_booking
  from public.bookings
  where program_id = new_program_id
  limit 1;
  return new_booking;
end;
$$;

revoke all on function public.request_experience_slot(uuid, integer, text, text, text, boolean) from public;
grant execute on function public.request_experience_slot(uuid, integer, text, text, text, boolean) to authenticated;

-- A administração pode acrescentar um item à programação sem ultrapassar as vagas.
create function public.community_add_program_item(
  target_program_id uuid,
  target_slot_id uuid,
  participant_count integer
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_customer_id uuid;
  chosen_slot public.experience_slots;
  experience_limit integer;
  reserved_participants integer;
  new_booking public.bookings;
begin
  if not (select public.is_community_admin()) then
    raise exception 'Somente a gestão da comunidade pode alterar a programação.';
  end if;
  select customer_id into target_customer_id
  from public.visit_programs
  where id = target_program_id;
  if target_customer_id is null then
    raise exception 'A programação não foi encontrada.';
  end if;
  if participant_count is null or participant_count < 1 or participant_count > 100 then
    raise exception 'Informe um número válido de participantes.';
  end if;

  select * into chosen_slot from public.experience_slots
  where id = target_slot_id for update;
  if chosen_slot.id is null or not chosen_slot.is_active or chosen_slot.starts_at <= now() then
    raise exception 'O horário não está mais disponível.';
  end if;
  if not public.is_experience_available(
    chosen_slot.experience_id,
    (chosen_slot.starts_at at time zone 'America/Boa_Vista')::date
  ) then
    raise exception 'A experiência não está disponível nesta época.';
  end if;

  select max_participants into experience_limit
  from public.experiences
  where id = chosen_slot.experience_id and is_active;
  if not found or (experience_limit is not null and participant_count > experience_limit) then
    raise exception 'O número de participantes excede o limite desta experiência.';
  end if;

  select coalesce(sum(participants), 0)::integer into reserved_participants
  from public.bookings
  where availability_slot_id = chosen_slot.id
    and status in ('requested', 'confirmed');
  if participant_count > chosen_slot.capacity - reserved_participants then
    raise exception 'Não há vagas suficientes neste horário.';
  end if;

  insert into public.bookings (
    customer_id, program_id, experience_id, availability_slot_id, scheduled_for, participants
  )
  values (
    target_customer_id, target_program_id, chosen_slot.experience_id,
    chosen_slot.id, chosen_slot.starts_at, participant_count
  )
  returning * into new_booking;
  return new_booking;
end;
$$;

revoke all on function public.community_add_program_item(uuid, uuid, integer) from public;
grant execute on function public.community_add_program_item(uuid, uuid, integer) to authenticated;

-- A remoção é um cancelamento auditado para preservar a programação e liberar vagas.
create function public.community_remove_program_item(target_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_booking public.bookings;
begin
  if not (select public.is_community_admin()) then
    raise exception 'Somente a gestão da comunidade pode alterar a programação.';
  end if;
  update public.bookings
  set status = 'cancelled'
  where id = target_booking_id
    and program_id is not null
    and status in ('requested', 'confirmed')
  returning * into removed_booking;
  if removed_booking.id is null then
    raise exception 'Este item não está ativo ou não pertence a uma programação.';
  end if;
  return removed_booking;
end;
$$;

revoke all on function public.community_remove_program_item(uuid) from public;
grant execute on function public.community_remove_program_item(uuid) to authenticated;

-- Só mostra ao visitante horários que também respeitam a época da experiência.
create or replace function public.get_available_experience_slots()
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
  select slot.id, slot.experience_id, slot.starts_at, slot.capacity,
    slot.capacity - coalesce((
      select sum(booking.participants)::integer
      from public.bookings booking
      where booking.availability_slot_id = slot.id
        and booking.status in ('requested', 'confirmed')
    ), 0) as remaining
  from public.experience_slots slot
  join public.experiences experience
    on experience.id = slot.experience_id and experience.is_active
  where slot.is_active
    and slot.starts_at > now()
    and public.is_experience_available(
      slot.experience_id,
      (slot.starts_at at time zone 'America/Boa_Vista')::date
    )
    and slot.capacity - coalesce((
      select sum(booking.participants)::integer
      from public.bookings booking
      where booking.availability_slot_id = slot.id
        and booking.status in ('requested', 'confirmed')
    ), 0) > 0
  order by slot.starts_at;
$$;

revoke all on function public.get_available_experience_slots() from public;
grant execute on function public.get_available_experience_slots() to anon, authenticated;
