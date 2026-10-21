<script setup lang="ts">
import { onUnmounted, computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const admin = useAdminStore()
const menuOpen = ref(false)
const signingOut = ref(false)

type NavLink = { to: string; label: string; icon: string; exact?: boolean }

const allLinks: NavLink[] = [
  { to: '/admin', label: 'Panel', icon: 'pi pi-th-large', exact: true },
  { to: '/admin/historial', label: 'Historial', icon: 'pi pi-history' },
  { to: '/admin/salas', label: 'Salas', icon: 'pi pi-building' },
  { to: '/admin/config', label: 'Configuración', icon: 'pi pi-cog' },
  { to: '/admin/auditoria', label: 'Auditoría', icon: 'pi pi-shield' },
]

const links = computed<NavLink[]>(() =>
  auth.isJefa && !auth.isAdmin
    ? [{ to: '/admin/historial', label: 'Historial', icon: 'pi pi-download' }]
    : allLinks,
)

const pageTitle = computed(() => {
  const match = links.value.find((l) =>
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

watch(
  () => auth.isAdmin,
  (isAdmin) => {
    if (isAdmin) admin.startOccupancyWatch()
    else admin.stopOccupancyWatch()
  },
  { immediate: true },
)

onUnmounted(() => {
  admin.stopOccupancyWatch()
})

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
  <div class="relative min-h-svh bg-[#e7eef8] font-display text-slate-800 antialiased">
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute -top-24 right-0 h-72 w-72 rounded-full bg-navy/15 blur-3xl" />
      <div class="absolute top-1/3 -left-16 h-64 w-64 rounded-full bg-brand-red/10 blur-3xl" />
      <div
        class="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(44,67,143,0.14)_1px,transparent_1px)] [background-size:22px_22px]"
      />
    </div>

    <header
      class="sticky top-0 z-30 border-b border-white/10 bg-[#142454]/88 text-white shadow-[0_12px_40px_-24px_rgba(12,23,56,0.8)] backdrop-blur-xl"
    >
      <div class="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          class="inline-flex size-11 items-center justify-center rounded-xl text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 min-[900px]:hidden"
          :aria-expanded="menuOpen"
          aria-label="Abrir menú"
          @click="menuOpen = !menuOpen"
        >
          <i class="pi pi-bars text-lg" aria-hidden="true" />
        </button>
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <span
            class="inline-block size-10 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff_0_28%,transparent_29%),conic-gradient(from_200deg,#dc3545,#c5d0e0,#fff,#dc3545)] shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p class="m-0 truncate text-[0.68rem] font-semibold tracking-[0.16em] text-white/75 uppercase">
              Tecnológico Comfenalco
            </p>
            <h1 class="m-0 truncate text-lg font-extrabold tracking-tight">{{ pageTitle }}</h1>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-white/25 bg-white/10 px-3.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-60"
          :disabled="signingOut"
          @click="logout"
        >
          {{ signingOut ? 'Saliendo…' : 'Salir' }}
        </button>
      </div>
    </header>

    <div class="relative z-10 flex min-h-[calc(100svh-4.25rem)]">
      <aside
        class="fixed inset-y-0 left-0 z-40 w-[min(16rem,88vw)] border-r border-white/60 bg-white/80 px-3 pt-[5.25rem] pb-6 shadow-2xl shadow-navy/10 backdrop-blur-xl transition-transform duration-300 min-[900px]:sticky min-[900px]:top-[4.25rem] min-[900px]:z-10 min-[900px]:h-[calc(100svh-4.25rem)] min-[900px]:w-60 min-[900px]:pt-4 min-[900px]:shadow-none"
        :class="menuOpen ? 'translate-x-0' : '-translate-x-[105%] min-[900px]:translate-x-0'"
      >
        <p
          v-if="auth.isSuperadmin"
          class="mx-3 mb-3 rounded-xl bg-navy px-3 py-2 text-xs font-bold tracking-wide text-white uppercase"
        >
          Superadmin
        </p>
        <nav class="flex flex-col gap-1" aria-label="Administración">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
            :class="
              isActive(link.to, link.exact)
                ? 'bg-navy text-white shadow-[0_10px_24px_-16px_rgba(31,49,112,0.9)] hover:bg-navy'
                : ''
            "
            @click="closeMenu"
          >
            <i
              :class="[link.icon, isActive(link.to, link.exact) ? 'text-white' : 'text-slate-500']"
              aria-hidden="true"
            />
            {{ link.label }}
          </RouterLink>
        </nav>
      </aside>

      <button
        v-if="menuOpen"
        type="button"
        class="fixed inset-0 z-30 bg-[#0c1738]/40 backdrop-blur-[2px] min-[900px]:hidden"
        aria-label="Cerrar menú"
        @click="closeMenu"
      />

      <main class="min-w-0 flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 min-[900px]:px-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
