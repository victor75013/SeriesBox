// ===========================
// SeriesBox — Main App
// ===========================

import '../assets/styles/base.css'
import '../assets/styles/components.css'
import '../assets/styles/pages.css'

import { router } from './utils/router.js'
import { getSession, onAuthStateChange } from './api/supabase.js'
import { renderNavbar, updateActiveNav } from './components/navbar.js'
import { toast } from './components/toast.js'

// Import pages
import { renderAuth } from './pages/auth.js'
import { renderHome } from './pages/home.js'
import { renderSearch } from './pages/search.js'
import { renderSeriesDetail } from './pages/series-detail.js'
import { renderDiary } from './pages/diary.js'
import { renderWatchlist } from './pages/watchlist.js'
import { renderLists } from './pages/lists.js'
import { renderProfile } from './pages/profile.js'

// App state
let currentUser = null
let navbarContainer = null
let contentContainer = null

async function init() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div id="navbar-container"></div>
    <main class="main-content" id="content"></main>
  `

  navbarContainer = document.getElementById('navbar-container')
  contentContainer = document.getElementById('content')

  // Listen to auth state changes reactively
  onAuthStateChange((event, session) => {
    const prevUser = currentUser
    currentUser = session?.user || null

    if (currentUser) {
      if (navbarContainer) renderNavbar(navbarContainer, currentUser)
      if (router.getCurrentPath() === '/auth') {
        router.navigate('/')
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null
      if (navbarContainer) navbarContainer.innerHTML = ''
      router.navigate('/auth')
    }
  })

  // Quick initial check (non-blocking for UI render)
  try {
    const session = await getSession()
    currentUser = session?.user || null
    if (currentUser) {
      renderNavbar(navbarContainer, currentUser)
    }
  } catch {
    // ignore
  }

  // Setup routes
  router
    .on('/', async () => {
      updateActiveNav()
      await renderHome(contentContainer)
    })
    .on('/auth', async () => {
      navbarContainer.innerHTML = ''
      await renderAuth(contentContainer)
    })
    .on('/search', async (params) => {
      updateActiveNav()
      await renderSearch(contentContainer, params)
    })
    .on('/series/:id', async (params) => {
      updateActiveNav()
      await renderSeriesDetail(contentContainer, params)
    })
    .on('/diary', async () => {
      updateActiveNav()
      await renderDiary(contentContainer)
    })
    .on('/watchlist', async () => {
      updateActiveNav()
      await renderWatchlist(contentContainer)
    })
    .on('/lists', async () => {
      updateActiveNav()
      await renderLists(contentContainer)
    })
    .on('/lists/:id', async (params) => {
      updateActiveNav()
      await renderLists(contentContainer, params)
    })
    .on('/profile', async () => {
      updateActiveNav()
      await renderProfile(contentContainer)
    })
    .guard(async (route) => {
      if (route === '/auth') return true

      const protectedRoutes = ['/diary', '/watchlist', '/lists', '/profile']
      const needsAuth = protectedRoutes.some((r) => route.startsWith(r))

      if (needsAuth && !currentUser) {
        toast.info('Connectez-vous pour accéder à cette page')
        router.navigate('/auth')
        return false
      }

      if (route !== '/auth' && navbarContainer.innerHTML === '') {
        renderNavbar(navbarContainer, currentUser)
      }

      return true
    })

  // Start router immediately
  router.start()

  if (!window.location.hash) {
    router.navigate('/')
  }
}

// Start the app
init().catch((err) => {
  console.error('App init error:', err)
})
