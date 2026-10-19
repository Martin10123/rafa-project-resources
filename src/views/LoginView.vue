<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Textarea from 'primevue/textarea'
import { ALLOWED_EMAIL_DOMAIN, useAuthStore } from '../stores/auth'

type Step = 'login' | 'register' | 'confirm-sent' | 'forgot' | 'set-password'

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

async function resolvePostLoginPath(): Promise<string> {
  if (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')) {
    return route.query.redirect
  }
  if (auth.isAdmin) return '/admin'
  if (!auth.usesSupabase) return '/sala/demo?t=preview'

  const { supabase } = await import('../lib/supabase')
  if (supabase) {
    const { data } = await supabase
      .from('salas')
      .select('id, token_qr')
      .eq('activa', true)
      .order('nombre')
      .limit(1)
      .maybeSingle()
    if (data?.id && data.token_qr) {
      return `/sala/${data.id}?t=${encodeURIComponent(data.token_qr)}`
    }
  }
  return '/admin'
}

async function finishLogin() {
  if (!auth.perfil?.nombre?.trim()) {
    nombre.value = ''
    nombreDialog.value = true
    return
  }
  await router.push(await resolvePostLoginPath())
}

async function submitLogin() {
  loading.value = true
  try {
    const result = await auth.signInWithPassword(identifier.value, password.value)
    if (!result.ok) {
      toast.add({
        severity: 'error',
        summary: 'No se pudo ingresar',
        detail: result.message,
        life: 6000,
      })
      return
    }
    password.value = ''
    await finishLogin()
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  loading.value = true
  try {
    const result = await auth.signUpWithPassword(
      identifier.value,
      password.value,
      passwordConfirm.value,
      nombre.value,
    )
    if (!result.ok) {
      toast.add({
        severity: 'error',
        summary: 'No se pudo registrar',
        detail: result.message,
        life: 6000,
      })
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
  loading.value = true
  try {
    const result = await auth.requestPasswordReset(identifier.value)
    if (!result.ok) {
      toast.add({
        severity: 'error',
        summary: 'No se pudo enviar',
        detail: result.message,
        life: 6000,
      })
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
  loading.value = true
  try {
    const result = await auth.updatePassword(password.value, passwordConfirm.value)
    if (!result.ok) {
      toast.add({
        severity: 'error',
        summary: 'Contraseña',
        detail: result.message,
        life: 6000,
      })
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
  loading.value = true
  try {
    const result = await auth.completeFromMagicLinkUrl(magicLinkPaste.value)
    if (!result.ok) {
      toast.add({
        severity: 'error',
        summary: 'Enlace inválido',
        detail: result.message,
        life: 6000,
      })
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
  savingNombre.value = true
  try {
    const result = await auth.updateNombre(nombre.value)
    if (!result.ok) {
      toast.add({ severity: 'error', summary: 'Nombre', detail: result.message, life: 5000 })
      return
    }
    nombreDialog.value = false
    await router.push(await resolvePostLoginPath())
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
    await router.replace(await resolvePostLoginPath())
  }
})
</script>

<template>
  <div class="grid min-h-svh w-full grid-cols-1 bg-surface-100 lg:grid-cols-[minmax(280px,1.05fr)_minmax(320px,1fr)]">
    <aside
      class="relative hidden overflow-hidden bg-gradient-to-br from-navy via-navy-light to-navy-dark p-8 text-white lg:flex xl:p-14"
    >
      <div
        class="pointer-events-none absolute -left-16 -top-20 h-72 w-72 rounded-full bg-brand-red/25 blur-3xl"
        aria-hidden="true"
      />
      <div class="relative z-10 flex max-w-md flex-col justify-center gap-3">
        <span
          class="mb-3 inline-block size-[3.25rem] rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff_0_28%,transparent_29%),conic-gradient(from_200deg,#dc3545,#c5d0e0,#fff,#dc3545)]"
          aria-hidden="true"
        />
        <p class="m-0 text-xs font-semibold tracking-[0.12em] text-white/80 uppercase">
          Fundación Universitaria
        </p>
        <h1 class="m-0 text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
          Tecnológico Comfenalco
        </h1>
        <p class="m-0 max-w-sm text-lg leading-snug text-white/90">
          Check-in digital de salas de sistemas
        </p>
      </div>
    </aside>

    <main class="flex min-h-svh w-full items-center justify-center bg-surface-100 p-5 sm:p-8">
      <div
        class="flex w-full max-w-md flex-col gap-3.5 rounded-xl border border-surface-200 bg-white p-6 shadow-lg sm:p-9"
      >
        <p class="m-0 text-[0.72rem] font-bold tracking-[0.1em] text-brand-red uppercase">
          Acceso institucional
        </p>
        <h2 class="m-0 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
          <template v-if="step === 'login'">Ingresar</template>
          <template v-else-if="step === 'register'">Crear cuenta</template>
          <template v-else-if="step === 'forgot'">Recuperar contraseña</template>
          <template v-else-if="step === 'set-password'">Nueva contraseña</template>
          <template v-else>Revisa tu correo</template>
        </h2>
        <p class="mb-1 text-[0.98rem] leading-relaxed text-muted-color">
          <template v-if="step === 'login'">
            Usa tu usuario o correo
            <strong class="text-navy">@{{ ALLOWED_EMAIL_DOMAIN }}</strong> y tu contraseña.
          </template>
          <template v-else-if="step === 'register'">
            Define tu contraseña. Te llegará <strong class="text-navy">un solo correo</strong> para
            confirmar la cuenta; después entras sin enlace.
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
            Abre el enlace en este navegador. Si Outlook solo muestra vista previa, cópialo y pégalo
            abajo.
          </template>
        </p>

        <form v-if="step === 'login'" class="mt-1 flex flex-col gap-4" @submit.prevent="submitLogin">
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Usuario o correo</span>
            <InputText
              v-model="identifier"
              autocomplete="username"
              placeholder="usuario o correo@"
              fluid
              size="large"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Contraseña</span>
            <Password
              v-model="password"
              class="w-full"
              input-class="w-full"
              autocomplete="current-password"
              placeholder="Tu contraseña"
              :feedback="false"
              toggle-mask
              fluid
            />
          </label>
          <Button
            type="submit"
            label="Entrar"
            icon="pi pi-sign-in"
            size="large"
            :loading="loading"
            fluid
          />
          <div class="flex flex-wrap items-center justify-between gap-1">
            <Button type="button" label="Crear cuenta" link @click="goRegister" />
            <Button type="button" label="Olvidé mi contraseña" link @click="goForgot" />
          </div>
        </form>

        <form
          v-else-if="step === 'register'"
          class="mt-1 flex flex-col gap-4"
          @submit.prevent="submitRegister"
        >
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Usuario o correo</span>
            <InputText
              v-model="identifier"
              autocomplete="username"
              placeholder="usuario o correo@"
              fluid
              size="large"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Nombre completo</span>
            <InputText
              v-model="nombre"
              autocomplete="name"
              placeholder="Tu nombre"
              fluid
              size="large"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Contraseña</span>
            <Password
              v-model="password"
              class="w-full"
              input-class="w-full"
              autocomplete="new-password"
              placeholder="Mínimo 8 caracteres"
              toggle-mask
              fluid
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Confirmar contraseña</span>
            <Password
              v-model="passwordConfirm"
              class="w-full"
              input-class="w-full"
              autocomplete="new-password"
              placeholder="Repite la contraseña"
              :feedback="false"
              toggle-mask
              fluid
            />
          </label>
          <Button
            type="submit"
            label="Registrarme"
            icon="pi pi-user-plus"
            size="large"
            :loading="loading"
            fluid
          />
          <Button type="button" label="Ya tengo cuenta" link fluid @click="goLogin" />
        </form>

        <form
          v-else-if="step === 'forgot'"
          class="mt-1 flex flex-col gap-4"
          @submit.prevent="submitForgot"
        >
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Usuario o correo</span>
            <InputText
              v-model="identifier"
              autocomplete="username"
              placeholder="usuario o correo@"
              fluid
              size="large"
            />
          </label>
          <Button
            type="submit"
            label="Enviar enlace de recuperación"
            icon="pi pi-envelope"
            size="large"
            :loading="loading"
            fluid
          />
          <Button type="button" label="Volver a ingresar" link fluid @click="goLogin" />
        </form>

        <form
          v-else-if="step === 'set-password'"
          class="mt-1 flex flex-col gap-4"
          @submit.prevent="submitNewPassword"
        >
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Nueva contraseña</span>
            <Password
              v-model="password"
              class="w-full"
              input-class="w-full"
              autocomplete="new-password"
              placeholder="Mínimo 8 caracteres"
              toggle-mask
              fluid
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>Confirmar contraseña</span>
            <Password
              v-model="passwordConfirm"
              class="w-full"
              input-class="w-full"
              autocomplete="new-password"
              placeholder="Repite la contraseña"
              :feedback="false"
              toggle-mask
              fluid
            />
          </label>
          <Button
            type="submit"
            label="Guardar contraseña"
            icon="pi pi-check"
            size="large"
            :loading="loading"
            fluid
          />
        </form>

        <div v-else class="mt-1 flex flex-col gap-4">
          <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
            <span>¿No abre el enlace? Pégalo aquí</span>
            <Textarea
              v-model="magicLinkPaste"
              rows="3"
              auto-resize
              placeholder="https://…supabase.co/auth/v1/verify?…"
              fluid
            />
          </label>
          <Button
            type="button"
            label="Continuar con el enlace pegado"
            icon="pi pi-sign-in"
            size="large"
            :loading="loading"
            :disabled="!magicLinkPaste.trim()"
            fluid
            @click="submitPastedLink"
          />
          <Button type="button" label="Ya confirmé · Ir a ingresar" link fluid @click="goLogin" />
        </div>
      </div>
    </main>

    <Dialog
      v-model:visible="nombreDialog"
      modal
      header="Completa tu perfil"
      :closable="false"
      :style="{ width: 'min(100%, 28rem)' }"
    >
      <p class="mb-4 text-muted-color">Es tu primer ingreso. ¿Cómo te llamas?</p>
      <label class="flex flex-col gap-1.5 text-sm font-semibold text-color">
        <span>Nombre completo</span>
        <InputText v-model="nombre" autocomplete="name" placeholder="Tu nombre" fluid />
      </label>
      <template #footer>
        <Button
          label="Guardar y continuar"
          icon="pi pi-check"
          :loading="savingNombre"
          @click="saveNombre"
        />
      </template>
    </Dialog>
  </div>
</template>
