<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import SedeFiltro from '../../components/SedeFiltro.vue'
import { filtrarPorSede, isSedeUuid, readVistaSede, sedeNombre, writeVistaSede } from '../../lib/sedes'
import type { Horario, Sala } from '../../types'
import {
  diaSemanaLabel,
  formatTimeHm,
  salaCheckinUrl,
  useAdminStore,
} from '../../stores/admin'

const admin = useAdminStore()
const confirm = useConfirm()
const toast = useToast()

const salaDialog = ref(false)
const editingSala = ref<Sala | null>(null)
const formNombre = ref('')
const formUbicacion = ref('')
const formActiva = ref(true)
const formSedeId = ref<string | null>(null)
const sedeFiltro = ref<string | null>(readVistaSede())

const franjaSala = ref<Sala | null>(null)
const franjaDialog = ref(false)
const franjaSaving = ref(false)
const editingFranjaIds = ref<string[]>([])
const formDias = ref<number[]>([1, 2, 3, 4, 5])
const formInicio = ref('07:00')
const formFin = ref('18:00')

const qrDialog = ref(false)
const qrSala = ref<Sala | null>(null)
const qrDataUrl = ref('')

const diaOptions = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  label: diaSemanaLabel(d),
  short: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d - 1],
  value: d,
}))

const salasVisibles = computed(() => filtrarPorSede(admin.salasList, sedeFiltro.value))

const franjaGrupos = computed(() => {
  const list = admin.horariosList.filter((h) => h.sala_id === franjaSala.value?.id)
  const map = new Map<string, Horario[]>()
  for (const horario of list) {
    const key = `${formatTimeHm(horario.hora_inicio)}|${formatTimeHm(horario.hora_fin)}`
    const bucket = map.get(key) ?? []
    bucket.push(horario)
    map.set(key, bucket)
  }
  return [...map.values()].map((items) => ({
    inicio: formatTimeHm(items[0].hora_inicio),
    fin: formatTimeHm(items[0].hora_fin),
    dias: items.map((item) => item.dia_semana).sort((a, b) => a - b),
    items,
  }))
})

const lunesAViernesActivo = computed(() => [1, 2, 3, 4, 5].every((dia) => formDias.value.includes(dia)))

function personasDentro(salaId: string) {
  return admin.dashboardSalas.find((sala) => sala.id === salaId)?.openRegistros.length ?? 0
}

function diasFranjaLabel(dias: number[]): string {
  const key = dias.join(',')
  if (key === '1,2,3,4,5') return 'Lunes a viernes'
  if (key === '1,2,3,4,5,6') return 'Lunes a sábado'
  if (key === '1,2,3,4,5,6,7') return 'Toda la semana'
  if (key === '6,7') return 'Fin de semana'
  return dias.map((dia) => diaSemanaLabel(dia)).join(', ')
}

onMounted(async () => {
  try {
    await Promise.all([
      admin.fetchSalasAndHorarios(),
      admin.fetchSedes(),
      admin.fetchDashboard({ silent: true }),
    ])
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudieron cargar las salas',
      life: 5000,
    })
  }
})

watch(sedeFiltro, (value) => writeVistaSede(value))

function openNewSala() {
  editingSala.value = null
  formNombre.value = ''
  formUbicacion.value = ''
  formActiva.value = true
  formSedeId.value = isSedeUuid(sedeFiltro.value) ? sedeFiltro.value : null
  salaDialog.value = true
}

function openEditSala(sala: Sala) {
  editingSala.value = sala
  formNombre.value = sala.nombre
  formUbicacion.value = sala.ubicacion ?? ''
  formActiva.value = sala.activa
  formSedeId.value = sala.sede_id
  salaDialog.value = true
}

async function saveSalaForm() {
  const nombre = formNombre.value.trim()
  if (!nombre) {
    toast.add({ severity: 'warn', summary: 'El nombre es obligatorio', life: 3000 })
    return
  }
  if (!formSedeId.value) {
    toast.add({ severity: 'warn', summary: 'Elige la sede de la sala', life: 3000 })
    return
  }
  try {
    await admin.saveSala({
      id: editingSala.value?.id,
      nombre,
      ubicacion: formUbicacion.value.trim() || null,
      activa: formActiva.value,
      sedeId: formSedeId.value,
    })
    salaDialog.value = false
    toast.add({ severity: 'success', summary: 'Sala guardada', life: 2500 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudo guardar',
      life: 5000,
    })
  }
}

function resetFranjaForm() {
  editingFranjaIds.value = []
  formDias.value = [1, 2, 3, 4, 5]
  formInicio.value = '07:00'
  formFin.value = '18:00'
}

function openFranjas(sala: Sala) {
  franjaSala.value = sala
  resetFranjaForm()
  franjaDialog.value = true
}

function toggleDia(dia: number) {
  formDias.value = formDias.value.includes(dia)
    ? formDias.value.filter((item) => item !== dia)
    : [...formDias.value, dia].sort((a, b) => a - b)
}

function elegirLunesViernes() {
  const laborables = [1, 2, 3, 4, 5]
  if (lunesAViernesActivo.value) {
    formDias.value = formDias.value.filter((dia) => dia > 5)
    return
  }
  formDias.value = [...new Set([...formDias.value, ...laborables])].sort((a, b) => a - b)
}

function editarFranja(items: Horario[]) {
  editingFranjaIds.value = items.map((item) => item.id)
  formDias.value = items.map((item) => item.dia_semana).sort((a, b) => a - b)
  formInicio.value = formatTimeHm(items[0].hora_inicio)
  formFin.value = formatTimeHm(items[0].hora_fin)
}

function toPgTime(hm: string): string {
  return hm.length === 5 ? `${hm}:00` : hm
}

async function saveFranjaForm() {
  if (!franjaSala.value || franjaSaving.value) return
  if (!formDias.value.length) {
    toast.add({ severity: 'warn', summary: 'Elige al menos un día', life: 3000 })
    return
  }
  if (!formInicio.value || !formFin.value || formFin.value <= formInicio.value) {
    toast.add({ severity: 'warn', summary: 'La hora fin tiene que ser mayor que la de inicio', life: 3500 })
    return
  }
  franjaSaving.value = true
  try {
    await admin.guardarFranjaDias({
      salaId: franjaSala.value.id,
      dias: formDias.value,
      horaInicio: toPgTime(formInicio.value),
      horaFin: toPgTime(formFin.value),
      replaceIds: editingFranjaIds.value,
    })
    resetFranjaForm()
    toast.add({ severity: 'success', summary: 'Franja guardada', life: 2500 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudo guardar la franja',
      life: 5000,
    })
  } finally {
    franjaSaving.value = false
  }
}

function confirmDeleteFranja(items: Horario[]) {
  confirm.require({
    message: `¿Eliminar la franja de ${diasFranjaLabel(items.map((item) => item.dia_semana).sort((a, b) => a - b))}?`,
    header: 'Eliminar franja',
    icon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Eliminar',
    rejectLabel: 'Cancelar',
    accept: async () => {
      if (!franjaSala.value) return
      try {
        await admin.guardarFranjaDias({
          salaId: franjaSala.value.id,
          dias: [],
          horaInicio: items[0].hora_inicio,
          horaFin: items[0].hora_fin,
          replaceIds: items.map((item) => item.id),
        })
        if (items.some((item) => editingFranjaIds.value.includes(item.id))) resetFranjaForm()
        toast.add({ severity: 'success', summary: 'Franja eliminada', life: 2500 })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: e instanceof Error ? e.message : 'No se pudo eliminar',
          life: 5000,
        })
      }
    },
  })
}

async function rotateToken(sala: Sala) {
  confirm.require({
    message: `¿Generar un nuevo token QR para ${sala.nombre}? Los códigos impresos dejarán de ser válidos.`,
    header: 'Rotar token',
    icon: 'pi pi-refresh',
    acceptLabel: 'Rotar',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await admin.rotateSalaToken(sala.id)
        toast.add({ severity: 'success', summary: 'Token actualizado', life: 3000 })
        if (qrSala.value?.id === sala.id) {
          await showQr(admin.salasList.find((s) => s.id === sala.id) ?? sala)
        }
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: e instanceof Error ? e.message : 'No se pudo rotar',
          life: 5000,
        })
      }
    },
  })
}

async function showQr(sala: Sala) {
  qrSala.value = sala
  const url = salaCheckinUrl(sala.id, sala.token_qr)
  qrDataUrl.value = await QRCode.toDataURL(url, { width: 280, margin: 2 })
  qrDialog.value = true
}

function downloadQr() {
  if (!qrDataUrl.value || !qrSala.value) return
  const link = document.createElement('a')
  link.href = qrDataUrl.value
  link.download = `qr-${qrSala.value.nombre.replace(/\s+/g, '-').toLowerCase()}.png`
  link.click()
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Salas y horarios"
      description="Cada sala pertenece a una sede. Así los espacios de una sede no aparecen en las otras."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración: cambios locales en esta sesión.
        </Message>
      </template>
    </AdminPageHeader>

    <SedeFiltro
      v-model="sedeFiltro"
      :sedes="admin.sedesList"
      allow-all
      allow-none
      prompt="¿Qué sede vas a administrar? Elige una para no mezclar los espacios."
    />

    <div class="layout">
      <div class="panel">
        <div class="panel__toolbar">
          <h3>Salas</h3>
          <Button label="Nueva sala" icon="pi pi-plus" size="small" @click="openNewSala" />
        </div>
        <DataTable
          :value="salasVisibles"
          :loading="admin.loading"
          data-key="id"
          striped-rows
          paginator
          :rows="8"
          :rows-per-page-options="[8, 20]"
          class="salas-table"
          empty-message="Elige una sede para ver sus salas."
        >
          <Column field="nombre" header="Nombre" />
          <Column header="Sede">
            <template #body="{ data }">{{ sedeNombre(admin.sedesList, data.sede_id) }}</template>
          </Column>
          <Column field="ubicacion" header="Ubicación" />
          <Column header="Ocupación">
            <template #body="{ data }">
              <Tag
                :value="personasDentro(data.id) ? `${personasDentro(data.id)} dentro` : 'Disponible'"
                :severity="personasDentro(data.id) ? 'warn' : 'success'"
              />
            </template>
          </Column>
          <Column header="Estado">
            <template #body="{ data }">
              <Tag :value="data.activa ? 'Activa' : 'Inactiva'" :severity="data.activa ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Acciones" style="min-width: 12rem">
            <template #body="{ data }">
              <div class="row-actions">
                <Button icon="pi pi-pencil" text rounded severity="secondary" aria-label="Editar sala" @click="openEditSala(data)" />
                <Button icon="pi pi-clock" label="Franjas" text size="small" @click="openFranjas(data)" />
                <Button icon="pi pi-qrcode" text rounded @click="showQr(data)" />
                <Button
                  icon="pi pi-refresh"
                  text
                  rounded
                  severity="warn"
                  aria-label="Rotar token"
                  @click="rotateToken(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <Dialog
      v-model:visible="salaDialog"
      :header="editingSala ? 'Editar sala' : 'Nueva sala'"
      modal
      :style="{ width: 'min(calc(100vw - 2rem), 28rem)' }"
    >
      <div class="dialog-form">
        <label>
          <span>Nombre</span>
          <InputText v-model="formNombre" fluid />
        </label>
        <label>
          <span>Sede</span>
          <Select
            v-model="formSedeId"
            :options="admin.sedesList"
            option-label="nombre"
            option-value="id"
            placeholder="Elige la sede"
            fluid
          />
        </label>
        <label>
          <span>Ubicación</span>
          <InputText v-model="formUbicacion" fluid />
        </label>
        <label class="switch-row">
          <span>Sala activa</span>
          <ToggleSwitch v-model="formActiva" />
        </label>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="salaDialog = false" />
        <Button label="Guardar" icon="pi pi-check" @click="saveSalaForm" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="franjaDialog"
      :header="franjaSala ? `Franjas — ${franjaSala.nombre}` : 'Franjas'"
      modal
      :style="{ width: 'min(calc(100vw - 2rem), 36rem)' }"
    >
      <div class="dialog-form">
        <ul v-if="franjaGrupos.length" class="franja-list">
          <li v-for="grupo in franjaGrupos" :key="`${grupo.inicio}-${grupo.fin}`">
            <span>
              <strong>{{ diasFranjaLabel(grupo.dias) }}</strong>
              <small>{{ grupo.inicio }} – {{ grupo.fin }}</small>
            </span>
            <span class="row-actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Editar franja" @click="editarFranja(grupo.items)" />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Eliminar franja"
                @click="confirmDeleteFranja(grupo.items)"
              />
            </span>
          </li>
        </ul>
        <p v-else class="franja-empty">Esta sala todavía no tiene franjas.</p>

        <p class="franja-form-title">
          {{ editingFranjaIds.length ? 'Editar franja' : 'Agregar franja' }}
        </p>
        <div>
          <span class="field-label">Días con el mismo horario</span>
          <div class="dia-picker" role="group" aria-label="Días de la franja">
            <button
              v-for="dia in diaOptions"
              :key="dia.value"
              type="button"
              class="dia-picker__btn"
              :class="{ 'dia-picker__btn--on': formDias.includes(dia.value) }"
              :aria-pressed="formDias.includes(dia.value)"
              @click="toggleDia(dia.value)"
            >
              {{ dia.short }}
            </button>
          </div>
          <button
            type="button"
            class="dia-preset"
            :class="{ 'dia-preset--on': lunesAViernesActivo }"
            @click="elegirLunesViernes"
          >
            Lunes a viernes
          </button>
        </div>
        <div class="franja-horas">
          <label>
            <span>Hora inicio</span>
            <InputText v-model="formInicio" type="time" fluid />
          </label>
          <label>
            <span>Hora fin</span>
            <InputText v-model="formFin" type="time" fluid />
          </label>
        </div>
      </div>
      <template #footer>
        <Button v-if="editingFranjaIds.length" label="Cancelar edición" text @click="resetFranjaForm" />
        <Button label="Cerrar" text @click="franjaDialog = false" />
        <Button
          :label="editingFranjaIds.length ? 'Guardar franja' : 'Agregar franja'"
          icon="pi pi-check"
          :loading="franjaSaving"
          @click="saveFranjaForm"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="qrDialog"
      :header="qrSala ? `QR — ${qrSala.nombre}` : 'Código QR'"
      modal
      :style="{ width: 'min(calc(100vw - 2rem), 22rem)' }"
    >
      <div v-if="qrSala" class="qr-box">
        <img :src="qrDataUrl" alt="Código QR de check-in" width="280" height="280" />
        <p class="qr-url">{{ salaCheckinUrl(qrSala.id, qrSala.token_qr) }}</p>
        <Button label="Descargar PNG" icon="pi pi-download" outlined @click="downloadQr" />
      </div>
    </Dialog>
  </section>
</template>

<style scoped>
.admin-page {
  width: 100%;
}

.demo-banner {
  margin-top: 0.5rem;
}

.layout {
  display: grid;
  gap: 1rem;
  width: 100%;
  grid-template-columns: 1fr;
}

.panel {
  background: rgb(255 255 255 / 0.78);
  border: 1px solid rgb(255 255 255 / 0.72);
  border-radius: 1.25rem;
  box-shadow:
    0 18px 50px -28px rgb(15 23 42 / 0.38),
    0 8px 24px -18px rgb(44 67 143 / 0.28);
  backdrop-filter: blur(16px);
  padding: 1rem 1.1rem;
  min-width: 0;
}

.panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.panel h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--color-navy);
}

.salas-table {
  width: 100%;
}

.franja-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.franja-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border-radius: 0.85rem;
  background: rgb(255 255 255 / 0.7);
  border: 1px solid rgb(226 232 240 / 0.9);
}

.franja-list strong {
  display: block;
  font-size: 0.9rem;
}

.franja-list small {
  color: var(--color-muted);
}

.franja-empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.franja-form-title {
  margin: 0.25rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-navy);
}

.field-label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.dia-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.dia-picker__btn {
  min-width: 3.1rem;
  min-height: 2.6rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(203 213 225);
  background: white;
  color: var(--color-navy);
  font-weight: 700;
  cursor: pointer;
}

.dia-picker__btn--on {
  background: var(--color-navy);
  border-color: var(--color-navy);
  color: white;
}

.dia-preset {
  margin-top: 0.55rem;
  border: 0;
  background: transparent;
  color: var(--color-navy);
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.dia-preset--on {
  color: var(--color-muted);
}

.franja-horas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.row-actions {
  display: flex;
  gap: 0.15rem;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.switch-row {
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.qr-url {
  margin: 0;
  font-size: 0.7rem;
  word-break: break-all;
  color: var(--color-muted);
}

</style>
