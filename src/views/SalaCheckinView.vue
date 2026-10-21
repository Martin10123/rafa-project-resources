<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Textarea from 'primevue/textarea'
import AppLayout from '../layouts/AppLayout.vue'
import SedePicker from '../components/SedePicker.vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Registro, Sala } from '../types'

type SalaAbierta = {
  id: string
  nombre: string
  ubicacion: string | null
  activa: boolean
  sede_id: string | null
  sede_nombre: string | null
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const motivo = ref('')
const sala = ref<Sala | null>(null)
const registroAbierto = ref<Registro | null>(null)
const historial = ref<Registro[]>([])
const pageLoading = ref(true)
const actionLoading = ref(false)
const pageError = ref<string | null>(null)
const sedeDeSala = ref<string | null>(null)
const now = ref(Date.now())
let salaChannel: RealtimeChannel | null = null
let clock: ReturnType<typeof setInterval> | null = null

const salaId = computed(() => String(route.params.id ?? ''))
const token = computed(() => String(route.query.t ?? ''))

const checkedIn = computed(() => Boolean(registroAbierto.value))
const needsSede = computed(() => !auth.isAdmin && !auth.perfil?.sede_id)
const motivosRecientes = computed(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const row of historial.value) {
    const text = row.motivo.trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    list.push(text)
    if (list.length === 4) break
  }
  return list
})

const demoSala: Sala = {
  id: 'demo',
  nombre: 'Sala de Sistemas (demo)',
  ubicacion: 'Campus — vista previa',
  token_qr: 'preview',
  activa: true,
  sede_id: null,
}

function mapRegistroError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('franja horaria')) {
    return 'No puedes hacer check-in fuera del horario permitido de esta sala.'
  }
  if (lower.includes('duplicate key') || lower.includes('uq_registro_abierto')) {
    return 'Ya tienes un check-in abierto en esta sala. Haz check-out primero.'
  }
  if (lower.includes('inactiva') || lower.includes('inexistente')) {
    return 'Esta sala no está disponible.'
  }
  if (lower.includes('no pertenece a tu sede')) {
    return 'Esta sala es de otra sede. No puedes registrarte aquí.'
  }
  if (lower.includes('selecciona tu sede')) {
    return 'Primero elige la sede a la que perteneces.'
  }
  if (lower.includes('no coincide')) {
    return 'El QR no coincide con esta sala. Escanea el código actualizado.'
  }
  if (lower.includes('no tiene sede asignada')) {
    return 'Esta sala todavía no tiene sede. Avisa a quien administra las salas.'
  }
  return message
}

async function loadOpenRegistro(sid: string) {
  if (!auth.userId) return
  if (auth.demoMode || !supabase) {
    registroAbierto.value = null
    return
  }

  const { data, error } = await supabase
    .from('registros')
    .select('id, sala_id, usuario_id, motivo, entrada, salida, tipo_cierre, cerrado_por')
    .eq('sala_id', sid)
    .eq('usuario_id', auth.userId)
    .is('salida', null)
    .maybeSingle()

  if (error) throw error
  registroAbierto.value = (data as Registro | null) ?? null
  if (registroAbierto.value) {
    motivo.value = registroAbierto.value.motivo
  }
}

async function loadHistorial(sid: string) {
  if (!auth.userId || auth.demoMode || !supabase) {
    historial.value = []
    return
  }

  const { data, error } = await supabase
    .from('registros')
    .select('id, sala_id, usuario_id, motivo, entrada, salida, tipo_cierre, cerrado_por')
    .eq('sala_id', sid)
    .eq('usuario_id', auth.userId)
    .order('entrada', { ascending: false })
    .limit(20)

  if (error) throw error
  historial.value = (data ?? []) as Registro[]
}

function formatCuando(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuracion(entrada: string, salida: string | null) {
  const end = salida ? new Date(salida).getTime() : now.value
  const mins = Math.max(0, Math.round((end - new Date(entrada).getTime()) / 60000))
  if (mins < 1) return 'menos de 1 min'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

function usarMotivo(text: string) {
  motivo.value = text
}

function listenSala(sid: string) {
  if (!supabase || auth.demoMode) return
  if (salaChannel) void supabase.removeChannel(salaChannel)
  salaChannel = supabase
    .channel(`sala-registros-${sid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'registros', filter: `sala_id=eq.${sid}` },
      () => {
        void loadOpenRegistro(sid)
        void loadHistorial(sid)
      },
    )
    .subscribe()
}

async function loadSala() {
  pageLoading.value = true
  pageError.value = null
  sala.value = null
  sedeDeSala.value = null
  registroAbierto.value = null
  historial.value = []

  try {
    if (needsSede.value) return

    if (!token.value) {
      pageError.value = 'Falta el token del QR (?t=…). Escanea el código en la puerta.'
      return
    }

    if (auth.demoMode || !supabase) {
      if (salaId.value === 'demo' && token.value === 'preview') {
        sala.value = demoSala
        return
      }
      pageError.value = 'Modo demo: abre /sala/demo?t=preview después de iniciar sesión.'
      return
    }

    const { data, error } = await supabase
      .rpc('abrir_sala', {
        p_sala_id: salaId.value,
        p_token: token.value,
      })
      .maybeSingle()

    if (error) throw error

    const abierta = data as SalaAbierta | null
    if (!abierta) {
      pageError.value = 'El QR no coincide con esta sala. Escanea el código actualizado.'
      return
    }

    if (!abierta.activa) {
      pageError.value = 'Esta sala no está disponible.'
      return
    }

    if (!auth.isAdmin && abierta.sede_id && abierta.sede_id !== auth.perfil?.sede_id) {
      pageError.value = `Esta sala es de ${abierta.sede_nombre ?? 'otra sede'}. No puedes registrarte aquí.`
      return
    }

    sedeDeSala.value = abierta.sede_nombre
    sala.value = {
      id: abierta.id,
      nombre: abierta.nombre,
      ubicacion: abierta.ubicacion,
      token_qr: token.value,
      activa: abierta.activa,
      sede_id: abierta.sede_id,
    }
    await Promise.all([loadOpenRegistro(abierta.id), loadHistorial(abierta.id)])
    listenSala(abierta.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al cargar la sala'
    pageError.value = message
  } finally {
    pageLoading.value = false
  }
}

async function checkIn() {
  const text = motivo.value.trim()
  if (text.length < 3 || text.length > 200) {
    toast.add({
      severity: 'warn',
      summary: 'Motivo',
      detail: 'Escribe entre 3 y 200 caracteres.',
      life: 4000,
    })
    return
  }

  actionLoading.value = true
  try {
    if (auth.demoMode || !supabase) {
      registroAbierto.value = {
        id: 'demo-registro',
        sala_id: salaId.value,
        usuario_id: auth.userId!,
        motivo: text,
        entrada: new Date().toISOString(),
        salida: null,
        tipo_cierre: null,
        cerrado_por: null,
      }
      toast.add({ severity: 'success', summary: 'Check-in (demo)', life: 3000 })
      return
    }

    const { error } = await supabase.rpc('checkin', {
      p_sala_id: sala.value!.id,
      p_token: token.value,
      p_motivo: text,
    })

    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Check-in',
        detail: mapRegistroError(error.message),
        life: 6000,
      })
      return
    }

    await loadOpenRegistro(sala.value!.id)
    await loadHistorial(sala.value!.id)
    toast.add({ severity: 'success', summary: 'Check-in registrado', life: 3000 })
  } finally {
    actionLoading.value = false
  }
}

async function checkOut() {
  if (!registroAbierto.value) return

  actionLoading.value = true
  try {
    if (auth.demoMode || !supabase) {
      registroAbierto.value = null
      motivo.value = ''
      toast.add({ severity: 'success', summary: 'Check-out (demo)', life: 3000 })
      return
    }

    const { error } = await supabase.rpc('checkout', {
      p_registro_id: registroAbierto.value.id,
    })

    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Check-out',
        detail: mapRegistroError(error.message),
        life: 6000,
      })
      return
    }

    registroAbierto.value = null
    motivo.value = ''
    if (sala.value) await loadHistorial(sala.value.id)
    toast.add({ severity: 'success', summary: 'Check-out registrado', life: 3000 })
  } finally {
    actionLoading.value = false
  }
}

async function onSedeSaved() {
  await loadSala()
}

async function signOut() {
  await auth.signOut()
  await router.push({ name: 'login' })
}

onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now()
  }, 30000)
  void loadSala()
})
watch(
  () => auth.isAdmin,
  (isAdmin, wasAdmin) => {
    if (isAdmin && !wasAdmin && !sala.value) void loadSala()
  },
)
watch(() => [route.params.id, route.query.t], loadSala)
onUnmounted(() => {
  if (clock) clearInterval(clock)
  if (salaChannel && supabase) void supabase.removeChannel(salaChannel)
})
</script>

<template>
  <AppLayout>
    <section class="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      <article class="glass-panel flex flex-col gap-4 p-5 sm:p-6">
        <header class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="m-0 text-[0.72rem] font-bold tracking-[0.14em] text-[#9f1239] uppercase">
              {{ checkedIn ? 'Estás dentro' : 'Check-in' }}
            </p>
            <h2 class="m-0 mt-1 text-2xl font-extrabold tracking-tight text-navy">
              <template v-if="sala">{{ sala.nombre }}</template>
              <template v-else-if="needsSede">Elige tu sede</template>
              <template v-else-if="pageLoading">Cargando sala…</template>
              <template v-else>Sala no disponible</template>
            </h2>
            <p v-if="sala?.ubicacion || sedeDeSala" class="mt-1 mb-0 text-sm text-slate-600">
              <template v-if="sedeDeSala">{{ sedeDeSala }}</template>
              <template v-if="sedeDeSala && sala?.ubicacion"> · </template>
              <template v-if="sala?.ubicacion">{{ sala.ubicacion }}</template>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
            @click="signOut"
          >
            Cerrar sesión
          </button>
        </header>

        <SedePicker v-if="needsSede" bare @saved="onSedeSaved" />

        <template v-else>
          <div v-if="pageError" class="flex flex-col gap-3">
            <p role="alert" class="m-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {{ pageError }}
            </p>
          </div>
          <p v-else-if="pageLoading" class="m-0 text-sm text-slate-600">Validando sala y token QR…</p>

          <template v-else-if="sala">
          <div v-if="checkedIn && registroAbierto" class="rounded-2xl bg-navy/[0.06] px-4 py-3">
            <p class="m-0 text-sm leading-relaxed text-slate-700">
              Entraste {{ formatCuando(registroAbierto.entrada) }} · llevas
              {{ formatDuracion(registroAbierto.entrada, null) }}
            </p>
            <p class="mt-2 mb-0 text-base font-semibold tracking-tight text-navy">
              {{ registroAbierto.motivo }}
            </p>
          </div>

          <form v-else class="flex flex-col gap-3" @submit.prevent="checkIn">
            <label class="flex flex-col gap-1.5 text-sm font-semibold text-slate-700" for="motivo-uso">
              ¿Para qué vas a usar la sala?
              <Textarea
                id="motivo-uso"
                v-model="motivo"
                rows="2"
                maxlength="200"
                auto-resize
                placeholder="Ej. Clase de programación"
                fluid
              />
            </label>
            <div v-if="motivosRecientes.length" class="flex flex-wrap gap-2">
              <button
                v-for="text in motivosRecientes"
                :key="text"
                type="button"
                class="max-w-full truncate rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-navy/30 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
                @click="usarMotivo(text)"
              >
                {{ text }}
              </button>
            </div>
            <button
              type="submit"
              class="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-gradient-to-r from-[#18265a] via-navy to-navy-light px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(31,49,112,0.9)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="actionLoading || motivo.trim().length < 3"
            >
              {{ actionLoading ? 'Entrando…' : 'Entrar a la sala' }}
            </button>
          </form>

          <button
            v-if="checkedIn"
            type="button"
            class="inline-flex h-11 w-fit items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-800 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
            :disabled="actionLoading"
            @click="checkOut"
          >
            {{ actionLoading ? 'Cerrando…' : 'Salir de la sala' }}
          </button>
          </template>
        </template>
      </article>

      <article v-if="sala && !pageError" class="glass-panel p-5 sm:p-6">
        <header class="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 class="m-0 text-lg font-extrabold tracking-tight text-navy">Tus ingresos</h3>
            <p class="mt-1 mb-0 text-sm text-slate-600">
              Veces que pediste esta sala
              <span v-if="historial.length">· {{ historial.length }}</span>
            </p>
          </div>
        </header>

        <p v-if="!historial.length" class="m-0 rounded-2xl bg-white/70 px-4 py-6 text-sm text-slate-600">
          Todavía no hay ingresos tuyos en esta sala.
        </p>

        <ol v-else class="m-0 flex max-h-[32rem] list-none flex-col gap-2 overflow-y-auto p-0">
          <li
            v-for="visita in historial"
            :key="visita.id"
            class="rounded-2xl border border-white/80 bg-white/70 px-4 py-3"
            :class="visita.id === registroAbierto?.id ? 'ring-2 ring-navy/20' : ''"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="m-0 text-sm font-semibold text-navy">
                {{ visita.id === registroAbierto?.id ? 'Ahora · ' : '' }}{{ formatCuando(visita.entrada) }}
              </p>
              <p class="m-0 text-xs font-medium text-slate-500">
                {{ visita.salida ? formatDuracion(visita.entrada, visita.salida) : formatDuracion(visita.entrada, null) }}
              </p>
            </div>
            <p class="mt-1 mb-0 text-sm leading-relaxed text-slate-700">{{ visita.motivo }}</p>
            <p v-if="visita.salida" class="mt-1 mb-0 text-xs text-slate-500">
              Salida {{ formatCuando(visita.salida) }}
            </p>
          </li>
        </ol>
      </article>
    </section>
  </AppLayout>
</template>
