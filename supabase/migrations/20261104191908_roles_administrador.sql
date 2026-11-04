-- El administrador asigna auxiliar, monitor o superadmin.
-- Superadmin entra al panel. Este apartado no: solo existe fila en admins.

alter table public.perfiles
  add column if not exists rol text not null default 'monitor';

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('auxiliar', 'monitor', 'superadmin'));

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

  if new.rol is distinct from old.rol then
    if (select auth.uid()) is null
      or not exists (
        select 1 from public.admins a where a.user_id = (select auth.uid())
      ) then
      raise exception 'Solo un administrador puede cambiar roles';
    end if;

    if exists (select 1 from public.admins a where a.user_id = new.id) then
      raise exception 'El administrador conserva su acceso. Elige otra cuenta.';
    end if;

    if new.rol = 'superadmin' then
      insert into public.superadmins (user_id) values (new.id)
      on conflict (user_id) do nothing;
    else
      delete from public.superadmins where user_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

alter table public.perfiles disable trigger perfiles_before_update;

update public.perfiles p
set rol = 'superadmin'
where exists (
  select 1 from public.superadmins s where s.user_id = p.id
)
and p.rol is distinct from 'superadmin';

alter table public.perfiles enable trigger perfiles_before_update;

create or replace function public.listar_roles()
returns table (
  user_id uuid,
  email text,
  nombre text,
  rol text,
  es_administrador boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  ) then
    raise exception 'Solo un administrador puede ver los roles';
  end if;

  return query
  select
    p.id,
    p.email,
    p.nombre,
    p.rol,
    exists (select 1 from public.admins a where a.user_id = p.id)
  from public.perfiles p
  order by p.email;
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

  if v_actual is null then
    raise exception 'Esa persona no tiene cuenta';
  end if;

  if v_actual = v_rol then
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

revoke all on function public.listar_roles() from public, anon;
revoke all on function public.asignar_rol(uuid, text) from public, anon;
grant execute on function public.listar_roles() to authenticated;
grant execute on function public.asignar_rol(uuid, text) to authenticated;

notify pgrst, 'reload schema';
