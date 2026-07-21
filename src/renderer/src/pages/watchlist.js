// ===========================
// SeriesBox — Watchlist Page
// ===========================

import { getWatchlist, removeFromWatchlist, getSession } from '../api/supabase.js'
import { IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'

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
        <div class="section-header">
          <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);">
            Watchlist
          </h1>
          <span style="color:var(--text-muted);font-size:var(--font-size-sm);">
            ${watchlist.length} série${watchlist.length > 1 ? 's' : ''}
          </span>
        </div>

        <div class="poster-grid" id="watchlist-grid"></div>
      </div>
    `

    const grid = document.getElementById('watchlist-grid')

    if (watchlist.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="empty-state-icon">📋</div>
          <p class="empty-state-title">Watchlist vide</p>
          <p class="empty-state-text">Ajoutez des séries à votre watchlist depuis leur page de détails</p>
          <button class="btn btn-primary" style="margin-top:16px;" id="go-search">Découvrir des séries</button>
        </div>
      `
      document
        .getElementById('go-search')
        ?.addEventListener('click', () => router.navigate('/search'))
      return
    }

    grid.innerHTML = watchlist
      .map(
        (item) => `
      <div class="series-card" data-id="${item.tmdb_id}">
        ${
          item.poster_path
            ? `<img class="poster" src="${IMG.poster(item.poster_path, 'w342')}" alt="${item.series_name}" loading="lazy" />`
            : `<div class="poster-placeholder">📺</div>`
        }
        <div class="watchlist-badge" title="Dans la watchlist">👁</div>
        <div class="card-overlay">
          <div class="card-title">${item.series_name}</div>
          <button class="btn btn-sm btn-danger watchlist-remove" data-tmdb="${item.tmdb_id}"
                  style="margin-top:4px;width:100%;">
            Retirer
          </button>
        </div>
      </div>
    `
      )
      .join('')

    // Click on card → detail
    grid.querySelectorAll('.series-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.watchlist-remove')) return
        router.navigate(`/series/${card.dataset.id}`)
      })
    })

    // Remove from watchlist
    grid.querySelectorAll('.watchlist-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
          await removeFromWatchlist(session.user.id, parseInt(btn.dataset.tmdb))
          toast.success('Retirée de la watchlist')
          renderWatchlist(container)
        } catch (err) {
          toast.error('Erreur: ' + err.message)
        }
      })
    })
  } catch (err) {
    console.error('Watchlist error:', err)
  }
}
