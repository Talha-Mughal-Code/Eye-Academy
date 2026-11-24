import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useAuth } from './auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p role="status" className="muted">Loading…</p>
  if (!user)
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Please sign in</h1>
        <p className="muted">You need to be signed in to use the viva.</p>
        <Link to="/" className="button primary">Go to sign in</Link>
      </div>
    )
  return <>{children}</>
}
