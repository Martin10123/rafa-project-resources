-- La jefa queda fija por correo. No se asigna desde Configuración.
-- Índice para el listado de historial ordenado por entrada.

create index if not exists registros_entrada_idx on public.registros (entrada desc);

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
    insert into public.jefas (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

insert into public.jefas (user_id)
select id
from auth.users
where lower(email) = 'admin@tecnologicocomfenalco.edu.co'
on conflict (user_id) do nothing;
