<script setup lang="ts">
import Message from 'primevue/message'

defineProps<{
  title: string
  description: string
  badge?: string
}>()
</script>

<template>
  <section class="page">
    <header class="page__header">
      <p v-if="badge" class="page__badge">{{ badge }}</p>
      <h2 class="page__title">{{ title }}</h2>
      <p class="page__desc">{{ description }}</p>
    </header>
    <Message severity="info" :closable="false">
      Vista en construcción. Conectaremos esta pantalla en la siguiente fase del MVP.
    </Message>
    <slot />
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.page__badge {
  margin: 0;
  align-self: flex-start;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.page__title {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  color: var(--color-navy);
  font-weight: 700;
}

.page__desc {
  margin: 0;
  color: var(--color-muted);
  width: 100%;
  line-height: 1.5;
}
</style>
