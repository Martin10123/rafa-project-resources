import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authCallbackUrl, isSupabaseConfigured, supabase } from '../lib/supabase'
import { limpiarActividad, marcarActividad, sesionInactiva } from '../lib/sessionIdle'
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

type DemoSessionStored = { email: string; nombre: string | null; sedeId?: string | null }

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
  const isSuperadmin = ref(false)
  const isJefa = ref(false)
  const ready = ref(false)
  const demoMode = ref(false)

  const isAuthenticated = computed(() => Boolean(userId.value))
  const usesSupabase = computed(() => isSupabaseConfigured)
  let ultimoMarcado = 0
  /** Sube en cada login o salida para ignorar cargas que terminan tarde. */
  let generacion = 0
  /** Tras Salir, un refresh o otra pestaña no puede volver a abrir la sesión. */
  let sesionCerrada = false

  function sesionVigente(epoch: number) {
    return epoch === generacion && !sesionCerrada
  }

  function aceptarNuevaSesion() {
    generacion += 1
    sesionCerrada = false
  }

  function borrarTokenSupabase() {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key?.startsWith('sb-') && key.includes('auth-token')) keys.push(key)
      }
      for (const key of keys) localStorage.removeItem(key)
    } catch {
      /* modo privado */
    }
  }

  function registrarActividad() {
    if (!userId.value || demoMode.value) return
    const now = Date.now()
    if (now - ultimoMarcado < 60_000) return
    ultimoMarcado = now
    marcarActividad(now)
  }

  async function expireIfIdle(): Promise<boolean> {
    if (!ready.value || !supabase || demoMode.value || !userId.value) return false
    if (!sesionInactiva()) return false
    await signOut()
    return true
  }

  function clearSession() {
    userId.value = null
    email.value = null
    perfil.value = null
    isAdmin.value = false
    isSuperadmin.value = false
    isJefa.value = false
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
      sedeId: perfil.value?.sede_id ?? null,
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
      if (perfil.value && (parsed.nombre?.trim() || parsed.sedeId)) {
        perfil.value = {
          ...perfil.value,
          nombre: parsed.nombre?.trim() || perfil.value.nombre,
          sede_id: parsed.sedeId ?? null,
        }
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
    isSuperadmin.value = false
    isJefa.value = false
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
      sede_id: null,
    }
    isAdmin.value = !isSupabaseConfigured
    isSuperadmin.value = false
    isJefa.value = false
    persistDemoSession()
  }

  async function loadPerfilAndAdmin(uid: string, epoch: number) {
    if (!supabase || !sesionVigente(epoch)) return

    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, email, nombre, sede_id')
      .eq('id', uid)
      .maybeSingle()

    if (!sesionVigente(epoch)) return
    if (perfilError) throw perfilError
    perfil.value = (perfilData as Perfil | null) ?? null

    let nextAdmin = false
    let nextSuperadmin = false
    let nextJefa = false

    const { data: superRow, error: superError } = await supabase
      .from('superadmins')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle()

    if (!sesionVigente(epoch)) return
    if (!superError && superRow) {
      nextSuperadmin = true
      nextAdmin = true
    }

    const { data: adminRow, error: adminError } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle()

    if (!sesionVigente(epoch)) return
    if (!adminError && adminRow) {
      nextAdmin = true
    } else if (!nextAdmin) {
      const { data: rpcAdmin, error: rpcError } = await supabase.rpc('is_admin')
      if (!rpcError && rpcAdmin === true) nextAdmin = true
    }

    if (!sesionVigente(epoch)) return
    if (!nextAdmin) {
      const { data: jefaRow, error: jefaError } = await supabase
        .from('jefas')
        .select('user_id')
        .eq('user_id', uid)
        .maybeSingle()

      if (!jefaError && jefaRow) {
        nextJefa = true
      } else {
        const { data: rpcJefa, error: rpcJefaError } = await supabase.rpc('is_jefa')
        if (!sesionVigente(epoch)) return
        if (!rpcJefaError && rpcJefa === true) nextJefa = true
      }
    }

    if (!sesionVigente(epoch)) return
    isSuperadmin.value = nextSuperadmin
    isAdmin.value = nextAdmin
    isJefa.value = nextJefa
  }

  async function applySupabaseUser(uid: string, userEmail: string | undefined) {
    const epoch = generacion
    if (!sesionVigente(epoch)) return
    try {
      await loadPerfilAndAdmin(uid, epoch)
    } catch (error) {
      if (!sesionVigente(epoch)) return
      throw error
    }
    if (!sesionVigente(epoch)) return
    userId.value = uid
    email.value = userEmail?.toLowerCase() ?? null
    demoMode.value = false
  }

  let listening = false

  async function syncSessionFromClient() {
    if (!supabase) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) {
      if (sesionInactiva(session.user.last_sign_in_at)) {
        await signOut()
        return
      }
      await applySupabaseUser(session.user.id, session.user.email)
      ultimoMarcado = Date.now()
      marcarActividad(ultimoMarcado)
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
      supabase.auth.onAuthStateChange((event, nextSession) => {
        const epoch = generacion
        if (!sesionVigente(epoch)) {
          if (nextSession?.user) borrarTokenSupabase()
          return
        }
        if (event === 'TOKEN_REFRESHED') return
        const uid = nextSession?.user?.id
        const mail = nextSession?.user?.email
        if (!uid) {
          if (!demoMode.value) clearSession()
          return
        }
        queueMicrotask(() => {
          if (!sesionVigente(epoch)) return
          void applySupabaseUser(uid, mail)
        })
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

    aceptarNuevaSesion()
    const epoch = generacion
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password,
    })
    if (!sesionVigente(epoch)) {
      if (sesionCerrada) borrarTokenSupabase()
      return { ok: false, message: 'Vuelve a intentar.' }
    }

    if (error) {
      return { ok: false, message: mapAuthError(error.message) }
    }

    if (data.user) {
      await applySupabaseUser(data.user.id, data.user.email)
      ultimoMarcado = Date.now()
      marcarActividad(ultimoMarcado)
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

    aceptarNuevaSesion()
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
      ultimoMarcado = Date.now()
      marcarActividad(ultimoMarcado)
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
      aceptarNuevaSesion()
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) return { ok: false, message: mapAuthError(error.message) }
      if (data.user) {
        await applySupabaseUser(data.user.id, data.user.email)
        ultimoMarcado = Date.now()
        marcarActividad(ultimoMarcado)
      }
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
      aceptarNuevaSesion()
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as 'email' | 'magiclink' | 'signup' | 'recovery',
      })
      if (error) {
        return { ok: false, message: mapAuthError(error.message) }
      }
      if (data.user) {
        await applySupabaseUser(data.user.id, data.user.email)
        ultimoMarcado = Date.now()
        marcarActividad(ultimoMarcado)
      }
      return { ok: true }
    }

    if (token) {
      aceptarNuevaSesion()
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as 'email' | 'magiclink' | 'signup' | 'recovery',
      })
      if (error) return { ok: false, message: mapAuthError(error.message) }
      if (data.user) {
        await applySupabaseUser(data.user.id, data.user.email)
        ultimoMarcado = Date.now()
        marcarActividad(ultimoMarcado)
      }
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
      .select('id, email, nombre, sede_id')
      .single()

    if (error) {
      return { ok: false, message: error.message }
    }

    perfil.value = data as Perfil
    return { ok: true }
  }

  async function updateSede(
    sedeId: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!sedeId) return { ok: false, message: 'Elige una sede' }

    if (demoMode.value || !supabase) {
      if (perfil.value) perfil.value = { ...perfil.value, sede_id: sedeId }
      persistDemoSession()
      return { ok: true }
    }

    if (!userId.value) return { ok: false, message: 'No hay sesión activa' }

    const { data, error } = await supabase
      .from('perfiles')
      .update({ sede_id: sedeId })
      .eq('id', userId.value)
      .select('id, email, nombre, sede_id')
      .single()

    if (error) return { ok: false, message: error.message }

    perfil.value = data as Perfil
    return { ok: true }
  }

  async function signOut() {
    const epoch = ++generacion
    const eraDemo = demoMode.value
    sesionCerrada = true
    clearSession()
    limpiarActividad()
    ultimoMarcado = 0
    borrarTokenSupabase()
    if (!supabase || eraDemo) return
    void supabase.auth.signOut({ scope: 'local' }).then(
      () => {
        if (epoch === generacion) borrarTokenSupabase()
      },
      () => {
        if (epoch === generacion) borrarTokenSupabase()
      },
    )
  }

  return {
    userId,
    email,
    perfil,
    isAdmin,
    isSuperadmin,
    isJefa,
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
    updateSede,
    signOut,
    registrarActividad,
    expireIfIdle,
  }
})
