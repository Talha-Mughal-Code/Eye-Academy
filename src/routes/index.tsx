import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth'
import { auth } from '../lib/firebase/client'
import { useAuth } from '../lib/auth'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p role="status">Loading…</p>
  if (user)
    return (
      <section>
        <h1>Welcome</h1>
        <p>Signed in as {user.email}.</p>
        <p>
          <Link to="/viva" className="button">Start the viva</Link>{' '}
          <Link to="/attempts">View past attempts</Link>
        </p>
      </section>
    )

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const onSignIn = (e: FormEvent) => {
    e.preventDefault()
    run(() => signInWithEmailAndPassword(auth(), email, password))
  }

  return (
    <section className="card narrow">
      <h1>Sign in</h1>
      <form onSubmit={onSignIn}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
        </label>
        <div className="row">
          <button type="submit">Sign in</button>
          <button type="button" onClick={() => run(() => createUserWithEmailAndPassword(auth(), email, password))}>
            Create account
          </button>
        </div>
      </form>
      <hr />
      <button type="button" onClick={() => run(() => signInWithPopup(auth(), new GoogleAuthProvider()))}>
        Sign in with Google
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  )
}
