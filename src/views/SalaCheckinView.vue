<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import AppLayout from '../layouts/AppLayout.vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import type { Registro, Sala } from '../types'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const motivo = ref('')
const sala = ref<Sala | null>(null)
const registroAbierto = ref<Registro | null>(null)
const pageLoading = ref(true)
const actionLoading = ref(false)
const pageError = ref<string | null>(null)

const salaId = computed(() => String(route.params.id ?? ''))
const token = computed(() => String(route.query.t ?? ''))

const checkedIn = computed(() => Boolean(registroAbierto.value))

const demoSala: Sala = {
  id: 'demo',
  nombre: 'Sala de Sistemas (demo)',
  ubicacion: 'Campus — vista previa',
  token_qr: 'preview',
  activa: true,
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

async function loadSala() {
  pageLoading.value = true
  pageError.value = null
  sala.value = null
  registroAbierto.value = null

  try {
    if (!token.value) {
      pageError.value = 'Falta el token del QR (?t=…). Escanea el código en la puerta.'
      return
    }

    if (auth.demoMode || !supabase) {
      if (salaId.value === 'demo' && token.value === 'preview') {
        sala.value = demoSala
        return
      }
      pageError.value =
        'Modo demo: abre /sala/demo?t=preview después de iniciar sesión.'
      return
    }

    const { data, error } = await supabase
      .from('salas')
      .select('id, nombre, ubicacion, token_qr, activa')
      .eq('id', salaId.value)
      .maybeSingle()

    if (error) throw error

    if (!data || !data.activa) {
      pageError.value = 'Sala no encontrada o inactiva.'
      return
    }

    if (data.token_qr !== token.value) {
      pageError.value = 'El QR no coincide con esta sala. Escanea el código actualizado.'
      return
    }

    sala.value = data as Sala
    await loadOpenRegistro(data.id)
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

    const { data, error } = await supabase
      .from('registros')
      .insert({
        sala_id: sala.value!.id,
        usuario_id: auth.userId!,
        motivo: text,
      })
      .select('id, sala_id, usuario_id, motivo, entrada, salida, tipo_cierre, cerrado_por')
      .single()

    if (error) {
      toast.add({
        severity: 'error',
        summary: 'Check-in',
        detail: mapRegistroError(error.message),
        life: 6000,
      })
      return
    }

    registroAbierto.value = data as Registro
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

    const { error } = await supabase
      .from('registros')
      .update({ salida: new Date().toISOString() })
      .eq('id', registroAbierto.value.id)

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
    toast.add({ severity: 'success', summary: 'Check-out registrado', life: 3000 })
  } finally {
    actionLoading.value = false
  }
}

async function toggleCheck() {
  if (checkedIn.value) {
    await checkOut()
  } else {
    await checkIn()
  }
}

async function signOut() {
  await auth.signOut()
  await router.push({ name: 'login' })
}

onMounted(loadSala)
watch(() => [route.params.id, route.query.t], loadSala)
</script>

<template>
  <AppLayout>
    <section class="sala">
      <header class="sala__head">
        <div class="sala__tags">
          <Tag v-if="auth.demoMode" value="Modo demo" severity="info" />
          <Tag v-if="checkedIn" value="Check-in activo" severity="success" />
        </div>
        <h2 v-if="sala">{{ sala.nombre }}</h2>
        <h2 v-else-if="pageLoading">Cargando sala…</h2>
        <h2 v-else>Sala no disponible</h2>
        <p v-if="sala?.ubicacion">{{ sala.ubicacion }}</p>
        <p v-else-if="!pageError" class="sala__meta">Sala <code>{{ salaId }}</code></p>
      </header>

      <Message v-if="pageError" severity="error" :closable="false">
        {{ pageError }}
      </Message>
      <Message v-else-if="pageLoading" severity="secondary" :closable="false">
        Validando sala y token QR…
      </Message>
      <Message v-else-if="checkedIn" severity="success" :closable="false">
        Entrada: {{ new Date(registroAbierto!.entrada).toLocaleString('es-CO') }} — puedes hacer check-out al salir.
      </Message>
      <Message v-else severity="warn" :closable="false">
        Indica el motivo de uso (3–200 caracteres) antes de hacer check-in.
      </Message>

      <div v-if="sala && !pageError" class="panel">
        <label v-if="!checkedIn" class="field">
          <span>Motivo de uso</span>
          <Textarea
            v-model="motivo"
            rows="3"
            maxlength="200"
            placeholder="Ej. Clase de programación / práctica libre"
            auto-resize
            fluid
          />
        </label>
        <p v-else class="motivo-readonly">
          <span>Motivo</span>
          {{ registroAbierto?.motivo }}
        </p>

        <Button
          :label="checkedIn ? 'Hacer check-out' : 'Hacer check-in'"
          :icon="checkedIn ? 'pi pi-sign-out' : 'pi pi-sign-in'"
          :severity="checkedIn ? 'danger' : 'primary'"
          :disabled="!checkedIn && motivo.trim().length < 3"
          :loading="actionLoading"
          fluid
          @click="toggleCheck"
        />

        <Button
          type="button"
          label="Cerrar sesión"
          link
          icon="pi pi-power-off"
          class="signout"
          @click="signOut"
        />
      </div>
    </section>
  </AppLayout>
</template>

<style scoped>
.sala {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sala__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sala__head h2 {
  margin: 0.5rem 0 0.35rem;
  color: var(--color-navy);
  font-size: 1.5rem;
}

.sala__head p {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.5;
}

.sala__meta code {
  font-size: 0.85em;
  background: #eef2f6;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}

.panel {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.motivo-readonly {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
}

.motivo-readonly span {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.signout {
  align-self: flex-start;
}
</style>
