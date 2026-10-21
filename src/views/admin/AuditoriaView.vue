<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import { resumenDetalle, seccionesDetalle, type SeccionDetalle } from '../../lib/auditoriaDetalle'
import { formatDateTime, useAdminStore, type AuditoriaRow } from '../../stores/admin'

const admin = useAdminStore()
const toast = useToast()
const first = ref(0)
const pageSize = ref(20)
const detalleAbierto = ref(false)
const detalleTitulo = ref('')
const detalleCuando = ref('')
const detalleSecciones = ref<SeccionDetalle[]>([])

onMounted(() => {
  void cargar()
})

async function cargar(force = false) {
  try {
    await admin.fetchAuditoria({ first: first.value, rows: pageSize.value }, { force })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudo cargar auditoría',
      life: 5000,
    })
  }
}

function onPage(event: { first: number; rows: number }) {
  first.value = event.first
  pageSize.value = event.rows
  void cargar(true)
}

function abrirDetalle(row: AuditoriaRow) {
  detalleTitulo.value = `${row.accion} · ${row.entidad}`
  detalleCuando.value = formatDateTime(row.ocurrido_en)
  detalleSecciones.value = seccionesDetalle(row.detalle)
  detalleAbierto.value = true
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Auditoría"
      description="Cierres manuales, cambios de horarios, rotación de tokens y ajustes de configuración (registrados por triggers)."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración con eventos de ejemplo.
        </Message>
      </template>
    </AdminPageHeader>

    <p v-if="admin.auditoriaMs != null" class="query-meta">
      {{ admin.auditoriaTotal }} eventos · consulta {{ admin.auditoriaMs }} ms
    </p>

    <DataTable
      :value="admin.auditoriaRows"
      :loading="admin.loading"
      lazy
      striped-rows
      paginator
      :first="first"
      :rows="pageSize"
      :total-records="admin.auditoriaTotal"
      :rows-per-page-options="[20, 50, 100]"
      class="audit-table"
      empty-message="Sin eventos de auditoría."
      @page="onPage"
    >
      <Column field="ocurrido_en" header="Fecha">
        <template #body="{ data }">{{ formatDateTime(data.ocurrido_en) }}</template>
      </Column>
      <Column field="accion" header="Acción" />
      <Column field="entidad" header="Entidad" />
      <Column header="Detalle">
        <template #body="{ data }">
          <button type="button" class="detalle-btn" @click="abrirDetalle(data)">
            {{ resumenDetalle(data.detalle) }}
          </button>
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="detalleAbierto"
      modal
      dismissable-mask
      :header="detalleTitulo"
      :style="{ width: 'min(calc(100vw - 2rem), 32rem)' }"
    >
      <p class="detalle-cuando">{{ detalleCuando }}</p>
      <p v-if="!detalleSecciones.length" class="detalle-vacio">Este evento no tiene más detalle.</p>
      <section v-for="seccion in detalleSecciones" :key="seccion.titulo" class="detalle-sec">
        <h3>{{ seccion.titulo }}</h3>
        <dl>
          <template v-for="campo in seccion.campos" :key="campo.etiqueta">
            <dt>{{ campo.etiqueta }}</dt>
            <dd>{{ campo.valor }}</dd>
          </template>
        </dl>
      </section>
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

.query-meta {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.audit-table {
  width: 100%;
}

.detalle-btn {
  max-width: 18rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-navy);
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detalle-btn:hover {
  text-decoration: underline;
}

.detalle-cuando,
.detalle-vacio {
  margin: 0 0 0.75rem;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.detalle-sec + .detalle-sec {
  margin-top: 1rem;
}

.detalle-sec h3 {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-navy);
}

.detalle-sec dl {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.35rem 0.75rem;
  margin: 0;
}

.detalle-sec dt {
  color: var(--color-muted);
  font-size: 0.8rem;
}

.detalle-sec dd {
  margin: 0;
  font-size: 0.9rem;
}
</style>
