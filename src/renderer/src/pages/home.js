// ===========================
// SeriesBox — Home Page
// ===========================

import { getTrending, getPopular, getTopRated, getOnTheAir, IMG } from '../api/tmdb.js'
import { getDiaryEntries, getSession } from '../api/supabase.js'
import { router } from '../utils/router.js'
import { getYear, starsHTML, truncate } from '../utils/helpers.js'

export async function renderHome(container) {
  container.innerHTML = `
    <div class="page-container">
      <div class="hero-section" id="hero-section">
        <div class="page-loader"><div class="spinner"></div></div>
      </div>
      <div class="home-section" id="popular-section">
        <div class="section-header">
          <h2 class="section-title">Séries Populaires</h2>
          <a class="section-link" data-nav="/search?sort=popular">Voir tout →</a>
        </div>
        <div class="scroll-row" id="popular-row"></div>
      </div>
      <div class="home-section" id="onair-section">
        <div class="section-header">
          <h2 class="section-title">En cours de diffusion</h2>
          <a class="section-link" data-nav="/search?sort=on_the_air">Voir tout →</a>
        </div>
        <div class="scroll-row" id="onair-row"></div>
      </div>
      <div class="home-section" id="toprated-section">
        <div class="section-header">
          <h2 class="section-title">Les mieux notées</h2>
          <a class="section-link" data-nav="/search?sort=top_rated">Voir tout →</a>
        </div>
        <div class="scroll-row" id="toprated-row"></div>
      </div>
      <div class="home-section" id="recent-activity">
        <div class="section-header">
          <h2 class="section-title">Votre activité récente</h2>
          <a class="section-link" data-nav="/diary">Voir le journal →</a>
        </div>
        <div id="activity-row"></div>
      </div>
    </div>
  `

  // Setup nav links
  container.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault()
      router.navigate(el.dataset.nav)
    })
  })

  try {
    // Load data in parallel
    const [trending, popular, topRated, onAir] = await Promise.all([
      getTrending('week'),
      getPopular(),
      getTopRated(),
      getOnTheAir()
    ])

    // Hero section
    renderHero(trending.results.slice(0, 1)[0])

    // Rows
    renderSeriesRow('popular-row', popular.results.slice(0, 12))
    renderSeriesRow('onair-row', onAir.results.slice(0, 12))
    renderSeriesRow('toprated-row', topRated.results.slice(0, 12))

    // Recent activity
    await renderRecentActivity()

  } catch (err) {
    console.error('Home page error:', err)
    container.querySelector('.page-loader')?.remove()
  }
}

function renderHero(series) {
  if (!series) return
  const heroSection = document.getElementById('hero-section')
  if (!heroSection) return

  heroSection.innerHTML = `
    <div class="hero-backdrop" style="background-image: url('${IMG.backdrop(series.backdrop_path)}')"></div>
    <div class="hero-gradient"></div>
    <div class="hero-content">
      <img class="hero-poster" src="${IMG.poster(series.poster_path, 'w342')}" alt="${series.name}" />
      <div class="hero-info">
        <span class="badge badge-green hero-badge">🔥 Tendance</span>
        <h1 class="hero-title">${series.name}</h1>
        <div class="hero-meta">
          ${getYear(series.first_air_date)} · ⭐ ${series.vote_average.toFixed(1)}
        </div>
        <p class="hero-overview">${truncate(series.overview, 250)}</p>
        <div style="margin-top: 16px; display: flex; gap: 12px;">
          <button class="btn btn-primary" data-nav="/series/${series.id}">Voir les détails</button>
        </div>
      </div>
    </div>
  `

  heroSection.querySelector('.btn-primary').addEventListener('click', () => {
    router.navigate(`/series/${series.id}`)
  })
}

function renderSeriesRow(containerId, seriesList) {
  const row = document.getElementById(containerId)
  if (!row) return

  row.innerHTML = seriesList.map(series => `
    <div class="series-card" data-id="${series.id}" style="width: 150px;">
      ${series.poster_path
        ? `<img class="poster" src="${IMG.poster(series.poster_path, 'w342')}" alt="${series.name}" loading="lazy" />`
        : `<div class="poster-placeholder">📺</div>`
      }
      ${series.vote_average > 0 ? `
        <div class="card-rating">★ ${series.vote_average.toFixed(1)}</div>
      ` : ''}
      <div class="card-overlay">
        <div class="card-title">${series.name}</div>
        <div class="card-year">${getYear(series.first_air_date)}</div>
      </div>
    </div>
  `).join('')

  // Click to detail
  row.querySelectorAll('.series-card').forEach(card => {
    card.addEventListener('click', () => {
      router.navigate(`/series/${card.dataset.id}`)
    })
  })
}

async function renderRecentActivity() {
  const activityRow = document.getElementById('activity-row')
  if (!activityRow) return

  try {
    const session = await getSession()
    if (!session) {
      activityRow.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <p class="empty-state-text">Connectez-vous pour voir votre activité</p>
        </div>
      `
      return
    }

    const entries = await getDiaryEntries(session.user.id, { limit: 5 })

    if (entries.length === 0) {
      activityRow.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-title">Aucune activité</p>
          <p class="empty-state-text">Commencez à logger vos séries pour voir votre activité ici</p>
        </div>
      `
      return
    }

    activityRow.innerHTML = `<div class="scroll-row">${entries.map(entry => `
      <div class="series-card" data-id="${entry.tmdb_id}" style="width: 120px;">
        ${entry.poster_path
          ? `<img class="poster" src="${IMG.poster(entry.poster_path, 'w185')}" alt="${entry.series_name}" loading="lazy" />`
          : `<div class="poster-placeholder">📺</div>`
        }
        ${entry.rating ? `<div class="card-rating">★ ${entry.rating}</div>` : ''}
        <div class="card-overlay">
          <div class="card-title">${entry.series_name}</div>
        </div>
      </div>
    `).join('')}</div>`

    activityRow.querySelectorAll('.series-card').forEach(card => {
      card.addEventListener('click', () => {
        router.navigate(`/series/${card.dataset.id}`)
      })
    })
  } catch (err) {
    console.error('Activity error:', err)
  }
}
