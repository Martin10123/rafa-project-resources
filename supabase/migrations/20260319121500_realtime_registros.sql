-- Publicar registros en Realtime para el panel admin en vivo

do $$
begin
  alter publication supabase_realtime add table public.registros;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publicacion supabase_realtime no disponible; habilitar Realtime en el Dashboard.';
end;
$$;
