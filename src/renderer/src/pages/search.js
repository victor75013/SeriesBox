// ===========================
// SeriesBox — Search Page
// ===========================

import { searchSeries, getPopular, getTopRated, getOnTheAir, discoverSeries, getGenres, IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { getYear, debounce } from '../utils/helpers.js'

export async function renderSearch(container, params = {}) {
  const initialQuery = params.q || ''
  const initialSort = params.sort || ''

  container.innerHTML = `
    <div class="page-container fade-in">
      <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);margin-bottom:var(--space-lg);">
        Découvrir les séries
      </h1>

      <input class="search-page-input" type="text" id="search-input"
             placeholder="Rechercher une série..." value="${initialQuery}" autofocus />

      <div class="search-filters" id="genre-filters"></div>

      <div class="search-results-count" id="results-count"></div>

      <div class="poster-grid" id="search-results"></div>

      <div id="load-more-container" style="text-align:center;margin-top:var(--space-xl);display:none;">
        <button class="btn btn-secondary" id="load-more-btn">Charger plus</button>
      </div>
    </div>
  `

  let currentPage = 1
  let totalPages = 1
  let currentQuery = initialQuery
  let selectedGenre = null
  let allResults = []

  // Load genres
  try {
    const genres = await getGenres()
    const filtersContainer = document.getElementById('genre-filters')
    filtersContainer.innerHTML = `
      <span class="chip ${!selectedGenre ? 'active' : ''}" data-genre="">Tous</span>
      ${genres.map(g => `<span class="chip" data-genre="${g.id}">${g.name}</span>`).join('')}
    `

    filtersContainer.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtersContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
        chip.classList.add('active')
        selectedGenre = chip.dataset.genre || null
        currentPage = 1
        allResults = []
        doSearch()
      })
    })
  } catch (err) {
    console.error('Genres error:', err)
  }

  const searchInput = document.getElementById('search-input')

  // Debounced search
  const debouncedSearch = debounce(() => {
    currentQuery = searchInput.value.trim()
    currentPage = 1
    allResults = []
    doSearch()
  }, 400)

  searchInput.addEventListener('input', debouncedSearch)

  // Load more
  document.getElementById('load-more-btn').addEventListener('click', () => {
    currentPage++
    doSearch(true)
  })

  // Initial load
  if (initialSort) {
    await loadBySort(initialSort)
  } else if (initialQuery) {
    doSearch()
  } else {
    await loadBySort('popular')
  }

  async function doSearch(append = false) {
    const resultsContainer = document.getElementById('search-results')
    const countEl = document.getElementById('results-count')
    const loadMoreContainer = document.getElementById('load-more-container')

    if (!append) {
      resultsContainer.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>'
    }

    try {
      let data
      if (currentQuery) {
        data = await searchSeries(currentQuery, currentPage)
      } else if (selectedGenre) {
        data = await discoverSeries({ with_genres: selectedGenre, page: currentPage })
      } else {
        data = await getPopular(currentPage)
      }

      totalPages = data.total_pages
      const results = data.results || []

      if (append) {
        allResults = [...allResults, ...results]
      } else {
        allResults = results
      }

      countEl.textContent = `${data.total_results} résultat${data.total_results > 1 ? 's' : ''}`

      renderResults(resultsContainer, allResults)

      loadMoreContainer.style.display = currentPage < totalPages ? 'block' : 'none'
    } catch (err) {
      console.error('Search error:', err)
      if (!append) {
        resultsContainer.innerHTML = `<div class="empty-state"><p class="empty-state-text">Erreur de recherche</p></div>`
      }
    }
  }

  async function loadBySort(sort) {
    const resultsContainer = document.getElementById('search-results')
    const countEl = document.getElementById('results-count')

    resultsContainer.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>'

    try {
      let data
      switch (sort) {
        case 'top_rated': data = await getTopRated(); break
        case 'on_the_air': data = await getOnTheAir(); break
        default: data = await getPopular(); break
      }

      allResults = data.results || []
      countEl.textContent = `${allResults.length} séries`
      renderResults(resultsContainer, allResults)
    } catch (err) {
      console.error('Sort error:', err)
    }
  }

  function renderResults(container, results) {
    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🔍</div>
          <p class="empty-state-title">Aucune série trouvée</p>
          <p class="empty-state-text">Essayez une autre recherche</p>
        </div>
      `
      return
    }

    container.innerHTML = results.map(series => `
      <div class="series-card" data-id="${series.id}">
        ${series.poster_path
          ? `<img class="poster" src="${IMG.poster(series.poster_path, 'w342')}" alt="${series.name}" loading="lazy" />`
          : `<div class="poster-placeholder">📺</div>`
        }
        ${series.vote_average > 0 ? `<div class="card-rating">★ ${series.vote_average.toFixed(1)}</div>` : ''}
        <div class="card-overlay">
          <div class="card-title">${series.name}</div>
          <div class="card-year">${getYear(series.first_air_date)}</div>
        </div>
      </div>
    `).join('')

    container.querySelectorAll('.series-card').forEach(card => {
      card.addEventListener('click', () => router.navigate(`/series/${card.dataset.id}`))
    })
  }
}
