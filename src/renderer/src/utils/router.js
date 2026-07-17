// ===========================
// SeriesBox — SPA Router
// Hash-based routing
// ===========================

class Router {
  constructor() {
    this.routes = {}
    this.currentRoute = null
    this.beforeEach = null
    window.addEventListener('hashchange', () => this._onHashChange())
  }

  // Register a route
  on(path, handler) {
    this.routes[path] = handler
    return this
  }

  // Set a guard that runs before each navigation
  guard(fn) {
    this.beforeEach = fn
    return this
  }

  // Navigate to a route
  navigate(path) {
    window.location.hash = path
  }

  // Get current hash path
  getCurrentPath() {
    return window.location.hash.slice(1) || '/'
  }

  // Start the router
  start() {
    this._onHashChange()
  }

  // Internal: handle hash changes
  async _onHashChange() {
    const fullPath = this.getCurrentPath()
    const [path, queryString] = fullPath.split('?')

    // Parse query params
    const params = {}
    if (queryString) {
      new URLSearchParams(queryString).forEach((val, key) => {
        params[key] = val
      })
    }

    // Parse route params (e.g., /series/12345)
    let matchedRoute = null
    let routeParams = {}

    for (const routePath in this.routes) {
      const match = this._matchRoute(routePath, path)
      if (match) {
        matchedRoute = routePath
        routeParams = match
        break
      }
    }

    if (!matchedRoute) {
      // Fallback to home
      this.navigate('/')
      return
    }

    // Run guard
    if (this.beforeEach) {
      const allowed = await this.beforeEach(matchedRoute, routeParams)
      if (!allowed) return
    }

    this.currentRoute = matchedRoute

    // Run handler
    const handler = this.routes[matchedRoute]
    if (handler) {
      await handler({ ...routeParams, ...params })
    }
  }

  // Match a route pattern against a path
  _matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean)
    const pathParts = path.split('/').filter(Boolean)

    if (patternParts.length !== pathParts.length) return null

    const params = {}
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
      } else if (patternParts[i] !== pathParts[i]) {
        return null
      }
    }

    return params
  }
}

export const router = new Router()
