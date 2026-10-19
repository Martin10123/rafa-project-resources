import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { ComfenalcoPreset } from './theme/comfenalco'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: ComfenalcoPreset,
    options: {
      darkModeSelector: false,
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue',
      },
    },
  },
  ripple: true,
})
app.use(ToastService)
app.use(ConfirmationService)

app.component('Toast', Toast)
app.component('ConfirmDialog', ConfirmDialog)

app.mount('#app')
