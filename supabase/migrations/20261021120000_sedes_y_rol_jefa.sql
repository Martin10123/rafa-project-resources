-- Sedes A/B/C y rol de jefa (solo consulta y descarga de aperturas y cierres).

create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo in ('A', 'B', 'C')),
  nombre text not null
);

insert into public.sedes (codigo, nombre)
values ('A', 'Sede A'), ('B', 'Sede B'), ('C', 'Sede C');

alter table public.salas
  add column sede_id uuid references public.sedes (id);

alter table public.perfiles
  add column sede_id uuid references public.sedes (id);

create index salas_sede_id_idx on public.salas (sede_id);
create index perfiles_sede_id_idx on public.perfiles (sede_id);

create table public.jefas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers de rol y sede
-- ---------------------------------------------------------------------------

create or replace function public.is_jefa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jefas j where j.user_id = auth.uid()
  );
$$;

create or replace function public.current_sede_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.sede_id
  from public.perfiles p
  where p.id = auth.uid();
$$;

create or replace function public.promote_jefa_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede asignar el rol de jefa';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    raise exception 'Escribe el correo de la jefa';
  end if;

  select p.id into v_id
  from public.perfiles p
  where p.email = v_email;

  if v_id is null then
    raise exception 'Esa persona todavía no tiene cuenta. Debe iniciar sesión una vez y después se le asigna el rol.';
  end if;

  insert into public.jefas (user_id) values (v_id)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.revoke_jefa_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede quitar el rol de jefa';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));

  delete from public.jefas j
  using public.perfiles p
  where j.user_id = p.id
    and p.email = v_email;
end;
$$;

create or replace function public.list_jefas()
returns table (user_id uuid, email text, nombre text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
  select p.id, p.email, p.nombre
  from public.jefas j
  join public.perfiles p on p.id = j.user_id
  order by p.email;
end;
$$;

revoke all on function public.is_jefa() from public, anon;
revoke all on function public.current_sede_id() from public, anon;
revoke all on function public.promote_jefa_by_email(text) from public, anon;
revoke all on function public.revoke_jefa_by_email(text) from public, anon;
revoke all on function public.list_jefas() from public, anon;

grant execute on function public.is_jefa() to authenticated;
grant execute on function public.current_sede_id() to authenticated;
grant execute on function public.promote_jefa_by_email(text) to authenticated;
grant execute on function public.revoke_jefa_by_email(text) to authenticated;
grant execute on function public.list_jefas() to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in: la sala tiene que ser de la sede de la persona
-- ---------------------------------------------------------------------------

create or replace function public.trg_registros_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala_sede uuid;
  v_user_sede uuid;
begin
  if new.usuario_id <> auth.uid() and not public.is_admin() then
    raise exception 'No puede crear registros para otro usuario';
  end if;

  if not exists (select 1 from public.salas s where s.id = new.sala_id and s.activa) then
    raise exception 'Sala inexistente o inactiva';
  end if;

  if not public.is_admin() and not public.sala_en_franja(new.sala_id, coalesce(new.entrada, now())) then
    raise exception 'Check-in fuera de la franja horaria de la sala';
  end if;

  if not public.is_admin() then
    select s.sede_id into v_sala_sede
    from public.salas s
    where s.id = new.sala_id;

    -- Sin sede asignada todavía: no se cruza nada porque el admin no la clasificó.
    if v_sala_sede is not null then
      select p.sede_id into v_user_sede
      from public.perfiles p
      where p.id = auth.uid();

      if v_user_sede is null then
        raise exception 'Selecciona tu sede antes del check-in';
      end if;

      if v_user_sede is distinct from v_sala_sede then
        raise exception 'Esta sala no pertenece a tu sede';
      end if;
    end if;
  end if;

  new.entrada := coalesce(new.entrada, now());
  new.salida := null;
  new.tipo_cierre := null;
  new.cerrado_por := null;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sedes enable row level security;
alter table public.jefas enable row level security;

drop policy if exists salas_select_auth on public.salas;
create policy salas_select_auth on public.salas
  for select to authenticated
  using (
    public.is_admin()
    or public.is_jefa()
    or sede_id is null
    or sede_id = public.current_sede_id()
  );

drop policy if exists perfiles_select_own_or_admin on public.perfiles;
create policy perfiles_select_own_or_admin on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_jefa());

drop policy if exists registros_select_own_or_admin on public.registros;
create policy registros_select_own_or_admin on public.registros
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin() or public.is_jefa());

create policy sedes_select_auth on public.sedes
  for select to authenticated
  using (true);

create policy jefas_select_own on public.jefas
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.sedes to authenticated;
grant select on public.jefas to authenticated;

notify pgrst, 'reload schema';
