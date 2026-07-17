// ===========================
// SeriesBox — Helpers
// ===========================

// Format date to French locale
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Format short date
export function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  })
}

// Get year from date string
export function getYear(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).getFullYear()
}

// Get month name
export function getMonthName(date) {
  return new Date(date).toLocaleDateString('fr-FR', { month: 'long' })
}

// Get weekday short name
export function getWeekday(date) {
  return new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' })
}

// Debounce function
export function debounce(fn, delay = 300) {
  let timer
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// Truncate text
export function truncate(text, maxLength = 200) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}

// Generate star display HTML
export function starsHTML(rating, options = {}) {
  const { size = '', readonly = true, interactive = false } = options
  const fullStars = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)

  let classes = 'star-rating'
  if (readonly) classes += ' readonly'
  if (size) classes += ` ${size}`
  if (interactive) classes += ' interactive'

  let html = `<span class="${classes}" data-rating="${rating}">`
  for (let i = 0; i < fullStars; i++) {
    html += `<span class="star filled" data-value="${i + 1}">★</span>`
  }
  if (hasHalf) {
    html += `<span class="star half" data-value="${fullStars + 0.5}">★</span>`
  }
  for (let i = 0; i < emptyStars; i++) {
    html += `<span class="star" data-value="${fullStars + (hasHalf ? 1.5 : 1) + i}">★</span>`
  }
  html += '</span>'
  return html
}

// Create interactive star rating
export function createStarRating(container, currentRating = 0, onChange = null) {
  container.innerHTML = ''
  container.className = 'star-rating large'

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span')
    star.className = 'star' + (i <= Math.floor(currentRating) ? ' filled' : '') +
      (currentRating % 1 >= 0.5 && i === Math.ceil(currentRating) ? ' half' : '')
    star.textContent = '★'
    star.dataset.value = i

    // Half-star support on click position
    star.addEventListener('click', (e) => {
      const rect = star.getBoundingClientRect()
      const isHalf = (e.clientX - rect.left) < rect.width / 2
      const value = isHalf ? i - 0.5 : i
      updateStars(container, value)
      if (onChange) onChange(value)
    })

    star.addEventListener('mouseenter', () => {
      updateStars(container, i, true)
    })

    container.appendChild(star)
  }

  container.addEventListener('mouseleave', () => {
    updateStars(container, currentRating)
  })

  function updateStars(cont, rating, isHover = false) {
    const stars = cont.querySelectorAll('.star')
    stars.forEach((s, idx) => {
      const val = idx + 1
      s.classList.remove('filled', 'half')
      if (val <= Math.floor(rating)) {
        s.classList.add('filled')
      } else if (rating % 1 >= 0.5 && val === Math.ceil(rating)) {
        s.classList.add('half')
      }
    })
    if (!isHover) {
      cont.dataset.rating = rating
      currentRating = rating
    }
  }
}

// Escape HTML
export function escapeHTML(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// Group array by key
export function groupBy(arr, keyFn) {
  return arr.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

// Format runtime (minutes to hours)
export function formatRuntime(minutes) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

// Plural helper
export function plural(count, singular, pluralForm) {
  return count <= 1 ? singular : (pluralForm || singular + 's')
}
