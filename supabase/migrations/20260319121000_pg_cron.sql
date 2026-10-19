-- ---------------------------------------------------------------------------
-- pg_cron: cierre automático de registros vencidos (cada 5 minutos)
-- ---------------------------------------------------------------------------
-- Requiere la extensión pg_cron en el proyecto Supabase (Dashboard → Database → Extensions).
-- En local o sin pg_cron, el bloque DO emite NOTICE y no falla la migración.

-- create extension if not exists pg_cron with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no está habilitada. Habilite la extensión y ejecute manualmente: '
      'select cron.schedule(''cerrar-registros-vencidos'', ''*/5 * * * *'', $$select public.cerrar_registros_vencidos();$$);';
    return;
  end if;

  select jobid
  into v_job_id
  from cron.job
  where jobname = 'cerrar-registros-vencidos'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'cerrar-registros-vencidos',
    '*/5 * * * *',
    $$select public.cerrar_registros_vencidos();$$
  );
exception
  when undefined_table or undefined_function then
    raise notice 'pg_cron no disponible (esquema cron inexistente). Programe el job cuando habilite la extensión.';
end;
$$;
