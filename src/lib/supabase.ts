import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function cleanEnv(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  return trimmed.length > 0 ? trimmed : undefined
}

const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL)
const anonKey = cleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

const urlLooksValid = Boolean(url && /^https?:\/\//i.test(url))

export const isSupabaseConfigured = Boolean(urlLooksValid && anonKey)

if (import.meta.env.DEV && url && !urlLooksValid) {
  console.error(
    '[supabase] VITE_SUPABASE_URL inválida. Debe empezar con http:// o https://. Valor recibido (truncado):',
    url.slice(0, 24),
  )
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE: el código del correo se cambia por la sesión en este navegador.
        // El enlace tiene que abrirse donde se pidió (el verificador no viaja en la URL).
        flowType: 'pkce',
      },
    })
  : null

/** URL de retorno tras abrir el enlace del correo */
export function authCallbackUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback'
  return `${window.location.origin}/auth/callback`
}
