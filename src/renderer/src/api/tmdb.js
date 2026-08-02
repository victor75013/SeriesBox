// ===========================
// SeriesBox — TMDB API Client
// ===========================

const BASE_URL = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'
const API_KEY = import.meta.env.RENDERER_VITE_TMDB_API_KEY

// Image size helpers
export const IMG = {
  poster: (path, size = 'w342') => (path ? `${IMG_BASE}/${size}${path}` : null),
  backdrop: (path, size = 'w1280') => (path ? `${IMG_BASE}/${size}${path}` : null),
  profile: (path, size = 'w185') => (path ? `${IMG_BASE}/${size}${path}` : null),
  still: (path, size = 'w300') => (path ? `${IMG_BASE}/${size}${path}` : null)
}

// Generic fetch helper
async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('language', 'fr-FR')
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, val)
    }
  })

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// ── Trending ──
export async function getTrending(timeWindow = 'week', page = 1) {
  return tmdbFetch(`/trending/tv/${timeWindow}`, { page })
}

// ── Popular ──
export async function getPopular(page = 1) {
  return tmdbFetch('/tv/popular', { page })
}

// ── Top Rated ──
export async function getTopRated(page = 1) {
  return tmdbFetch('/tv/top_rated', { page })
}

// ── Airing Today ──
export async function getAiringToday(page = 1) {
  return tmdbFetch('/tv/airing_today', { page })
}

// ── On The Air (series currently airing) ──
export async function getOnTheAir(page = 1) {
  return tmdbFetch('/tv/on_the_air', { page })
}

// ── Search ──
export async function searchSeries(query, page = 1) {
  if (!query || query.trim().length === 0) return { results: [], total_results: 0 }
  return tmdbFetch('/search/tv', { query: query.trim(), page })
}

// ── Series Details ──
export async function getSeriesDetails(id) {
  return tmdbFetch(`/tv/${id}`, {
    append_to_response: 'credits,similar,images,external_ids'
  })
}

// ── Season Details ──
export async function getSeasonDetails(seriesId, seasonNumber) {
  return tmdbFetch(`/tv/${seriesId}/season/${seasonNumber}`)
}

// ── Discover ──
export async function discoverSeries(params = {}) {
  return tmdbFetch('/discover/tv', {
    sort_by: 'popularity.desc',
    ...params
  })
}

// ── Genre List ──
let genreCache = null
export async function getGenres() {
  if (genreCache) return genreCache
  const data = await tmdbFetch('/genre/tv/list')
  genreCache = data.genres
  return genreCache
}

// ── Fetch genre names for a single series ──
export async function getSeriesGenres(id) {
  try {
    const data = await tmdbFetch(`/tv/${id}`)
    return data.genres || []
  } catch {
    return []
  }
}

// ── Batch-fetch genres for multiple series (respects rate limit) ──
export async function getGenresForEntries(tmdbIds, batchSize = 8) {
  const unique = [...new Set(tmdbIds)]
  const map = new Map()
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize)
    const results = await Promise.allSettled(batch.map((id) => getSeriesGenres(id)))
    results.forEach((r, idx) => {
      map.set(batch[idx], r.status === 'fulfilled' ? r.value.map((g) => g.name) : [])
    })
  }
  return map
}

// ── Get genre name by ID ──
export async function getGenreName(id) {
  const genres = await getGenres()
  const genre = genres.find((g) => g.id === id)
  return genre ? genre.name : 'Inconnu'
}

// ── Recommendations ──
export async function getRecommendations(id, page = 1) {
  return tmdbFetch(`/tv/${id}/recommendations`, { page })
}
