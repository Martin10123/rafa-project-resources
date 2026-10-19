# Informe QA — Modo demo local (MVP)

**Fecha:** 2026-10-19  
**Proyecto:** educative-resources (Vue 3 + Vite + PrimeVue 4)  
**Entorno probado:** sin `VITE_SUPABASE_ANON_KEY` válida (modo demo activo; ver nota de `.env`).

## Resumen

| Verificación | Resultado |
|--------------|-----------|
| `pnpm run build` (vue-tsc + vite) | **PASS** |
| Servidor local (`vite preview` / `vite --port 5180`) | **PASS** |
| `/login` — formulario ancho completo y colores `#2c438f` / `#dc3545` | **PASS** |
| OTP demo — correo `@tecnocomfenalco.edu.co` + cualquier código → `/sala/demo?t=preview` | **PASS** |
| `/admin` — panel con salas mock | **PASS** (tras corrección de sesión demo) |
| `/admin/historial`, `/admin/salas`, `/admin/config`, `/admin/auditoria` | **PASS** |
| Sin banner «Invalid PrimeUI License» | **PASS** |

## Cómo revisar en local

1. Instalar dependencias: `pnpm install`
2. Para **modo demo**: deja sin definir ambas claves, o usa solo URL sin key. Para **Supabase real**: define `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Compilar: `pnpm run build`
4. Servir: `pnpm exec vite --port 5180` o `pnpm exec vite preview --port 5180 --host 127.0.0.1`
5. Flujo sugerido:
   - Abrir `http://127.0.0.1:5180/login`
   - Correo: `nombre@tecnocomfenalco.edu.co`
   - Código OTP: cualquier valor (p. ej. `123456`)
   - Completar nombre si es primer ingreso → redirección a `/sala/demo?t=preview`
   - Ir a **Ir al panel admin** o `/admin` (la sesión demo persiste en `sessionStorage` tras recargar)

## Correcciones aplicadas en esta QA

**Archivo:** `src/stores/auth.ts`

- En modo demo (sin Supabase), el usuario autenticado recibe rol **admin** para poder abrir `/admin` (antes quedaba bloqueado con «No tienes permisos de administrador»).
- Persistencia de sesión demo en `sessionStorage` para que un refresh o navegación directa a `/admin` no pierda la sesión en memoria (Pinia).

## Estado Supabase (actualizado)

Proyecto remoto configurado: migraciones aplicadas, 3 salas + horarios lun–sáb 07:00–22:00, Realtime en `registros`, `pg_cron` cada 5 min.

Pendiente operativo:

1. **OTP real** — En Dashboard → Authentication: Email OTP habilitado; Site URL = `http://127.0.0.1:5173` (dev).
2. **Seed de admins** — Tras el primer login: `select public.promote_admin_by_email('correo@tecnocomfenalco.edu.co');`
3. **Dominio** — Solo `@tecnocomfenalco.edu.co`.

## Notas

- PrimeVue 4 + `@primeuix/themes` (MIT): no se observó banner de licencia PrimeUI.
- Las rutas devuelven el shell SPA (`index.html`); la validación funcional requiere navegador (pruebas e2e ejecutadas con Playwright en la sesión de QA).
