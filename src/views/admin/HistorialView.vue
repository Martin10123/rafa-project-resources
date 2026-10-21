<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import SedeFiltro from '../../components/SedeFiltro.vue'
import { downloadXlsx, type ExcelValue } from '../../lib/excel'
import { isSedeUuid, readVistaSede, writeVistaSede } from '../../lib/sedes'
import { useAuthStore } from '../../stores/auth'
import { formatDateTime, useAdminStore, type HistorialRow } from '../../stores/admin'

const admin = useAdminStore()
const auth = useAuthStore()
const toast = useToast()

const desde = ref<Date | null>(null)
const hasta = ref<Date | null>(null)
const salaId = ref<string | null>(null)
const usuarioQuery = ref('')
const sedeFiltro = ref<string | null>(sedeInicial())
const first = ref(0)
const pageSize = ref(15)
const exporting = ref(false)

const soloJefa = computed(() => auth.isJefa && !auth.isAdmin)
const canQuery = computed(() => auth.isAdmin || isSedeUuid(sedeFiltro.value))

const salaOptions = computed(() => {
  const base = isSedeUuid(sedeFiltro.value)
    ? admin.salasList.filter((s) => s.sede_id === sedeFiltro.value)
    : sedeFiltro.value === 'none'
      ? admin.salasList.filter((s) => !s.sede_id)
      : admin.salasList
  return [{ label: 'Todas las salas', value: null }, ...base.map((s) => ({ label: s.nombre, value: s.id }))]
})

function sedeInicial(): string | null {
  const saved = readVistaSede()
  if (auth.isAdmin) return saved ?? 'all'
  if (auth.perfil?.sede_id) return auth.perfil.sede_id
  return isSedeUuid(saved) ? saved : null
}

onMounted(async () => {
  try {
    await Promise.all([admin.fetchSalasAndHorarios(), admin.fetchSedes()])
    await buscar(true)
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error al cargar',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  }
})

watch(
  () => auth.isAdmin,
  (isAdmin) => {
    if (!isAdmin || admin.historialRows.length) return
    if (sedeFiltro.value === 'all' || sedeFiltro.value === 'none') void buscar(true)
  },
)

watch(sedeFiltro, (value, previous) => {
  writeVistaSede(value)
  if (value === previous) return
  salaId.value = null
  first.value = 0
  if (canQuery.value) void buscar(true)
})

function filtrosActuales() {
  return {
    desde: desde.value,
    hasta: hasta.value,
    salaId: salaId.value,
    sedeId: sedeFiltro.value,
    usuarioQuery: usuarioQuery.value,
  }
}

async function buscar(force = true) {
  try {
    if (!canQuery.value) return
    await admin.fetchHistorial(filtrosActuales(), { first: first.value, rows: pageSize.value }, { force })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error al cargar',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  }
}

function buscarDesdeInicio() {
  first.value = 0
  void buscar(true)
}

function onPage(event: { first: number; rows: number }) {
  first.value = event.first
  pageSize.value = event.rows
  void buscar(true)
}

function limpiarFiltros() {
  desde.value = null
  hasta.value = null
  salaId.value = null
  usuarioQuery.value = ''
  first.value = 0
  void buscar()
}

function quienCerro(row: HistorialRow): string {
  if (!row.salida) return ''
  if (row.tipo_cierre === 'automatico') return 'Cierre automático'
  if (row.cerrado_por_nombre?.trim()) return row.cerrado_por_nombre
  if (row.cerrado_por_email) return row.cerrado_por_email
  if (row.tipo_cierre === 'usuario') return row.usuario_nombre?.trim() || row.usuario_email
  return ''
}

function nombreArchivo(): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const sede = admin.sedesList.find((item) => item.id === sedeFiltro.value)
  const parte = sede
    ? `sede-${sede.codigo.toLowerCase()}`
    : sedeFiltro.value === 'none'
      ? 'sin-sede'
      : 'todas'
  return `aperturas-cierres-${parte}-${stamp}.xlsx`
}

function fechaExcel(iso: string): Date | string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? iso : fecha
}

async function exportarExcel() {
  if (!canQuery.value || exporting.value) return
  exporting.value = true
  try {
    const { rows, total } = await admin.fetchHistorialTodos(filtrosActuales())
    const headers = [
      'Sede',
      'Sala',
      'Quién abrió',
      'Correo',
      'Motivo',
      'Entrada',
      'Salida',
      'Quién cerró',
      'Tipo de cierre',
    ]
    const excelRows: ExcelValue[][] = rows.map((r) => [
      r.sede_nombre,
      r.sala_nombre,
      r.usuario_nombre?.trim() || r.usuario_email,
      r.usuario_email,
      r.motivo,
      fechaExcel(r.entrada),
      r.salida ? fechaExcel(r.salida) : 'Abierto',
      quienCerro(r),
      tipoCierreLabel(r.tipo_cierre),
    ])
    downloadXlsx(nombreArchivo(), 'Aperturas y cierres', headers, excelRows, [
      16, 28, 26, 40, 46, 20, 20, 24, 18,
    ])
    toast.add({
      severity: rows.length < total ? 'warn' : 'info',
      summary: rows.length < total ? `Excel con ${rows.length} de ${total}` : 'Excel descargado',
      life: 2500,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo exportar',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  } finally {
    exporting.value = false
  }
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
      :title="soloJefa ? 'Descarga de aperturas y cierres' : 'Historial'"
      :description="
        soloJefa
          ? 'Elige una sede. El archivo solo incluye quién abre y quién cierra las salas de esa sede.'
          : 'Consulta quién abre y quién cierra. El filtro de sede también aplica al Excel.'
      "
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración con datos de ejemplo.
        </Message>
      </template>
    </AdminPageHeader>

    <SedeFiltro
      v-model="sedeFiltro"
      :sedes="admin.sedesList"
      :allow-all="auth.isAdmin"
      :allow-none="auth.isAdmin"
      :prompt="
        soloJefa
          ? '¿De qué sede vas a descargar? Cada archivo queda separado.'
          : '¿Qué sede quieres consultar?'
      "
    />

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
        <Button label="Buscar" icon="pi pi-search" :disabled="!canQuery" @click="buscarDesdeInicio" />
        <Button label="Limpiar" icon="pi pi-filter-slash" outlined severity="secondary" @click="limpiarFiltros" />
        <Button
          label="Exportar Excel"
          icon="pi pi-file-excel"
          outlined
          :loading="exporting"
          :disabled="!canQuery || !admin.historialTotal"
          @click="exportarExcel"
        />
      </div>
    </div>

    <p v-if="canQuery && admin.historialMs != null" class="query-meta">
      {{ admin.historialTotal }} registros · consulta {{ admin.historialMs }} ms
    </p>

    <DataTable
      :value="canQuery ? admin.historialRows : []"
      :loading="admin.loading"
      lazy
      striped-rows
      paginator
      :first="first"
      :rows="pageSize"
      :total-records="canQuery ? admin.historialTotal : 0"
      :rows-per-page-options="[15, 30, 50]"
      class="hist-table"
      :empty-message="canQuery ? 'No hay registros con estos filtros.' : 'Elige una sede para ver y descargar.'"
      @page="onPage"
    >
      <Column field="sede_nombre" header="Sede" />
      <Column field="sala_nombre" header="Sala" />
      <Column header="Quién abrió">
        <template #body="{ data }">
          <span>{{ data.usuario_nombre ?? data.usuario_email }}</span>
        </template>
      </Column>
      <Column field="motivo" header="Motivo" />
      <Column field="entrada" header="Entrada">
        <template #body="{ data }">{{ formatDateTime(data.entrada) }}</template>
      </Column>
      <Column field="salida" header="Salida">
        <template #body="{ data }">{{
          data.salida ? formatDateTime(data.salida) : 'Abierto'
        }}</template>
      </Column>
      <Column header="Quién cerró">
        <template #body="{ data }">{{ quienCerro(data) || '—' }}</template>
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

.query-meta {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--color-muted);
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
