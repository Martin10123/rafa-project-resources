# Check-in Salas — Tecnológico Comfenalco

Aplicación web (Vue 3 + Vite + PrimeVue) para check-in / check-out de salas de sistemas.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Copia `.env.example` a `.env` y completa las claves de Supabase cuando las tengas.

## Stack

- Vue 3 + TypeScript + Vite
- PrimeVue 4 (MIT, tema institucional Comfenalco; sin licencia PrimeUI)
- Pinia + Vue Router
- Supabase (Auth email+password, Postgres, RLS, Realtime)

## Rutas

| Ruta | Uso |
|------|-----|
| `/login` | Usuario/correo + contraseña (confirmación por correo solo al registrarse) |
| `/sala/:id?t=TOKEN` | Check-in / check-out |
| `/admin` | Panel (solo 2 admins) |

## Base de datos

Migración MVP: `supabase/migrations/20260319120000_mvp_schema.sql`
