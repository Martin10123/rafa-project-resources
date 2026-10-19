<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, useAttrs, watch, type PropType } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Textarea from 'primevue/textarea'
import { resolvePostLoginPath } from '../lib/postLogin'
import { useAuthStore } from '../stores/auth'

type Step = 'login' | 'register' | 'confirm-sent' | 'forgot' | 'set-password'
type GlyphNode = { tag: string; attrs: Record<string, string | number> }
type IconName =
  | 'user'
  | 'lock'
  | 'eye'
  | 'eyeOff'
  | 'mail'
  | 'monitor'
  | 'scan'
  | 'shield'
  | 'alert'
  | 'arrowLeft'
  | 'check'
  | 'userPlus'
  | 'key'
  | 'link'

const glyphs: Record<IconName, GlyphNode[]> = {
  user: [
    { tag: 'path', attrs: { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' } },
    { tag: 'circle', attrs: { cx: 12, cy: 7, r: 4 } },
  ],
  lock: [
    { tag: 'rect', attrs: { width: 18, height: 11, x: 3, y: 11, rx: 2, ry: 2 } },
    { tag: 'path', attrs: { d: 'M7 11V7a5 5 0 0 1 10 0v4' } },
  ],
  eye: [
    {
      tag: 'path',
      attrs: {
        d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
      },
    },
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } },
  ],
  eyeOff: [
    {
      tag: 'path',
      attrs: { d: 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49' },
    },
    { tag: 'path', attrs: { d: 'M14.084 14.158a3 3 0 0 1-4.242-4.242' } },
    {
      tag: 'path',
      attrs: {
        d: 'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143',
      },
    },
    { tag: 'path', attrs: { d: 'm2 2 20 20' } },
  ],
  mail: [
    { tag: 'rect', attrs: { width: 20, height: 16, x: 2, y: 4, rx: 2 } },
    { tag: 'path', attrs: { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' } },
  ],
  monitor: [
    { tag: 'rect', attrs: { width: 20, height: 14, x: 2, y: 3, rx: 2 } },
    { tag: 'path', attrs: { d: 'M8 21h8' } },
    { tag: 'path', attrs: { d: 'M12 17v4' } },
  ],
  scan: [
    { tag: 'path', attrs: { d: 'M3 7V5a2 2 0 0 1 2-2h2' } },
    { tag: 'path', attrs: { d: 'M17 3h2a2 2 0 0 1 2 2v2' } },
    { tag: 'path', attrs: { d: 'M21 17v2a2 2 0 0 1-2 2h-2' } },
    { tag: 'path', attrs: { d: 'M7 21H5a2 2 0 0 1-2-2v-2' } },
    { tag: 'path', attrs: { d: 'M7 12h10' } },
  ],
  shield: [
    {
      tag: 'path',
      attrs: {
        d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      },
    },
    { tag: 'path', attrs: { d: 'm9 12 2 2 4-4' } },
  ],
  alert: [
    { tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } },
    { tag: 'path', attrs: { d: 'M12 8v4' } },
    { tag: 'path', attrs: { d: 'M12 16h.01' } },
  ],
  arrowLeft: [
    { tag: 'path', attrs: { d: 'm12 19-7-7 7-7' } },
    { tag: 'path', attrs: { d: 'M19 12H5' } },
  ],
  check: [{ tag: 'path', attrs: { d: 'M20 6 9 17l-5-5' } }],
  userPlus: [
    { tag: 'path', attrs: { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' } },
    { tag: 'circle', attrs: { cx: 9, cy: 7, r: 4 } },
    { tag: 'path', attrs: { d: 'M19 8v6' } },
    { tag: 'path', attrs: { d: 'M22 11h-6' } },
  ],
  key: [
    {
      tag: 'path',
      attrs: {
        d: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
      },
    },
    { tag: 'circle', attrs: { cx: '16.5', cy: '7.5', r: '.5', fill: 'currentColor' } },
  ],
  link: [
    { tag: 'path', attrs: { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' } },
    { tag: 'path', attrs: { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' } },
  ],
}

const Icon = defineComponent({
  name: 'LoginIcon',
  inheritAttrs: false,
  props: {
    name: { type: String as PropType<IconName>, required: true },
  },
  setup(props) {
    const attrs = useAttrs()
    return () =>
      h(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 24 24',
          width: '24',
          height: '24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.75',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          ...attrs,
        },
        (glyphs[props.name] ?? []).map((node) => h(node.tag, node.attrs)),
      )
  },
})

const router = useRouter()
const route = useRoute()
const toast = useToast()
const auth = useAuthStore()

const step = ref<Step>('login')
const identifier = ref('')
const password = ref('')
const passwordConfirm = ref('')
const nombre = ref('')
const magicLinkPaste = ref('')
const loading = ref(false)
const nombreDialog = ref(false)
const savingNombre = ref(false)
const formError = ref('')
const nombreError = ref('')

const heading = computed(() => {
  switch (step.value) {
    case 'login':
      return 'Ingresar'
    case 'register':
      return 'Crear cuenta'
    case 'forgot':
      return 'Recuperar contraseña'
    case 'set-password':
      return 'Nueva contraseña'
    default:
      return 'Revisa tu correo'
  }
})

const highlights = [
  {
    icon: 'monitor' as const,
    title: 'Salas en red',
    text: 'Cupo y estado de cada laboratorio, en un solo lugar.',
  },
  {
    icon: 'scan' as const,
    title: 'Check-in al instante',
    text: 'Escaneas el QR de la sala y la asistencia queda registrada.',
  },
  {
    icon: 'shield' as const,
    title: 'Acceso institucional',
    text: 'Solo cuentas institucionales Comfenalco.',
  },
]

const control =
  'h-[3.75rem] w-full rounded-xl border border-slate-300/90 bg-white/90 pb-2 pl-11 text-base text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition-all duration-300 placeholder:text-transparent hover:border-navy/35 focus:border-navy focus:bg-white focus:ring-2 focus:ring-navy/25'
const textControl = `${control} pr-4 pt-6`
const secretControl = `${control} pr-12 pt-6`
const areaControl =
  'min-h-28 w-full resize-y rounded-xl border border-slate-300/90 bg-white/90 px-3.5 py-3 text-base leading-relaxed text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none transition-all duration-300 placeholder:text-slate-500 hover:border-navy/35 focus:border-navy focus:bg-white focus:ring-2 focus:ring-navy/25'
const primaryBtn =
  'group relative inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#18265a] via-navy to-navy-light px-4 py-3 text-center text-[0.95rem] font-semibold tracking-tight text-white shadow-[0_12px_32px_-14px_rgba(31,49,112,0.9)] transition-all duration-300 hover:shadow-[0_18px_40px_-14px_rgba(31,49,112,1)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 disabled:active:scale-100'
const textBtn =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold text-navy underline-offset-4 transition-colors duration-200 hover:text-navy-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2'

const dialogPt = {
  mask: { class: 'login-dialog-mask' },
  root: { class: 'login-dialog' },
  header: { class: 'login-dialog-header' },
  title: { class: 'login-dialog-title' },
  content: { class: 'login-dialog-content' },
  footer: { class: 'login-dialog-footer' },
}

watch(step, () => {
  formError.value = ''
})

function postLoginPath() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  return resolvePostLoginPath(auth.isAdmin, redirect)
}

function reportError(summary: string, detail: string) {
  formError.value = detail
  toast.add({
    severity: 'error',
    summary,
    detail,
    life: 6000,
  })
}

async function finishLogin() {
  if (!auth.perfil?.nombre?.trim()) {
    nombre.value = ''
    nombreError.value = ''
    nombreDialog.value = true
    return
  }
  await router.push(postLoginPath())
}

async function submitLogin() {
  formError.value = ''
  loading.value = true
  try {
    const result = await auth.signInWithPassword(identifier.value, password.value)
    if (!result.ok) {
      reportError('No se pudo ingresar', result.message)
      return
    }
    password.value = ''
    await finishLogin()
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  formError.value = ''
  loading.value = true
  try {
    const result = await auth.signUpWithPassword(
      identifier.value,
      password.value,
      passwordConfirm.value,
      nombre.value,
    )
    if (!result.ok) {
      reportError('No se pudo registrar', result.message)
      return
    }

    password.value = ''
    passwordConfirm.value = ''

    if (result.needsEmailConfirmation) {
      step.value = 'confirm-sent'
      toast.add({
        severity: 'success',
        summary: 'Confirma tu correo',
        detail: 'Te enviamos un enlace único. Después entra con usuario y contraseña.',
        life: 7000,
      })
      return
    }

    await finishLogin()
  } finally {
    loading.value = false
  }
}

async function submitForgot() {
  formError.value = ''
  loading.value = true
  try {
    const result = await auth.requestPasswordReset(identifier.value)
    if (!result.ok) {
      reportError('No se pudo enviar', result.message)
      return
    }
    step.value = 'confirm-sent'
    toast.add({
      severity: 'success',
      summary: 'Correo enviado',
      detail: 'Abre el enlace para crear tu nueva contraseña (solo esta vez).',
      life: 7000,
    })
  } finally {
    loading.value = false
  }
}

async function submitNewPassword() {
  formError.value = ''
  loading.value = true
  try {
    const result = await auth.updatePassword(password.value, passwordConfirm.value)
    if (!result.ok) {
      reportError('Contraseña', result.message)
      return
    }
    password.value = ''
    passwordConfirm.value = ''
    toast.add({
      severity: 'success',
      summary: 'Contraseña guardada',
      detail: 'Ya puedes usar usuario/correo y contraseña en cada ingreso.',
      life: 5000,
    })
    await finishLogin()
  } finally {
    loading.value = false
  }
}

async function submitPastedLink() {
  formError.value = ''
  loading.value = true
  try {
    const result = await auth.completeFromMagicLinkUrl(magicLinkPaste.value)
    if (!result.ok) {
      reportError('Enlace inválido', result.message)
      return
    }
    magicLinkPaste.value = ''
    if (route.query.reset === '1' || step.value === 'confirm-sent') {
      step.value = 'set-password'
      toast.add({
        severity: 'info',
        summary: 'Define tu contraseña',
        detail: 'Así ya no necesitarás el correo en cada ingreso.',
        life: 6000,
      })
      return
    }
    await finishLogin()
  } finally {
    loading.value = false
  }
}

async function saveNombre() {
  nombreError.value = ''
  savingNombre.value = true
  try {
    const result = await auth.updateNombre(nombre.value)
    if (!result.ok) {
      nombreError.value = result.message
      toast.add({ severity: 'error', summary: 'Nombre', detail: result.message, life: 5000 })
      return
    }
    nombreDialog.value = false
    await router.push(postLoginPath())
  } finally {
    savingNombre.value = false
  }
}

function goLogin() {
  step.value = 'login'
  password.value = ''
  passwordConfirm.value = ''
  magicLinkPaste.value = ''
}

function goRegister() {
  step.value = 'register'
  password.value = ''
  passwordConfirm.value = ''
}

function goForgot() {
  step.value = 'forgot'
  password.value = ''
  passwordConfirm.value = ''
}

onMounted(async () => {
  await auth.init()

  if (route.query.reset === '1' && auth.isAuthenticated) {
    step.value = 'set-password'
    return
  }

  if (auth.isAuthenticated) {
    if (route.query.complete === '1' || !auth.perfil?.nombre?.trim()) {
      nombreDialog.value = true
      return
    }
    await router.replace(postLoginPath())
  }
})
</script>

<template>
  <div class="login-shell relative min-h-svh bg-[#e7eef8] font-display text-slate-800 antialiased">
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="orb orb-a" />
      <div class="orb orb-b" />
      <div class="orb orb-c" />
      <div class="dot-grid-light absolute inset-0" />
    </div>

    <div class="relative z-10 flex min-h-svh flex-col md:grid md:grid-cols-12">
      <aside
        class="mesh-dark relative hidden min-h-svh overflow-hidden text-white md:col-span-5 md:flex md:flex-col md:justify-between md:p-8 lg:col-span-6 lg:p-12 xl:col-span-7 xl:p-14"
      >
        <div class="dot-grid absolute inset-0" aria-hidden="true" />
        <div class="orb orb-panel-a" aria-hidden="true" />
        <div class="orb orb-panel-b" aria-hidden="true" />
        <div class="orb orb-panel-c" aria-hidden="true" />
        <svg class="network" viewBox="0 0 640 720" aria-hidden="true">
          <g fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1">
            <path d="M80 140h150l70 90H430" />
            <path d="M160 520l90-160 120 40 90-120" />
            <path d="M300 180l40 150" />
            <path d="M470 250l80 70" />
          </g>
          <g fill="rgba(255,255,255,0.85)">
            <circle cx="80" cy="140" r="4" />
            <circle cx="230" cy="140" r="3" />
            <circle cx="300" cy="230" r="4" />
            <circle cx="430" cy="230" r="3" />
            <circle cx="160" cy="520" r="4" />
            <circle cx="250" cy="360" r="3" />
            <circle cx="370" cy="400" r="4" />
            <circle cx="460" cy="280" r="3" />
            <circle cx="550" cy="320" r="4" />
          </g>
        </svg>

        <div class="relative z-10 flex items-center gap-3">
          <span class="brand-mark" aria-hidden="true" />
          <div>
            <p class="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-white/75 uppercase">
              Fundación Universitaria
            </p>
            <p class="m-0 text-sm font-semibold text-white">Check-in de salas</p>
          </div>
        </div>

        <div class="relative z-10 max-w-xl py-10">
          <h1 class="m-0 text-4xl leading-[1.05] font-extrabold tracking-tight text-white lg:text-5xl xl:text-6xl">
            Tecnológico Comfenalco
          </h1>
          <p class="mt-4 max-w-md text-base leading-relaxed text-white/90 lg:text-lg">
            Check-in digital de salas de sistemas. Entra, reserva y registra tu asistencia con el
            mismo acceso institucional.
          </p>
        </div>

        <ul class="relative z-10 m-0 grid list-none gap-3 p-0">
          <li
            v-for="item in highlights"
            :key="item.title"
            class="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            <span
              class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"
            >
              <Icon :name="item.icon" class="size-[18px]" />
            </span>
            <span>
              <span class="block text-sm font-semibold tracking-tight text-white">{{ item.title }}</span>
              <span class="mt-0.5 block text-sm leading-snug text-white/80">{{ item.text }}</span>
            </span>
          </li>
        </ul>
      </aside>

      <header
        class="relative px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-6 md:hidden"
      >
        <div
          class="mesh-dark relative overflow-hidden rounded-[1.75rem] border border-white/10 px-5 py-6 text-white shadow-[0_24px_50px_-28px_rgba(12,23,56,0.85)]"
        >
          <div class="dot-grid absolute inset-0 opacity-70" aria-hidden="true" />
          <div class="orb orb-panel-b" aria-hidden="true" />
          <div class="relative z-10 flex items-center gap-3">
            <span class="brand-mark" aria-hidden="true" />
            <div>
              <p class="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-white/75 uppercase">
                Fundación Universitaria
              </p>
              <h1 class="m-0 text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">
                Tecnológico Comfenalco
              </h1>
              <p class="m-0 mt-1 text-sm text-white/85">Check-in digital de salas de sistemas</p>
            </div>
          </div>
        </div>
      </header>

      <main
        class="relative -mt-8 flex flex-1 justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 md:col-span-7 md:mt-0 md:items-center md:px-8 md:py-10 lg:col-span-6 xl:col-span-5 xl:px-12"
      >
        <div
          class="w-full max-w-[440px] rounded-[1.75rem] border border-white/70 bg-white/75 p-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.45),0_10px_30px_-18px_rgba(44,67,143,0.35)] backdrop-blur-xl sm:p-8"
        >
          <p class="m-0 text-[0.72rem] font-bold tracking-[0.14em] text-[#9f1239] uppercase">
            Acceso institucional
          </p>
          <div aria-live="polite">
            <h2 id="auth-title" class="m-0 mt-2 text-[1.7rem] leading-tight font-extrabold tracking-tight text-navy sm:text-3xl">
              {{ heading }}
            </h2>
            <p id="auth-help" class="mt-2 mb-0 text-[0.95rem] leading-relaxed text-slate-600">
              <template v-if="step === 'login'">
                Usa tu usuario o correo
                <strong class="inline-block font-semibold text-navy"
                  >@tecnocomfenalco.edu.co</strong
                >
                o
                <strong class="inline-block font-semibold text-navy"
                  >@tecnologicocomfenalco.edu.co</strong
                >
                y tu contraseña.
              </template>
              <template v-else-if="step === 'register'">
                Define tu contraseña. Te llegará
                <strong class="font-semibold text-navy">un solo correo</strong>
                para confirmar la cuenta; después entras sin enlace.
              </template>
              <template v-else-if="step === 'forgot'">
                Te enviamos un enlace para crear una nueva contraseña. Luego entras con usuario y
                contraseña.
              </template>
              <template v-else-if="step === 'set-password'">
                Elige una contraseña de al menos 8 caracteres. Ya no necesitarás el correo en cada
                ingreso.
              </template>
              <template v-else>
                Abre el enlace en este navegador. Si Outlook solo muestra vista previa, cópialo y
                pégalo abajo.
              </template>
            </p>
          </div>

          <p
            v-if="formError"
            id="form-error"
            role="alert"
            class="mt-4 mb-0 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-snug text-red-800"
          >
            <Icon name="alert" class="mt-0.5 size-4 shrink-0" />
            <span>{{ formError }}</span>
          </p>

          <Transition name="auth-step" mode="out-in">
            <form
              v-if="step === 'login'"
              key="login"
              class="mt-5 flex flex-col gap-4"
              :aria-describedby="formError ? 'form-error' : 'auth-help'"
              @submit.prevent="submitLogin"
            >
              <div class="field" :class="{ 'is-filled': identifier.length > 0 }">
                <InputText
                  id="login-identifier"
                  v-model="identifier"
                  unstyled
                  placeholder=" "
                  autocomplete="username"
                  spellcheck="false"
                  enterkeyhint="next"
                  :pt="{ root: { class: textControl } }"
                  :aria-invalid="Boolean(formError)"
                />
                <label class="field-label" for="login-identifier">Usuario o correo</label>
                <Icon name="user" class="field-icon" />
              </div>

              <div class="field" :class="{ 'is-filled': password.length > 0 }">
                <Password
                  v-model="password"
                  unstyled
                  input-id="login-password"
                  :feedback="false"
                  toggle-mask
                  placeholder=" "
                  autocomplete="current-password"
                  enterkeyhint="go"
                  :input-class="secretControl"
                  :pt="{ root: { class: 'relative block w-full' } }"
                  :aria-invalid="Boolean(formError)"
                >
                  <template #unmaskicon="{ toggleCallback }">
                    <button
                      type="button"
                      class="field-reveal"
                      aria-label="Mostrar contraseña"
                      @mousedown.prevent
                      @click="toggleCallback"
                    >
                      <Icon name="eye" class="size-[18px]" />
                    </button>
                  </template>
                  <template #maskicon="{ toggleCallback }">
                    <button
                      type="button"
                      class="field-reveal"
                      aria-label="Ocultar contraseña"
                      @mousedown.prevent
                      @click="toggleCallback"
                    >
                      <Icon name="eyeOff" class="size-[18px]" />
                    </button>
                  </template>
                </Password>
                <label class="field-label" for="login-password">Contraseña</label>
                <Icon name="lock" class="field-icon" />
              </div>

              <Button type="submit" unstyled :disabled="loading" :aria-busy="loading" :pt="{ root: { class: primaryBtn } }">
                <span class="cta-shine" aria-hidden="true" />
                <span
                  v-if="loading"
                  class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                <span class="relative z-10">{{ loading ? 'Entrando…' : 'Entrar' }}</span>
              </Button>

              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" unstyled label="Crear cuenta" :pt="{ root: { class: textBtn + ' w-full sm:w-auto' } }" @click="goRegister" />
                <Button type="button" unstyled label="Olvidé mi contraseña" :pt="{ root: { class: textBtn + ' w-full sm:w-auto' } }" @click="goForgot" />
              </div>
            </form>

            <form
              v-else-if="step === 'register'"
              key="register"
              class="mt-5 flex flex-col gap-4"
              :aria-describedby="formError ? 'form-error' : 'auth-help'"
              @submit.prevent="submitRegister"
            >
              <div class="field" :class="{ 'is-filled': identifier.length > 0 }">
                <InputText
                  id="register-identifier"
                  v-model="identifier"
                  unstyled
                  placeholder=" "
                  autocomplete="username"
                  spellcheck="false"
                  :pt="{ root: { class: textControl } }"
                />
                <label class="field-label" for="register-identifier">Usuario o correo</label>
                <Icon name="user" class="field-icon" />
              </div>
              <div class="field" :class="{ 'is-filled': nombre.length > 0 }">
                <InputText
                  id="register-nombre"
                  v-model="nombre"
                  unstyled
                  placeholder=" "
                  autocomplete="name"
                  :pt="{ root: { class: textControl } }"
                />
                <label class="field-label" for="register-nombre">Nombre completo</label>
                <Icon name="userPlus" class="field-icon" />
              </div>
              <div class="field" :class="{ 'is-filled': password.length > 0 }">
                <Password
                  v-model="password"
                  unstyled
                  input-id="register-password"
                  :feedback="false"
                  toggle-mask
                  placeholder=" "
                  autocomplete="new-password"
                  :input-class="secretControl"
                  :pt="{ root: { class: 'relative block w-full' } }"
                >
                  <template #unmaskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Mostrar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eye" class="size-[18px]" />
                    </button>
                  </template>
                  <template #maskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Ocultar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eyeOff" class="size-[18px]" />
                    </button>
                  </template>
                </Password>
                <label class="field-label" for="register-password">Contraseña</label>
                <Icon name="lock" class="field-icon" />
              </div>
              <p class="m-0 -mt-2 text-xs leading-relaxed text-slate-500">Mínimo 8 caracteres.</p>
              <div class="field" :class="{ 'is-filled': passwordConfirm.length > 0 }">
                <Password
                  v-model="passwordConfirm"
                  unstyled
                  input-id="register-password-confirm"
                  :feedback="false"
                  toggle-mask
                  placeholder=" "
                  autocomplete="new-password"
                  :input-class="secretControl"
                  :pt="{ root: { class: 'relative block w-full' } }"
                >
                  <template #unmaskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Mostrar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eye" class="size-[18px]" />
                    </button>
                  </template>
                  <template #maskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Ocultar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eyeOff" class="size-[18px]" />
                    </button>
                  </template>
                </Password>
                <label class="field-label" for="register-password-confirm">Confirmar contraseña</label>
                <Icon name="key" class="field-icon" />
              </div>
              <Button type="submit" unstyled :disabled="loading" :aria-busy="loading" :pt="{ root: { class: primaryBtn } }">
                <span class="cta-shine" aria-hidden="true" />
                <span v-if="loading" class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span class="relative z-10">{{ loading ? 'Creando cuenta…' : 'Registrarme' }}</span>
              </Button>
              <Button type="button" unstyled label="Ya tengo cuenta" :pt="{ root: { class: textBtn + ' w-full' } }" @click="goLogin" />
            </form>

            <form
              v-else-if="step === 'forgot'"
              key="forgot"
              class="mt-5 flex flex-col gap-4"
              :aria-describedby="formError ? 'form-error' : 'auth-help'"
              @submit.prevent="submitForgot"
            >
              <div class="field" :class="{ 'is-filled': identifier.length > 0 }">
                <InputText
                  id="forgot-identifier"
                  v-model="identifier"
                  unstyled
                  placeholder=" "
                  autocomplete="username"
                  spellcheck="false"
                  :pt="{ root: { class: textControl } }"
                />
                <label class="field-label" for="forgot-identifier">Usuario o correo</label>
                <Icon name="mail" class="field-icon" />
              </div>
              <Button type="submit" unstyled :disabled="loading" :aria-busy="loading" :pt="{ root: { class: primaryBtn } }">
                <span class="cta-shine" aria-hidden="true" />
                <span v-if="loading" class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span class="relative z-10">{{ loading ? 'Enviando…' : 'Enviar enlace de recuperación' }}</span>
              </Button>
              <Button type="button" unstyled :pt="{ root: { class: textBtn + ' w-full gap-1.5' } }" @click="goLogin">
                <Icon name="arrowLeft" class="size-4" />
                Volver a ingresar
              </Button>
            </form>

            <form
              v-else-if="step === 'set-password'"
              key="set-password"
              class="mt-5 flex flex-col gap-4"
              :aria-describedby="formError ? 'form-error' : 'auth-help'"
              @submit.prevent="submitNewPassword"
            >
              <div class="field" :class="{ 'is-filled': password.length > 0 }">
                <Password
                  v-model="password"
                  unstyled
                  input-id="new-password"
                  :feedback="false"
                  toggle-mask
                  placeholder=" "
                  autocomplete="new-password"
                  :input-class="secretControl"
                  :pt="{ root: { class: 'relative block w-full' } }"
                >
                  <template #unmaskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Mostrar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eye" class="size-[18px]" />
                    </button>
                  </template>
                  <template #maskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Ocultar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eyeOff" class="size-[18px]" />
                    </button>
                  </template>
                </Password>
                <label class="field-label" for="new-password">Nueva contraseña</label>
                <Icon name="lock" class="field-icon" />
              </div>
              <div class="field" :class="{ 'is-filled': passwordConfirm.length > 0 }">
                <Password
                  v-model="passwordConfirm"
                  unstyled
                  input-id="new-password-confirm"
                  :feedback="false"
                  toggle-mask
                  placeholder=" "
                  autocomplete="new-password"
                  :input-class="secretControl"
                  :pt="{ root: { class: 'relative block w-full' } }"
                >
                  <template #unmaskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Mostrar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eye" class="size-[18px]" />
                    </button>
                  </template>
                  <template #maskicon="{ toggleCallback }">
                    <button type="button" class="field-reveal" aria-label="Ocultar contraseña" @mousedown.prevent @click="toggleCallback">
                      <Icon name="eyeOff" class="size-[18px]" />
                    </button>
                  </template>
                </Password>
                <label class="field-label" for="new-password-confirm">Confirmar contraseña</label>
                <Icon name="key" class="field-icon" />
              </div>
              <Button type="submit" unstyled :disabled="loading" :aria-busy="loading" :pt="{ root: { class: primaryBtn } }">
                <span class="cta-shine" aria-hidden="true" />
                <span v-if="loading" class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span class="relative z-10">{{ loading ? 'Guardando…' : 'Guardar contraseña' }}</span>
              </Button>
            </form>

            <div v-else key="confirm" class="mt-5 flex flex-col gap-4">
              <label class="flex flex-col gap-1.5 text-sm font-semibold text-slate-700" for="magic-link">
                <span class="inline-flex items-center gap-2">
                  <Icon name="link" class="size-4 text-navy" />
                  ¿No abre el enlace? Pégalo aquí
                </span>
                <Textarea
                  id="magic-link"
                  v-model="magicLinkPaste"
                  unstyled
                  rows="3"
                  auto-resize
                  placeholder="https://…supabase.co/auth/v1/verify?…"
                  :pt="{ root: { class: areaControl } }"
                />
              </label>
              <Button
                type="button"
                unstyled
                :disabled="loading || !magicLinkPaste.trim()"
                :aria-busy="loading"
                :pt="{ root: { class: primaryBtn } }"
                @click="submitPastedLink"
              >
                <span class="cta-shine" aria-hidden="true" />
                <span v-if="loading" class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                <span class="relative z-10">{{ loading ? 'Validando…' : 'Continuar con el enlace pegado' }}</span>
              </Button>
              <Button type="button" unstyled :pt="{ root: { class: textBtn + ' w-full gap-1.5' } }" @click="goLogin">
                <Icon name="check" class="size-4" />
                Ya confirmé · Ir a ingresar
              </Button>
            </div>
          </Transition>
        </div>
      </main>
    </div>

    <Dialog
      v-model:visible="nombreDialog"
      modal
      :draggable="false"
      header="Completa tu perfil"
      :closable="false"
      :style="{ width: 'min(100% - 2rem, 28rem)' }"
      :pt="dialogPt"
    >
      <p class="m-0 text-sm leading-relaxed text-slate-600">Es tu primer ingreso. ¿Cómo te llamas?</p>
      <div class="field mt-4" :class="{ 'is-filled': nombre.length > 0 }">
        <InputText
          id="profile-nombre"
          v-model="nombre"
          unstyled
          placeholder=" "
          autocomplete="name"
          :pt="{ root: { class: textControl } }"
          :aria-invalid="Boolean(nombreError)"
          :aria-describedby="nombreError ? 'nombre-error' : undefined"
        />
        <label class="field-label" for="profile-nombre">Nombre completo</label>
        <Icon name="user" class="field-icon" />
      </div>
      <p
        v-if="nombreError"
        id="nombre-error"
        role="alert"
        class="mt-3 mb-0 flex items-start gap-2 text-sm text-red-800"
      >
        <Icon name="alert" class="mt-0.5 size-4 shrink-0" />
        <span>{{ nombreError }}</span>
      </p>
      <template #footer>
        <Button
          type="button"
          unstyled
          :disabled="savingNombre"
          :aria-busy="savingNombre"
          :pt="{ root: { class: primaryBtn } }"
          @click="saveNombre"
        >
          <span class="cta-shine" aria-hidden="true" />
          <span v-if="savingNombre" class="relative z-10 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
          <span class="relative z-10">{{ savingNombre ? 'Guardando…' : 'Guardar y continuar' }}</span>
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.mesh-dark {
  background:
    radial-gradient(ellipse 90% 70% at 8% 12%, rgba(220, 53, 69, 0.42), transparent 56%),
    radial-gradient(ellipse 70% 55% at 92% 6%, rgba(156, 186, 255, 0.5), transparent 52%),
    radial-gradient(ellipse 75% 65% at 78% 92%, rgba(61, 86, 168, 0.72), transparent 58%),
    radial-gradient(ellipse 40% 35% at 40% 48%, rgba(255, 255, 255, 0.08), transparent 70%),
    linear-gradient(165deg, #0c1738 0%, #1a2d72 48%, #24377f 100%);
}

.dot-grid {
  background-image: radial-gradient(rgba(255, 255, 255, 0.28) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse at 30% 40%, #000 15%, transparent 75%);
}

.dot-grid-light {
  background-image: radial-gradient(rgba(44, 67, 143, 0.16) 1px, transparent 1px);
  background-size: 20px 20px;
  mask-image: linear-gradient(90deg, transparent 0%, #000 42%, #000 100%);
}

.orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(64px);
  pointer-events: none;
}

.orb-a {
  top: -4rem;
  right: -3rem;
  width: 22rem;
  height: 22rem;
  background: rgba(44, 67, 143, 0.18);
  animation: drift 18s ease-in-out infinite alternate;
}

.orb-b {
  top: 38%;
  right: 8%;
  width: 18rem;
  height: 18rem;
  background: rgba(220, 53, 69, 0.12);
  animation: drift 22s ease-in-out infinite alternate-reverse;
}

.orb-c {
  bottom: -6rem;
  left: 40%;
  width: 20rem;
  height: 20rem;
  background: rgba(125, 166, 255, 0.28);
}

.orb-panel-a {
  top: -5rem;
  left: -4rem;
  width: 24rem;
  height: 24rem;
  background: rgba(220, 53, 69, 0.35);
  animation: drift 16s ease-in-out infinite alternate;
}

.orb-panel-b {
  top: 18%;
  right: -6rem;
  width: 22rem;
  height: 22rem;
  background: rgba(147, 177, 255, 0.35);
  animation: drift 20s ease-in-out infinite alternate-reverse;
}

.orb-panel-c {
  bottom: -4rem;
  left: 20%;
  width: 18rem;
  height: 18rem;
  background: rgba(255, 255, 255, 0.12);
}

.network {
  position: absolute;
  inset: 8% -10% auto auto;
  width: min(78%, 640px);
  height: auto;
  opacity: 0.55;
}

.brand-mark {
  display: inline-block;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  border-radius: 9999px;
  background:
    radial-gradient(circle at 35% 35%, #fff 0 28%, transparent 29%),
    conic-gradient(from 200deg, #dc3545, #c5d0e0, #fff, #dc3545);
  box-shadow:
    0 0 0 4px rgba(255, 255, 255, 0.12),
    0 10px 30px -12px rgba(0, 0, 0, 0.55);
}

.field {
  position: relative;
}

.field-label {
  pointer-events: none;
  position: absolute;
  left: 2.75rem;
  top: 50%;
  z-index: 2;
  max-width: calc(100% - 4.5rem);
  overflow: hidden;
  color: #475569;
  font-size: 0.95rem;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateY(-50%);
  transition:
    top 0.3s ease,
    transform 0.3s ease,
    font-size 0.3s ease,
    color 0.3s ease,
    letter-spacing 0.3s ease;
}

.field:focus-within .field-label,
.field.is-filled .field-label {
  top: 0.55rem;
  color: #2c438f;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  transform: none;
}

.field-icon {
  pointer-events: none;
  position: absolute;
  top: 50%;
  left: 0.9rem;
  z-index: 2;
  width: 1.125rem;
  height: 1.125rem;
  color: #64748b;
  transform: translateY(-50%);
  transition: color 0.3s ease;
}

.field:focus-within .field-icon {
  color: #2c438f;
}

.field-reveal {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  z-index: 3;
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.field-reveal:hover {
  background: rgba(44, 67, 143, 0.06);
  color: #2c438f;
}

.field-reveal:focus-visible {
  outline: 2px solid rgba(44, 67, 143, 0.45);
  outline-offset: 2px;
}

.cta-shine {
  pointer-events: none;
  position: absolute;
  inset: 0 auto 0 -40%;
  width: 40%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.38), transparent);
  transform: translateX(0);
}

.group:hover .cta-shine {
  animation: shine 0.75s ease;
}

.auth-step-enter-active,
.auth-step-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.auth-step-enter-from,
.auth-step-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

:global(.login-dialog-mask) {
  background: rgba(12, 23, 56, 0.46) !important;
  backdrop-filter: blur(8px);
}

:global(.login-dialog) {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7) !important;
  border-radius: 1.5rem !important;
  background: rgba(255, 255, 255, 0.94) !important;
  box-shadow:
    0 24px 70px -32px rgba(15, 23, 42, 0.5),
    0 10px 30px -18px rgba(44, 67, 143, 0.35) !important;
}

:global(.login-dialog-header) {
  padding: 1.35rem 1.35rem 0.35rem !important;
}

:global(.login-dialog-title) {
  color: #2c438f !important;
  font-family: var(--font-display);
  font-size: 1.25rem !important;
  font-weight: 800 !important;
  letter-spacing: -0.03em;
}

:global(.login-dialog-content) {
  padding: 0.35rem 1.35rem 0.5rem !important;
}

:global(.login-dialog-footer) {
  padding: 0.5rem 1.35rem 1.35rem !important;
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(1.5rem, -1.25rem, 0) scale(1.08);
  }
}

@keyframes shine {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(380%);
  }
}

@media (max-width: 767px) {
  .dot-grid-light {
    mask-image: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orb,
  .cta-shine,
  .auth-step-enter-active,
  .auth-step-leave-active,
  .field-label,
  .field-icon {
    animation: none !important;
    transition: none !important;
  }
}
</style>
