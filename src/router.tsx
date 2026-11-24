import { createRouter, Link } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Page not found</h1>
      <p className="muted">That page does not exist.</p>
      <Link to="/" className="button primary">Go home</Link>
    </div>
  )
}

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true, defaultNotFoundComponent: NotFound })
}
