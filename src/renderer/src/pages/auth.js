// ===========================
// SeriesBox — Auth Page
// ===========================

import { signIn, signUp } from '../api/supabase.js'
import { router } from '../utils/router.js'

export async function renderAuth(container) {
  let isLogin = true

  function render() {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-logo">
            <h1>Series<span class="accent">Box</span></h1>
          </div>
          <p class="auth-subtitle">
            ${isLogin ? 'Connectez-vous pour suivre vos séries' : 'Créez votre compte SeriesBox'}
          </p>

          <div class="auth-error" id="auth-error"></div>

          <form class="auth-form" id="auth-form">
            ${
              !isLogin
                ? `
              <div class="form-group">
                <label class="form-label" for="username">Nom d'utilisateur</label>
                <input class="form-input" type="text" id="username" placeholder="MonPseudo" required />
              </div>
            `
                : ''
            }

            <div class="form-group">
              <label class="form-label" for="email">Email</label>
              <input class="form-input" type="email" id="email" placeholder="you@example.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="password">Mot de passe</label>
              <input class="form-input" type="password" id="password" placeholder="••••••••" required minlength="6" />
            </div>

            <button type="submit" class="btn btn-primary btn-lg" id="auth-submit">
              ${isLogin ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          <div class="auth-switch">
            ${
              isLogin
                ? 'Pas encore de compte ? <a id="switch-auth">S\'inscrire</a>'
                : 'Déjà un compte ? <a id="switch-auth">Se connecter</a>'
            }
          </div>
        </div>
      </div>
    `

    // Form submission
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      const errorEl = document.getElementById('auth-error')
      const submitBtn = document.getElementById('auth-submit')

      submitBtn.disabled = true
      submitBtn.textContent = 'Chargement...'
      errorEl.classList.remove('show')

      try {
        if (isLogin) {
          await signIn(email, password)
        } else {
          const username = document.getElementById('username').value
          await signUp(email, password, username)
        }
        router.navigate('/')
      } catch (err) {
        errorEl.textContent = err.message || 'Une erreur est survenue'
        errorEl.classList.add('show')
        submitBtn.disabled = false
        submitBtn.textContent = isLogin ? 'Se connecter' : "S'inscrire"
      }
    })

    // Switch auth mode
    document.getElementById('switch-auth').addEventListener('click', () => {
      isLogin = !isLogin
      render()
    })
  }

  render()
}
