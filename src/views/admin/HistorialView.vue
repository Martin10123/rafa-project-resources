<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import { downloadCsv, rowsToCsv } from '../../lib/csv'
import { formatDateTime, useAdminStore } from '../../stores/admin'

const admin = useAdminStore()
const toast = useToast()

const desde = ref<Date | null>(null)
const hasta = ref<Date | null>(null)
const salaId = ref<string | null>(null)
const usuarioQuery = ref('')

const salaOptions = ref<{ label: string; value: string | null }[]>([{ label: 'Todas las salas', value: null }])

onMounted(async () => {
  await admin.fetchSalasAndHorarios()
  salaOptions.value = [
    { label: 'Todas las salas', value: null },
    ...admin.salasList.map((s) => ({ label: s.nombre, value: s.id })),
  ]
  await buscar(false)
})

async function buscar(force = true) {
  try {
    await admin.fetchHistorial(
      {
        desde: desde.value,
        hasta: hasta.value,
        salaId: salaId.value,
        usuarioQuery: usuarioQuery.value,
      },
      { force },
    )
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error al cargar',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  }
}

function limpiarFiltros() {
  desde.value = null
  hasta.value = null
  salaId.value = null
  usuarioQuery.value = ''
  void buscar()
}

function exportarCsv() {
  const headers = [
    'Sala',
    'Usuario',
    'Correo',
    'Motivo',
    'Entrada',
    'Salida',
    'Tipo cierre',
  ]
  const rows = admin.historialRows.map((r) => [
    r.sala_nombre,
    r.usuario_nombre ?? '',
    r.usuario_email,
    r.motivo,
    formatDateTime(r.entrada),
    r.salida ? formatDateTime(r.salida) : '',
    r.tipo_cierre ?? '',
  ])
  const csv = rowsToCsv(headers, rows)
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`historial-checkin-${stamp}.csv`, csv)
  toast.add({ severity: 'info', summary: 'CSV descargado', life: 2500 })
}

function tipoCierreLabel(t: string | null): string {
  if (!t) return '—'
  const map: Record<string, string> = {
    usuario: 'Usuario',
    admin: 'Administrador',
    automatico: 'Automático',
  }
  return map[t] ?? t
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Historial"
      description="Consulte registros de entrada y salida. Los filtros aplican también a la exportación CSV."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración con datos de ejemplo.
        </Message>
      </template>
    </AdminPageHeader>

    <div class="filters">
      <div class="filters__field">
        <label for="hist-desde">Desde</label>
        <DatePicker
          id="hist-desde"
          v-model="desde"
          date-format="dd/mm/yy"
          show-icon
          fluid
          placeholder="Cualquier fecha"
        />
      </div>
      <div class="filters__field">
        <label for="hist-hasta">Hasta</label>
        <DatePicker
          id="hist-hasta"
          v-model="hasta"
          date-format="dd/mm/yy"
          show-icon
          fluid
          placeholder="Cualquier fecha"
        />
      </div>
      <div class="filters__field">
        <label for="hist-sala">Sala</label>
        <Select
          id="hist-sala"
          v-model="salaId"
          :options="salaOptions"
          option-label="label"
          option-value="value"
          fluid
        />
      </div>
      <div class="filters__field filters__field--grow">
        <label for="hist-usuario">Usuario (nombre o correo)</label>
        <InputText id="hist-usuario" v-model="usuarioQuery" fluid placeholder="Buscar…" />
      </div>
      <div class="filters__actions">
        <Button label="Buscar" icon="pi pi-search" @click="buscar" />
        <Button label="Limpiar" icon="pi pi-filter-slash" outlined severity="secondary" @click="limpiarFiltros" />
        <Button
          label="Exportar CSV"
          icon="pi pi-download"
          outlined
          :disabled="!admin.historialRows.length"
          @click="exportarCsv"
        />
      </div>
    </div>

    <DataTable
      :value="admin.historialRows"
      :loading="admin.loading"
      striped-rows
      paginator
      :rows="15"
      :rows-per-page-options="[15, 30, 50]"
      sort-field="entrada"
      :sort-order="-1"
      class="hist-table"
      empty-message="No hay registros con estos filtros."
    >
      <Column field="sala_nombre" header="Sala" sortable />
      <Column header="Usuario">
        <template #body="{ data }">
          <span>{{ data.usuario_nombre ?? data.usuario_email }}</span>
        </template>
      </Column>
      <Column field="motivo" header="Motivo" />
      <Column field="entrada" header="Entrada" sortable>
        <template #body="{ data }">{{ formatDateTime(data.entrada) }}</template>
      </Column>
      <Column field="salida" header="Salida" sortable>
        <template #body="{ data }">{{
          data.salida ? formatDateTime(data.salida) : 'Abierto'
        }}</template>
      </Column>
      <Column header="Cierre">
        <template #body="{ data }">{{ tipoCierreLabel(data.tipo_cierre) }}</template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.admin-page {
  width: 100%;
}

.demo-banner {
  margin-top: 0.5rem;
}

.filters {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  background: rgb(255 255 255 / 0.78);
  border: 1px solid rgb(255 255 255 / 0.72);
  border-radius: 1.25rem;
  box-shadow:
    0 18px 50px -28px rgb(15 23 42 / 0.38),
    0 8px 24px -18px rgb(44 67 143 / 0.28);
  backdrop-filter: blur(16px);
  padding: 1.1rem 1.25rem;
  margin-bottom: 1rem;
  width: 100%;
}

.filters__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filters__field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.filters__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.hist-table {
  width: 100%;
}

@media (min-width: 768px) {
  .filters {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters__field--grow {
    grid-column: span 2;
  }

  .filters__actions {
    grid-column: span 2;
  }
}

@media (min-width: 1100px) {
  .filters {
    grid-template-columns: repeat(4, 1fr);
  }

  .filters__field--grow {
    grid-column: span 2;
  }

  .filters__actions {
    grid-column: span 4;
  }
}
</style>
