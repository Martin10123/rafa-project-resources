-- Follow-up Fase 2: lectura propia de admins + EXECUTE de helpers

drop policy if exists admins_select_own on public.admins;

create policy admins_select_own on public.admins
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.admins to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.sala_en_franja(uuid, timestamptz) to authenticated;
grant execute on function public.get_margen_gracia_minutos() to authenticated;
grant execute on function public.cerrar_registros_vencidos() to service_role;
