// ===========================
// SeriesBox — Custom Confirm Modal
// ===========================

export function confirmModal(title, message) {
  return new Promise((resolve) => {
    // Create elements
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.style.opacity = '0'
    overlay.style.pointerEvents = 'none'

    overlay.innerHTML = `
      <div class="modal" style="max-width: 400px; transform: scale(0.95) translateY(10px); transition: transform var(--transition-base);">
        <div class="modal-header" style="padding: var(--space-base) var(--space-lg);">
          <h3 class="modal-title" style="color: var(--accent-red); display: flex; align-items: center; gap: 8px;">
            ⚠️ ${title}
          </h3>
          <button class="modal-close" id="confirm-modal-close-btn">✕</button>
        </div>
        <div class="modal-body" style="padding: var(--space-lg); font-size: var(--font-size-base); color: var(--text-secondary); line-height: var(--line-height-normal);">
          ${message}
        </div>
        <div class="modal-footer" style="padding: var(--space-base) var(--space-lg); background: rgba(0,0,0,0.15);">
          <button class="btn btn-secondary" id="confirm-modal-cancel-btn">Annuler</button>
          <button class="btn btn-danger" id="confirm-modal-ok-btn">Supprimer</button>
        </div>
      </div>
    `

    document.body.appendChild(overlay)

    // Trigger animations
    requestAnimationFrame(() => {
      overlay.style.opacity = '1'
      overlay.style.pointerEvents = 'auto'
      overlay.querySelector('.modal').style.transform = 'scale(1) translateY(0)'
    })

    const cleanup = (value) => {
      overlay.style.opacity = '0'
      overlay.style.pointerEvents = 'none'
      overlay.querySelector('.modal').style.transform = 'scale(0.95) translateY(10px)'
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay)
        }
        resolve(value)
      }, 200)
    }

    // Event listeners
    overlay.querySelector('#confirm-modal-ok-btn').addEventListener('click', () => cleanup(true))
    overlay
      .querySelector('#confirm-modal-cancel-btn')
      .addEventListener('click', () => cleanup(false))
    overlay
      .querySelector('#confirm-modal-close-btn')
      .addEventListener('click', () => cleanup(false))
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false)
    })
  })
}
