<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const menuOpen = ref(false)
const signingOut = ref(false)

const links = [
  { to: '/admin', label: 'Panel', icon: 'pi pi-th-large', exact: true },
  { to: '/admin/historial', label: 'Historial', icon: 'pi pi-history' },
  { to: '/admin/salas', label: 'Salas', icon: 'pi pi-building' },
  { to: '/admin/config', label: 'Configuración', icon: 'pi pi-cog' },
  { to: '/admin/auditoria', label: 'Auditoría', icon: 'pi pi-shield' },
]

const pageTitle = computed(() => {
  const match = links.find((l) =>
    l.exact ? route.path === l.to : route.path.startsWith(l.to),
  )
  return match?.label ?? 'Administración'
})

function isActive(to: string, exact?: boolean) {
  return exact ? route.path === to : route.path.startsWith(to)
}

function closeMenu() {
  menuOpen.value = false
}

async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await auth.signOut()
    await router.replace('/login')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <div class="admin">
    <header class="admin__top">
      <div class="admin__top-inner">
        <Button
          class="admin__menu-btn"
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          aria-label="Abrir menú"
          @click="menuOpen = !menuOpen"
        />
        <div class="admin__brand">
          <span class="admin__mark" aria-hidden="true" />
          <div class="admin__titles">
            <p class="admin__eyebrow">Tecnológico Comfenalco</p>
            <h1 class="admin__title">{{ pageTitle }}</h1>
          </div>
        </div>
        <button type="button" class="admin__exit" :disabled="signingOut" @click="logout">
          {{ signingOut ? 'Saliendo…' : 'Salir' }}
        </button>
      </div>
    </header>

    <div class="admin__body">
      <aside class="admin__aside" :class="{ 'admin__aside--open': menuOpen }">
        <nav class="admin__nav" aria-label="Administración">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="admin__link"
            :class="{ 'admin__link--active': isActive(link.to, link.exact) }"
            @click="closeMenu"
          >
            <i :class="link.icon" aria-hidden="true" />
            {{ link.label }}
          </RouterLink>
        </nav>
      </aside>

      <div v-if="menuOpen" class="admin__backdrop" @click="closeMenu" />

      <main class="admin__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin {
  min-height: 100svh;
  width: 100%;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
}

.admin__top {
  width: 100%;
  background: var(--color-navy);
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 30;
}

.admin__top-inner {
  width: 100%;
  padding: 0.75rem var(--space-page);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin__menu-btn {
  color: #fff !important;
  flex-shrink: 0;
}

.admin__brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex: 1;
  min-width: 0;
}

.admin__titles {
  min-width: 0;
}

.admin__mark {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff 0 28%, transparent 29%),
    conic-gradient(from 200deg, var(--color-red), var(--color-navy-light), var(--color-navy), var(--color-red));
  flex-shrink: 0;
}

.admin__eyebrow {
  margin: 0;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin__title {
  margin: 0;
  font-size: clamp(0.95rem, 2.8vw, 1.1rem);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin__exit {
  color: #fff;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  opacity: 0.9;
  flex-shrink: 0;
  padding: 0.35rem 0.5rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 0.35rem;
  cursor: pointer;
  font: inherit;
}

.admin__exit:hover:not(:disabled) {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.admin__exit:disabled {
  opacity: 0.6;
  cursor: wait;
}

.admin__body {
  flex: 1;
  display: flex;
  width: 100%;
  position: relative;
}

.admin__aside {
  position: fixed;
  inset: 3.5rem auto 0 0;
  width: min(16rem, 88vw);
  background: #fff;
  border-right: 1px solid var(--color-border);
  padding: 1rem 0.75rem;
  transform: translateX(-105%);
  transition: transform 0.2s ease;
  z-index: 25;
}

.admin__aside--open {
  transform: translateX(0);
}

.admin__backdrop {
  position: fixed;
  inset: 3.5rem 0 0 0;
  background: rgba(15, 23, 42, 0.35);
  z-index: 20;
}

.admin__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin__link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border-radius: 0.4rem;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}

.admin__link i {
  color: var(--color-muted);
  width: 1.1rem;
  text-align: center;
}

.admin__link:hover {
  background: var(--color-surface);
}

.admin__link--active {
  background: #eef1f9;
  color: var(--color-navy);
  font-weight: 700;
}

.admin__link--active i {
  color: var(--color-navy);
}

.admin__main {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: var(--space-page);
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
}

@media (min-width: 900px) {
  .admin__menu-btn {
    display: none !important;
  }

  .admin__aside {
    position: sticky;
    top: 3.5rem;
    inset: auto;
    height: calc(100svh - 3.5rem);
    width: 15rem;
    transform: none;
    flex-shrink: 0;
  }

  .admin__backdrop {
    display: none;
  }
}
</style>
