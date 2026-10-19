-- Correo de Rafa como admin conocido, sin repetir la consulta en cada sesión del cliente.

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
  if v_domain is distinct from 'tecnocomfenalco.edu.co'
     and v_email is distinct from 'aux.audiovisual6@tecnologicocomfenalco.edu.co' then
    raise exception 'Solo se permiten correos @tecnocomfenalco.edu.co';
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

  return new;
end;
$$;

insert into public.admins (user_id)
select id
from public.perfiles
where lower(email) = 'aux.audiovisual6@tecnologicocomfenalco.edu.co'
on conflict (user_id) do nothing;
