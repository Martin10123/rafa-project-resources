import { createRouter, createWebHistory } from 'vue-router'
import { resolvePostLoginPath } from '../lib/postLogin'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { layout: 'auth', guestOnly: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallbackView.vue'),
      meta: { layout: 'auth' },
    },
    {
      path: '/inicio',
      name: 'inicio',
      component: () => import('../views/InicioView.vue'),
      meta: { layout: 'app', requiresAuth: true },
    },
    {
      path: '/sala/:id',
      name: 'sala',
      component: () => import('../views/SalaCheckinView.vue'),
      meta: { layout: 'app', requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { layout: 'admin', requiresAuth: true, requiresStaff: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../views/admin/DashboardView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'historial',
          name: 'admin-historial',
          component: () => import('../views/admin/HistorialView.vue'),
        },
        {
          path: 'salas',
          name: 'admin-salas',
          component: () => import('../views/admin/SalasView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'config',
          name: 'admin-config',
          component: () => import('../views/admin/ConfigView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'auditoria',
          name: 'admin-auditoria',
          component: () => import('../views/admin/AuditoriaView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.init()
  }

  const needsAuth = to.matched.some((record) => record.meta.requiresAuth)
  const needsAdmin = to.matched.some((record) => record.meta.requiresAdmin)
  const needsStaff = to.matched.some((record) => record.meta.requiresStaff)
  const guestOnly = to.matched.some((record) => record.meta.guestOnly)

  if (needsAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (auth.isAuthenticated && to.name === 'inicio') {
    if (auth.isAdmin) return { name: 'admin-dashboard' }
    if (auth.isJefa && auth.perfil?.sede_id) return { name: 'admin-historial' }
  }

  if (needsAdmin && auth.isAuthenticated && !auth.isAdmin) {
    return auth.isJefa ? { name: 'admin-historial' } : { name: 'inicio' }
  }

  if (needsStaff && auth.isAuthenticated && !auth.isAdmin && !auth.isJefa) {
    return { name: 'inicio' }
  }

  if (guestOnly && auth.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null
    return resolvePostLoginPath(auth.isAdmin, auth.isJefa, redirect)
  }

  return true
})

export default router
