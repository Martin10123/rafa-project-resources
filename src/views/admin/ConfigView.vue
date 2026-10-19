<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import AdminPageHeader from './AdminPageHeader.vue'
import { useAdminStore } from '../../stores/admin'

const admin = useAdminStore()
const toast = useToast()
const margen = ref(15)
const saving = ref(false)

onMounted(async () => {
  try {
    await admin.fetchConfig()
    margen.value = admin.margenGraciaMinutos
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e instanceof Error ? e.message : 'No se pudo cargar la configuración',
      life: 5000,
    })
  }
})

async function guardar() {
  if (margen.value == null || margen.value < 0) {
    toast.add({ severity: 'warn', summary: 'Valor inválido', life: 3000 })
    return
  }
  saving.value = true
  try {
    await admin.saveMargenGracia(margen.value)
    toast.add({
      severity: 'success',
      summary: 'Configuración guardada',
      detail: `Margen de gracia: ${margen.value} min`,
      life: 3500,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Error al guardar',
      detail: e instanceof Error ? e.message : 'Intente de nuevo',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Configuración"
      description="Margen de gracia del cierre automático (minutos después del fin de franja). Valor editable sin redeploy."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración: el valor se guarda solo en esta sesión.
        </Message>
      </template>
    </AdminPageHeader>

    <div class="config">
      <label class="field">
        <span>Margen de gracia (minutos)</span>
        <InputNumber v-model="margen" :min="0" :max="120" show-buttons fluid />
      </label>
      <p class="hint">
        Tras finalizar la franja horaria del día, los registros abiertos se cierran automáticamente
        cuando transcurran estos minutos (job en servidor).
      </p>
      <Button
        label="Guardar"
        icon="pi pi-save"
        :loading="saving"
        @click="guardar"
      />
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

.config {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 28rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
  line-height: 1.45;
  font-weight: 400;
}
</style>
