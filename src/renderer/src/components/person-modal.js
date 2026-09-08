// ===========================
// SeriesBox — Person Modal Component
// ===========================

import { getPersonDetails, IMG } from '../api/tmdb.js'
import { formatDate, getYear, escapeHTML, truncate } from '../utils/helpers.js'
import { router } from '../utils/router.js'

function getAge(birthDateStr, deathDateStr) {
  if (!birthDateStr) return null
  const birth = new Date(birthDateStr)
  if (isNaN(birth.getTime())) return null
  const end = deathDateStr ? new Date(deathDateStr) : new Date()
  let age = end.getFullYear() - birth.getFullYear()
  const m = end.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
    age--
  }
  return age
}

function getDepartmentLabel(dept, gender) {
  if (dept === 'Acting') {
    return gender === 1 ? 'Actrice' : 'Acteur'
  }
  if (dept === 'Directing') {
    return gender === 1 ? 'Réalisatrice' : 'Réalisateur'
  }
  if (dept === 'Writing') {
    return 'Scénariste'
  }
  if (dept === 'Production') {
    return gender === 1 ? 'Productrice' : 'Producteur'
  }
  return dept || 'Artiste'
}

export async function showPersonModal(personId) {
  // Create overlay
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.opacity = '0'
  overlay.style.pointerEvents = 'none'

  // Loading skeleton inside modal
  overlay.innerHTML = `
    <div class="modal person-modal">
      <div class="modal-header">
        <h3 class="modal-title">Fiche de l'acteur</h3>
        <button class="modal-close" id="person-modal-close-btn" title="Fermer">✕</button>
      </div>
      <div class="modal-body" id="person-modal-content">
        <div class="page-loader" style="padding: 48px 0;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  // Trigger entrance animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1'
    overlay.style.pointerEvents = 'auto'
  })

  let isClosed = false
  const cleanup = () => {
    if (isClosed) return
    isClosed = true
    overlay.style.opacity = '0'
    overlay.style.pointerEvents = 'none'
    const modalEl = overlay.querySelector('.modal')
    if (modalEl) modalEl.style.transform = 'scale(0.95) translateY(10px)'
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    }, 200)
    window.removeEventListener('keydown', handleKeyDown)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') cleanup()
  }
  window.addEventListener('keydown', handleKeyDown)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup()
  })

  const closeBtn = overlay.querySelector('#person-modal-close-btn')
  if (closeBtn) {
    closeBtn.addEventListener('click', cleanup)
  }

  // Fetch person data
  try {
    const person = await getPersonDetails(personId)
    if (isClosed) return

    const contentEl = overlay.querySelector('#person-modal-content')
    const titleEl = overlay.querySelector('.modal-title')
    if (titleEl) {
      titleEl.textContent = person.name || 'Détails'
    }

    const age = getAge(person.birthday, person.deathday)
    const profession = getDepartmentLabel(person.known_for_department, person.gender)

    // Deduplicate and prepare credits
    const rawCast = person.combined_credits?.cast || []
    const creditsMap = new Map()

    for (const item of rawCast) {
      if (!item.id || (!item.title && !item.name)) continue
      const key = `${item.media_type}_${item.id}`
      if (!creditsMap.has(key)) {
        creditsMap.set(key, { ...item })
      } else {
        // Merge characters if multiple roles
        const existing = creditsMap.get(key)
        if (item.character && existing.character && !existing.character.includes(item.character)) {
          existing.character += ` / ${item.character}`
        }
      }
    }

    const allCredits = Array.from(creditsMap.values()).sort((a, b) => {
      // Sort by popularity / vote count
      return (b.vote_count || 0) * (b.popularity || 0) - (a.vote_count || 0) * (a.popularity || 0)
    })

    const tvCredits = allCredits.filter((c) => c.media_type === 'tv')
    const movieCredits = allCredits.filter((c) => c.media_type === 'movie')

    // Biography handling
    const bioText = person.biography?.trim() || ''
    const isBioLong = bioText.length > 320
    const shortBio = isBioLong ? truncate(bioText, 320) : bioText

    contentEl.innerHTML = `
      <div class="person-header">
        <div class="person-avatar-wrapper">
          ${
            person.profile_path
              ? `<img class="person-avatar" src="${IMG.profile(person.profile_path, 'h632')}" alt="${escapeHTML(person.name)}" />`
              : `<div class="person-avatar person-avatar-placeholder">👤</div>`
          }
        </div>
        <div class="person-meta-col">
          <h2 class="person-name">${escapeHTML(person.name)}</h2>
          
          <div class="person-badges">
            <span class="badge badge-purple">${escapeHTML(profession)}</span>
            ${age ? `<span class="badge badge-gray">${age} ans${person.deathday ? ' (décédé)' : ''}</span>` : ''}
            ${
              person.place_of_birth
                ? `<span class="badge badge-gray" title="Lieu de naissance">📍 ${escapeHTML(person.place_of_birth)}</span>`
                : ''
            }
          </div>

          ${
            person.birthday
              ? `
            <div class="person-birth-info">
              <span>Né${person.gender === 1 ? 'e' : ''} le ${formatDate(person.birthday)}</span>
              ${person.deathday ? `<span> · Décédé${person.gender === 1 ? 'e' : ''} le ${formatDate(person.deathday)}</span>` : ''}
            </div>
          `
              : ''
          }

          ${
            bioText
              ? `
            <div class="person-bio-container">
              <p class="person-bio" id="person-bio-text">${escapeHTML(shortBio)}</p>
              ${
                isBioLong
                  ? `<button class="person-bio-more-btn" id="person-bio-toggle">Lire la suite</button>`
                  : ''
              }
            </div>
          `
              : `<p class="person-bio-empty">Aucune biographie disponible pour cet acteur.</p>`
          }
        </div>
      </div>

      <!-- Filmography Section -->
      <div class="person-credits-section">
        <div class="person-credits-header">
          <h3 class="person-section-title">Filmographie & Rôles</h3>
          <div class="person-credits-tabs">
            <button class="person-tab active" data-tab="all">Tous (${allCredits.length})</button>
            <button class="person-tab" data-tab="tv">Séries TV (${tvCredits.length})</button>
            <button class="person-tab" data-tab="movie">Films (${movieCredits.length})</button>
          </div>
        </div>

        <div class="person-credits-grid" id="person-credits-container">
          <!-- Populated by JS -->
        </div>
      </div>
    `

    // Biography expand toggle
    if (isBioLong) {
      const toggleBtn = contentEl.querySelector('#person-bio-toggle')
      const bioTextEl = contentEl.querySelector('#person-bio-text')
      let expanded = false
      toggleBtn?.addEventListener('click', () => {
        expanded = !expanded
        if (expanded) {
          bioTextEl.textContent = bioText
          toggleBtn.textContent = 'Réduire'
        } else {
          bioTextEl.textContent = shortBio
          toggleBtn.textContent = 'Lire la suite'
        }
      })
    }

    // Render credits helper
    const container = contentEl.querySelector('#person-credits-container')

    function renderCredits(filter = 'all') {
      let list = allCredits
      if (filter === 'tv') list = tvCredits
      if (filter === 'movie') list = movieCredits

      if (!list.length) {
        container.innerHTML = `<div class="person-empty-credits">Aucun projet trouvé dans cette catégorie.</div>`
        return
      }

      container.innerHTML = list
        .slice(0, 40)
        .map((item) => {
          const isTv = item.media_type === 'tv'
          const title = item.name || item.title
          const year = getYear(item.first_air_date || item.release_date)
          const role = item.character ? escapeHTML(item.character) : 'Rôle non spécifié'
          const voteAvg = item.vote_average ? item.vote_average.toFixed(1) : null

          return `
            <div class="person-credit-card ${isTv ? 'is-tv clickable' : 'is-movie'}" data-id="${item.id}" data-type="${item.media_type}" title="${isTv ? 'Cliquer pour voir la série' : escapeHTML(title)}">
              <div class="person-credit-poster-box">
                ${
                  item.poster_path
                    ? `<img class="person-credit-poster" src="${IMG.poster(item.poster_path, 'w185')}" alt="${escapeHTML(title)}" loading="lazy" />`
                    : `<div class="person-credit-placeholder">${isTv ? '📺' : '🎬'}</div>`
                }
                <span class="person-credit-badge ${isTv ? 'badge-tv' : 'badge-movie'}">
                  ${isTv ? 'Série' : 'Film'}
                </span>
                ${
                  voteAvg && item.vote_count > 10
                    ? `<span class="person-credit-score">★ ${voteAvg}</span>`
                    : ''
                }
              </div>
              <div class="person-credit-info">
                <div class="person-credit-title">${escapeHTML(title)}</div>
                ${role ? `<div class="person-credit-role">${role}</div>` : ''}
                <div class="person-credit-year">${year || 'TBA'}</div>
              </div>
            </div>
          `
        })
        .join('')

      // Attach click listeners to series
      container.querySelectorAll('.person-credit-card.is-tv').forEach((card) => {
        card.addEventListener('click', () => {
          const seriesId = card.dataset.id
          cleanup()
          router.navigate(`/series/${seriesId}`)
        })
      })
    }

    // Initial render
    renderCredits('all')

    // Tab buttons
    const tabs = contentEl.querySelectorAll('.person-tab')
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'))
        tab.classList.add('active')
        renderCredits(tab.dataset.tab)
      })
    })
  } catch (err) {
    console.error('Error loading person details:', err)
    if (isClosed) return
    const contentEl = overlay.querySelector('#person-modal-content')
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
          <p class="empty-state-title">Erreur</p>
          <p class="empty-state-text">Impossible de charger les informations de cet acteur.</p>
        </div>
      `
    }
  }
}
