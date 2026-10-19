-- MVP Check-in Salas de Sistemas
-- Fundación Universitaria Tecnológico Comfenalco

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  ubicacion text,
  token_qr text not null unique,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.salas (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio)
);

create index horarios_sala_dia_idx on public.horarios (sala_id, dia_semana);

create table public.config_sistema (
  clave text primary key,
  valor text not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id)
);

insert into public.config_sistema (clave, valor)
values ('margen_gracia_minutos', '15');

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text,
  created_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.registros (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.salas (id),
  usuario_id uuid not null references public.perfiles (id),
  motivo text not null check (char_length(motivo) between 3 and 200),
  entrada timestamptz not null default now(),
  salida timestamptz,
  tipo_cierre text check (tipo_cierre in ('usuario', 'admin', 'automatico')),
  cerrado_por uuid references auth.users (id),
  check (salida is null or salida >= entrada)
);

create unique index uq_registro_abierto
  on public.registros (sala_id, usuario_id)
  where salida is null;

create index registros_sala_entrada_idx on public.registros (sala_id, entrada desc);
create index registros_usuario_entrada_idx on public.registros (usuario_id, entrada desc);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  ocurrido_en timestamptz not null default now(),
  actor_id uuid references auth.users (id),
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  detalle jsonb
);

create index auditoria_ocurrido_idx on public.auditoria (ocurrido_en desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

create or replace function public.current_email_domain()
returns text
language sql
stable
as $$
  select lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2));
$$;

create or replace function public.get_margen_gracia_minutos()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(nullif(valor, '')::integer, 15))
  from public.config_sistema
  where clave = 'margen_gracia_minutos';
$$;

-- ISO: 1=lunes ... 7=domingo (America/Bogota)
create or replace function public.sala_en_franja(p_sala_id uuid, p_moment timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dow smallint;
  v_time time;
begin
  v_dow := ((extract(isodow from timezone('America/Bogota', p_moment)))::smallint);
  v_time := (timezone('America/Bogota', p_moment))::time;

  return exists (
    select 1
    from public.horarios h
    where h.sala_id = p_sala_id
      and h.dia_semana = v_dow
      and v_time >= h.hora_inicio
      and v_time < h.hora_fin
  );
end;
$$;

create or replace function public.fin_franja_activa(p_sala_id uuid, p_moment timestamptz default now())
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fin time;
  v_local timestamp;
begin
  v_local := timezone('America/Bogota', p_moment);

  select h.hora_fin into v_fin
  from public.horarios h
  where h.sala_id = p_sala_id
    and h.dia_semana = (extract(isodow from v_local))::smallint
    and (v_local::time) >= h.hora_inicio
    and (v_local::time) < h.hora_fin
  order by h.hora_fin desc
  limit 1;

  if v_fin is null then
    return null;
  end if;

  return (date_trunc('day', v_local) + v_fin) at time zone 'America/Bogota';
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers de negocio
-- ---------------------------------------------------------------------------

create or replace function public.trg_registros_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  new.entrada := coalesce(new.entrada, now());
  new.salida := null;
  new.tipo_cierre := null;
  new.cerrado_por := null;
  return new;
end;
$$;

create trigger registros_before_insert
  before insert on public.registros
  for each row execute function public.trg_registros_before_insert();

create or replace function public.trg_registros_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Inmutables: no reabrir ni reasignar
  if old.salida is not null then
    raise exception 'Registro ya cerrado';
  end if;

  if new.sala_id is distinct from old.sala_id
     or new.usuario_id is distinct from old.usuario_id
     or new.motivo is distinct from old.motivo
     or new.entrada is distinct from old.entrada then
    raise exception 'Solo se permite cerrar el registro';
  end if;

  if new.salida is null then
    return new;
  end if;

  if auth.uid() = old.usuario_id and not public.is_admin() then
    new.tipo_cierre := 'usuario';
    new.cerrado_por := auth.uid();
  elsif public.is_admin() then
    new.tipo_cierre := coalesce(new.tipo_cierre, 'admin');
    new.cerrado_por := coalesce(new.cerrado_por, auth.uid());
  elsif new.tipo_cierre = 'automatico' then
    -- cierre por job/service role
    new.cerrado_por := null;
  else
    raise exception 'No autorizado a cerrar este registro';
  end if;

  return new;
end;
$$;

create trigger registros_before_update
  before update on public.registros
  for each row execute function public.trg_registros_before_update();

-- ---------------------------------------------------------------------------
-- Auditoría (triggers; no escribe el frontend)
-- ---------------------------------------------------------------------------

create or replace function public.audit_write(
  p_accion text,
  p_entidad text,
  p_entidad_id uuid,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (auth.uid(), p_accion, p_entidad, p_entidad_id, p_detalle);
end;
$$;

create or replace function public.trg_audit_registros_cierre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.salida is null and new.salida is not null and new.tipo_cierre = 'admin' then
    perform public.audit_write(
      'cierre_manual',
      'registros',
      new.id,
      jsonb_build_object(
        'sala_id', new.sala_id,
        'usuario_id', new.usuario_id,
        'salida', new.salida
      )
    );
  end if;
  return new;
end;
$$;

create trigger registros_audit_cierre
  after update on public.registros
  for each row execute function public.trg_audit_registros_cierre();

create or replace function public.trg_audit_horarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_accion text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
    v_accion := 'eliminar_horario';
    perform public.audit_write(v_accion, 'horarios', v_id, to_jsonb(old));
    return old;
  elsif tg_op = 'INSERT' then
    v_id := new.id;
    v_accion := 'crear_horario';
    perform public.audit_write(v_accion, 'horarios', v_id, to_jsonb(new));
    return new;
  else
    v_id := new.id;
    v_accion := 'cambiar_horario';
    perform public.audit_write(
      v_accion,
      'horarios',
      v_id,
      jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new))
    );
    return new;
  end if;
end;
$$;

create trigger horarios_audit
  after insert or update or delete on public.horarios
  for each row execute function public.trg_audit_horarios();

create or replace function public.trg_audit_salas_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.token_qr is distinct from old.token_qr then
    perform public.audit_write(
      'rotacion_token',
      'salas',
      new.id,
      jsonb_build_object('sala', new.nombre)
    );
  elsif tg_op = 'INSERT' then
    perform public.audit_write('crear_sala', 'salas', new.id, jsonb_build_object('nombre', new.nombre));
  elsif tg_op = 'UPDATE' then
    perform public.audit_write(
      'cambiar_sala',
      'salas',
      new.id,
      jsonb_build_object('antes', to_jsonb(old), 'despues', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

create trigger salas_audit
  after insert or update on public.salas
  for each row execute function public.trg_audit_salas_token();

create or replace function public.trg_audit_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  perform public.audit_write(
    'cambio_config',
    'config_sistema',
    null,
    jsonb_build_object('clave', new.clave, 'antes', old.valor, 'despues', new.valor)
  );
  return new;
end;
$$;

create trigger config_audit
  before update on public.config_sistema
  for each row execute function public.trg_audit_config();

-- Perfil al crear usuario (opcional; el frontend también puede completar nombre)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
  v_domain := lower(split_part(new.email, '@', 2));
  if v_domain is distinct from 'tecnocomfenalco.edu.co' then
    raise exception 'Solo se permiten correos @tecnocomfenalco.edu.co';
  end if;

  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Cierre automático (invocado por pg_cron)
-- salida = fin de franja; tipo_cierre = automatico
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_registros_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_margen integer := public.get_margen_gracia_minutos();
  v_count integer := 0;
  r record;
  v_fin timestamptz;
  v_fin_franja time;
begin
  for r in
    select reg.id, reg.sala_id, reg.entrada
    from public.registros reg
    where reg.salida is null
  loop
    -- Franja del día de la entrada (misma sala)
    select h.hora_fin into v_fin_franja
    from public.horarios h
    where h.sala_id = r.sala_id
      and h.dia_semana = (extract(isodow from timezone('America/Bogota', r.entrada)))::smallint
      and (timezone('America/Bogota', r.entrada))::time >= h.hora_inicio
      and (timezone('America/Bogota', r.entrada))::time < h.hora_fin
    order by h.hora_fin desc
    limit 1;

    if v_fin_franja is null then
      -- sin franja asociada: cierra con hora actual truncada a entrada+0 (fallback: now)
      update public.registros
      set salida = now(),
          tipo_cierre = 'automatico',
          cerrado_por = null
      where id = r.id and salida is null;
      v_count := v_count + 1;
      continue;
    end if;

    v_fin := (date_trunc('day', timezone('America/Bogota', r.entrada)) + v_fin_franja)
             at time zone 'America/Bogota';

    if now() >= v_fin + make_interval(mins => v_margen) then
      update public.registros
      set salida = v_fin,
          tipo_cierre = 'automatico',
          cerrado_por = null
      where id = r.id and salida is null;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Programar con pg_cron (requiere extensión habilitada en el proyecto Supabase):
-- select cron.schedule('cerrar-registros-vencidos', '*/5 * * * *', $$select public.cerrar_registros_vencidos();$$);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.salas enable row level security;
alter table public.horarios enable row level security;
alter table public.config_sistema enable row level security;
alter table public.perfiles enable row level security;
alter table public.admins enable row level security;
alter table public.registros enable row level security;
alter table public.auditoria enable row level security;

-- salas
create policy salas_select_auth on public.salas
  for select to authenticated
  using (true);

create policy salas_write_admin on public.salas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- horarios
create policy horarios_select_auth on public.horarios
  for select to authenticated
  using (true);

create policy horarios_write_admin on public.horarios
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- config
create policy config_select_auth on public.config_sistema
  for select to authenticated
  using (true);

create policy config_update_admin on public.config_sistema
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- perfiles
create policy perfiles_select_own_or_admin on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy perfiles_update_own on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- admins: solo puede ver su propia fila (para detectar rol en el cliente)
create policy admins_select_own on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- registros
create policy registros_select_own_or_admin on public.registros
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin());

create policy registros_insert_own on public.registros
  for insert to authenticated
  with check (usuario_id = auth.uid() or public.is_admin());

create policy registros_update_own_or_admin on public.registros
  for update to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid() or public.is_admin());

-- auditoria
create policy auditoria_select_admin on public.auditoria
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on public.salas, public.horarios, public.config_sistema to authenticated;
grant select on public.admins to authenticated;
grant select, update on public.perfiles to authenticated;
grant select, insert, update on public.registros to authenticated;
grant select on public.auditoria to authenticated;
grant insert, update, delete on public.salas, public.horarios to authenticated;
grant update on public.config_sistema to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.sala_en_franja(uuid, timestamptz) to authenticated;
grant execute on function public.get_margen_gracia_minutos() to authenticated;
grant execute on function public.cerrar_registros_vencidos() to service_role;
