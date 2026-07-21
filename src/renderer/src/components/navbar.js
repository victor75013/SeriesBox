// ===========================
// SeriesBox — Navbar Component
// ===========================

import { router } from '../utils/router.js'
import { searchSeries, IMG } from '../api/tmdb.js'
import { debounce } from '../utils/helpers.js'
import { getProfile } from '../api/supabase.js'

export function renderNavbar(container, user) {
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'U'
  const initial = username.charAt(0).toUpperCase()

  container.innerHTML = `
    <nav class="navbar" id="main-navbar">
      <a class="navbar-brand" data-nav="/">
        <span>Series<span class="brand-accent">Box</span></span>
      </a>

      <div class="navbar-nav">
        <a class="nav-link" data-nav="/" data-route="/">Accueil</a>
        <a class="nav-link" data-nav="/search" data-route="/search">Séries</a>
        <a class="nav-link" data-nav="/diary" data-route="/diary">Journal</a>
        <a class="nav-link" data-nav="/watchlist" data-route="/watchlist">Watchlist</a>
        <a class="nav-link" data-nav="/lists" data-route="/lists">Listes</a>
        <a class="nav-link" data-nav="/stats" data-route="/stats">Stats</a>
      </div>

      <div class="navbar-search" id="navbar-search">
        <input type="text" placeholder="Rechercher une série..." id="nav-search-input" autocomplete="off" />
        <div class="search-dropdown" id="search-dropdown"></div>
      </div>

      <div class="navbar-user">
        <div class="navbar-avatar" data-nav="/profile" id="navbar-avatar-el" title="Mon profil">${initial}</div>
        <div class="dropdown">
          <button class="btn btn-ghost btn-sm" id="user-menu-btn">▾</button>
          <div class="dropdown-menu" id="user-dropdown">
            <div class="dropdown-item" data-nav="/profile">Mon profil</div>
            <div class="dropdown-item" data-nav="/stats">Statistiques</div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="logout-btn">Déconnexion</div>
          </div>
        </div>
      </div>
    </nav>
  `

  // Fetch avatar asynchronously
  if (user) {
    getProfile(user.id)
      .then((profile) => {
        if (profile && profile.avatar_url) {
          const avatarEl = document.getElementById('navbar-avatar-el')
          if (avatarEl) {
            avatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`
            avatarEl.style.background = 'transparent'
            avatarEl.style.padding = '0'
            avatarEl.style.border = 'none'
          }
        }
      })
      .catch((err) => console.error('Navbar profile avatar error:', err))
  }

  // Setup navigation links
  container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      router.navigate(el.dataset.nav)
    })
  })

  // Update active link
  updateActiveNav()

  // Search functionality
  setupSearch()

  // User menu dropdown
  const menuBtn = document.getElementById('user-menu-btn')
  const dropdown = document.getElementById('user-dropdown')

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('show')
  })

  document.addEventListener('click', () => {
    dropdown.classList.remove('show')
  })

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { signOut } = await import('../api/supabase.js')
    await signOut()
    router.navigate('/auth')
  })
}

export function updateActiveNav() {
  const currentPath = router.getCurrentPath().split('?')[0]
  document.querySelectorAll('.nav-link').forEach((link) => {
    const route = link.dataset.route
    if (route === '/' && currentPath === '/') {
      link.classList.add('active')
    } else if (route !== '/' && currentPath.startsWith(route)) {
      link.classList.add('active')
    } else {
      link.classList.remove('active')
    }
  })
}

function setupSearch() {
  const input = document.getElementById('nav-search-input')
  const dropdown = document.getElementById('search-dropdown')
  if (!input || !dropdown) return

  const doSearch = debounce(async (query) => {
    if (!query || query.length < 2) {
      dropdown.classList.remove('show')
      return
    }

    try {
      const data = await searchSeries(query)
      if (data.results.length === 0) {
        dropdown.innerHTML = `<div class="search-result-item"><span class="result-info"><span class="result-title">Aucun résultat</span></span></div>`
        dropdown.classList.add('show')
        return
      }

      dropdown.innerHTML = data.results
        .slice(0, 8)
        .map(
          (series) => `
        <div class="search-result-item" data-id="${series.id}">
          <img class="mini-poster" src="${IMG.poster(series.poster_path, 'w92') || ''}"
               alt="" onerror="this.style.display='none'" />
          <div class="result-info">
            <div class="result-title">${series.name}</div>
            <div class="result-meta">${series.first_air_date ? new Date(series.first_air_date).getFullYear() : 'N/A'}</div>
          </div>
        </div>
      `
        )
        .join('')

      dropdown.classList.add('show')

      // Click on result
      dropdown.querySelectorAll('.search-result-item[data-id]').forEach((item) => {
        item.addEventListener('click', () => {
          router.navigate(`/series/${item.dataset.id}`)
          dropdown.classList.remove('show')
          input.value = ''
        })
      })
    } catch (err) {
      console.error('Search error:', err)
    }
  }, 300)

  input.addEventListener('input', (e) => doSearch(e.target.value))

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      router.navigate(`/search?q=${encodeURIComponent(input.value.trim())}`)
      dropdown.classList.remove('show')
      input.value = ''
    }
    if (e.key === 'Escape') {
      dropdown.classList.remove('show')
    }
  })

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#navbar-search')) {
      dropdown.classList.remove('show')
    }
  })
}
