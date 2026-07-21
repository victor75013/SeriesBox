// ===========================
// SeriesBox — Home Page
// ===========================

import { getTrending, getPopular, getTopRated, getOnTheAir, getRecommendations, IMG } from '../api/tmdb.js'
import { getDiaryEntries, getSession, getProfile, getAllRatings } from '../api/supabase.js'
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
      <div class="home-section" id="recommendations-section" style="display:none; margin-bottom: var(--space-2xl);">
        <div class="section-header">
          <h2 class="section-title">Recommandé pour vous</h2>
        </div>
        <div class="scroll-row" id="recommendations-row"></div>
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
  container.querySelectorAll('[data-nav]').forEach((el) => {
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

    // Recommendations
    await renderRecommendations()
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

  row.innerHTML = seriesList
    .map(
      (series) => `
    <div class="series-card" data-id="${series.id}" style="width: 150px;">
      ${
        series.poster_path
          ? `<img class="poster" src="${IMG.poster(series.poster_path, 'w342')}" alt="${series.name}" loading="lazy" />`
          : `<div class="poster-placeholder">📺</div>`
      }
      ${
        series.vote_average > 0
          ? `
        <div class="card-rating">★ ${series.vote_average.toFixed(1)}</div>
      `
          : ''
      }
      <div class="card-overlay">
        <div class="card-title">${series.name}</div>
        <div class="card-year">${getYear(series.first_air_date)}</div>
      </div>
    </div>
  `
    )
    .join('')

  // Click to detail
  row.querySelectorAll('.series-card').forEach((card) => {
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

    activityRow.innerHTML = `<div class="scroll-row">${entries
      .map(
        (entry) => `
      <div class="series-card" data-id="${entry.tmdb_id}" data-has-review="${!!entry.review}" style="width: 120px;">
        ${
          entry.poster_path
            ? `<img class="poster" src="${IMG.poster(entry.poster_path, 'w185')}" alt="${entry.series_name}" loading="lazy" />`
            : `<div class="poster-placeholder">📺</div>`
        }
        ${entry.rating ? `<div class="card-rating">★ ${entry.rating}</div>` : ''}
        <div class="card-overlay">
          <div class="card-title">${entry.series_name}</div>
        </div>
      </div>
    `
      )
      .join('')}</div>`

    activityRow.querySelectorAll('.series-card').forEach((card) => {
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
  } catch (err) {
    console.error('Activity error:', err)
  }
}

async function renderRecommendations() {
  const section = document.getElementById('recommendations-section')
  const row = document.getElementById('recommendations-row')
  if (!section || !row) return

  try {
    const session = await getSession()
    if (!session) return

    // Fetch profile (for top_four) and ratings in parallel
    const [profile, ratings, diary] = await Promise.all([
      getProfile(session.user.id).catch(() => null),
      getAllRatings(session.user.id).catch(() => []),
      getDiaryEntries(session.user.id, { limit: 1000 }).catch(() => [])
    ])

    // Collect base IDs
    const baseIds = new Set()
    
    // 1. Add top four
    if (profile && profile.top_four) {
      profile.top_four.forEach((item) => {
        if (item && item.id) baseIds.add(item.id)
      })
    }

    // 2. Add highly rated series (rating >= 4)
    ratings.forEach((r) => {
      if (r.rating >= 4) baseIds.add(r.tmdb_id)
    })

    const candidateIds = Array.from(baseIds)
    if (candidateIds.length === 0) return

    // Fetch recommendations for the first 3 candidate IDs to avoid overloading the API
    const targetIds = candidateIds.slice(0, 3)
    const recsList = await Promise.all(
      targetIds.map(async (id) => {
        try {
          const res = await getRecommendations(id)
          return res.results || []
        } catch {
          return []
        }
      })
    )

    // Merge and deduplicate
    const allRecs = {}
    recsList.flat().forEach((series) => {
      if (series && series.id) {
        allRecs[series.id] = series
      }
    })

    // Exclude series already watched/logged
    const watchedIds = new Set([
      ...diary.map((e) => e.tmdb_id),
      ...ratings.map((r) => r.tmdb_id)
    ])

    const filteredRecs = Object.values(allRecs).filter((series) => !watchedIds.has(series.id))

    if (filteredRecs.length === 0) return

    // Sort by popularity and slice first 12
    filteredRecs.sort((a, b) => b.popularity - a.popularity)
    const displayRecs = filteredRecs.slice(0, 12)

    // Render row
    row.innerHTML = displayRecs
      .map(
        (series) => `
      <div class="series-card" data-id="${series.id}" style="width: 150px;">
        ${
          series.poster_path
            ? `<img class="poster" src="${IMG.poster(series.poster_path, 'w342')}" alt="${series.name}" loading="lazy" />`
            : `<div class="poster-placeholder">📺</div>`
        }
        ${
          series.vote_average > 0
            ? `
          <div class="card-rating">★ ${series.vote_average.toFixed(1)}</div>
        `
            : ''
        }
        <div class="card-overlay">
          <div class="card-title">${series.name}</div>
          <div class="card-year">${getYear(series.first_air_date)}</div>
        </div>
      </div>
    `
      )
      .join('')

    // Show section
    section.style.display = 'block'

    // Click to detail
    row.querySelectorAll('.series-card').forEach((card) => {
      card.addEventListener('click', () => {
        router.navigate(`/series/${card.dataset.id}`)
      })
    })
  } catch (err) {
    console.error('Recommendations error:', err)
  }
}
