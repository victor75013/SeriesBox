// ===========================
// SeriesBox — Toast Notifications
// ===========================

class ToastManager {
  constructor() {
    this.container = null
    this._init()
  }

  _init() {
    this.container = document.createElement('div')
    this.container.className = 'toast-container'
    document.body.appendChild(this.container)
  }

  show(message, type = 'info', duration = 3500) {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ'
    }

    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close">✕</button>
    `

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this._remove(toast)
    })

    this.container.appendChild(toast)

    // Auto remove
    setTimeout(() => this._remove(toast), duration)
  }

  success(message) { this.show(message, 'success') }
  error(message) { this.show(message, 'error') }
  info(message) { this.show(message, 'info') }

  _remove(toast) {
    if (!toast.parentNode) return
    toast.classList.add('removing')
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 300)
  }
}

export const toast = new ToastManager()
