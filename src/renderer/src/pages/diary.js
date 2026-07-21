// ===========================
// SeriesBox — Diary Page
// ===========================

import { getDiaryEntries, getSession, deleteDiaryEntry } from '../api/supabase.js'
import { IMG } from '../api/tmdb.js'
import { router } from '../utils/router.js'
import { toast } from '../components/toast.js'
import { starsHTML, groupBy, getMonthName, getWeekday, getYear } from '../utils/helpers.js'
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
            <div class="empty-state-icon">🔒</div>
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

        <div id="diary-list"></div>
      </div>
    `

    const diaryList = document.getElementById('diary-list')

    if (entries.length === 0) {
      diaryList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-title">Journal vide</p>
          <p class="empty-state-text">Commencez à logger vos séries pour les retrouver ici</p>
          <button class="btn btn-primary" style="margin-top:16px;" id="go-search">Découvrir des séries</button>
        </div>
      `
      document
        .getElementById('go-search')
        ?.addEventListener('click', () => router.navigate('/search'))
      return
    }

    // Group by month
    const grouped = groupBy(entries, (entry) => {
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
              ${entry.is_rewatch ? '<span class="is-rewatch" title="Re-visionnage">🔄</span>' : ''}
              ${entry.review ? '<span class="has-review" title="Critique">💬</span>' : ''}
              <button class="btn btn-ghost btn-sm diary-edit" data-entry-id="${entry.id}" title="Modifier">✏️</button>
              <button class="btn btn-ghost btn-sm diary-delete" data-entry-id="${entry.id}" title="Supprimer">🗑</button>
            </div>
          </div>
        `
      }
    }

    diaryList.innerHTML = html

    // Click on entry → go to series
    diaryList.querySelectorAll('.diary-entry').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.diary-delete') || e.target.closest('.diary-edit')) return
        router.navigate(`/series/${el.dataset.tmdb}`)
      })
    })

    // Edit entry
    diaryList.querySelectorAll('.diary-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const entryId = btn.dataset.entryId
        const entry = entries.find((e) => e.id === entryId)
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

    // Delete entry
    diaryList.querySelectorAll('.diary-delete').forEach((btn) => {
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
            renderDiary(container)
          } catch (err) {
            toast.error('Erreur: ' + err.message)
          }
        }
      })
    })
  } catch (err) {
    console.error('Diary error:', err)
    container.innerHTML = `
      <div class="page-container">
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <p class="empty-state-title">Erreur</p>
          <p class="empty-state-text">${err.message}</p>
        </div>
      </div>
    `
  }
}
