-- El grant por defecto de Supabase deja EXECUTE a anon aunque se revoque PUBLIC.

revoke execute on function public.is_jefa() from anon;
revoke execute on function public.current_sede_id() from anon;
revoke execute on function public.promote_jefa_by_email(text) from anon;
revoke execute on function public.revoke_jefa_by_email(text) from anon;
revoke execute on function public.list_jefas() from anon;
