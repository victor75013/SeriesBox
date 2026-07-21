// ===========================
// SeriesBox — Watchlist Page
// ===========================

import { getWatchlist, removeFromWatchlist, getSession } from '../api/supabase.js'
import { getSeriesDetails, IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import { escapeHTML } from '../utils/helpers.js'

export async function renderWatchlist(container) {
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    if (!session) {
      container.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <p class="empty-state-title">Connexion requise</p>
            <p class="empty-state-text">Connectez-vous pour accéder à votre watchlist</p>
          </div>
        </div>
      `
      return
    }

    const watchlist = await getWatchlist(session.user.id)

    container.innerHTML = `
      <div class="page-container fade-in">
        <div class="section-header" style="margin-bottom: var(--space-md);">
          <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);">
            Watchlist
          </h1>
          <span style="color:var(--text-muted);font-size:var(--font-size-sm);" id="watchlist-count">
            ${watchlist.length} série${watchlist.length > 1 ? 's' : ''}
          </span>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: var(--space-lg); border-bottom: 1px solid rgba(153, 170, 187, 0.15); padding-bottom: 8px;">
          <span class="tab-btn active" id="tab-watchlist-shows">Séries à voir</span>
          <span class="tab-btn" id="tab-watchlist-calendar">Planning des sorties</span>
        </div>

        <div id="watchlist-tab-content"></div>
      </div>
    `

    const tabContent = document.getElementById('watchlist-tab-content')
    const btnShows = document.getElementById('tab-watchlist-shows')
    const btnCalendar = document.getElementById('tab-watchlist-calendar')
    const countEl = document.getElementById('watchlist-count')

    btnShows.addEventListener('click', () => {
      btnShows.classList.add('active')
      btnCalendar.classList.remove('active')
      countEl.innerText = `${watchlist.length} série${watchlist.length > 1 ? 's' : ''}`
      renderShowsGrid()
    })

    btnCalendar.addEventListener('click', () => {
      btnShows.classList.remove('active')
      btnCalendar.classList.add('active')
      renderCalendarTimeline()
    })

    // Default view
    renderShowsGrid()

    function renderShowsGrid() {
      if (watchlist.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <div class="empty-state-icon">📋</div>
            <p class="empty-state-title">Watchlist vide</p>
            <p class="empty-state-text">Ajoutez des séries à votre watchlist depuis leur page de détails</p>
            <button class="btn btn-primary" style="margin-top:16px;" id="go-search">Découvrir des séries</button>
          </div>
        `
        document.getElementById('go-search')?.addEventListener('click', () => router.navigate('/search'))
        return
      }

      tabContent.innerHTML = `
        <div class="poster-grid" id="watchlist-grid">
          ${watchlist.map(item => `
            <div class="series-card" data-id="${item.tmdb_id}">
              ${item.poster_path
                ? `<img class="poster" src="${IMG.poster(item.poster_path, 'w342')}" alt="${item.series_name}" loading="lazy" />`
                : `<div class="poster-placeholder">📺</div>`
              }
              <div class="watchlist-badge" title="Dans la watchlist">👁</div>
              <div class="card-overlay">
                <div class="card-title">${item.series_name}</div>
                <button class="btn btn-sm btn-danger watchlist-remove" data-tmdb="${item.tmdb_id}" style="margin-top:4px;width:100%;">
                  Retirer
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `

      // Click on card → detail
      tabContent.querySelectorAll('.series-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.watchlist-remove')) return
          router.navigate(`/series/${card.dataset.id}`)
        })
      })

      // Remove from watchlist
      tabContent.querySelectorAll('.watchlist-remove').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          try {
            await removeFromWatchlist(session.user.id, parseInt(btn.dataset.tmdb))
            toast.success('Retirée de la watchlist')
            const idx = watchlist.findIndex(item => item.tmdb_id === parseInt(btn.dataset.tmdb))
            if (idx !== -1) watchlist.splice(idx, 1)
            countEl.innerText = `${watchlist.length} série${watchlist.length > 1 ? 's' : ''}`
            renderShowsGrid()
          } catch (err) {
            toast.error('Erreur: ' + err.message)
          }
        })
      })
    }

    async function renderCalendarTimeline() {
      tabContent.innerHTML = `<div style="display:flex; justify-content:center; padding: 40px 0;"><div class="spinner"></div></div>`

      if (watchlist.length === 0) {
        tabContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <p class="empty-state-title">Watchlist vide</p>
            <p class="empty-state-text">Ajoutez des séries à votre watchlist pour suivre leurs diffusions.</p>
          </div>
        `
        return
      }

      try {
        const seriesDetailsList = await Promise.all(
          watchlist.map(async (item) => {
            try {
              return await getSeriesDetails(item.tmdb_id)
            } catch {
              return null
            }
          })
        )

        const upcomingEpisodes = seriesDetailsList
          .filter(s => s && s.next_episode_to_air)
          .map(s => ({
            seriesId: s.id,
            seriesName: s.name,
            posterPath: s.poster_path,
            episode: s.next_episode_to_air
          }))

        upcomingEpisodes.sort((a, b) => new Date(a.episode.air_date) - new Date(b.episode.air_date))

        countEl.innerText = `${upcomingEpisodes.length} sortie${upcomingEpisodes.length > 1 ? 's' : ''} prévue${upcomingEpisodes.length > 1 ? 's' : ''}`

        if (upcomingEpisodes.length === 0) {
          tabContent.innerHTML = `
            <div class="empty-state" style="margin-top: 20px;">
              <div class="empty-state-icon">📺</div>
              <p class="empty-state-title">Aucune sortie planifiée</p>
              <p class="empty-state-text">Les séries de votre watchlist sont terminées, en pause ou n'ont pas encore annoncé de dates de diffusion.</p>
            </div>
          `
          return
        }

        const groupedByDate = upcomingEpisodes.reduce((acc, curr) => {
          const dateStr = curr.episode.air_date
          if (!acc[dateStr]) acc[dateStr] = []
          acc[dateStr].push(curr)
          return acc
        }, {})

        let html = '<div class="calendar-timeline">'
        const today = new Date()
        today.setHours(0,0,0,0)

        for (const [dateStr, episodes] of Object.entries(groupedByDate)) {
          const airDate = new Date(dateStr)
          airDate.setHours(0,0,0,0)
          
          const diffTime = airDate - today
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          let relativeLabel = ''
          if (diffDays === 0) {
            relativeLabel = `<span class="badge badge-green" style="margin-left: 12px; text-transform: uppercase;">Aujourd'hui</span>`
          } else if (diffDays === 1) {
            relativeLabel = `<span class="badge badge-blue" style="margin-left: 12px; text-transform: uppercase;">Demain</span>`
          } else if (diffDays > 1 && diffDays < 8) {
            relativeLabel = `<span style="color: var(--accent-green); font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; margin-left: 12px;">Dans ${diffDays} jours</span>`
          } else if (diffDays < 0) {
            relativeLabel = `<span style="color: var(--text-muted); font-size: var(--font-size-xs); font-weight: 500; text-transform: uppercase; margin-left: 12px;">Diffusé il y a ${Math.abs(diffDays)} jours</span>`
          } else {
            relativeLabel = `<span style="color: var(--text-muted); font-size: var(--font-size-xs); font-weight: 500; text-transform: uppercase; margin-left: 12px;">Dans ${diffDays} jours</span>`
          }

          const formattedDateStr = airDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
          const capitalizedDate = formattedDateStr.charAt(0).toUpperCase() + formattedDateStr.slice(1)

          html += `
            <div class="calendar-date-group" style="margin-bottom: var(--space-xl);">
              <div class="calendar-date-header" style="display: flex; align-items: center; border-bottom: 1px solid rgba(153, 170, 187, 0.15); padding-bottom: var(--space-xs); margin-bottom: var(--space-md);">
                <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--text-primary); margin: 0;">${capitalizedDate}</h3>
                ${relativeLabel}
              </div>
              <div class="calendar-episodes-grid" style="display: grid; grid-template-columns: 1fr; gap: var(--space-md);">
                ${episodes.map(ep => {
                  const epNum = `S${String(ep.episode.season_number).padStart(2, '0')}E${String(ep.episode.episode_number).padStart(2, '0')}`
                  return `
                    <div class="calendar-episode-card" data-id="${ep.seriesId}" style="display: flex; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--space-md); cursor: pointer; transition: all var(--transition-fast); align-items: center; gap: var(--space-md);">
                      <div class="calendar-episode-poster" style="width: 50px; height: 75px; flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-color);">
                        ${ep.posterPath 
                          ? `<img src="${IMG.poster(ep.posterPath, 'w92')}" style="width: 100%; height: 100%; object-fit: cover;" />`
                          : `<div style="width: 100%; height: 100%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📺</div>`
                        }
                      </div>
                      <div class="calendar-episode-info" style="flex: 1; min-width: 0;">
                        <div style="font-size: var(--font-size-sm); color: var(--accent-green); font-weight: var(--font-weight-semibold);">${escapeHTML(ep.seriesName)}</div>
                        <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); color: var(--text-primary); margin: 2px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${escapeHTML(ep.episode.name || 'Épisode sans titre')}
                        </div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                          <span class="chip chip-sm" style="background: var(--bg-tertiary); padding: 2px 6px; font-weight: 600; font-size: 0.65rem;">${epNum}</span>
                          ${ep.episode.runtime ? `<span>· ${ep.episode.runtime} min</span>` : ''}
                        </div>
                      </div>
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          `
        }

        html += '</div>'
        tabContent.innerHTML = html

        tabContent.querySelectorAll('.calendar-episode-card').forEach(card => {
          card.addEventListener('click', () => {
            router.navigate(`/series/${card.dataset.id}`)
          })
        })

      } catch (err) {
        console.error('Calendar tab error:', err)
        tabContent.innerHTML = `<p style="color:var(--accent-red);">Impossible de charger le planning.</p>`
      }
    }

  } catch (err) {
    console.error('Watchlist error:', err)
  }
}
