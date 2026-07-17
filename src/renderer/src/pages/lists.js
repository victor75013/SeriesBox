// ===========================
// SeriesBox — Lists Page
// ===========================

import {
  getLists, createList, deleteList, getList,
  addToList, removeFromList, getSession
} from '../api/supabase.js'
import { searchSeries, IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import { escapeHTML, debounce } from '../utils/helpers.js'
import { confirmModal } from '../components/confirm-modal.js'

export async function renderLists(container, params = {}) {
  // If a list ID is passed, show that list
  if (params.id) {
    return renderListDetail(container, params.id)
  }

  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    if (!session) {
      container.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <p class="empty-state-title">Connexion requise</p>
            <p class="empty-state-text">Connectez-vous pour gérer vos listes</p>
          </div>
        </div>
      `
      return
    }

    const lists = await getLists(session.user.id)

    container.innerHTML = `
      <div class="page-container fade-in">
        <div class="section-header">
          <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);">
            Mes Listes
          </h1>
          <button class="btn btn-primary" id="create-list-btn">+ Nouvelle liste</button>
        </div>

        <div class="lists-grid" id="lists-grid"></div>

        <!-- Create list modal -->
        <div class="modal-overlay" id="create-list-modal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Nouvelle liste</h3>
              <button class="modal-close" id="create-list-close">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Titre</label>
                <input class="form-input" type="text" id="list-title" placeholder="Ma super liste" />
              </div>
              <div class="form-group">
                <label class="form-label">Description (optionnel)</label>
                <textarea class="form-input" id="list-description" placeholder="Description de la liste..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="create-list-cancel">Annuler</button>
              <button class="btn btn-primary" id="create-list-save">Créer</button>
            </div>
          </div>
        </div>
      </div>
    `

    const grid = document.getElementById('lists-grid')
    renderListCards(grid, lists)

    // Create list modal
    const modal = document.getElementById('create-list-modal')
    document.getElementById('create-list-btn').addEventListener('click', () => modal.classList.add('show'))
    document.getElementById('create-list-close').addEventListener('click', () => modal.classList.remove('show'))
    document.getElementById('create-list-cancel').addEventListener('click', () => modal.classList.remove('show'))
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show') })

    document.getElementById('create-list-save').addEventListener('click', async () => {
      const title = document.getElementById('list-title').value.trim()
      const description = document.getElementById('list-description').value.trim()
      if (!title) { toast.error('Veuillez saisir un titre'); return }

      try {
        await createList(session.user.id, title, description)
        toast.success('Liste créée !')
        modal.classList.remove('show')
        renderLists(container)
      } catch (err) {
        toast.error('Erreur: ' + err.message)
      }
    })

  } catch (err) {
    console.error('Lists error:', err)
  }
}

function renderListCards(grid, lists) {
  if (lists.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-title">Aucune liste</p>
        <p class="empty-state-text">Créez votre première liste pour organiser vos séries</p>
      </div>
    `
    return
  }

  grid.innerHTML = lists.map(list => {
    const items = list.list_items || []
    const posters = items.slice(0, 4)
    return `
      <div class="list-card" data-id="${list.id}">
        <div class="list-card-posters">
          ${posters.length > 0
            ? posters.map(item =>
                item.poster_path
                  ? `<img src="${IMG.poster(item.poster_path, 'w185')}" alt="" />`
                  : `<div style="flex:1;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">📺</div>`
              ).join('')
            : `<div style="flex:1;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:2rem;">📋</div>`
          }
        </div>
        <div class="list-card-body">
          <div class="list-card-title">${escapeHTML(list.title)}</div>
          <div class="list-card-meta">${items.length} série${items.length > 1 ? 's' : ''}</div>
        </div>
      </div>
    `
  }).join('')

  grid.querySelectorAll('.list-card').forEach(card => {
    card.addEventListener('click', () => {
      router.navigate(`/lists/${card.dataset.id}`)
    })
  })
}

async function renderListDetail(container, listId) {
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    const list = await getList(listId)

    container.innerHTML = `
      <div class="page-container fade-in">
        <div style="margin-bottom:var(--space-lg);">
          <a style="cursor:pointer;color:var(--text-secondary);font-size:var(--font-size-sm);" id="back-to-lists">← Retour aux listes</a>
        </div>

        <div class="section-header">
          <div>
            <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);">
              ${escapeHTML(list.title)}
            </h1>
            ${list.description ? `<p style="color:var(--text-muted);margin-top:4px;">${escapeHTML(list.description)}</p>` : ''}
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" id="add-to-list-btn">+ Ajouter une série</button>
            <button class="btn btn-danger btn-sm" id="delete-list-btn">🗑</button>
          </div>
        </div>

        <div style="color:var(--text-muted);font-size:var(--font-size-sm);margin-bottom:var(--space-lg);">
          ${list.list_items?.length || 0} série${(list.list_items?.length || 0) > 1 ? 's' : ''}
        </div>

        <div class="poster-grid" id="list-items-grid"></div>

        <!-- Add to list modal -->
        <div class="modal-overlay" id="add-modal">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title">Ajouter une série</h3>
              <button class="modal-close" id="add-modal-close">✕</button>
            </div>
            <div class="modal-body">
              <input class="form-input" type="text" id="add-search-input" placeholder="Rechercher une série..." />
              <div id="add-search-results" style="margin-top:12px;max-height:300px;overflow-y:auto;"></div>
            </div>
          </div>
        </div>
      </div>
    `

    document.getElementById('back-to-lists').addEventListener('click', () => router.navigate('/lists'))

    // Render items
    const itemsGrid = document.getElementById('list-items-grid')
    renderListItems(itemsGrid, list.list_items || [], listId, session, container)

    // Delete list
    document.getElementById('delete-list-btn').addEventListener('click', async () => {
      const confirmed = await confirmModal(
        'Supprimer la liste',
        `Êtes-vous sûr de vouloir supprimer la liste "${list.title}" ? Cette action est irréversible.`
      )
      if (confirmed) {
        try {
          await deleteList(listId)
          toast.success('Liste supprimée')
          router.navigate('/lists')
        } catch (err) {
          toast.error('Erreur: ' + err.message)
        }
      }
    })

    // Add to list modal
    const addModal = document.getElementById('add-modal')
    document.getElementById('add-to-list-btn').addEventListener('click', () => addModal.classList.add('show'))
    document.getElementById('add-modal-close').addEventListener('click', () => addModal.classList.remove('show'))
    addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.classList.remove('show') })

    const addSearchInput = document.getElementById('add-search-input')
    const addSearchResults = document.getElementById('add-search-results')

    const doAddSearch = debounce(async (query) => {
      if (!query || query.length < 2) { addSearchResults.innerHTML = ''; return }
      try {
        const data = await searchSeries(query)
        addSearchResults.innerHTML = data.results.slice(0, 6).map(s => `
          <div class="search-result-item" data-series='${JSON.stringify({ id: s.id, name: s.name, poster_path: s.poster_path })}'>
            <img class="mini-poster" src="${IMG.poster(s.poster_path, 'w92') || ''}" alt="" onerror="this.style.display='none'" />
            <div class="result-info">
              <div class="result-title">${s.name}</div>
              <div class="result-meta">${s.first_air_date ? new Date(s.first_air_date).getFullYear() : 'N/A'}</div>
            </div>
          </div>
        `).join('')

        addSearchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            try {
              const series = JSON.parse(item.dataset.series)
              const position = (list.list_items?.length || 0) + 1
              await addToList(listId, series, position)
              toast.success(`${series.name} ajoutée à la liste`)
              addModal.classList.remove('show')
              renderListDetail(container, listId)
            } catch (err) {
              toast.error('Erreur: ' + err.message)
            }
          })
        })
      } catch (err) {
        console.error(err)
      }
    }, 300)

    addSearchInput.addEventListener('input', (e) => doAddSearch(e.target.value))

  } catch (err) {
    console.error('List detail error:', err)
  }
}

function renderListItems(grid, items, listId, session, container) {
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">📋</div>
        <p class="empty-state-title">Liste vide</p>
        <p class="empty-state-text">Ajoutez des séries à cette liste</p>
      </div>
    `
    return
  }

  grid.innerHTML = items.map((item, idx) => `
    <div class="series-card" data-tmdb="${item.tmdb_id}">
      ${item.poster_path
        ? `<img class="poster" src="${IMG.poster(item.poster_path, 'w342')}" alt="${item.series_name}" loading="lazy" />`
        : `<div class="poster-placeholder">📺</div>`
      }
      <div class="card-overlay">
        <div class="card-title">${item.series_name}</div>
        <button class="btn btn-sm btn-danger list-item-remove" data-item-id="${item.id}" style="margin-top:4px;width:100%;">
          Retirer
        </button>
      </div>
    </div>
  `).join('')

  grid.querySelectorAll('.series-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.list-item-remove')) return
      router.navigate(`/series/${card.dataset.tmdb}`)
    })
  })

  grid.querySelectorAll('.list-item-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      try {
        await removeFromList(btn.dataset.itemId)
        toast.success('Retirée de la liste')
        renderListDetail(container, listId)
      } catch (err) {
        toast.error('Erreur: ' + err.message)
      }
    })
  })
}
