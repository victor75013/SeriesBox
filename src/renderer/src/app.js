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
import { renderStats } from './pages/stats.js'
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

  // Check auth state
  const session = await getSession()
  currentUser = session?.user || null

  // Auth state change listener
  onAuthStateChange((event, session) => {
    currentUser = session?.user || null
    if (event === 'SIGNED_IN') {
      renderNavbar(navbarContainer, currentUser)
      if (router.getCurrentPath() === '/auth') {
        router.navigate('/')
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null
      router.navigate('/auth')
    }
  })

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
    .on('/stats', async () => {
      updateActiveNav()
      await renderStats(contentContainer)
    })
    .on('/profile', async () => {
      updateActiveNav()
      await renderProfile(contentContainer)
    })
    .guard(async (route) => {
      // Auth pages don't need protection
      if (route === '/auth') return true

      // Protected routes need auth
      const protectedRoutes = ['/diary', '/watchlist', '/lists', '/stats', '/profile']
      const needsAuth = protectedRoutes.some((r) => route.startsWith(r))

      if (needsAuth && !currentUser) {
        toast.info('Connectez-vous pour accéder à cette page')
        router.navigate('/auth')
        return false
      }

      // Show navbar for non-auth routes
      if (route !== '/auth' && navbarContainer.innerHTML === '') {
        renderNavbar(navbarContainer, currentUser)
      }

      return true
    })

  // Initial render
  if (currentUser) {
    renderNavbar(navbarContainer, currentUser)
  }

  // Start router
  router.start()

  // If no hash, go to home or auth
  if (!window.location.hash) {
    if (currentUser) {
      router.navigate('/')
    } else {
      router.navigate('/')
    }
  }
}

// Start the app
init().catch((err) => {
  console.error('App init error:', err)
})
