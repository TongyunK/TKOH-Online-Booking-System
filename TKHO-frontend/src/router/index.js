import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useStatusDialogStore } from '../stores/statusDialog'
import { pathRequiresAuth } from '../utils/publicRoutes'
import { canAccessPath, getDeniedSystemMessage, systemForPath } from '../utils/systemAccess'

function defaultHomeForUser(user) {
  const sys = user?.system
  if (sys === 'parking') return '/evBooking/Calendar'
  if (sys === 'admin') return '/admin'
  return '/VenueBooking'
}

const routes = [
  // 访问根路径时自动重定向到登录页
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/VenueBooking',
    name: 'VenueBooking',
    component: () => import('../views/VenueBooking.vue'),
    meta: {
      title: 'Venue Booking'
    }
  },
  {
    path: '/VenueBooking/Calendar',
    name: 'VenueCalendarView',
    component: () => import('../views/VenueCalendarView.vue'),
    meta: {
      title: 'Booking Calendar'
    }
  },
  {
    path: '/VenueBooking/Display',
    name: 'VenueDisplayView',
    component: () => import('../views/display/VenueDisplayView.vue'),
    meta: {
      title: 'Venue Display'
    }
  },
  {
    path: '/VenueBooking/Display/Merge',
    name: 'VenueMergeDisplayView',
    component: () => import('../views/display/VenueMergeDisplayView.vue'),
    meta: {
      title: 'Venue Merge Display'
    }
  },
  {
    path: '/VenueBooking/Display/TeaService',
    name: 'TeaServiceDisplayView',
    component: () => import('../views/display/TeaServiceDisplayView.vue'),
    meta: {
      title: 'Tea Service Display'
    }
  },
  {
    path: '/VenueBooking/ManageBooking',
    name: 'VenueManageBooking',
    component: () => import('../views/VenueManageBooking.vue'),
    meta: {
      title: 'Manage Booking'
    }
  },
  {
    path: '/Account',
    name: 'Account',
    component: () => import('../views/Account.vue'),
    meta: {
      title: 'Account'
    }
  },
  {
    path: '/evBooking',
    name: 'EVBooking',
    component: () => import('../views/EVBooking.vue'),
    meta: {
      title: 'EV Booking'
    }
  },
  {
    path: '/evBooking/Calendar',
    name: 'EVBookingCalendar',
    component: () => import('../views/EVBooking.vue'),
    meta: {
      title: 'EV Booking'
    }
  },
  {
    path: '/EVBooking/Calendar',
    redirect: '/evBooking/Calendar'
  },
  {
    path: '/evBooking/ManageBooking',
    name: 'EVManageBooking',
    component: () => import('../views/EVManageBooking.vue'),
    meta: {
      title: 'Manage EV Booking'
    }
  },
  {
    path: '/evBooking/Display',
    name: 'EVDisplayView',
    component: () => import('../views/display/EVDisplayView.vue'),
    meta: {
      title: 'EV Display'
    }
  },
  {
    path: '/EVBooking/Display',
    redirect: '/evBooking/Display'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: {
      title: 'Login'
    }
  },
  {
    path: '/register',
    name: 'UserRegistration',
    component: () => import('../views/UserRegistration.vue'),
    meta: {
      title: 'User Registration'
    }
  },
  {
    path: '/admin',
    name: 'AdminManagement',
    component: () => import('../views/AdminManagement.vue'),
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: () => import('../views/AdminDashboard.vue'),
        meta: {
          title: 'Admin - Home'
        }
      },
      {
        path: 'ev',
        name: 'AdminEVManagement',
        component: () => import('../components/admin/EVManagement.vue'),
        meta: {
          title: 'Admin - EV Management'
        }
      },
      {
        path: 'venue',
        name: 'AdminVenueManagement',
        component: () => import('../components/admin/VenueManagement.vue'),
        meta: {
          title: 'Admin - Venue Management'
        }
      },
      {
        path: 'user',
        name: 'AdminUserManagement',
        component: () => import('../components/admin/UserManagement.vue'),
        meta: {
          title: 'Admin - User Management'
        }
      },
      {
        path: 'access-right',
        name: 'AdminAccessRightManagement',
        component: () => import('../components/admin/AccessRightManagement.vue'),
        meta: {
          title: 'Admin - Access Right Management'
        }
      },
      {
        path: 'approval',
        name: 'AdminMeetingApproval',
        component: () => import('../components/admin/MeetingApproval.vue'),
        meta: {
          title: 'Admin - Meeting Approval'
        }
      },
      {
        path: 'prompt',
        name: 'AdminPromptManagement',
        component: () => import('../components/admin/PromptManagement.vue'),
        meta: {
          title: 'Admin - Prompts and Templates'
        }
      },
      {
        path: 'license-plate',
        name: 'AdminLicensePlateManagement',
        component: () => import('../components/admin/LicensePlateManagement.vue'),
        meta: {
          title: 'Admin - License Plate Management'
        }
      },
      {
        path: 'display',
        name: 'AdminDisplayManagement',
        component: () => import('../components/admin/DisplayManagement.vue'),
        meta: {
          title: 'Admin - Display Management'
        }
      },
      {
        path: 'system-settings',
        name: 'AdminSystemSettings',
        component: () => import('../components/admin/SystemSettings.vue'),
        meta: {
          title: 'Admin - System Settings'
        }
      }
    ],
    meta: {
      title: 'Admin Management'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title
    ? `${to.meta.title} - TKOH GA Venue and EV Charging Booking System`
    : 'TKOH GA Venue and EV Charging Booking System'

  const userStore = useUserStore()

  if (pathRequiresAuth(to.path) && !userStore.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  if (pathRequiresAuth(to.path) && userStore.token && !canAccessPath(userStore.userInfo, to.path)) {
    const deniedSystem = systemForPath(to.path)
    useStatusDialogStore().show(getDeniedSystemMessage(deniedSystem || 'unknown'), 'error')
    next(defaultHomeForUser(userStore.userInfo))
    return
  }

  if (to.path === '/login' && userStore.token) {
    next(defaultHomeForUser(userStore.userInfo))
    return
  }

  next()
})

export default router
