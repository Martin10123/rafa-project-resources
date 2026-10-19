<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="topbar__inner">
        <RouterLink to="/login" class="brand">
          <span class="brand__mark" aria-hidden="true" />
          <span class="brand__text">
            <span class="brand__name">Tecnológico Comfenalco</span>
            <span class="brand__app">Check-in Salas</span>
          </span>
        </RouterLink>
      </div>
    </header>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100svh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.topbar {
  width: 100%;
  background: var(--color-navy);
  color: #fff;
}

.topbar__inner {
  width: 100%;
  padding: 0.85rem var(--space-page);
  display: flex;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.brand__mark {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff 0 28%, transparent 29%),
    conic-gradient(from 200deg, var(--color-red), var(--color-navy-light), var(--color-navy), var(--color-red));
  flex-shrink: 0;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}

.brand__name {
  font-size: clamp(0.62rem, 2.2vw, 0.72rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand__app {
  font-size: clamp(0.95rem, 3vw, 1.1rem);
  font-weight: 700;
}

.main {
  flex: 1;
  width: 100%;
  padding: var(--space-page);
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  box-sizing: border-box;
}
</style>
