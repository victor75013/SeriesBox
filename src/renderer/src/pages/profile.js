// ===========================
// SeriesBox — Profile Page
// ===========================

import { getSession, getProfile, updateProfile, getStats } from '../api/supabase.js'
import { searchSeries, IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import { escapeHTML, debounce } from '../utils/helpers.js'

export async function renderProfile(container) {
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    if (!session) {
      container.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <p class="empty-state-title">Connexion requise</p>
            <p class="empty-state-text">Connectez-vous pour voir votre profil</p>
          </div>
        </div>
      `
      return
    }

    let profile
    try {
      profile = await getProfile(session.user.id)
    } catch {
      // Profile might not exist yet, create it
      profile = {
        id: session.user.id,
        username:
          session.user.user_metadata?.username ||
          session.user.email?.split('@')[0] ||
          'Utilisateur',
        top_four: []
      }
    }

    const stats = await getStats(session.user.id)
    const initial = (profile.username || 'U').charAt(0).toUpperCase()

    container.innerHTML = `
      <div class="page-container fade-in">
        <!-- Profile Header -->
        <div class="profile-header">
          <div class="profile-avatar-container" id="profile-avatar-container" style="position: relative; width: 100px; height: 100px; cursor: pointer; flex-shrink: 0; border-radius: 50%; overflow: hidden; margin-bottom: var(--space-xs);">
            ${
              profile.avatar_url
                ? `<img src="${profile.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;" id="profile-avatar-img" />`
                : `<div class="profile-avatar" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--accent-green); background: var(--accent-green-dim);">${initial}</div>`
            }
            <div class="avatar-hover-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--transition-fast);">
              <span style="font-size: var(--font-size-xs); color: #fff; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Modifier</span>
            </div>
            <input type="file" id="avatar-file-input" accept="image/*" style="display: none;" />
          </div>
          <h1 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); margin: 0;">
            ${escapeHTML(profile.username || 'Utilisateur')}
          </h1>
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(153, 170, 187, 0.15); margin: var(--space-xl) 0;" />

        <!-- Top 4 -->
        <div class="top-four" style="margin-bottom: var(--space-xl);">
          <h2>Séries favorites</h2>
          <div class="top-four-grid" id="top-four-grid">
            ${[0, 1, 2, 3]
              .map((i) => {
                const topItem = profile.top_four?.[i]
                if (topItem && topItem.poster_path) {
                  return `
                  <div class="top-four-slot filled" data-index="${i}" data-tmdb="${topItem.id}" draggable="true" style="position: relative;">
                    <img src="${IMG.poster(topItem.poster_path, 'w342')}" alt="${topItem.name || ''}" />
                    <button class="top-four-edit-btn" data-index="${i}" title="Modifier">✏️</button>
                  </div>
                `
                }
                return `
                <div class="top-four-slot" data-index="${i}">
                  <span class="placeholder-icon">+</span>
                </div>
              `
              })
              .join('')}
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(153, 170, 187, 0.15); margin: var(--space-xl) 0;" />

        <!-- Recent Activity -->
        <div class="section-header" style="margin-bottom: var(--space-base);">
          <h2 style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0;">Activité récente</h2>
          <a class="section-link" style="cursor:pointer; font-size: var(--font-size-sm);" id="go-diary">Voir le journal →</a>
        </div>
        <div class="scroll-row" id="recent-posters" style="margin-bottom: var(--space-xl);">
          ${
            stats.diary
              .slice(0, 10)
              .map(
                (entry) => `
            <div class="series-card" data-id="${entry.tmdb_id}" data-has-review="${!!entry.review}" style="width:120px;flex-shrink:0;">
              ${
                entry.poster_path
                  ? `<img class="poster" src="${IMG.poster(entry.poster_path, 'w185')}" alt="${entry.series_name}" loading="lazy" />`
                  : `<div class="poster-placeholder">📺</div>`
              }
              ${entry.rating ? `<div class="card-rating">★ ${entry.rating}</div>` : ''}
            </div>
          `
              )
              .join('') || '<p style="color:var(--text-muted);">Aucune activité</p>'
          }
        </div>

        <hr style="border: 0; border-top: 1px solid rgba(153, 170, 187, 0.15); margin: var(--space-xl) 0;" />

        <!-- Ratings Chart (Full Width at the bottom) -->
        <div class="chart-card" style="margin-bottom: var(--space-2xl);">
          <h2 style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: var(--space-md); margin-top: 0;">Mes notes</h2>
          <div style="display: flex; align-items: flex-end; gap: var(--space-md); height: 75px; padding-bottom: 2px;">
            <span style="color: #00E054; font-size: 1.1rem; line-height: 1; padding-bottom: 1px; user-select: none;">★</span>
            <div style="flex: 1; height: 100%; position: relative; border-bottom: 1.5px solid #2c3440; padding-bottom: 1px;">
              <canvas id="profile-ratings-chart"></canvas>
            </div>
            <span style="color: #00E054; font-size: 0.8rem; line-height: 1; padding-bottom: 2px; letter-spacing: -1.5px; user-select: none;">★★★★★</span>
          </div>
        </div>

        <!-- Top Four Picker Modal -->
        <div class="modal-overlay" id="topfour-modal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Choisir une série favorite</h3>
              <button class="modal-close" id="topfour-modal-close">✕</button>
            </div>
            <div class="modal-body">
              <input class="form-input" type="text" id="topfour-search" placeholder="Rechercher une série..." />
              <div id="topfour-results" style="margin-top:12px;max-height:300px;overflow-y:auto;"></div>
              <div id="topfour-remove-container" style="margin-top: 16px; display: none; text-align: center;">
                <button class="btn btn-danger" id="topfour-remove-btn" style="width: 100%;">Retirer des favorites</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    // Navigation
    document.getElementById('go-diary')?.addEventListener('click', () => router.navigate('/diary'))

    // Render Ratings Chart
    renderProfileRatingsChart(stats)
    container.querySelectorAll('#recent-posters .series-card').forEach((card) => {
      card.addEventListener('click', () => {
        const tmdbId = card.dataset.id
        const hasReview = card.dataset.hasReview === 'true'
        if (hasReview) {
          router.navigate(`/series/${tmdbId}?review=true`)
        } else {
          router.navigate(`/series/${tmdbId}`)
        }
      })
    })

    // Profile avatar upload logic
    const avatarContainer = document.getElementById('profile-avatar-container')
    const avatarInput = document.getElementById('avatar-file-input')
    const hoverOverlay = avatarContainer.querySelector('.avatar-hover-overlay')

    avatarContainer.addEventListener('mouseenter', () => {
      hoverOverlay.style.opacity = '1'
    })
    avatarContainer.addEventListener('mouseleave', () => {
      hoverOverlay.style.opacity = '0'
    })
    avatarContainer.addEventListener('click', () => {
      avatarInput.click()
    })

    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return

      // Validate file size and type
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image')
        return
      }

      toast.info("Traitement de l'image...")

      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = async () => {
          // Downscale image using canvas to keep Base64 size small
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 150
          const MAX_HEIGHT = 150
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          // Export compressed JPEG base64
          const base64Data = canvas.toDataURL('image/jpeg', 0.7)

          try {
            await updateProfile(session.user.id, { avatar_url: base64Data })
            toast.success('Photo de profil mise à jour !')

            // Refresh navbar avatar
            const navbarAvatarEl = document.getElementById('navbar-avatar-el')
            if (navbarAvatarEl) {
              navbarAvatarEl.innerHTML = `<img src="${base64Data}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`
              navbarAvatarEl.style.background = 'transparent'
              navbarAvatarEl.style.padding = '0'
              navbarAvatarEl.style.border = 'none'
            }

            // Refresh profile view
            renderProfile(container)
          } catch (err) {
            toast.error('Erreur lors de la mise à jour : ' + err.message)
          }
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    })

    // Top Four click & Drag and Drop logic
    let selectedSlotIndex = 0
    let draggedIndex = null
    const topFourModal = document.getElementById('topfour-modal')
    const removeContainer = document.getElementById('topfour-remove-container')

    const openPicker = (index) => {
      selectedSlotIndex = index
      const topItem = profile.top_four?.[index]
      if (topItem && topItem.poster_path) {
        removeContainer.style.display = 'block'
      } else {
        removeContainer.style.display = 'none'
      }
      topFourModal.classList.add('show')
      document.getElementById('topfour-search').value = ''
      document.getElementById('topfour-results').innerHTML = ''
      document.getElementById('topfour-search').focus()
    }

    document.querySelectorAll('.top-four-slot').forEach((slot) => {
      const index = parseInt(slot.dataset.index)

      // Drag & Drop events
      slot.addEventListener('dragstart', (e) => {
        draggedIndex = index
        e.dataTransfer.effectAllowed = 'move'
      })

      slot.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      })

      slot.addEventListener('drop', async (e) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return

        const newTopFour = [...(profile.top_four || [null, null, null, null])]
        while (newTopFour.length < 4) newTopFour.push(null)

        // Swap the elements
        const temp = newTopFour[draggedIndex]
        newTopFour[draggedIndex] = newTopFour[index]
        newTopFour[index] = temp

        try {
          await updateProfile(session.user.id, { top_four: newTopFour })
          toast.success('Favoris réorganisés !')
          renderProfile(container)
        } catch (err) {
          toast.error('Erreur: ' + err.message)
        }
      })

      if (slot.classList.contains('filled')) {
        // Clicks on the edit button open the picker
        const editBtn = slot.querySelector('.top-four-edit-btn')
        editBtn?.addEventListener('click', (e) => {
          e.stopPropagation()
          openPicker(index)
        })

        // Clicking the slot itself (the poster) redirects
        slot.addEventListener('click', (e) => {
          if (e.target.closest('.top-four-edit-btn')) return
          const tmdbId = slot.dataset.tmdb
          const hasReview = stats.diary.some(
            (entry) => Number(entry.tmdb_id) === Number(tmdbId) && entry.review
          )

          if (hasReview) {
            router.navigate(`/series/${tmdbId}?review=true`)
          } else {
            router.navigate(`/series/${tmdbId}`)
          }
        })
      } else {
        // Clicks on empty slot open the picker
        slot.addEventListener('click', () => {
          openPicker(index)
        })
      }
    })

    // Remove from favorites button
    const removeBtn = document.getElementById('topfour-remove-btn')
    removeBtn?.addEventListener('click', async () => {
      const newTopFour = [...(profile.top_four || [null, null, null, null])]
      while (newTopFour.length < 4) newTopFour.push(null)
      newTopFour[selectedSlotIndex] = null

      try {
        await updateProfile(session.user.id, { top_four: newTopFour })
        toast.success('Série retirée des favorites')
        topFourModal.classList.remove('show')
        renderProfile(container)
      } catch (err) {
        toast.error('Erreur: ' + err.message)
      }
    })

    document
      .getElementById('topfour-modal-close')
      .addEventListener('click', () => topFourModal.classList.remove('show'))
    topFourModal.addEventListener('click', (e) => {
      if (e.target === topFourModal) topFourModal.classList.remove('show')
    })

    const topFourSearch = debounce(async (query) => {
      const resultsEl = document.getElementById('topfour-results')
      if (!query || query.length < 2) {
        resultsEl.innerHTML = ''
        return
      }

      try {
        const data = await searchSeries(query)
        resultsEl.innerHTML = data.results
          .slice(0, 6)
          .map(
            (s) => `
          <div class="search-result-item" data-series='${JSON.stringify({ id: s.id, name: s.name, poster_path: s.poster_path })}'>
            <img class="mini-poster" src="${IMG.poster(s.poster_path, 'w92') || ''}" alt="" onerror="this.style.display='none'" />
            <div class="result-info">
              <div class="result-title">${s.name}</div>
              <div class="result-meta">${s.first_air_date ? new Date(s.first_air_date).getFullYear() : ''}</div>
            </div>
          </div>
        `
          )
          .join('')

        resultsEl.querySelectorAll('.search-result-item').forEach((item) => {
          item.addEventListener('click', async () => {
            const series = JSON.parse(item.dataset.series)
            const newTopFour = [...(profile.top_four || [null, null, null, null])]
            while (newTopFour.length < 4) newTopFour.push(null)
            newTopFour[selectedSlotIndex] = series

            try {
              await updateProfile(session.user.id, { top_four: newTopFour })
              toast.success(`${series.name} ajoutée aux favorites`)
              topFourModal.classList.remove('show')
              renderProfile(container)
            } catch (err) {
              toast.error('Erreur: ' + err.message)
            }
          })
        })
      } catch (err) {
        console.error(err)
      }
    }, 300)

    document
      .getElementById('topfour-search')
      .addEventListener('input', (e) => topFourSearch(e.target.value))
  } catch (err) {
    console.error('Profile error:', err)
    container.innerHTML = `
      <div class="page-container">
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p class="empty-state-title">Erreur</p>
          <p class="empty-state-text">${err.message}</p>
        </div>
      </div>
    `
  }
}

async function renderProfileRatingsChart(stats) {
  const canvas = document.getElementById('profile-ratings-chart')
  if (!canvas) return

  // Load Chart.js modules dynamically
  const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } =
    await import('chart.js')
  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

  const ratingValues = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  const distribution = {}
  ratingValues.forEach((v) => {
    distribution[v] = 0
  })
  stats.ratings.forEach((r) => {
    const key = Number(r.rating)
    if (distribution[key] !== undefined) distribution[key]++
  })

  const hasRatings = stats.ratings.length > 0

  if (!hasRatings) {
    const container = canvas.parentElement.parentElement
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:var(--font-size-sm);padding: 20px 0;">Aucune note donnée</div>`
    return
  }

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ratingValues.map((v) => `${v}★`),
      datasets: [
        {
          data: ratingValues.map((v) => distribution[v]),
          backgroundColor: '#445566', // Letterboxd grey-blue bars
          hoverBackgroundColor: '#00E054', // Letterboxd green on hover
          borderRadius: 1,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (tooltipItems) => tooltipItems[0].label,
            label: (context) => {
              const count = context.raw
              return `${count} série${count > 1 ? 's' : ''}`
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  })
}
