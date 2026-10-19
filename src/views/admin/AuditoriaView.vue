<script setup lang="ts">
import { onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import { formatDateTime, useAdminStore } from '../../stores/admin'

const admin = useAdminStore()
const toast = useToast()

onMounted(async () => {
  try {
    await admin.fetchAuditoria()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudo cargar auditoría',
      life: 5000,
    })
  }
})

function detalleTexto(detalle: Record<string, unknown> | null): string {
  if (!detalle) return '—'
  try {
    return JSON.stringify(detalle)
  } catch {
    return '—'
  }
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

    <DataTable
      :value="admin.auditoriaRows"
      :loading="admin.loading"
      striped-rows
      paginator
      :rows="20"
      :rows-per-page-options="[20, 50, 100]"
      class="audit-table"
      empty-message="Sin eventos de auditoría."
    >
      <Column field="ocurrido_en" header="Fecha" sortable>
        <template #body="{ data }">{{ formatDateTime(data.ocurrido_en) }}</template>
      </Column>
      <Column field="accion" header="Acción" sortable />
      <Column field="entidad" header="Entidad" sortable />
      <Column header="Detalle">
        <template #body="{ data }">
          <span class="detalle">{{ detalleTexto(data.detalle) }}</span>
        </template>
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

.audit-table {
  width: 100%;
}

.detalle {
  font-size: 0.8rem;
  word-break: break-word;
  color: var(--color-muted);
}
</style>
