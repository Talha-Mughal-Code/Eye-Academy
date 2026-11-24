import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useAuth } from './auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p role="status">Loading…</p>
  if (!user)
    return (
      <p>
        You need to <Link to="/">sign in</Link> first.
      </p>
    )
  return <>{children}</>
}
