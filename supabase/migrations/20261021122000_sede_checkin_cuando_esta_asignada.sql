-- La separación por sede empieza cuando la sala ya tiene sede.
-- Las salas sin clasificar siguen visibles y permiten check-in.

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

drop policy if exists salas_select_auth on public.salas;
create policy salas_select_auth on public.salas
  for select to authenticated
  using (
    public.is_admin()
    or public.is_jefa()
    or sede_id is null
    or sede_id = public.current_sede_id()
  );
