// ===========================
// SeriesBox — Series Detail Page
// ===========================

import { getSeriesDetails, getSeasonDetails, IMG } from '../api/tmdb.js'
import {
  getSession,
  getRating,
  setRating,
  isInWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  addDiaryEntry,
  getDiaryEntriesForSeries,
  deleteDiaryEntry
} from '../api/supabase.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import {
  formatDate,
  getYear,
  starsHTML,
  truncate,
  createStarRating,
  escapeHTML,
  formatRuntime
} from '../utils/helpers.js'
import { showLogModal } from '../components/log-modal.js'
import { confirmModal } from '../components/confirm-modal.js'

export async function renderSeriesDetail(container, params) {
  const { id } = params
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const series = await getSeriesDetails(id)
    const session = await getSession()
    let userRating = null
    let inWatchlist = false
    let diaryEntries = []

    if (session) {
      ;[userRating, inWatchlist, diaryEntries] = await Promise.all([
        getRating(session.user.id, series.id),
        isInWatchlist(session.user.id, series.id),
        getDiaryEntriesForSeries(session.user.id, series.id)
      ])
    }

    const genres = series.genres?.map((g) => g.name).join(', ') || ''
    const creators = series.created_by?.map((c) => c.name).join(', ') || ''
    const status =
      {
        'Returning Series': 'En cours',
        Ended: 'Terminée',
        Canceled: 'Annulée',
        'In Production': 'En production',
        Planned: 'Planifiée'
      }[series.status] || series.status

    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-backdrop" style="background-image: url('${IMG.backdrop(series.backdrop_path, 'original')}')"></div>
        <div class="detail-backdrop-overlay"></div>
      </div>

      <div class="detail-main">
        <div class="detail-poster-container">
          ${
            series.poster_path
              ? `<img class="detail-poster" src="${IMG.poster(series.poster_path, 'w500')}" alt="${series.name}" />`
              : `<div class="detail-poster poster-placeholder" style="height:345px; width:230px;">📺</div>`
          }
        </div>

        <div class="detail-info">
          <h1 class="detail-title">${escapeHTML(series.name)}</h1>
          ${series.tagline ? `<p class="detail-tagline">"${escapeHTML(series.tagline)}"</p>` : ''}

          <div class="detail-meta">
            <span>${getYear(series.first_air_date)}${series.last_air_date && series.status === 'Ended' ? '–' + getYear(series.last_air_date) : ''}</span>
            <span class="detail-meta-separator"></span>
            <span>${series.number_of_seasons} saison${series.number_of_seasons > 1 ? 's' : ''}</span>
            <span class="detail-meta-separator"></span>
            <span>${series.number_of_episodes} épisodes</span>
            ${
              series.episode_run_time?.length
                ? `
              <span class="detail-meta-separator"></span>
              <span>${formatRuntime(series.episode_run_time[0])}/ép.</span>
            `
                : ''
            }
            <span class="detail-meta-separator"></span>
            <span class="badge ${status === 'En cours' ? 'badge-green' : status === 'Terminée' ? 'badge-blue' : 'badge-orange'}">${status}</span>
          </div>

          <div class="detail-genres">
            ${series.genres?.map((g) => `<span class="chip">${g.name}</span>`).join('') || ''}
          </div>

          <div class="detail-rating-row">
            <div class="detail-tmdb-rating">
              <span class="detail-tmdb-score">${series.vote_average.toFixed(1)}</span>
              <div>
                <div style="font-size:0.7rem;color:var(--text-muted);">TMDB</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">${series.vote_count} votes</div>
              </div>
            </div>
            <div class="detail-your-rating">
              <span style="font-size:0.8rem;color:var(--text-muted);margin-right:8px;">Ma note</span>
              <div id="user-rating-stars"></div>
            </div>
          </div>

          <div class="action-buttons" id="action-buttons">
            <button class="action-btn" id="btn-log" title="Logger">
              <span class="action-icon">📝</span>
              <span class="action-label">Logger</span>
            </button>
            <button class="action-btn ${inWatchlist ? 'active' : ''}" id="btn-watchlist" title="Watchlist">
              <span class="action-icon">${inWatchlist ? '👁' : '👁‍🗨'}</span>
              <span class="action-label">Watchlist</span>
            </button>
          </div>
        </div>
      </div>

      <div class="detail-content">
        ${
          series.overview
            ? `
          <div class="detail-overview">
            <h3>Synopsis</h3>
            <p>${escapeHTML(series.overview)}</p>
          </div>
        `
            : ''
        }

        ${
          creators
            ? `
          <div class="detail-overview">
            <h3>Créée par</h3>
            <p>${escapeHTML(creators)}</p>
          </div>
        `
            : ''
        }

        <!-- Seasons -->
        <div class="detail-overview">
          <h3>Saisons</h3>
        </div>
        <div id="seasons-container">
          ${
            series.seasons
              ?.filter((s) => s.season_number > 0)
              .map(
                (season) => `
            <div class="season-item" data-season="${season.season_number}">
              <div class="season-header">
                ${
                  season.poster_path
                    ? `<img class="season-poster-mini" src="${IMG.poster(season.poster_path, 'w92')}" alt="" />`
                    : `<div class="season-poster-mini" style="background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">📺</div>`
                }
                <div class="season-info">
                  <div class="season-name">${escapeHTML(season.name)}</div>
                  <div class="season-meta">${season.episode_count} épisodes · ${getYear(season.air_date) || 'TBA'}</div>
                </div>
                <span class="season-toggle">▼</span>
              </div>
              <div class="season-episodes" id="season-${season.season_number}-episodes"></div>
            </div>
          `
              )
              .join('') || '<p style="color:var(--text-muted)">Aucune saison disponible</p>'
          }
        </div>

        <!-- Cast -->
        ${
          series.credits?.cast?.length
            ? `
          <div class="detail-overview" style="margin-top: var(--space-xl);">
            <h3>Casting</h3>
          </div>
          <div class="cast-grid">
            ${series.credits.cast
              .slice(0, 15)
              .map(
                (person) => `
              <div class="cast-card">
                ${
                  person.profile_path
                    ? `<img class="cast-photo" src="${IMG.profile(person.profile_path)}" alt="${person.name}" loading="lazy" />`
                    : `<div class="cast-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;">👤</div>`
                }
                <div class="cast-name">${escapeHTML(person.name)}</div>
                <div class="cast-character">${escapeHTML(person.character)}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Similar Series -->
        ${
          series.similar?.results?.length
            ? `
          <div class="detail-overview" style="margin-top: var(--space-xl);">
            <h3>Séries similaires</h3>
          </div>
          <div class="scroll-row" id="similar-row">
            ${series.similar.results
              .slice(0, 10)
              .map(
                (s) => `
              <div class="series-card" data-id="${s.id}" style="width:130px;flex-shrink:0;">
                ${
                  s.poster_path
                    ? `<img class="poster" src="${IMG.poster(s.poster_path, 'w185')}" alt="${s.name}" loading="lazy" />`
                    : `<div class="poster-placeholder">📺</div>`
                }
                <div class="card-overlay">
                  <div class="card-title">${s.name}</div>
                  <div class="card-year">${getYear(s.first_air_date)}</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <!-- Diary entries for this series -->
        ${
          diaryEntries.length > 0
            ? `
          <div class="detail-overview" style="margin-top: var(--space-xl);">
            <h3>Vos visionnages</h3>
          </div>
          <div>
            ${diaryEntries
              .map((entry) => {
                const formattedDate = new Date(entry.watched_date).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric'
                })
                const capitalizedDate =
                  formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
                return `
                <div class="diary-entry details-diary-entry" data-entry-id="${entry.id}" style="cursor:pointer;">
                  <div class="diary-date" style="width: auto; text-align: left; padding-right: 16px;">
                    <div style="font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: 500;">
                      ${capitalizedDate}
                    </div>
                  </div>
                  <div class="diary-info">
                    <div class="diary-title">${escapeHTML(entry.series_name)}</div>
                    <div class="diary-meta">
                      ${entry.rating ? starsHTML(entry.rating, { size: 'small' }) : ''}
                      ${entry.is_rewatch ? '<span class="is-rewatch" title="Re-visionnage">🔄</span>' : ''}
                      ${entry.review ? '<span class="has-review" title="Critique">💬</span>' : ''}
                    </div>
                  </div>
                  <div class="diary-icons">
                    <button class="btn btn-ghost btn-sm details-diary-delete" data-entry-id="${entry.id}" title="Supprimer">🗑</button>
                  </div>
                </div>
              `
              })
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `

    // ── Interactive star rating ──
    if (session) {
      const ratingContainer = document.getElementById('user-rating-stars')
      createStarRating(ratingContainer, userRating || 0, async (newRating) => {
        try {
          await setRating(session.user.id, series.id, newRating)
          toast.success(`Note de ${newRating}/5 enregistrée`)
        } catch (err) {
          toast.error('Erreur lors de la notation')
        }
      })
    }

    // ── Log modal (Create) ──
    document.getElementById('btn-log').addEventListener('click', () => {
      if (!session) {
        toast.error('Connectez-vous pour logger')
        return
      }

      showLogModal({
        userId: session.user.id,
        tmdbId: series.id,
        seriesName: series.name,
        posterPath: series.poster_path,
        entry: null,
        onSave: () => renderSeriesDetail(container, { id })
      })
    })

    // ── Edit entry click ──
    container.querySelectorAll('.details-diary-entry').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.details-diary-delete')) return
        const entryId = el.dataset.entryId
        const entry = diaryEntries.find((d) => d.id === entryId)
        if (!entry) return

        showLogModal({
          userId: session.user.id,
          tmdbId: series.id,
          seriesName: series.name,
          posterPath: series.poster_path,
          entry,
          onSave: () => renderSeriesDetail(container, { id })
        })
      })
    })

    // ── Delete entry click ──
    container.querySelectorAll('.details-diary-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const confirmed = await confirmModal(
          'Supprimer le visionnage',
          'Voulez-vous vraiment retirer cette série de votre journal de visionnage ?'
        )
        if (confirmed) {
          try {
            await deleteDiaryEntry(btn.dataset.entryId)
            toast.success('Visionnage supprimé')
            renderSeriesDetail(container, { id })
          } catch (err) {
            toast.error('Erreur: ' + err.message)
          }
        }
      })
    })

    // ── Watchlist toggle ──
    document.getElementById('btn-watchlist').addEventListener('click', async () => {
      if (!session) {
        toast.error('Connectez-vous pour utiliser la watchlist')
        return
      }
      const btn = document.getElementById('btn-watchlist')
      try {
        if (inWatchlist) {
          await removeFromWatchlist(session.user.id, series.id)
          inWatchlist = false
          btn.classList.remove('active')
          btn.querySelector('.action-icon').textContent = '👁‍🗨'
          toast.success('Retirée de la watchlist')
        } else {
          await addToWatchlist(session.user.id, series)
          inWatchlist = true
          btn.classList.add('active')
          btn.querySelector('.action-icon').textContent = '👁'
          toast.success('Ajoutée à la watchlist')
        }
      } catch (err) {
        toast.error('Erreur watchlist: ' + err.message)
      }
    })

    // ── Season accordion ──
    document.querySelectorAll('.season-header').forEach((header) => {
      header.addEventListener('click', async () => {
        const item = header.closest('.season-item')
        const seasonNum = parseInt(item.dataset.season)
        const episodesContainer = document.getElementById(`season-${seasonNum}-episodes`)

        if (item.classList.contains('open')) {
          item.classList.remove('open')
          return
        }

        // Close others
        document.querySelectorAll('.season-item.open').forEach((s) => s.classList.remove('open'))
        item.classList.add('open')

        // Load episodes if not already loaded
        if (!episodesContainer.innerHTML.trim()) {
          episodesContainer.innerHTML =
            '<div class="page-loader" style="padding:16px;"><div class="spinner"></div></div>'
          try {
            const seasonData = await getSeasonDetails(id, seasonNum)
            episodesContainer.innerHTML = seasonData.episodes
              .map(
                (ep) => `
              <div class="episode-item">
                <span class="episode-number">${ep.episode_number}</span>
                ${
                  ep.still_path
                    ? `<img class="episode-still" src="${IMG.still(ep.still_path)}" alt="" loading="lazy" />`
                    : `<div class="episode-still" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">📺</div>`
                }
                <div class="episode-info">
                  <div class="episode-name">${escapeHTML(ep.name)}</div>
                  <div class="episode-date">${formatDate(ep.air_date)}</div>
                </div>
              </div>
            `
              )
              .join('')
          } catch (err) {
            episodesContainer.innerHTML =
              '<p style="padding:16px;color:var(--text-muted);">Erreur de chargement</p>'
          }
        }
      })
    })

    // ── Similar series click ──
    document.querySelectorAll('#similar-row .series-card').forEach((card) => {
      card.addEventListener('click', () => router.navigate(`/series/${card.dataset.id}`))
    })

    // ── Auto-open review modal if query param review=true is present ──
    if (session && params.review === 'true') {
      const entryWithReview = diaryEntries.find((entry) => entry.review)
      if (entryWithReview) {
        // Strip the query param to prevent re-opening if page is updated/re-rendered
        if (window.location.hash.includes('?')) {
          const basePath = window.location.hash.split('?')[0]
          window.history.replaceState(null, '', basePath)
        }

        showLogModal({
          userId: session.user.id,
          tmdbId: series.id,
          seriesName: series.name,
          posterPath: series.poster_path,
          entry: entryWithReview,
          onSave: () => renderSeriesDetail(container, { id })
        })
      }
    }
  } catch (err) {
    console.error('Series detail error:', err)
    container.innerHTML = `
      <div class="page-container">
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p class="empty-state-title">Erreur de chargement</p>
          <p class="empty-state-text">${err.message}</p>
        </div>
      </div>
    `
  }
}
