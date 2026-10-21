-- Check-in, check-out y franjas quedan en una sola transacción de Postgres.
-- PostgREST abre la transacción al llamar la función:
--   si la función termina bien, hace COMMIT;
--   si lanza una excepción, hace ROLLBACK de todo lo escrito en esa llamada.
-- Una función PL/pgSQL no puede ejecutar COMMIT ni ROLLBACK: irían dentro de
-- la transacción que ya abrió PostgREST y la migración fallaría.

-- ---------------------------------------------------------------------------
-- Alta: el correo del dominio ya no otorga admin ni superadmin
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_email text;
begin
  v_email := lower(new.email);
  v_domain := lower(split_part(v_email, '@', 2));
  if v_domain not in ('tecnocomfenalco.edu.co', 'tecnologicocomfenalco.edu.co') then
    raise exception 'Solo se permiten correos @tecnocomfenalco.edu.co o @tecnologicocomfenalco.edu.co';
  end if;

  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name')
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in: hora del servidor, QR en el servidor, un solo insert
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

  -- La hora de entrada la fija el servidor. Un valor enviado por el cliente no cuenta.
  new.entrada := now();
  new.salida := null;
  new.tipo_cierre := null;
  new.cerrado_por := null;

  if not public.is_admin() and not public.sala_en_franja(new.sala_id, new.entrada) then
    raise exception 'Check-in fuera de la franja horaria de la sala';
  end if;

  if not public.is_admin() then
    select s.sede_id into v_sala_sede
    from public.salas s
    where s.id = new.sala_id;

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

  return new;
end;
$$;

create or replace function public.trg_registros_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    new.salida := now();
    new.tipo_cierre := 'usuario';
    new.cerrado_por := auth.uid();
  elsif public.is_admin() then
    new.salida := now();
    new.tipo_cierre := coalesce(nullif(new.tipo_cierre, 'automatico'), 'admin');
    new.cerrado_por := auth.uid();
  elsif new.tipo_cierre = 'automatico' then
    -- El cierre del cron conserva la hora de fin de franja.
    new.cerrado_por := null;
  else
    raise exception 'No autorizado a cerrar este registro';
  end if;

  return new;
end;
$$;

create or replace function public.abrir_sala(p_sala_id uuid, p_token text)
returns table (
  id uuid,
  nombre text,
  ubicacion text,
  activa boolean,
  sede_id uuid,
  sede_nombre text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'No hay sesión activa';
  end if;

  return query
  select s.id, s.nombre, s.ubicacion, s.activa, s.sede_id, sd.nombre
  from public.salas s
  left join public.sedes sd on sd.id = s.sede_id
  where s.id = p_sala_id
    and s.token_qr = p_token;

  if not found then
    raise exception 'El QR no coincide con esta sala';
  end if;
end;
$$;

create or replace function public.checkin(p_sala_id uuid, p_token text, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_activa boolean;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'No hay sesión activa';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 200 then
    raise exception 'Escribe entre 3 y 200 caracteres';
  end if;

  select s.token_qr, s.activa
    into v_token, v_activa
  from public.salas s
  where s.id = p_sala_id
  for update;

  if not found or v_token is distinct from p_token then
    raise exception 'El QR no coincide con esta sala';
  end if;

  if not v_activa then
    raise exception 'Sala inexistente o inactiva';
  end if;

  insert into public.registros (sala_id, usuario_id, motivo)
  values (p_sala_id, (select auth.uid()), v_motivo)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.checkout(p_registro_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'No hay sesión activa';
  end if;

  update public.registros
  set salida = now()
  where id = p_registro_id
    and usuario_id = (select auth.uid())
    and salida is null;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No hay un check-in abierto para cerrar';
  end if;
end;
$$;

-- Borrar y crear los días de una franja es una sola transacción.
-- Si el insert falla, el delete de esta llamada también se revierte.
create or replace function public.guardar_franja_dias(
  p_sala_id uuid,
  p_dias smallint[],
  p_hora_inicio time,
  p_hora_fin time,
  p_replace_ids uuid[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if coalesce(array_length(p_dias, 1), 0) > 0 then
    if p_hora_inicio is null or p_hora_fin is null or p_hora_fin <= p_hora_inicio then
      raise exception 'La hora fin tiene que ser mayor que la de inicio';
    end if;
    if exists (select 1 from unnest(p_dias) as dia where dia < 1 or dia > 7) then
      raise exception 'Día de la semana inválido';
    end if;
  end if;

  if coalesce(array_length(p_replace_ids, 1), 0) > 0 then
    delete from public.horarios
    where id = any (p_replace_ids)
      and sala_id = p_sala_id;
  end if;

  if coalesce(array_length(p_dias, 1), 0) > 0 then
    insert into public.horarios (sala_id, dia_semana, hora_inicio, hora_fin)
    select p_sala_id, dia, p_hora_inicio, p_hora_fin
    from unnest(p_dias) as dia;
  end if;
end;
$$;

create or replace function public.listar_salas()
returns table (
  id uuid,
  nombre text,
  ubicacion text,
  token_qr text,
  activa boolean,
  sede_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.nombre,
    s.ubicacion,
    case when public.is_admin() then s.token_qr else null end,
    s.activa,
    s.sede_id
  from public.salas s
  where public.is_admin()
     or s.sede_id is null
     or s.sede_id = public.current_sede_id()
  order by s.nombre;
$$;

-- ---------------------------------------------------------------------------
-- Perfil: el correo no se edita; la sede se elige una vez
-- ---------------------------------------------------------------------------

create or replace function public.trg_perfiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'No se puede reasignar el perfil';
  end if;

  if new.email is distinct from old.email then
    raise exception 'El correo no se edita desde el perfil';
  end if;

  if new.sede_id is distinct from old.sede_id and not public.is_admin() then
    if old.sede_id is not null then
      raise exception 'La sede ya fue elegida';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_before_update on public.perfiles;
create trigger perfiles_before_update
  before update on public.perfiles
  for each row execute function public.trg_perfiles_before_update();

drop policy if exists perfiles_update_admin on public.perfiles;
create policy perfiles_update_admin on public.perfiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- La jefa consulta la sede de su perfil, no todas las sedes
-- ---------------------------------------------------------------------------

drop policy if exists salas_select_auth on public.salas;
create policy salas_select_auth on public.salas
  for select to authenticated
  using (
    public.is_admin()
    or sede_id is null
    or sede_id = public.current_sede_id()
  );

drop policy if exists perfiles_select_own_or_admin on public.perfiles;
create policy perfiles_select_own_or_admin on public.perfiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or (
      public.is_jefa()
      and public.current_sede_id() is not null
      and sede_id = public.current_sede_id()
    )
  );

drop policy if exists registros_select_own_or_admin on public.registros;
create policy registros_select_own_or_admin on public.registros
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or public.is_admin()
    or (
      public.is_jefa()
      and public.current_sede_id() is not null
      and exists (
        select 1
        from public.salas s
        where s.id = sala_id
          and (s.sede_id is null or s.sede_id = public.current_sede_id())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Permisos: el token del QR y las funciones internas salen de la API pública
-- ---------------------------------------------------------------------------

revoke insert on table public.registros from public, anon, authenticated;
revoke select (token_qr) on table public.salas from public, anon, authenticated;

revoke all on function public.abrir_sala(uuid, text) from public, anon;
revoke all on function public.checkin(uuid, text, text) from public, anon;
revoke all on function public.checkout(uuid) from public, anon;
revoke all on function public.guardar_franja_dias(uuid, smallint[], time, time, uuid[]) from public, anon;
revoke all on function public.listar_salas() from public, anon;

grant execute on function public.abrir_sala(uuid, text) to authenticated;
grant execute on function public.checkin(uuid, text, text) to authenticated;
grant execute on function public.checkout(uuid) to authenticated;
grant execute on function public.guardar_franja_dias(uuid, smallint[], time, time, uuid[]) to authenticated;
grant execute on function public.listar_salas() to authenticated;

revoke all on function public.audit_write(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cerrar_registros_vencidos() from public, anon, authenticated;
grant execute on function public.cerrar_registros_vencidos() to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.trg_registros_before_insert() from public, anon, authenticated;
revoke all on function public.trg_registros_before_update() from public, anon, authenticated;
revoke all on function public.trg_perfiles_before_update() from public, anon, authenticated;
revoke all on function public.trg_audit_registros_cierre() from public, anon, authenticated;
revoke all on function public.trg_audit_horarios() from public, anon, authenticated;
revoke all on function public.trg_audit_salas_token() from public, anon, authenticated;
revoke all on function public.trg_audit_config() from public, anon, authenticated;
revoke all on function public.fin_franja_activa(uuid, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
