<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="admin-page__header">
    <h2 class="admin-page__title">{{ title }}</h2>
    <p v-if="description" class="admin-page__desc">{{ description }}</p>
    <slot name="meta" />
  </header>
</template>

<style scoped>
.admin-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
}

.admin-page__title {
  margin: 0;
  font-size: clamp(1.45rem, 3vw, 1.9rem);
  color: var(--color-navy);
  font-weight: 800;
  letter-spacing: -0.035em;
}

.admin-page__desc {
  margin: 0;
  color: #475569;
  line-height: 1.5;
  width: 100%;
  max-width: 42rem;
}
</style>
