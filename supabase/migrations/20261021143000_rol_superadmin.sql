-- Superadmin: mismo acceso que un administrador, un escalón arriba.
-- El correo fijo no se asigna desde Configuración.

create table if not exists public.superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.superadmins enable row level security;

drop policy if exists superadmins_select_own on public.superadmins;
create policy superadmins_select_own on public.superadmins
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.superadmins from public, anon;
grant select on table public.superadmins to authenticated;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.superadmins s where s.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_superadmin() from public;
revoke execute on function public.is_superadmin() from anon;
grant execute on function public.is_superadmin() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.superadmins s where s.user_id = (select auth.uid())
  );
$$;

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

  if v_email in (
    'aux.audiovisual6@tecnologicocomfenalco.edu.co',
    'rafaelpolo@tecnocomfenalco.edu.co',
    'msimarras@tecnocomfenalco.edu.co'
  ) then
    insert into public.admins (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  if v_email = 'admin@tecnologicocomfenalco.edu.co' then
    insert into public.superadmins (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

delete from public.jefas
where user_id in (
  select id from auth.users
  where lower(email) = 'admin@tecnologicocomfenalco.edu.co'
);

insert into public.superadmins (user_id)
select id
from auth.users
where lower(email) = 'admin@tecnologicocomfenalco.edu.co'
on conflict (user_id) do nothing;
