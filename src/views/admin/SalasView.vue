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

const selectedSalaId = ref<string | null>(null)
const selectedSalaRow = ref<Sala | null>(null)
const horarioDialog = ref(false)
const editingHorario = ref<Horario | null>(null)
const formDia = ref(1)
const formInicio = ref('08:00')
const formFin = ref('12:00')

const qrDialog = ref(false)
const qrSala = ref<Sala | null>(null)
const qrDataUrl = ref('')

const diaOptions = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  label: diaSemanaLabel(d),
  value: d,
}))

const horariosDeSala = computed(() =>
  admin.horariosList.filter((h) => h.sala_id === selectedSalaId.value),
)

const selectedSala = computed(() =>
  admin.salasList.find((s) => s.id === selectedSalaId.value) ?? null,
)

function onSalaSelect(event: { data: Sala }) {
  selectedSalaId.value = event.data.id
}

onMounted(async () => {
  try {
    await admin.fetchSalasAndHorarios()
    if (admin.salasList.length && !selectedSalaId.value) {
      selectedSalaId.value = admin.salasList[0].id
      selectedSalaRow.value = admin.salasList[0]
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudieron cargar las salas',
      life: 5000,
    })
  }
})

watch(
  () => admin.salasList.length,
  (n) => {
    if (n && !selectedSalaId.value) selectedSalaId.value = admin.salasList[0].id
  },
)

function openNewSala() {
  editingSala.value = null
  formNombre.value = ''
  formUbicacion.value = ''
  formActiva.value = true
  salaDialog.value = true
}

function openEditSala(sala: Sala) {
  editingSala.value = sala
  formNombre.value = sala.nombre
  formUbicacion.value = sala.ubicacion ?? ''
  formActiva.value = sala.activa
  salaDialog.value = true
}

async function saveSalaForm() {
  const nombre = formNombre.value.trim()
  if (!nombre) {
    toast.add({ severity: 'warn', summary: 'El nombre es obligatorio', life: 3000 })
    return
  }
  try {
    await admin.saveSala({
      id: editingSala.value?.id,
      nombre,
      ubicacion: formUbicacion.value.trim() || null,
      activa: formActiva.value,
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

function openNewHorario() {
  if (!selectedSalaId.value) return
  editingHorario.value = null
  formDia.value = 1
  formInicio.value = '08:00'
  formFin.value = '12:00'
  horarioDialog.value = true
}

function openEditHorario(h: Horario) {
  editingHorario.value = h
  formDia.value = h.dia_semana
  formInicio.value = formatTimeHm(h.hora_inicio)
  formFin.value = formatTimeHm(h.hora_fin)
  horarioDialog.value = true
}

function toPgTime(hm: string): string {
  return hm.length === 5 ? `${hm}:00` : hm
}

async function saveHorarioForm() {
  if (!selectedSalaId.value) return
  try {
    await admin.saveHorario({
      id: editingHorario.value?.id,
      sala_id: selectedSalaId.value,
      dia_semana: formDia.value,
      hora_inicio: toPgTime(formInicio.value),
      hora_fin: toPgTime(formFin.value),
    })
    horarioDialog.value = false
    toast.add({ severity: 'success', summary: 'Horario guardado', life: 2500 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'Revise que la hora fin sea mayor que inicio',
      life: 5000,
    })
  }
}

function confirmDeleteHorario(h: Horario) {
  confirm.require({
    message: `¿Eliminar franja del ${diaSemanaLabel(h.dia_semana)}?`,
    header: 'Eliminar horario',
    icon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Eliminar',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await admin.deleteHorario(h.id)
        toast.add({ severity: 'success', summary: 'Horario eliminado', life: 2500 })
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
      description="Administre salas, franjas horarias, rotación de tokens y códigos QR para check-in."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración: cambios locales en esta sesión.
        </Message>
      </template>
    </AdminPageHeader>

    <div class="layout">
      <div class="panel">
        <div class="panel__toolbar">
          <h3>Salas</h3>
          <Button label="Nueva sala" icon="pi pi-plus" size="small" @click="openNewSala" />
        </div>
        <DataTable
          v-model:selection="selectedSalaRow"
          :value="admin.salasList"
          :loading="admin.loading"
          selection-mode="single"
          data-key="id"
          striped-rows
          class="salas-table"
          @row-select="onSalaSelect"
        >
          <Column selection-mode="single" header-style="width: 3rem" />
          <Column field="nombre" header="Nombre" />
          <Column field="ubicacion" header="Ubicación" />
          <Column header="Estado">
            <template #body="{ data }">
              <Tag :value="data.activa ? 'Activa' : 'Inactiva'" :severity="data.activa ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Acciones" style="min-width: 12rem">
            <template #body="{ data }">
              <div class="row-actions">
                <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openEditSala(data)" />
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

      <div class="panel">
        <div class="panel__toolbar">
          <h3>
            Horarios
            <span v-if="selectedSala" class="panel__sub">— {{ selectedSala.nombre }}</span>
          </h3>
          <Button
            label="Agregar franja"
            icon="pi pi-clock"
            size="small"
            :disabled="!selectedSalaId"
            @click="openNewHorario"
          />
        </div>
        <DataTable
          :value="horariosDeSala"
          striped-rows
          class="horarios-table"
          empty-message="Seleccione una sala o agregue franjas horarias."
        >
          <Column header="Día">
            <template #body="{ data }">{{ diaSemanaLabel(data.dia_semana) }}</template>
          </Column>
          <Column header="Inicio">
            <template #body="{ data }">{{ formatTimeHm(data.hora_inicio) }}</template>
          </Column>
          <Column header="Fin">
            <template #body="{ data }">{{ formatTimeHm(data.hora_fin) }}</template>
          </Column>
          <Column header="">
            <template #body="{ data }">
              <div class="row-actions">
                <Button icon="pi pi-pencil" text rounded @click="openEditHorario(data)" />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  severity="danger"
                  @click="confirmDeleteHorario(data)"
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
      :style="{ width: 'min(100%, 28rem)' }"
    >
      <div class="dialog-form">
        <label>
          <span>Nombre</span>
          <InputText v-model="formNombre" fluid />
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
      v-model:visible="horarioDialog"
      :header="editingHorario ? 'Editar horario' : 'Nuevo horario'"
      modal
      :style="{ width: 'min(100%, 28rem)' }"
    >
      <div class="dialog-form">
        <label>
          <span>Día de la semana</span>
          <Select v-model="formDia" :options="diaOptions" option-label="label" option-value="value" fluid />
        </label>
        <label>
          <span>Hora inicio</span>
          <InputText v-model="formInicio" type="time" fluid />
        </label>
        <label>
          <span>Hora fin</span>
          <InputText v-model="formFin" type="time" fluid />
        </label>
      </div>
      <template #footer>
        <Button label="Cancelar" text @click="horarioDialog = false" />
        <Button label="Guardar" icon="pi pi-check" @click="saveHorarioForm" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="qrDialog"
      :header="qrSala ? `QR — ${qrSala.nombre}` : 'Código QR'"
      modal
      :style="{ width: 'min(100%, 22rem)' }"
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
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
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

.panel__sub {
  font-weight: 500;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.salas-table,
.horarios-table {
  width: 100%;
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

@media (min-width: 1000px) {
  .layout {
    grid-template-columns: 1.2fr 1fr;
  }
}
</style>
