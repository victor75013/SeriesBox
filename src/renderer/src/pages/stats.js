// ===========================
// SeriesBox — Stats Page
// ===========================

import { getStats, getSession } from '../api/supabase.js'
import { router } from '../utils/router.js'
import { groupBy } from '../utils/helpers.js'

export async function renderStats(container) {
  container.innerHTML = `<div class="page-container"><div class="page-loader"><div class="spinner"></div></div></div>`

  try {
    const session = await getSession()
    if (!session) {
      container.innerHTML = `
        <div class="page-container">
          <div class="empty-state">
            <div class="empty-state-icon">🔒</div>
            <p class="empty-state-title">Connexion requise</p>
            <p class="empty-state-text">Connectez-vous pour voir vos statistiques</p>
          </div>
        </div>
      `
      return
    }

    const stats = await getStats(session.user.id)

    container.innerHTML = `
      <div class="page-container fade-in">
        <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-extrabold);margin-bottom:var(--space-xl);">
          Statistiques
        </h1>

        <!-- Overview Cards -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-value">${stats.totalSeries}</div>
            <div class="stat-label">Séries vues</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalEntries}</div>
            <div class="stat-label">Visionnages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.avgRating || '–'}</div>
            <div class="stat-label">Note moyenne</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.totalWatchlist}</div>
            <div class="stat-label">En watchlist</div>
          </div>
        </div>

        <!-- Charts -->
        <div class="stats-charts">
          <div class="chart-card">
            <h3>Notes données</h3>
            <div class="chart-container">
              <canvas id="ratings-chart"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <h3>Visionnages par mois</h3>
            <div class="chart-container">
              <canvas id="monthly-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Activity Heatmap -->
        <div class="chart-card" style="margin-bottom:var(--space-2xl);">
          <h3>Activité (12 derniers mois)</h3>
          <div class="heatmap-container">
            <div class="heatmap" id="activity-heatmap"></div>
          </div>
        </div>

        <!-- Top rated -->
        ${
          stats.ratings.length > 0
            ? `
          <div class="chart-card">
            <h3>Vos meilleures notes</h3>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${stats.ratings
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 10)
                .map((r, i) => {
                  const entry = stats.diary.find((d) => d.tmdb_id === r.tmdb_id)
                  return `
                    <div style="display:flex;align-items:center;gap:12px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.15s;"
                         onmouseenter="this.style.background='var(--bg-tertiary)'"
                         onmouseleave="this.style.background='transparent'"
                         onclick="window.location.hash='/series/${r.tmdb_id}'">
                      <span style="color:var(--text-muted);width:24px;font-weight:600;">${i + 1}</span>
                      <span style="flex:1;font-weight:500;">${entry?.series_name || 'Série #' + r.tmdb_id}</span>
                      <span style="color:var(--star-filled);font-weight:700;">★ ${r.rating}</span>
                    </div>
                  `
                })
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>
    `

    // Render charts
    renderCharts(stats)
    renderHeatmap(stats.diary)
  } catch (err) {
    console.error('Stats error:', err)
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

async function renderCharts(stats) {
  const {
    Chart,
    BarController,
    DoughnutController,
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
  } = await import('chart.js')
  Chart.register(
    BarController,
    DoughnutController,
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
  )

  const chartColors = {
    green: '#00E054',
    blue: '#40BCF4',
    orange: '#EE7000',
    purple: '#A700FF',
    red: '#FF2834',
    teal: '#00BFA5',
    pink: '#FF4081'
  }

  // Ratings distribution
  const ratingsCanvas = document.getElementById('ratings-chart')
  if (ratingsCanvas && stats.ratings.length > 0) {
    const ratingValues = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
    const distribution = {}
    ratingValues.forEach((v) => {
      distribution[v] = 0
    })
    stats.ratings.forEach((r) => {
      const key = Number(r.rating)
      if (distribution[key] !== undefined) distribution[key]++
    })

    new Chart(ratingsCanvas, {
      type: 'bar',
      data: {
        labels: ratingValues.map((v) => `${v}★`),
        datasets: [
          {
            data: ratingValues.map((v) => distribution[v]),
            backgroundColor: chartColors.green,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#99AABB', font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#667788', stepSize: 1 },
            grid: { color: 'rgba(44,52,64,0.5)' }
          }
        }
      }
    })
  }

  // Monthly activity
  const monthlyCanvas = document.getElementById('monthly-chart')
  if (monthlyCanvas && stats.diary.length > 0) {
    const monthlyData = {}
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      monthlyData[key] = { label, count: 0 }
    }

    stats.diary.forEach((entry) => {
      const d = new Date(entry.watched_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyData[key]) monthlyData[key].count++
    })

    new Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels: Object.values(monthlyData).map((d) => d.label),
        datasets: [
          {
            data: Object.values(monthlyData).map((d) => d.count),
            backgroundColor: chartColors.blue,
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#99AABB', font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#667788', stepSize: 1 },
            grid: { color: 'rgba(44,52,64,0.5)' }
          }
        }
      }
    })
  }
}

function renderHeatmap(diary) {
  const heatmap = document.getElementById('activity-heatmap')
  if (!heatmap) return

  // Count entries per day for the last 365 days
  const dayCounts = {}
  diary.forEach((entry) => {
    const d = entry.watched_date
    dayCounts[d] = (dayCounts[d] || 0) + 1
  })

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 364)

  // Align to Monday
  while (startDate.getDay() !== 1) {
    startDate.setDate(startDate.getDate() - 1)
  }

  let html = ''
  const current = new Date(startDate)

  while (current <= today) {
    html += '<div class="heatmap-week">'
    for (let day = 0; day < 7; day++) {
      const dateStr = current.toISOString().split('T')[0]
      const count = dayCounts[dateStr] || 0
      let level = 0
      if (count === 1) level = 1
      else if (count === 2) level = 2
      else if (count === 3) level = 3
      else if (count >= 4) level = 4

      const title = `${current.toLocaleDateString('fr-FR')} : ${count} visionnage${count > 1 ? 's' : ''}`
      html += `<div class="heatmap-day" data-level="${level}" title="${title}"></div>`
      current.setDate(current.getDate() + 1)
    }
    html += '</div>'
  }

  heatmap.innerHTML = html
}
