-- El check-out es un UPDATE. Sin réplica completa, Realtime no puede evaluar
-- la política RLS (usa usuario_id) y descarta el evento. El panel no se entera.

alter table public.registros replica identity full;
