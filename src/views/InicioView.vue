<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import AppLayout from '../layouts/AppLayout.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function signOut() {
  await auth.signOut()
  await router.replace('/login')
}

onMounted(async () => {
  await auth.init()
  if (!auth.isAuthenticated) {
    await router.replace('/login')
    return
  }
  if (auth.isAdmin) {
    await router.replace('/admin')
  }
})
</script>

<template>
  <AppLayout>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-5 py-2">
      <div>
        <p class="m-0 text-[0.72rem] font-bold tracking-[0.14em] text-[#9f1239] uppercase">
          Sesión activa
        </p>
        <h1 class="m-0 mt-2 text-3xl font-extrabold tracking-tight text-navy">Listo para check-in</h1>
        <p class="mt-2 mb-0 text-slate-600">
          Hola{{ auth.perfil?.nombre ? `, ${auth.perfil.nombre}` : '' }}. Sesión iniciada como
          <strong class="text-navy">{{ auth.email }}</strong>.
        </p>
      </div>

      <div class="glass-panel p-5 sm:p-6">
        <p class="m-0 text-base leading-relaxed text-slate-800">
          Para registrar entrada o salida, <strong>escanea el código QR</strong> pegado en la puerta
          de la sala. Esa es la única forma de abrir el check-in correcto.
        </p>
        <p class="mt-3 mb-0 text-sm leading-relaxed text-slate-600">
          No uses un enlace de otra sala ni intentes entrar al panel de administración: solo los
          admins tienen acceso ahí.
        </p>
      </div>

      <Button
        type="button"
        label="Cerrar sesión"
        icon="pi pi-sign-out"
        severity="secondary"
        outlined
        @click="signOut"
      />
    </div>
  </AppLayout>
</template>
