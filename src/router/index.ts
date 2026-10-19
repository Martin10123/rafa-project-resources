import { createRouter, createWebHistory } from 'vue-router'
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
      path: '/sala/:id',
      name: 'sala',
      component: () => import('../views/SalaCheckinView.vue'),
      meta: { layout: 'app', requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { layout: 'admin', requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../views/admin/DashboardView.vue'),
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
        },
        {
          path: 'config',
          name: 'admin-config',
          component: () => import('../views/admin/ConfigView.vue'),
        },
        {
          path: 'auditoria',
          name: 'admin-auditoria',
          component: () => import('../views/admin/AuditoriaView.vue'),
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
  const guestOnly = to.matched.some((record) => record.meta.guestOnly)

  if (needsAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (needsAdmin && auth.isAuthenticated && !auth.isAdmin) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
        admin: '1',
      },
    }
  }

  if (guestOnly && auth.isAuthenticated) {
    if (typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/')) {
      return to.query.redirect
    }
    if (auth.isAdmin) return '/admin'
    return true
  }

  return true
})

export default router
