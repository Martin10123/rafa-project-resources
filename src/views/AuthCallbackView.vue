<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import ProgressSpinner from 'primevue/progressspinner'
import { resolvePostLoginPath } from '../lib/postLogin'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const status = ref('Confirmando cuenta…')

function postLoginPath() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  return resolvePostLoginPath(auth.isAdmin, redirect)
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
    await router.replace(postLoginPath())
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
  <div class="relative flex min-h-svh flex-col items-center justify-center gap-4 bg-[#e7eef8] px-6 font-display text-navy">
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute top-0 right-0 h-72 w-72 rounded-full bg-navy/15 blur-3xl" />
      <div class="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-red/10 blur-3xl" />
    </div>
    <div class="glass-panel relative z-10 flex w-full max-w-sm flex-col items-center gap-4 px-6 py-8 text-center">
      <ProgressSpinner style="width: 3rem; height: 3rem" stroke-width="4" />
      <p class="m-0 text-base font-semibold tracking-tight">{{ status }}</p>
    </div>
  </div>
</template>
