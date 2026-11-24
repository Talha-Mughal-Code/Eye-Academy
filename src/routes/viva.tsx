import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { RequireAuth } from '../lib/RequireAuth'
import { useAuth } from '../lib/auth'
import { useLiveViva, type Card, type Status } from '../lib/viva/useLiveViva'

export const Route = createFileRoute('/viva')({
  component: () => (
    <RequireAuth>
      <Viva />
    </RequireAuth>
  ),
})

const BADGE: Record<Status, { text: string; cls: string }> = {
  idle: { text: 'Not started', cls: 'idle' },
  connecting: { text: 'Connecting…', cls: 'idle' },
  your_turn: { text: 'Your turn: listening', cls: 'listening' },
  recording: { text: 'Your turn: listening (recording)', cls: 'listening' },
  thinking: { text: 'Examiner thinking', cls: 'thinking' },
  speaking: { text: 'Examiner speaking', cls: 'speaking' },
  ended: { text: 'Viva finished', cls: 'idle' },
  error: { text: 'Stopped', cls: 'idle' },
}

const EYE: Record<string, string> = { right: 'Right eye', left: 'Left eye', both: 'Both eyes' }

function FindingCard({ c }: { c: Card }) {
  if (c.kind === 'available')
    return (
      <li className="finding">
        <div className="meta">{c.eye ? EYE[c.eye] : 'General'}</div>
        <strong>{c.label}:</strong> {c.value}
        {c.method && <div className="meta">{c.method}</div>}
      </li>
    )
  if (c.kind === 'unavailable')
    return (
      <li className="finding unavailable">
        <div className="meta">{c.eye ? EYE[c.eye] : 'General'}</div>
        <strong>{c.label}</strong> — <strong>Not available:</strong> {c.reason}
      </li>
    )
  if (c.kind === 'history')
    return (
      <li className="finding">
        <div className="meta">History</div>
        <strong>{c.label}:</strong> {c.text}
      </li>
    )
  return (
    <li className="finding unavailable">
      <strong>Not in this case:</strong> {c.label}
    </li>
  )
}

function Viva() {
  const { user } = useAuth()
  const v = useLiveViva({ getIdToken: () => user!.getIdToken() })
  const { status, viva, canTalk, pressStart, pressEnd } = v

  // Spacebar push-to-talk (ignored while typing in a field).
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName)
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isField(e.target)) return
      e.preventDefault()
      pressStart()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isField(e.target)) return
      e.preventDefault()
      pressEnd()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [pressStart, pressEnd])

  const badge = BADGE[status]
  const started = status !== 'idle' && status !== 'error'
  const summary = v.latency.summary()

  return (
    <section>
      <h1>Voice viva</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className={`badge ${badge.cls}`} role="status" aria-live="polite">
          {badge.text}
        </span>
        <span className="muted">Phase: {viva.phase}</span>
      </div>

      {!started && (
        <p>
          <button className="primary" onClick={v.start}>
            {status === 'error' ? 'Restart viva' : 'Start viva'}
          </button>{' '}
          <span className="muted">Uses your microphone. Hold the button or the spacebar to speak.</span>
        </p>
      )}
      {v.error && <p role="alert" className="error">{v.error}</p>}

      {started && status !== 'ended' && (
        <div className="row" style={{ marginBottom: 16 }}>
          <button
            className={`ptt ${status === 'recording' ? 'active' : ''}`}
            disabled={!canTalk}
            aria-pressed={status === 'recording'}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              pressStart()
            }}
            onPointerUp={pressEnd}
            onPointerCancel={pressEnd}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), pressStart())}
            onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), pressEnd())}
          >
            {status === 'recording' ? 'Release to send' : 'Hold to talk'}
          </button>
          {viva.phase === 'findings' && (
            <button onClick={v.ready} disabled={status !== 'your_turn'}>
              I'm ready to give my diagnosis and management
            </button>
          )}
          {viva.phase === 'followup' && <span className="muted">One follow-up question, then the viva ends.</span>}
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h2>Revealed findings</h2>
          {v.cards.length === 0 ? <p className="muted">Ask the examiner for findings.</p> : <ul style={{ listStyle: 'none', padding: 0 }}>{v.cards.map((c, i) => <FindingCard key={i} c={c} />)}</ul>}
        </div>
        <div className="card">
          <h2>Transcript</h2>
          <div className="transcript" aria-live="off">
            {v.transcript.map((l, i) => (
              <p key={i}>
                <strong>{l.role === 'examiner' ? 'Examiner' : 'You'}:</strong> {l.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {status === 'ended' && (
        <div className="card revision" style={{ marginTop: 16 }}>
          <h2>Viva finished</h2>
          <p className="muted">Revision point: coming in a later step.</p>
        </div>
      )}

      {import.meta.env.DEV && (
        <details className="card" style={{ marginTop: 16 }}>
          <summary>Latency (dev) — {v.latencyTurns} turns</summary>
          <p className="muted">Start = push-to-talk released. Stop = first examiner audio scheduled to play. Excludes mic and speaker hardware delay.</p>
          <p>
            Tool-call turns: n={summary.toolCall.n}, median {summary.toolCall.median ?? '–'} ms, slowest {summary.toolCall.max ?? '–'} ms. Plain turns: n={summary.plain.n}, median {summary.plain.median ?? '–'} ms, slowest {summary.plain.max ?? '–'} ms.
          </p>
          <table className="latency">
            <thead>
              <tr><th>#</th><th>phase</th><th>tool call</th><th>ms</th></tr>
            </thead>
            <tbody>
              {v.latency.turns.map((t) => (
                <tr key={t.turn}><td>{t.turn}</td><td>{t.phase}</td><td>{t.toolCall ? 'yes' : 'no'}</td><td>{t.latencyMs}</td></tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => v.latency.exportJson()}>Export latency JSON</button>
        </details>
      )}
    </section>
  )
}
