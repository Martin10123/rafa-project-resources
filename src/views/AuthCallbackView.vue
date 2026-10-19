<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import ProgressSpinner from 'primevue/progressspinner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const status = ref('Confirmando cuenta…')

async function resolvePostLoginPath(): Promise<string> {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  if (redirect?.startsWith('/')) return redirect
  if (auth.isAdmin) return '/admin'
  if (!supabase) return '/login'

  const { data } = await supabase
    .from('salas')
    .select('id, token_qr')
    .eq('activa', true)
    .order('nombre')
    .limit(1)
    .maybeSingle()

  if (data?.id && data.token_qr) {
    return `/sala/${data.id}?t=${encodeURIComponent(data.token_qr)}`
  }
  return '/admin'
}

onMounted(async () => {
  try {
    if (!supabase) {
      await router.replace('/login')
      return
    }

    status.value = 'Validando enlace…'
    await auth.init()

    const errDesc =
      typeof route.query.error_description === 'string'
        ? route.query.error_description
        : typeof route.query.error === 'string'
          ? route.query.error
          : null
    if (errDesc) {
      throw new Error(decodeURIComponent(errDesc.replace(/\+/g, ' ')))
    }

    // Implicit flow: #access_token=...&refresh_token=...&type=signup|recovery
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const hashType = hash.get('type')
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      if (error) throw error
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    }

    // Esperar a que detectSessionInUrl / setSession dejen sesión
    for (let i = 0; i < 25 && !auth.isAuthenticated; i++) {
      await auth.syncSessionFromClient()
      if (auth.isAuthenticated) break
      await new Promise((r) => setTimeout(r, 120))
    }

    if (!auth.isAuthenticated) {
      throw new Error(
        'No se pudo confirmar. Abre el enlace en este mismo Chrome o pégalo en el login.',
      )
    }

    const isReset = route.query.reset === '1' || hashType === 'recovery'

    if (isReset) {
      status.value = 'Define tu contraseña…'
      await router.replace({ name: 'login', query: { reset: '1' } })
      return
    }

    if (!auth.perfil?.nombre?.trim()) {
      await router.replace({ name: 'login', query: { complete: '1' } })
      return
    }

    status.value = 'Cuenta confirmada. Redirigiendo…'
    await router.replace(await resolvePostLoginPath())
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al confirmar el enlace'
    const friendly = /PKCE|code verifier/i.test(message)
      ? 'El enlace se abrió en otro contexto. Ábrelo en este Chrome o pégalo en el login.'
      : message
    toast.add({ severity: 'error', summary: 'Enlace inválido', detail: friendly, life: 8000 })
    await router.replace('/login')
  }
})
</script>

<template>
  <div class="callback">
    <ProgressSpinner style="width: 3rem; height: 3rem" stroke-width="4" />
    <p>{{ status }}</p>
  </div>
</template>

<style scoped>
.callback {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: #eef0f4;
  color: #1a2744;
  font-weight: 600;
}
</style>
