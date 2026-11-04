-- Una cuenta nueva no recibe rol. Hasta que el administrador lo asigne,
-- no puede hacer check-in.

alter table public.perfiles alter column rol drop not null;
alter table public.perfiles alter column rol drop default;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol is null or rol in ('auxiliar', 'monitor', 'superadmin'));

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

  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.raw_user_meta_data ->> 'full_name'),
    null
  );

  return new;
end;
$$;

create or replace function public.asignar_rol(p_user_id uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_actual text;
begin
  if not exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  ) then
    raise exception 'Solo un administrador puede asignar roles';
  end if;

  v_rol := lower(trim(coalesce(p_rol, '')));
  if v_rol not in ('auxiliar', 'monitor', 'superadmin') then
    raise exception 'El rol debe ser auxiliar, monitor o superadmin';
  end if;

  select p.rol into v_actual
  from public.perfiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'Esa persona no tiene cuenta';
  end if;

  if v_actual is not distinct from v_rol then
    return;
  end if;

  update public.perfiles
  set rol = v_rol
  where id = p_user_id;

  perform public.audit_write(
    'asignar_rol',
    'perfiles',
    p_user_id,
    jsonb_build_object('rol', v_rol)
  );
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

  if not public.is_admin()
     and not exists (
       select 1
       from public.perfiles p
       where p.id = (select auth.uid())
         and p.rol in ('auxiliar', 'monitor', 'superadmin')
     ) then
    raise exception 'No tienes un rol asignado. Comunícate con el administrador.';
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

notify pgrst, 'reload schema';
