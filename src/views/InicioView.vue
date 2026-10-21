<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import AppLayout from '../layouts/AppLayout.vue'
import SedePicker from '../components/SedePicker.vue'
import { loadSedes } from '../lib/sedes'
import { useAuthStore } from '../stores/auth'
import type { Sede } from '../types'

const router = useRouter()
const auth = useAuthStore()
const sedes = ref<Sede[]>([])
const cambiandoSede = ref(false)

const miSede = computed(
  () => sedes.value.find((sede) => sede.id === auth.perfil?.sede_id) ?? null,
)

async function signOut() {
  await auth.signOut()
  await router.replace('/login')
}

async function cargarSedes() {
  sedes.value = await loadSedes()
}

function redirigirStaff() {
  if (auth.isAdmin) return router.replace('/admin')
  if (auth.isJefa) return router.replace('/admin/historial')
  return null
}

onMounted(async () => {
  await auth.init()
  if (!auth.isAuthenticated) {
    await router.replace('/login')
    return
  }
  if (auth.isAdmin || auth.isJefa) {
    await redirigirStaff()
    return
  }
  try {
    await cargarSedes()
  } catch {
    sedes.value = []
  }
})

watch(
  () => auth.isAdmin || auth.isJefa,
  (esStaff) => {
    if (esStaff && auth.isAuthenticated) void redirigirStaff()
  },
)

async function onSedeSaved() {
  cambiandoSede.value = false
  await cargarSedes()
}
</script>

<template>
  <AppLayout>
    <div class="mx-auto flex w-full max-w-lg flex-col gap-5 py-2">
      <SedePicker
        v-if="!miSede || cambiandoSede"
        :cancelable="Boolean(miSede)"
        @saved="onSedeSaved"
        @cancel="cambiandoSede = false"
      />

      <template v-else>
        <div>
          <p class="m-0 text-[0.72rem] font-bold tracking-[0.14em] text-[#9f1239] uppercase">
            Sesión activa · {{ miSede.nombre }}
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
            de la sala. Solo funcionan las salas de <strong>{{ miSede.nombre }}</strong>.
          </p>
          <p class="mt-3 mb-0 text-sm leading-relaxed text-slate-600">
            Un QR de otra sede no abre el check-in. Si la sede no es la tuya, cámbiala antes de
            escanear.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            label="Cambiar sede"
            icon="pi pi-map-marker"
            severity="secondary"
            outlined
            @click="cambiandoSede = true"
          />
          <Button
            type="button"
            label="Cerrar sesión"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            @click="signOut"
          />
        </div>
      </template>
    </div>
  </AppLayout>
</template>
