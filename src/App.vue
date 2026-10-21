<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()
let timer = 0

async function revisarInactividad() {
  if (document.visibilityState === 'hidden') return
  const expiro = await auth.expireIfIdle()
  if (expiro && router.currentRoute.value.name !== 'login') {
    await router.replace({ name: 'login' })
  }
}

function onActivity() {
  auth.registrarActividad()
}

onMounted(() => {
  window.addEventListener('pointerdown', onActivity, { passive: true })
  window.addEventListener('keydown', onActivity)
  document.addEventListener('visibilitychange', revisarInactividad)
  timer = window.setInterval(() => {
    void revisarInactividad()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onActivity)
  window.removeEventListener('keydown', onActivity)
  document.removeEventListener('visibilitychange', revisarInactividad)
  window.clearInterval(timer)
})
</script>

<template>
  <RouterView />
  <Toast position="top-center" />
  <ConfirmDialog />
</template>
