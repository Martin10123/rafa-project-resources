<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import { useAdminStore, type RolAsignable, type UsuarioRol } from '../../stores/admin'

const admin = useAdminStore()
const toast = useToast()
const guardandoId = ref<string | null>(null)
const cargando = ref(false)

const opciones: { label: string; value: RolAsignable }[] = [
  { label: 'Auxiliar', value: 'auxiliar' },
  { label: 'Monitor', value: 'monitor' },
  { label: 'Superadmin', value: 'superadmin' },
]

onMounted(() => {
  void cargar()
})

async function cargar() {
  cargando.value = true
  try {
    await admin.fetchRoles()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudieron cargar los roles',
      life: 5000,
    })
  } finally {
    cargando.value = false
  }
}

async function cambiar(persona: UsuarioRol, rol: RolAsignable | null) {
  if (!rol || persona.es_administrador || persona.rol === rol || guardandoId.value) return
  const anterior = persona.rol
  guardandoId.value = persona.user_id
  try {
    await admin.asignarRol(persona.user_id, rol)
    toast.add({
      severity: 'success',
      summary: 'Rol actualizado',
      detail: `${persona.email} ahora es ${opciones.find((opcion) => opcion.value === rol)?.label ?? rol}.`,
      life: 3500,
    })
  } catch (e) {
    persona.rol = anterior
    toast.add({
      severity: 'error',
      summary: 'No se pudo asignar el rol',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  } finally {
    guardandoId.value = null
  }
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Roles"
      description="Solo el administrador asigna auxiliar, monitor o superadmin. Sin rol, la cuenta ve un aviso para comunicarse contigo. Auxiliar y monitor hacen check-in. Superadmin entra al panel, sin este apartado."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración: el cambio queda solo en esta sesión.
        </Message>
      </template>
    </AdminPageHeader>

    <div class="panel">
      <DataTable
        :value="admin.rolesList"
        :loading="cargando"
        data-key="user_id"
        striped-rows
        paginator
        :rows="10"
        class="roles-table"
        empty-message="No hay cuentas para asignar."
      >
        <Column field="nombre" header="Nombre">
          <template #body="{ data }">{{ data.nombre || '—' }}</template>
        </Column>
        <Column field="email" header="Correo" />
        <Column header="Rol">
          <template #body="{ data }">
            <Tag v-if="data.es_administrador" value="Administrador" severity="info" />
            <Select
              v-else
              :model-value="data.rol"
              :options="opciones"
              option-label="label"
              option-value="value"
              :disabled="guardandoId === data.user_id"
              placeholder="Sin rol"
              fluid
              @update:model-value="cambiar(data, $event)"
            />
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  width: 100%;
}

.demo-banner {
  margin-top: 0.5rem;
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

.roles-table {
  width: 100%;
}
</style>
