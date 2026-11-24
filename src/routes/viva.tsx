import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { RequireAuth } from '../lib/RequireAuth'
import { useAuth } from '../lib/auth'
import { useLiveViva, type Status } from '../lib/viva/useLiveViva'
import { FindingCard, MicIcon, Stepper } from '../components/viva'
import { CASE } from '../lib/case/findings'

export const Route = createFileRoute('/viva')({
  component: () => (
    <RequireAuth>
      <Viva />
    </RequireAuth>
  ),
})

const BADGE: Record<Status, { text: string; cls: string; help: string }> = {
  idle: { text: 'Not started', cls: 'idle', help: 'Start the viva when you are ready. You will need your microphone.' },
  connecting: { text: 'Connecting…', cls: 'idle', help: 'Setting up a secure session with the examiner.' },
  your_turn: { text: 'Your turn: listening', cls: 'listening', help: 'Hold the button or the spacebar while you speak, then release.' },
  recording: { text: 'Your turn: listening', cls: 'recording', help: 'Recording. Release when you have finished speaking.' },
  thinking: { text: 'Examiner thinking', cls: 'thinking', help: 'Please wait.' },
  speaking: { text: 'Examiner speaking', cls: 'speaking', help: 'Listen to the examiner. The microphone is off.' },
  ended: { text: 'Viva finished', cls: 'idle', help: 'The session has ended.' },
  error: { text: 'Stopped', cls: 'idle', help: 'Something went wrong. You can restart the viva.' },
}

function Viva() {
  const { user } = useAuth()
  const v = useLiveViva({ getIdToken: () => user!.getIdToken() })
  const { status, viva, canTalk, pressStart, pressEnd } = v
  const transcriptEnd = useRef<HTMLDivElement>(null)

  // Spacebar push-to-talk (ignored while focus is in a field or on another button).
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(t.tagName)
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

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [v.transcript.length])

  const badge = BADGE[status]
  const started = status !== 'idle' && status !== 'error'
  const live = started && status !== 'ended'
  const summary = v.latency.summary()

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Case {CASE.case_id}</p>
          <h1>{CASE.title ?? 'Voice viva'}</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <Stepper phase={viva.phase} />

        {!started ? (
          <div className="stage">
            <div>
              <span className={`badge ${badge.cls}`} role="status" aria-live="polite">
                <span className="dot" aria-hidden="true" />
                {badge.text}
              </span>
              <p className="muted stage-help">
                {status === 'error' ? badge.help : <>The examiner will read the case and wait for your questions. Hold <kbd>Space</kbd> or the microphone button to speak.</>}
              </p>
              {v.error && <p role="alert" className="error small">{v.error}</p>}
            </div>
            <button className="primary lg" onClick={v.start}>
              {status === 'error' ? 'Restart viva' : 'Start viva'}
            </button>
          </div>
        ) : (
          <div className="stage">
            <div>
              <span className={`badge ${badge.cls}`} role="status" aria-live="polite">
                <span className="dot" aria-hidden="true" />
                {badge.text}
              </span>
              <p className="muted stage-help">{badge.help}</p>
              {v.error && <p role="alert" className="error small">{v.error}</p>}
              {live && (
                <div className="actions">
                  {viva.phase === 'findings' && (
                    <button onClick={v.ready} disabled={status !== 'your_turn'}>
                      I'm ready to give my diagnosis and management
                    </button>
                  )}
                  {viva.phase === 'answer' && <span className="muted small">Give your diagnosis and immediate management in one go.</span>}
                  {viva.phase === 'followup' && <span className="muted small">One follow-up question, then the viva ends.</span>}
                </div>
              )}
            </div>
            {live && (
              <div className="ptt-wrap">
                <button
                  className={`ptt ${status === 'recording' ? 'active' : ''}`}
                  disabled={!canTalk}
                  aria-pressed={status === 'recording'}
                  aria-label={status === 'recording' ? 'Release to send' : 'Hold to talk'}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    pressStart()
                  }}
                  onPointerUp={pressEnd}
                  onPointerCancel={pressEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), pressStart())}
                  onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), pressEnd())}
                >
                  <MicIcon />
                  {status === 'recording' ? 'Release' : 'Hold to talk'}
                </button>
                <span className="muted small">or hold <kbd>Space</kbd></span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-head">
            <h2>Revealed findings</h2>
            <span className="count" aria-label={`${v.cards.length} items`}>{v.cards.length}</span>
          </div>
          {v.cards.length === 0 ? (
            <p className="empty">Findings you ask for will appear here.</p>
          ) : (
            <ul className="findings">
              {v.cards.map((c, i) => <FindingCard key={i} c={c} />)}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Transcript</h2>
          </div>
          {v.transcript.length === 0 ? (
            <p className="empty">The conversation will appear here.</p>
          ) : (
            <div className="transcript">
              {v.transcript.map((l, i) => (
                <div key={i} className={`bubble ${l.role}`}>
                  <span className="who">{l.role === 'examiner' ? 'Examiner' : 'You'}</span>
                  {l.text}
                </div>
              ))}
              <div ref={transcriptEnd} />
            </div>
          )}
        </div>
      </div>

      {status === 'ended' && (
        <div className="card revision">
          <h2>Viva finished</h2>
          <p className="muted">Revision point: coming in a later step.</p>
          <div className="row">
            <Link to="/attempts" className="button">See past attempts</Link>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <details className="card dev">
          <summary>Latency (dev) · {v.latencyTurns} turns</summary>
          <p className="muted small">Start = push-to-talk released. Stop = first examiner audio scheduled to play. Excludes microphone and speaker hardware delay.</p>
          <div className="stats">
            <div className="stat"><span className="muted small">Tool-call median</span><b>{summary.toolCall.median ?? '–'} ms</b><span className="muted small">slowest {summary.toolCall.max ?? '–'} · n={summary.toolCall.n}</span></div>
            <div className="stat"><span className="muted small">Plain median</span><b>{summary.plain.median ?? '–'} ms</b><span className="muted small">slowest {summary.plain.max ?? '–'} · n={summary.plain.n}</span></div>
          </div>
          {v.latency.turns.length > 0 && (
            <table className="latency">
              <thead>
                <tr><th>#</th><th>Phase</th><th>Tool call</th><th>Latency</th></tr>
              </thead>
              <tbody>
                {v.latency.turns.map((t) => (
                  <tr key={t.turn}><td>{t.turn}</td><td>{t.phase}</td><td>{t.toolCall ? 'yes' : 'no'}</td><td className="num">{t.latencyMs} ms</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="small" onClick={() => v.latency.exportJson()}>Export latency JSON</button>
        </details>
      )}
    </section>
  )
}
