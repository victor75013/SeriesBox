// ===========================
// SeriesBox — Diary Page
// ===========================

import { getDiaryEntries, getSession, deleteDiaryEntry } from '../api/supabase.js'
import { IMG, getGenresForEntries } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import { starsHTML, groupBy, getYear } from '../utils/helpers.js'
import { confirmModal } from '../components/confirm-modal.js'
import { showLogModal } from '../components/log-modal.js'

export async function renderDiary(container) {
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    if (!session) {
      container.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <p class="empty-state-title">Connexion requise</p>
            <p class="empty-state-text">Connectez-vous pour accéder à votre journal</p>
          </div>
        </div>
      `
      return
    }

    const entries = await getDiaryEntries(session.user.id, { limit: 200 })

    container.innerHTML = `
      <div class="page-container fade-in">
        <div class="section-header">
          <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);">
            Journal
          </h1>
          <span style="color:var(--text-muted);font-size:var(--font-size-sm);">
            ${entries.length} visionnage${entries.length > 1 ? 's' : ''}
          </span>
        </div>

        <!-- Sub-tabs -->
        <div class="diary-subtabs">
          <button class="diary-subtab active" data-tab="list">Journal</button>
          <button class="diary-subtab" data-tab="grid">Séries</button>
          <button class="diary-subtab" data-tab="reviews">Reviews</button>
        </div>

        <div id="diary-list"></div>
        <div id="diary-grid" style="display:none;"></div>
        <div id="diary-reviews" style="display:none;"></div>
      </div>
    `

    const diaryList = document.getElementById('diary-list')
    const diaryGrid = document.getElementById('diary-grid')
    const diaryReviews = document.getElementById('diary-reviews')

    // Sub-tab switching
    container.querySelectorAll('.diary-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.diary-subtab').forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        const tab = btn.dataset.tab
        diaryList.style.display    = tab === 'list'    ? '' : 'none'
        diaryGrid.style.display    = tab === 'grid'    ? '' : 'none'
        diaryReviews.style.display = tab === 'reviews' ? '' : 'none'
      })
    })

    if (entries.length === 0) {
      diaryList.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">Journal vide</p>
          <p class="empty-state-text">Commencez à logger vos séries pour les retrouver ici</p>
          <button class="btn btn-primary" style="margin-top:16px;" id="go-search">Découvrir des séries</button>
        </div>
      `
      document.getElementById('go-search')?.addEventListener('click', () => router.navigate('/search'))
      return
    }

    // ── Fetch genres for all unique series (in background) ──
    const tmdbIds = entries.map((e) => e.tmdb_id)
    let genreMap = new Map()
    // Start genre fetch in background (don't block UI)
    getGenresForEntries(tmdbIds).then((map) => {
      genreMap = map
      // Attach genres to entries
      entries.forEach((e) => { e._genres = genreMap.get(e.tmdb_id) || [] })
      // Rebuild genre dropdowns once data is ready
      rebuildGenreDropdowns()
    })

    // Shared filter state (used by both list and grid)
    const listFilters = { notation: '', decade: '', genre: '', sort: 'date-desc' }
    const gridFilters = { notation: '', decade: '', genre: '', sort: 'date-desc' }

    // ── Year options (individual years from watched dates) ──
    const watchedYears = [...new Set(entries.map((e) => new Date(e.watched_date).getFullYear()))].sort((a, b) => b - a)

    // ── Filter bar HTML builder ──
    function buildFilterBar(idPrefix, filters) {
      return `
        <div class="diary-filter-bar">
          <div class="diary-filter-group">
            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn ${filters.notation ? 'has-filter' : ''}" data-filter="notation" data-prefix="${idPrefix}">
                Notation <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item ${!filters.notation ? 'active' : ''}" data-value="">Toute note</div>
                <div class="diary-filter-item ${filters.notation === '4.5' ? 'active' : ''}" data-value="4.5">★★★★½ et plus</div>
                <div class="diary-filter-item ${filters.notation === '4' ? 'active' : ''}" data-value="4">★★★★ et plus</div>
                <div class="diary-filter-item ${filters.notation === '3' ? 'active' : ''}" data-value="3">★★★ et plus</div>
                <div class="diary-filter-item ${filters.notation === '2' ? 'active' : ''}" data-value="2">★★ et plus</div>
                <div class="diary-filter-item ${filters.notation === 'norating' ? 'active' : ''}" data-value="norating">Non noté</div>
              </div>
            </div>

            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn ${filters.decade ? 'has-filter' : ''}" data-filter="decade" data-prefix="${idPrefix}">
                Année <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item active" data-value="">N'importe quelle année</div>
                ${watchedYears.map((y) => `<div class="diary-filter-item" data-value="${y}">${y}</div>`).join('')}
              </div>
            </div>

            <div class="diary-filter-dropdown" data-genre-dropdown="${idPrefix}">
              <button class="diary-filter-btn ${filters.genre ? 'has-filter' : ''}" data-filter="genre" data-prefix="${idPrefix}">
                Genre <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu" data-genre-menu="${idPrefix}">
                <div class="diary-filter-item active" data-value="">Tout genre</div>
                <div class="diary-filter-loading" style="padding:8px 12px;color:var(--text-muted);font-size:0.8rem;">Chargement...</div>
              </div>
            </div>

            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn" data-filter="sort" data-prefix="${idPrefix}">
                Trier par <span class="diary-filter-sort-label">${getSortLabel(filters.sort)}</span> <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item ${filters.sort === 'date-desc' ? 'active' : ''}" data-value="date-desc">Date — Du plus récent</div>
                <div class="diary-filter-item ${filters.sort === 'date-asc' ? 'active' : ''}" data-value="date-asc">Date — Du plus ancien</div>
                <div class="diary-filter-item ${filters.sort === 'rating-desc' ? 'active' : ''}" data-value="rating-desc">Note — La plus haute</div>
                <div class="diary-filter-item ${filters.sort === 'rating-asc' ? 'active' : ''}" data-value="rating-asc">Note — La plus basse</div>
                <div class="diary-filter-item ${filters.sort === 'name-asc' ? 'active' : ''}" data-value="name-asc">Nom — A à Z</div>
                <div class="diary-filter-item ${filters.sort === 'name-desc' ? 'active' : ''}" data-value="name-desc">Nom — Z à A</div>
              </div>
            </div>
          </div>

          <span class="diary-filter-count" id="${idPrefix}-count">${entries.length} série${entries.length !== 1 ? 's' : ''}</span>
        </div>
      `
    }

    function getSortLabel(sort) {
      const labels = {
        'date-desc': 'Date ↓', 'date-asc': 'Date ↑',
        'rating-desc': 'Note ↓', 'rating-asc': 'Note ↑',
        'name-asc': 'Nom A-Z', 'name-desc': 'Nom Z-A'
      }
      return labels[sort] || 'Date ↓'
    }

    // ── Apply filter logic ──
    function applyFilters(source, filters) {
      let filtered = [...source]

      if (filters.notation === 'norating') {
        filtered = filtered.filter((e) => !e.rating)
      } else if (filters.notation) {
        const min = parseFloat(filters.notation)
        filtered = filtered.filter((e) => e.rating && e.rating >= min)
      }

      if (filters.decade) {
        const year = parseInt(filters.decade)
        filtered = filtered.filter((e) => new Date(e.watched_date).getFullYear() === year)
      }

      if (filters.genre) {
        filtered = filtered.filter((e) => (e._genres || []).includes(filters.genre))
      }

      filtered.sort((a, b) => {
        switch (filters.sort) {
          case 'date-asc':    return new Date(a.watched_date) - new Date(b.watched_date)
          case 'rating-desc': return (b.rating || 0) - (a.rating || 0)
          case 'rating-asc':  return (a.rating || 0) - (b.rating || 0)
          case 'name-asc':    return a.series_name.localeCompare(b.series_name)
          case 'name-desc':   return b.series_name.localeCompare(a.series_name)
          default:            return new Date(b.watched_date) - new Date(a.watched_date)
        }
      })

      return filtered
    }

    // ── Attach filter bar event listeners ──
    function attachFilterListeners(wrapper, filters, onApply) {
      wrapper.querySelectorAll('.diary-filter-dropdown').forEach((dropdown) => {
        const btn = dropdown.querySelector('.diary-filter-btn')
        const menu = dropdown.querySelector('.diary-filter-menu')
        const filterKey = btn.dataset.filter

        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const isOpen = menu.classList.contains('show')
          wrapper.querySelectorAll('.diary-filter-menu').forEach((m) => m.classList.remove('show'))
          document.querySelectorAll('.diary-filter-menu').forEach((m) => m.classList.remove('show'))
          if (!isOpen) menu.classList.add('show')
        })

        menu.querySelectorAll('.diary-filter-item').forEach((item) => {
          item.addEventListener('click', () => {
            menu.querySelectorAll('.diary-filter-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
            filters[filterKey] = item.dataset.value

            if (filterKey === 'sort') {
              btn.querySelector('.diary-filter-sort-label').textContent = getSortLabel(item.dataset.value)
            }
            btn.classList.toggle('has-filter', !!item.dataset.value && item.dataset.value !== 'date-desc')

            menu.classList.remove('show')
            onApply()
          })
        })
      })
    }

    // ── Rebuild genre dropdown items when genres are loaded ──
    function rebuildGenreDropdowns() {
      const allGenres = [...new Set(entries.flatMap((e) => e._genres || []))].sort()

      ;['list', 'grid'].forEach((prefix) => {
        const menu = document.querySelector(`[data-genre-menu="${prefix}"]`)
        if (!menu) return
        menu.innerHTML = `
          <div class="diary-filter-item active" data-value="">Tout genre</div>
          ${allGenres.map((g) => `<div class="diary-filter-item" data-value="${g}">${g}</div>`).join('')}
        `
        // Re-attach click listeners for genre items
        const filters = prefix === 'list' ? listFilters : gridFilters
        const onApply = prefix === 'list' ? renderListView : renderGridView
        menu.querySelectorAll('.diary-filter-item').forEach((item) => {
          item.addEventListener('click', () => {
            menu.querySelectorAll('.diary-filter-item').forEach((i) => i.classList.remove('active'))
            item.classList.add('active')
            filters.genre = item.dataset.value
            const btn = document.querySelector(`[data-genre-dropdown="${prefix}"] .diary-filter-btn`)
            if (btn) btn.classList.toggle('has-filter', !!item.dataset.value)
            menu.classList.remove('show')
            onApply()
          })
        })
      })
    }

    // ── LIST VIEW ──
    function renderListView() {
      const filtered = applyFilters(entries, listFilters)
      const countEl = document.getElementById('list-count')
      if (countEl) countEl.textContent = `${filtered.length} visionnage${filtered.length !== 1 ? 's' : ''}`

      const listContent = document.getElementById('list-content')
      if (!listContent) return

      if (filtered.length === 0) {
        listContent.innerHTML = `<p style="color:var(--text-muted);padding:var(--space-lg) 0;">Aucun résultat pour ces filtres</p>`
        return
      }

      const grouped = groupBy(filtered, (entry) => {
        const d = new Date(entry.watched_date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })

      let html = ''
      for (const [monthKey, monthEntries] of Object.entries(grouped)) {
        const [year, month] = monthKey.split('-')
        const date = new Date(year, month - 1, 1)
        const monthName = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        html += `<h2 class="diary-month-header">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h2>`

        for (const entry of monthEntries) {
          html += `
            <div class="diary-entry" data-id="${entry.id}" data-tmdb="${entry.tmdb_id}">
              <img class="diary-poster" src="${IMG.poster(entry.poster_path, 'w92')}" alt=""
                   onerror="this.style.display='none'" />
              <div class="diary-info">
                <div class="diary-title">${entry.series_name}</div>
                <div class="diary-meta">
                  ${entry.rating ? starsHTML(entry.rating, { size: 'small' }) : '<span style="color:var(--text-muted)">Non noté</span>'}
                </div>
              </div>
              <div class="diary-icons">
                ${entry.is_liked ? '<span class="is-liked" title="J\'aime">🧡</span>' : ''}
                ${entry.is_rewatch ? '<span class="is-rewatch" title="Re-visionnage">🔄</span>' : ''}
                ${entry.review ? '<span class="has-review" title="Critique">💬</span>' : ''}
                <button class="btn btn-ghost btn-sm diary-edit" data-entry-id="${entry.id}" title="Modifier">✏️</button>
                <button class="btn btn-ghost btn-sm diary-delete" data-entry-id="${entry.id}" title="Supprimer">🗑</button>
              </div>
            </div>
          `
        }
      }

      listContent.innerHTML = html

      listContent.querySelectorAll('.diary-entry').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.diary-delete') || e.target.closest('.diary-edit')) return
          router.navigate(`/series/${el.dataset.tmdb}`)
        })
      })

      listContent.querySelectorAll('.diary-edit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const entry = entries.find((e) => e.id === btn.dataset.entryId)
          if (!entry) return
          showLogModal({
            userId: session.user.id,
            tmdbId: entry.tmdb_id,
            seriesName: entry.series_name,
            posterPath: entry.poster_path,
            entry,
            onSave: () => renderDiary(container)
          })
        })
      })

      listContent.querySelectorAll('.diary-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const confirmed = await confirmModal(
            'Veuillez confirmer',
            'Voulez-vous vraiment retirer cette série de votre journal de visionnage ?'
          )
          if (confirmed) {
            try {
              await deleteDiaryEntry(btn.dataset.entryId)
              toast.success('Visionnage supprimé')
              renderDiary(container)
            } catch (err) {
              toast.error('Erreur: ' + err.message)
            }
          }
        })
      })
    }

    // ── GRID VIEW ──
    function renderGridView() {
      const filtered = applyFilters(entries, gridFilters)
      const countEl = document.getElementById('grid-count')
      if (countEl) countEl.textContent = `${filtered.length} série${filtered.length !== 1 ? 's' : ''}`

      const grid = document.getElementById('diary-poster-grid')
      if (!grid) return

      grid.innerHTML = filtered.length === 0
        ? `<p style="color:var(--text-muted);padding:var(--space-lg) 0;">Aucune série ne correspond aux filtres</p>`
        : filtered.map((entry) => `
            <div class="diary-grid-item" data-tmdb="${entry.tmdb_id}" title="${entry.series_name}">
              <div class="diary-grid-poster">
                <img src="${IMG.poster(entry.poster_path, 'w185')}" alt="${entry.series_name}"
                     onerror="this.src=''" loading="lazy" />
              </div>
              <div class="diary-grid-rating">
                ${entry.rating ? starsHTML(entry.rating, { size: 'small' }) : '<span class="diary-grid-unrated">—</span>'}
              </div>
            </div>
          `).join('')

      grid.querySelectorAll('.diary-grid-item').forEach((el) => {
        el.addEventListener('click', () => router.navigate(`/series/${el.dataset.tmdb}`))
      })
    }

    // ── Build List view ──
    diaryList.innerHTML = `
      ${buildFilterBar('list', listFilters)}
      <div id="list-content"></div>
    `
    attachFilterListeners(diaryList, listFilters, renderListView)
    renderListView()

    // ── Build Grid view ──
    diaryGrid.innerHTML = `
      ${buildFilterBar('grid', gridFilters)}
      <div class="diary-poster-grid" id="diary-poster-grid"></div>
    `
    attachFilterListeners(diaryGrid, gridFilters, renderGridView)
    renderGridView()

    // ── Build Reviews view ──
    const allReviewEntries = [...entries].filter((e) => e.review)
    const reviewFilters = { notation: '', decade: '', sort: 'date-desc' }

    function renderReviewsView() {
      if (allReviewEntries.length === 0) {
        diaryReviews.innerHTML = `
          <div class="empty-state">
            <p class="empty-state-title">Aucune critique</p>
            <p class="empty-state-text">Ajoutez des critiques en loggant vos séries</p>
          </div>
        `
        return
      }

      // Apply filters
      let filtered = [...allReviewEntries]

      if (reviewFilters.notation === 'norating') {
        filtered = filtered.filter((e) => !e.rating)
      } else if (reviewFilters.notation) {
        const min = parseFloat(reviewFilters.notation)
        filtered = filtered.filter((e) => e.rating && e.rating >= min)
      }

      if (reviewFilters.decade) {
        const year = parseInt(reviewFilters.decade)
        filtered = filtered.filter((e) => new Date(e.watched_date).getFullYear() === year)
      }

      filtered.sort((a, b) => {
        switch (reviewFilters.sort) {
          case 'date-asc':    return new Date(a.watched_date) - new Date(b.watched_date)
          case 'rating-desc': return (b.rating || 0) - (a.rating || 0)
          case 'rating-asc':  return (a.rating || 0) - (b.rating || 0)
          case 'name-asc':    return a.series_name.localeCompare(b.series_name)
          case 'name-desc':   return b.series_name.localeCompare(a.series_name)
          default:            return new Date(b.watched_date) - new Date(a.watched_date)
        }
      })

      diaryReviews.innerHTML = `
        <div class="diary-filter-bar">
          <div class="diary-filter-group">
            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn ${reviewFilters.notation ? 'has-filter' : ''}" data-filter="notation">
                Notation <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item ${!reviewFilters.notation ? 'active' : ''}" data-value="">Toute note</div>
                <div class="diary-filter-item ${reviewFilters.notation === '4.5' ? 'active' : ''}" data-value="4.5">★★★★½ et plus</div>
                <div class="diary-filter-item ${reviewFilters.notation === '4' ? 'active' : ''}" data-value="4">★★★★ et plus</div>
                <div class="diary-filter-item ${reviewFilters.notation === '3' ? 'active' : ''}" data-value="3">★★★ et plus</div>
                <div class="diary-filter-item ${reviewFilters.notation === '2' ? 'active' : ''}" data-value="2">★★ et plus</div>
                <div class="diary-filter-item ${reviewFilters.notation === 'norating' ? 'active' : ''}" data-value="norating">Non noté</div>
              </div>
            </div>

            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn ${reviewFilters.decade ? 'has-filter' : ''}" data-filter="decade">
                Année <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item ${!reviewFilters.decade ? 'active' : ''}" data-value="">N'importe quelle année</div>
                ${watchedYears.map((y) => `<div class="diary-filter-item ${reviewFilters.decade === String(y) ? 'active' : ''}" data-value="${y}">${y}</div>`).join('')}
              </div>
            </div>

            <div class="diary-filter-dropdown">
              <button class="diary-filter-btn" data-filter="sort">
                Trier par <span class="diary-filter-sort-label">${getSortLabel(reviewFilters.sort)}</span> <span class="diary-filter-arrow">▾</span>
              </button>
              <div class="diary-filter-menu">
                <div class="diary-filter-item ${reviewFilters.sort === 'date-desc' ? 'active' : ''}" data-value="date-desc">Date — Du plus récent</div>
                <div class="diary-filter-item ${reviewFilters.sort === 'date-asc' ? 'active' : ''}" data-value="date-asc">Date — Du plus ancien</div>
                <div class="diary-filter-item ${reviewFilters.sort === 'rating-desc' ? 'active' : ''}" data-value="rating-desc">Note — La plus haute</div>
                <div class="diary-filter-item ${reviewFilters.sort === 'rating-asc' ? 'active' : ''}" data-value="rating-asc">Note — La plus basse</div>
                <div class="diary-filter-item ${reviewFilters.sort === 'name-asc' ? 'active' : ''}" data-value="name-asc">Nom — A à Z</div>
                <div class="diary-filter-item ${reviewFilters.sort === 'name-desc' ? 'active' : ''}" data-value="name-desc">Nom — Z à A</div>
              </div>
            </div>
          </div>
          <span class="diary-filter-count">${filtered.length} critique${filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div class="reviews-list">
          ${filtered.length === 0
            ? `<p style="color:var(--text-muted);padding:var(--space-lg) 0;">Aucune critique pour ces filtres</p>`
            : filtered.map((entry) => {
              const watchedDate = new Date(entry.watched_date).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
              })
              return `
              <div class="review-card" data-tmdb="${entry.tmdb_id}">
                <div class="review-poster-wrap">
                  <img class="review-poster" src="${IMG.poster(entry.poster_path, 'w154')}" alt="${entry.series_name}"
                       onerror="this.style.display='none'" />
                </div>
                <div class="review-body">
                  <div class="review-title-row">
                    <span class="review-series-name">${entry.series_name}</span>
                  </div>
                  <div class="review-meta">
                    ${entry.rating ? starsHTML(entry.rating, { size: 'small' }) : ''}
                    <span class="review-date">Regardé le ${watchedDate}</span>
                  </div>
                  <p class="review-text">${entry.review}</p>
                  ${entry.contains_spoilers ? '<span class="review-spoiler-tag">⚠ Contient des spoilers</span>' : ''}
                </div>
              </div>
            `}).join('')}
        </div>
      `

      // Dropdown listeners
      diaryReviews.querySelectorAll('.diary-filter-dropdown').forEach((dropdown) => {
        const btn = dropdown.querySelector('.diary-filter-btn')
        const menu = dropdown.querySelector('.diary-filter-menu')
        const filterKey = btn.dataset.filter

        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const isOpen = menu.classList.contains('show')
          document.querySelectorAll('.diary-filter-menu').forEach((m) => m.classList.remove('show'))
          if (!isOpen) menu.classList.add('show')
        })

        menu.querySelectorAll('.diary-filter-item').forEach((item) => {
          item.addEventListener('click', () => {
            reviewFilters[filterKey] = item.dataset.value
            if (filterKey === 'sort') {
              btn.querySelector('.diary-filter-sort-label').textContent = getSortLabel(item.dataset.value)
            }
            menu.classList.remove('show')
            renderReviewsView()
          })
        })
      })

      diaryReviews.querySelectorAll('.review-card').forEach((el) => {
        el.addEventListener('click', () => router.navigate(`/series/${el.dataset.tmdb}`))
      })
    }

    renderReviewsView()


    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.diary-filter-menu').forEach((m) => m.classList.remove('show'))
    })

  } catch (err) {
    console.error('Diary error:', err)
    container.innerHTML = `
      <div class="page-container">
        <div class="empty-state">
          <p class="empty-state-title">Erreur</p>
          <p class="empty-state-text">${err.message}</p>
        </div>
      </div>
    `
  }
}
