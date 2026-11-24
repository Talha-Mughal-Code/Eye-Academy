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
      <strong>Eye Academy Viva</strong>
      <nav aria-label="Main">
        <Link to="/">Home</Link>
        <Link to="/viva">Viva</Link>
        <Link to="/attempts">My attempts</Link>
      </nav>
      {user && (
        <span className="who">
          {user.email}{' '}
          <button type="button" onClick={() => signOut(auth())}>
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
