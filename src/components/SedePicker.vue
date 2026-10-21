<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadSedes } from '../lib/sedes'
import { useAuthStore } from '../stores/auth'
import type { Sede } from '../types'

defineProps<{ cancelable?: boolean; bare?: boolean }>()

const emit = defineEmits<{ saved: []; cancel: [] }>()

const auth = useAuthStore()
const sedes = ref<Sede[]>([])
const loading = ref(true)
const savingId = ref<string | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    sedes.value = await loadSedes()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudieron cargar las sedes'
  } finally {
    loading.value = false
  }
})

async function elegir(id: string) {
  if (savingId.value) return
  savingId.value = id
  error.value = null
  const result = await auth.updateSede(id)
  savingId.value = null
  if (!result.ok) {
    error.value = result.message
    return
  }
  emit('saved')
}
</script>

<template>
  <div :class="bare ? '' : 'glass-panel p-5 sm:p-6'">
    <p class="m-0 text-[0.72rem] font-bold tracking-[0.14em] text-[#9f1239] uppercase">Tu sede</p>
    <h2 class="m-0 mt-2 text-2xl font-extrabold tracking-tight text-navy">¿A qué sede perteneces?</h2>
    <p class="mt-2 mb-0 text-sm leading-relaxed text-slate-600">
      Solo verás y podrás registrar las salas de esa sede. Las de las otras sedes no aparecen.
    </p>

    <p v-if="loading" class="mt-4 mb-0 text-sm text-slate-600">Cargando sedes…</p>
    <div v-else class="mt-4 flex flex-col gap-2">
      <button
        v-for="sede in sedes"
        :key="sede.id"
        type="button"
        class="min-h-12 rounded-xl border px-4 text-left text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 disabled:cursor-wait disabled:opacity-70"
        :class="
          auth.perfil?.sede_id === sede.id
            ? 'border-navy bg-navy text-white'
            : 'border-slate-200 bg-white text-navy hover:border-navy/40'
        "
        :disabled="Boolean(savingId)"
        @click="elegir(sede.id)"
      >
        {{ savingId === sede.id ? 'Guardando…' : sede.nombre }}
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-3 mb-0 text-sm text-red-800">{{ error }}</p>

    <button
      v-if="cancelable"
      type="button"
      class="mt-4 text-sm font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
      @click="emit('cancel')"
    >
      Cancelar
    </button>
  </div>
</template>
