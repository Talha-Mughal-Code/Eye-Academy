/// <reference types="vite/client" />
import { Outlet, createRootRoute, HeadContent, Scripts, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import appCss from '../styles.css?url'
import { AuthProvider, useAuth } from '../lib/auth'
import { auth } from '../lib/firebase/client'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Eye Academy Viva' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function Nav() {
  const { user } = useAuth()
  return (
    <header className="nav">
      <Link to="/" className="brand" aria-label="Eye Academy Viva, home">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Eye Academy Viva
      </Link>
      {user && (
        <nav aria-label="Main">
          <Link to="/viva" activeProps={{ className: 'active' }}>Viva</Link>
          <Link to="/attempts" activeProps={{ className: 'active' }}>My attempts</Link>
        </nav>
      )}
      {user && (
        <span className="who">
          <span>{user.email}</span>
          <button type="button" className="small ghost" onClick={() => signOut(auth())}>
            Sign out
          </button>
        </span>
      )}
    </header>
  )
}

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <Nav />
          <main>
            <Outlet />
          </main>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
