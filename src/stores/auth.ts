import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authCallbackUrl, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Perfil } from '../types'

/** Dominio por defecto al escribir solo el usuario (sin @). */
export const ALLOWED_EMAIL_DOMAIN = 'tecnocomfenalco.edu.co'

/** Dominios institucionales permitidos. */
export const ALLOWED_EMAIL_DOMAINS = [
  'tecnocomfenalco.edu.co',
  'tecnologicocomfenalco.edu.co',
] as const

/** Admin Rafa (correo con dominio “tecnologico…”). */
export const RAFA_ADMIN_EMAIL = 'aux.audiovisual6@tecnologicocomfenalco.edu.co'

const DEMO_SESSION_STORAGE_KEY = 'educative-resources-demo-auth'
const MIN_PASSWORD_LENGTH = 8

type DemoSessionStored = { email: string; nombre: string | null }

export function isAllowedEmail(raw: string): boolean {
  const normalized = raw.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at <= 0) return false
  const domain = normalized.slice(at + 1)
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)
}

/** Acepta correo completo o usuario (ej. msimarras → msimarras@tecnocomfenalco.edu.co). */
export function resolveInstitutionalEmail(
  raw: string,
): { ok: true; email: string } | { ok: false; message: string } {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return { ok: false, message: 'Escribe tu usuario o correo' }
  }

  if (trimmed.includes('@')) {
    if (!isAllowedEmail(trimmed)) {
      return {
        ok: false,
        message:
          'Solo se permiten correos @tecnocomfenalco.edu.co o @tecnologicocomfenalco.edu.co',
      }
    }
    return { ok: true, email: trimmed }
  }

  if (!/^[a-z0-9._-]+$/i.test(trimmed)) {
    return {
      ok: false,
      message: 'Usuario inválido. Usa solo letras, números, punto, guion o guion bajo.',
    }
  }

  return { ok: true, email: `${trimmed}@${ALLOWED_EMAIL_DOMAIN}` }
}

function mapAuthError(message: string): string {
  const msg = message || 'Error de autenticación'
  if (/only request this after|rate limit|429/i.test(msg)) {
    return 'Espera unos segundos antes de pedir otro correo (límite de seguridad de Supabase).'
  }
  if (/invalid login credentials|invalid credentials/i.test(msg)) {
    return 'Usuario o contraseña incorrectos.'
  }
  if (/email not confirmed|not confirmed/i.test(msg)) {
    return 'Confirma tu correo con el enlace que te enviamos (solo una vez) y vuelve a entrar.'
  }
  if (/user already registered|already been registered/i.test(msg)) {
    return 'Ya tienes cuenta. Inicia sesión con tu contraseña o usa “Olvidé mi contraseña”.'
  }
  if (/password should be at least|weak password/i.test(msg)) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  return msg
}

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(null)
  const email = ref<string | null>(null)
  const perfil = ref<Perfil | null>(null)
  const isAdmin = ref(false)
  const ready = ref(false)
  const demoMode = ref(false)

  const isAuthenticated = computed(() => Boolean(userId.value))
  const usesSupabase = computed(() => isSupabaseConfigured)

  function clearSession() {
    userId.value = null
    email.value = null
    perfil.value = null
    isAdmin.value = false
    demoMode.value = false
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY)
    }
  }

  function persistDemoSession() {
    if (typeof sessionStorage === 'undefined' || !demoMode.value || !email.value) return
    const payload: DemoSessionStored = {
      email: email.value,
      nombre: perfil.value?.nombre ?? null,
    }
    sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(payload))
  }

  function restoreDemoSessionFromStorage(): boolean {
    if (typeof sessionStorage === 'undefined' || isSupabaseConfigured) return false
    const raw = sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY)
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw) as DemoSessionStored
      if (!isAllowedEmail(parsed.email)) return false
      setDemoSession(parsed.email)
      if (parsed.nombre?.trim() && perfil.value) {
        perfil.value = { ...perfil.value, nombre: parsed.nombre.trim() }
        persistDemoSession()
      }
      return true
    } catch {
      return false
    }
  }

  function setSession(payload: {
    userId: string
    email: string
    perfil?: Perfil | null
    isAdmin?: boolean
  }) {
    userId.value = payload.userId
    email.value = payload.email
    perfil.value = payload.perfil ?? null
    isAdmin.value = payload.isAdmin ?? false
    demoMode.value = false
  }

  function setDemoSession(userEmail: string) {
    const normalized = userEmail.trim().toLowerCase()
    demoMode.value = true
    userId.value = '00000000-0000-4000-8000-000000000001'
    email.value = normalized
    perfil.value = {
      id: userId.value,
      email: normalized,
      nombre: null,
    }
    isAdmin.value = !isSupabaseConfigured
    persistDemoSession()
  }

  async function loadPerfilAndAdmin(uid: string) {
    if (!supabase) return

    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, email, nombre')
      .eq('id', uid)
      .maybeSingle()

    if (perfilError) throw perfilError
    perfil.value = (perfilData as Perfil | null) ?? null

    isAdmin.value = false
    const { data: adminRow, error: adminError } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle()

    if (!adminError && adminRow) {
      isAdmin.value = true
      return
    }

    const { data: rpcAdmin, error: rpcError } = await supabase.rpc('is_admin')
    if (!rpcError && rpcAdmin === true) {
      isAdmin.value = true
    }
  }

  async function applySupabaseUser(uid: string, userEmail: string | undefined) {
    userId.value = uid
    email.value = userEmail?.toLowerCase() ?? null
    demoMode.value = false
    await loadPerfilAndAdmin(uid)
  }

  let listening = false

  async function syncSessionFromClient() {
    if (!supabase) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      await applySupabaseUser(session.user.id, session.user.email)
    } else if (!demoMode.value) {
      clearSession()
    }
  }

  async function init() {
    if (ready.value) return
    if (!supabase) {
      restoreDemoSessionFromStorage()
      ready.value = true
      return
    }

    await syncSessionFromClient()

    if (!listening) {
      listening = true
      supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) {
          await applySupabaseUser(nextSession.user.id, nextSession.user.email)
        } else if (!demoMode.value) {
          clearSession()
        }
      })
    }

    ready.value = true
  }

  async function signInWithPassword(
    identifier: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const resolved = resolveInstitutionalEmail(identifier)
    if (!resolved.ok) return resolved

    if (!password) {
      return { ok: false, message: 'Escribe tu contraseña' }
    }

    if (!supabase) {
      setDemoSession(resolved.email)
      return { ok: true }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password,
    })

    if (error) {
      return { ok: false, message: mapAuthError(error.message) }
    }

    if (data.user) {
      await applySupabaseUser(data.user.id, data.user.email)
    }

    return { ok: true }
  }

  /**
   * Registro: un solo correo de confirmación.
   * Después el usuario entra solo con usuario/correo + contraseña.
   */
  async function signUpWithPassword(
    identifier: string,
    password: string,
    passwordConfirm: string,
    nombre?: string,
  ): Promise<
    | { ok: true; needsEmailConfirmation: boolean }
    | { ok: false; message: string }
  > {
    const resolved = resolveInstitutionalEmail(identifier)
    if (!resolved.ok) return resolved

    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      }
    }
    if (password !== passwordConfirm) {
      return { ok: false, message: 'Las contraseñas no coinciden' }
    }

    if (!supabase) {
      setDemoSession(resolved.email)
      if (nombre?.trim() && perfil.value) {
        perfil.value = { ...perfil.value, nombre: nombre.trim() }
        persistDemoSession()
      }
      return { ok: true, needsEmailConfirmation: false }
    }

    const { data, error } = await supabase.auth.signUp({
      email: resolved.email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(),
        data: nombre?.trim() ? { nombre: nombre.trim() } : undefined,
      },
    })

    if (error) {
      return { ok: false, message: mapAuthError(error.message) }
    }

    // Supabase a veces “registra” sin error si el correo ya existe
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        message: 'Ya tienes cuenta. Inicia sesión o usa “Olvidé mi contraseña”.',
      }
    }

    if (data.session?.user) {
      await applySupabaseUser(data.session.user.id, data.session.user.email)
      return { ok: true, needsEmailConfirmation: false }
    }

    return { ok: true, needsEmailConfirmation: true }
  }

  async function requestPasswordReset(
    identifier: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const resolved = resolveInstitutionalEmail(identifier)
    if (!resolved.ok) return resolved

    if (!supabase) {
      return { ok: true }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resolved.email, {
      redirectTo: `${authCallbackUrl()}?reset=1`,
    })

    if (error) {
      return { ok: false, message: mapAuthError(error.message) }
    }

    return { ok: true }
  }

  async function updatePassword(
    password: string,
    passwordConfirm: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      }
    }
    if (password !== passwordConfirm) {
      return { ok: false, message: 'Las contraseñas no coinciden' }
    }

    if (!supabase) {
      return { ok: true }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return { ok: false, message: mapAuthError(error.message) }
    }

    return { ok: true }
  }

  /** Completa sesión si el usuario pegó el enlace de confirmación / recuperación. */
  async function completeFromMagicLinkUrl(
    rawUrl: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!supabase) {
      return { ok: false, message: 'Supabase no configurado' }
    }

    let parsed: URL
    try {
      parsed = new URL(rawUrl.trim())
    } catch {
      return { ok: false, message: 'Pega el enlace completo del correo' }
    }

    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) return { ok: false, message: mapAuthError(error.message) }
      if (data.user) await applySupabaseUser(data.user.id, data.user.email)
      return { ok: true }
    }

    const token =
      parsed.searchParams.get('token') ||
      parsed.searchParams.get('token_hash') ||
      hashParams.get('token_hash')
    const typeRaw = parsed.searchParams.get('type') || hashParams.get('type') || 'email'
    const type =
      typeRaw === 'magiclink' || typeRaw === 'signup' || typeRaw === 'recovery'
        ? typeRaw
        : 'email'

    if (token && parsed.pathname.includes('/verify')) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as 'email' | 'magiclink' | 'signup' | 'recovery',
      })
      if (error) {
        return { ok: false, message: mapAuthError(error.message) }
      }
      if (data.user) await applySupabaseUser(data.user.id, data.user.email)
      return { ok: true }
    }

    if (token) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as 'email' | 'magiclink' | 'signup' | 'recovery',
      })
      if (error) return { ok: false, message: mapAuthError(error.message) }
      if (data.user) await applySupabaseUser(data.user.id, data.user.email)
      return { ok: true }
    }

    return {
      ok: false,
      message:
        'Enlace incompleto. Ábrelo en este Chrome o copia la URL completa tras hacer clic.',
    }
  }

  async function updateNombre(nombre: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const trimmed = nombre.trim()
    if (trimmed.length < 2) {
      return { ok: false, message: 'Escribe tu nombre completo' }
    }

    if (demoMode.value || !supabase) {
      if (perfil.value) {
        perfil.value = { ...perfil.value, nombre: trimmed }
      }
      persistDemoSession()
      return { ok: true }
    }

    if (!userId.value) {
      return { ok: false, message: 'No hay sesión activa' }
    }

    const { data, error } = await supabase
      .from('perfiles')
      .update({ nombre: trimmed })
      .eq('id', userId.value)
      .select('id, email, nombre')
      .single()

    if (error) {
      return { ok: false, message: error.message }
    }

    perfil.value = data as Perfil
    return { ok: true }
  }

  async function signOut() {
    if (supabase && !demoMode.value) {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // Igual limpiamos sesión local
      }
    }
    clearSession()
  }

  return {
    userId,
    email,
    perfil,
    isAdmin,
    ready,
    demoMode,
    usesSupabase,
    isAuthenticated,
    setSession,
    clearSession,
    init,
    syncSessionFromClient,
    signInWithPassword,
    signUpWithPassword,
    requestPasswordReset,
    updatePassword,
    completeFromMagicLinkUrl,
    updateNombre,
    signOut,
  }
})
