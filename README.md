# Check-in Salas — Tecnológico Comfenalco

Aplicación web (Vue 3 + Vite + PrimeVue) para check-in / check-out de salas de sistemas.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Copia `.env.example` a `.env.local` y completa las claves de Supabase.

## Deploy en Vercel

1. Conecta el repo en Vercel (framework **Vite**, output `dist`).
2. Configura variables de entorno (Production + Preview):

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publishable / anon |
| `VITE_APP_URL` | URL pública de Vercel (p. ej. `https://tu-app.vercel.app`) |

3. En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: la misma `VITE_APP_URL`
   - **Redirect URLs**: `https://tu-app.vercel.app/auth/callback` (y la de preview si aplica)

El archivo `vercel.json` ya define build con pnpm y rewrites SPA para Vue Router.

## Stack

- Vue 3 + TypeScript + Vite
- PrimeVue 4 (MIT, tema institucional Comfenalco; sin licencia PrimeUI)
- Pinia + Vue Router
- Supabase (Auth email+password, Postgres, RLS, Realtime)

## Rutas

| Ruta | Uso |
|------|-----|
| `/login` | Usuario/correo + contraseña (confirmación por correo solo al registrarse) |
| `/inicio` | Usuario normal: espera e instrucciones para escanear QR |
| `/sala/:id?t=TOKEN` | Check-in / check-out (solo vía QR de la puerta) |
| `/admin` | Panel (solo admins) |

## Base de datos

Migración MVP: `supabase/migrations/20260319120000_mvp_schema.sql`
