// Edge Function: check-in seguro (JWT, dominio institucional, rate limit)
// Despliegue: supabase functions deploy checkin --no-verify-jwt (validamos JWT aquí)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Dominio permitido (debe coincidir con trigger en perfiles). */
const ALLOWED_EMAIL_DOMAIN = Deno.env.get('ALLOWED_EMAIL_DOMAIN') ?? 'tecnocomfenalco.edu.co'
const RAFA_ADMIN_EMAIL = 'aux.audiovisual6@tecnologicocomfenalco.edu.co'

/** Upstash Redis REST (opcional — stub si faltan claves). */
const UPSTASH_REDIS_REST_URL = Deno.env.get('UPSTASH_REDIS_REST_URL')
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

type CheckinBody = {
  sala_id?: string
  motivo?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice('Bearer '.length).trim()
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return ''
  return email.slice(at + 1).toLowerCase()
}

/**
 * Hook de rate limit con Upstash (REST).
 * Si no hay UPSTASH_* configurado, devuelve allowed: true (stub documentado).
 */
async function checkRateLimit(key: string, limit = 30, windowSec = 60): Promise<{ allowed: boolean; remaining?: number }> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    // TODO: configurar Upstash y usar INCR + EXPIRE o @upstash/ratelimit en Deno
    return { allowed: true }
  }

  const url = `${UPSTASH_REDIS_REST_URL}/pipeline`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSec],
    ]),
  })

  if (!res.ok) {
    console.error('Upstash rate limit error', await res.text())
    return { allowed: true }
  }

  const data = (await res.json()) as { result?: number }[]
  const count = Number(data?.[0]?.result ?? 0)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Configuración del servidor incompleta' }, 500)
  }

  const jwt = extractBearerToken(req)
  if (!jwt) {
    return jsonResponse({ error: 'Token JWT requerido' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'JWT inválido o expirado' }, 401)
  }

  const email = (userData.user.email ?? '').toLowerCase()
  const domain = emailDomain(email)
  if (email !== RAFA_ADMIN_EMAIL && domain !== ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
    return jsonResponse({ error: `Solo correos @${ALLOWED_EMAIL_DOMAIN}` }, 403)
  }

  const rate = await checkRateLimit(`checkin:${userData.user.id}`)
  if (!rate.allowed) {
    return jsonResponse({ error: 'Demasiadas solicitudes; intente más tarde' }, 429)
  }

  let body: CheckinBody
  try {
    body = (await req.json()) as CheckinBody
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  if (!body.sala_id?.trim()) {
    return jsonResponse({ error: 'sala_id es obligatorio' }, 400)
  }

  // Punto de extensión: insertar/actualizar registro vía RPC o tabla con RLS
  return jsonResponse({
    ok: true,
    user_id: userData.user.id,
    sala_id: body.sala_id,
    motivo: body.motivo ?? null,
    rate_remaining: rate.remaining,
  })
})
