<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import AdminPageHeader from './AdminPageHeader.vue'
import { formatDateTime, useAdminStore } from '../../stores/admin'

const admin = useAdminStore()
const confirm = useConfirm()
const toast = useToast()

let channel: RealtimeChannel | null = null

onMounted(async () => {
  await admin.fetchDashboard()
  if (supabase) {
    channel = supabase
      .channel('admin-registros-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registros' },
        () => {
          void admin.fetchDashboard()
        },
      )
      .subscribe()
  }
})

onUnmounted(() => {
  if (channel && supabase) {
    void supabase.removeChannel(channel)
  }
})

function displayName(nombre: string | null, email: string): string {
  return nombre?.trim() ? nombre : email
}

function confirmCloseRegistro(registroId: string, label: string) {
  confirm.require({
    message: `¿Cerrar el registro de ${label}?`,
    header: 'Cierre manual',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancelar',
    acceptLabel: 'Cerrar registro',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await admin.closeRegistro(registroId)
        toast.add({ severity: 'success', summary: 'Registro cerrado', life: 3000 })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: e instanceof Error ? e.message : 'No se pudo cerrar',
          life: 5000,
        })
      }
    },
  })
}

function confirmCloseSala(salaId: string, nombre: string, count: number) {
  if (count === 0) return
  confirm.require({
    message: `¿Cerrar los ${count} registro(s) abiertos en ${nombre}?`,
    header: 'Cierre por sala',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancelar',
    acceptLabel: 'Cerrar todos',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await admin.closeAllInSala(salaId)
        toast.add({ severity: 'success', summary: 'Sala liberada', life: 3000 })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: e instanceof Error ? e.message : 'No se pudo cerrar',
          life: 5000,
        })
      }
    },
  })
}
</script>

<template>
  <section class="admin-page">
    <AdminPageHeader
      title="Estado de salas"
      description="Ocupación en tiempo real y cierre manual por registro o por sala completa."
    >
      <template #meta>
        <Message v-if="admin.demoMode" severity="warn" :closable="false" class="demo-banner">
          Modo demostración: datos locales. Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para
          datos en vivo.
        </Message>
      </template>
    </AdminPageHeader>

    <div v-if="admin.loading && !admin.dashboardSalas.length" class="admin-page__loading">
      Cargando salas…
    </div>

    <div v-else class="grid">
      <article v-for="sala in admin.dashboardSalas" :key="sala.id" class="tile">
        <div class="tile__head">
          <div>
            <h3>{{ sala.nombre }}</h3>
            <p v-if="sala.ubicacion" class="tile__ubic">{{ sala.ubicacion }}</p>
          </div>
          <Tag
            :value="sala.openRegistros.length ? 'Ocupada' : 'Disponible'"
            :severity="sala.openRegistros.length ? 'danger' : 'success'"
          />
        </div>

        <p class="tile__count">
          {{ sala.openRegistros.length }}
          {{ sala.openRegistros.length === 1 ? 'persona dentro' : 'personas dentro' }}
        </p>

        <ul v-if="sala.openRegistros.length" class="tile__list">
          <li v-for="reg in sala.openRegistros" :key="reg.id" class="tile__row">
            <div class="tile__person">
              <strong>{{ displayName(reg.nombre, reg.email) }}</strong>
              <span class="tile__motivo">{{ reg.motivo }}</span>
              <span class="tile__time">Entrada: {{ formatDateTime(reg.entrada) }}</span>
            </div>
            <Button
              label="Cerrar"
              size="small"
              severity="danger"
              outlined
              @click="confirmCloseRegistro(reg.id, displayName(reg.nombre, reg.email))"
            />
          </li>
        </ul>
        <p v-else class="tile__empty">Sin registros abiertos</p>

        <Button
          v-if="sala.openRegistros.length"
          label="Cerrar todos en esta sala"
          icon="pi pi-times-circle"
          severity="danger"
          class="tile__close-all"
          @click="confirmCloseSala(sala.id, sala.nombre, sala.openRegistros.length)"
        />

        <Tag v-if="!sala.activa" value="Inactiva" severity="secondary" class="tile__inactive" />
      </article>
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

.admin-page__loading {
  color: var(--color-muted);
  padding: 2rem 0;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  width: 100%;
}

.tile {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tile__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.tile h3 {
  margin: 0;
  color: var(--color-navy);
  font-size: 1.1rem;
}

.tile__ubic {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.tile__count {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

.tile__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.tile__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: var(--color-surface);
  border-radius: 0.4rem;
}

.tile__person {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.tile__motivo,
.tile__time {
  font-size: 0.8rem;
  color: var(--color-muted);
}

.tile__empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

.tile__close-all {
  align-self: flex-start;
}

.tile__inactive {
  align-self: flex-start;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1100px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
