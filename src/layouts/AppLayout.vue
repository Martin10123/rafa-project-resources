<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="relative flex min-h-svh flex-col bg-[#e7eef8] font-display text-slate-800 antialiased">
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="absolute -top-20 right-0 h-72 w-72 rounded-full bg-navy/15 blur-3xl" />
      <div class="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-red/10 blur-3xl" />
      <div
        class="absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(44,67,143,0.14)_1px,transparent_1px)] [background-size:22px_22px]"
      />
    </div>

    <header class="relative z-10 border-b border-white/10 bg-[#142454]/88 text-white backdrop-blur-xl">
      <div class="flex items-center px-4 py-3.5 sm:px-6">
        <RouterLink to="/inicio" class="flex min-w-0 items-center gap-3 text-inherit no-underline">
          <span
            class="inline-block size-10 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff_0_28%,transparent_29%),conic-gradient(from_200deg,#dc3545,#c5d0e0,#fff,#dc3545)] shadow-[0_0_0_4px_rgba(255,255,255,0.12)]"
            aria-hidden="true"
          />
          <span class="flex min-w-0 flex-col leading-tight">
            <span class="truncate text-[0.68rem] font-semibold tracking-[0.16em] text-white/75 uppercase">
              Tecnológico Comfenalco
            </span>
            <span class="truncate text-lg font-extrabold tracking-tight">Check-in Salas</span>
          </span>
        </RouterLink>
      </div>
    </header>

    <main class="relative z-10 flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <slot />
    </main>
  </div>
</template>
