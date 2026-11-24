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
import { CASE } from '../lib/case/findings'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <p role="status" className="muted">Loading…</p>

  if (user)
    return (
      <section className="card hero">
        <p className="eyebrow">Case {CASE.case_id}</p>
        <h1>{CASE.title ?? 'Ophthalmology viva'}</h1>
        <p className="muted">A short spoken viva with an AI examiner. Every finding comes straight from the case file.</p>
        <ol>
          <li>Ask the examiner for the history and examination findings you need.</li>
          <li>When you're ready, give your diagnosis and immediate management.</li>
          <li>Answer one follow-up question, then get a revision point from the reference note.</li>
        </ol>
        <div className="row">
          <Link to="/viva" className="button primary lg">Start the viva</Link>
          <Link to="/attempts" className="button lg">Past attempts</Link>
        </div>
      </section>
    )

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message.replace(/^Firebase: /, ''))
    } finally {
      setBusy(false)
    }
  }
  const onSignIn = (e: FormEvent) => {
    e.preventDefault()
    run(() => signInWithEmailAndPassword(auth(), email, password))
  }

  return (
    <div className="auth-wrap">
      <section className="card auth-card" aria-labelledby="signin-title">
        <p className="eyebrow">Eye Academy</p>
        <h1 id="signin-title">Sign in to practise</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Voice ophthalmology viva. Local demo accounts are fine.</p>
        <form onSubmit={onSignIn} style={{ marginTop: 18 }}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={busy} style={{ flex: 1 }}>Sign in</button>
            <button type="button" disabled={busy} style={{ flex: 1 }} onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).form
              if (form && !form.reportValidity()) return
              run(() => createUserWithEmailAndPassword(auth(), email, password))
            }}>
              Create account
            </button>
          </div>
        </form>
        <div className="divider">or</div>
        <button type="button" className="full" disabled={busy} onClick={() => run(() => signInWithPopup(auth(), new GoogleAuthProvider()))}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Continue with Google
        </button>
        {error && <p role="alert" className="error small">{error}</p>}
      </section>
    </div>
  )
}
