<script setup lang="ts">
import type { Sede } from '../types'

defineProps<{
  sedes: Sede[]
  modelValue: string | null
  prompt: string
  allowAll?: boolean
  allowNone?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="mb-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_50px_-28px_rgb(15_23_42/0.38)]">
    <p class="m-0 text-sm font-semibold text-navy">{{ prompt }}</p>
    <div class="mt-3 flex flex-wrap gap-2" role="group" :aria-label="prompt">
      <button
        v-for="sede in sedes"
        :key="sede.id"
        type="button"
        class="min-h-11 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        :class="
          modelValue === sede.id
            ? 'border-navy bg-navy text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-navy/30'
        "
        :aria-pressed="modelValue === sede.id"
        @click="emit('update:modelValue', sede.id)"
      >
        {{ sede.nombre }}
      </button>
      <button
        v-if="allowAll"
        type="button"
        class="min-h-11 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        :class="
          modelValue === 'all'
            ? 'border-navy bg-navy text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-navy/30'
        "
        :aria-pressed="modelValue === 'all'"
        @click="emit('update:modelValue', 'all')"
      >
        Todas las sedes
      </button>
      <button
        v-if="allowNone"
        type="button"
        class="min-h-11 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        :class="
          modelValue === 'none'
            ? 'border-navy bg-navy text-white'
            : 'border-slate-200 bg-white text-slate-700 hover:border-navy/30'
        "
        :aria-pressed="modelValue === 'none'"
        @click="emit('update:modelValue', 'none')"
      >
        Sin sede
      </button>
    </div>
  </div>
</template>
