// ===========================
// SeriesBox — Programmatic Log/Edit Modal
// ===========================

import { addDiaryEntry, updateDiaryEntry, setRating } from '../api/supabase.js'
import { createStarRating } from '../utils/helpers.js'
import { toast } from './toast.js'

export function showLogModal({ userId, tmdbId, seriesName, posterPath, entry = null, onSave }) {
  const isEdit = !!entry

  // Create overlay
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.opacity = '0'
  overlay.style.pointerEvents = 'none'

  // Pre-fill values
  const watchedDate = entry ? entry.watched_date.slice(0, 7) : new Date().toISOString().slice(0, 7)
  const rating = entry ? Number(entry.rating || 0) : 0
  const review = entry ? entry.review || '' : ''
  const isRewatch = entry ? !!entry.is_rewatch : false
  const containsSpoilers = entry ? !!entry.contains_spoilers : false

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Modifier le visionnage de' : 'Logger'} "${seriesName}"</h3>
        <button class="modal-close" id="log-modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Mois de visionnage</label>
          <input class="form-input" type="month" id="log-date" value="${watchedDate}" />
        </div>
        <div class="form-group">
          <label class="form-label">Note</label>
          <div id="log-rating-stars"></div>
        </div>
        <div class="form-group">
          <label class="form-input form-checkbox">
            <input type="checkbox" id="log-rewatch" ${isRewatch ? 'checked' : ''} />
            C'est un re-visionnage
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Critique (optionnel)</label>
          <textarea class="form-input" id="log-review" placeholder="Qu'en avez-vous pensé ?">${review}</textarea>
        </div>
        <div class="form-group">
          <label class="form-input form-checkbox">
            <input type="checkbox" id="log-spoilers" ${containsSpoilers ? 'checked' : ''} />
            Contient des spoilers
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="log-cancel-btn">Annuler</button>
        <button class="btn btn-primary" id="log-save-btn">Enregistrer</button>
      </div>
    </div>
  `

  document.body.appendChild(overlay)

  // Initialize interactive stars
  let currentRating = rating
  const starsContainer = overlay.querySelector('#log-rating-stars')
  createStarRating(starsContainer, currentRating, (r) => {
    currentRating = r
  })

  // Trigger modal animations
  requestAnimationFrame(() => {
    overlay.style.opacity = '1'
    overlay.style.pointerEvents = 'auto'
  })

  const cleanup = () => {
    overlay.style.opacity = '0'
    overlay.style.pointerEvents = 'none'
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }, 200)
  }

  // Handle Save
  overlay.querySelector('#log-save-btn').addEventListener('click', async () => {
    const btn = overlay.querySelector('#log-save-btn')
    btn.disabled = true
    btn.textContent = 'Enregistrement...'

    const data = {
      user_id: userId,
      tmdb_id: tmdbId,
      series_name: seriesName,
      poster_path: posterPath,
      watched_date: overlay.querySelector('#log-date').value + '-01',
      rating: currentRating || null,
      review: overlay.querySelector('#log-review').value.trim() || null,
      is_rewatch: overlay.querySelector('#log-rewatch').checked,
      contains_spoilers: overlay.querySelector('#log-spoilers').checked
    }

    try {
      if (isEdit) {
        // Update diary entry
        await updateDiaryEntry(entry.id, {
          watched_date: data.watched_date,
          rating: data.rating,
          review: data.review,
          is_rewatch: data.is_rewatch,
          contains_spoilers: data.contains_spoilers
        })
      } else {
        // Create new diary entry
        await addDiaryEntry(data)
      }

      // Upsert global rating for the series
      if (currentRating) {
        await setRating(userId, tmdbId, currentRating)
      }

      toast.success(isEdit ? 'Visionnage modifié !' : 'Visionnage enregistré !')
      cleanup()
      if (onSave) onSave()
    } catch (err) {
      toast.error('Erreur: ' + err.message)
      btn.disabled = false
      btn.textContent = 'Enregistrer'
    }
  })

  // Cancel events
  overlay.querySelector('#log-cancel-btn').addEventListener('click', cleanup)
  overlay.querySelector('#log-modal-close-btn').addEventListener('click', cleanup)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup()
  })
}
