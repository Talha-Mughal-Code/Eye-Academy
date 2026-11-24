import type { Card } from '../lib/viva/useLiveViva'
import type { Phase } from '../lib/viva/phase'

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'findings', label: 'Findings' },
  { phase: 'answer', label: 'Your answer' },
  { phase: 'followup', label: 'Follow-up' },
  { phase: 'done', label: 'Done' },
]

const EYE_CHIP: Record<string, { text: string; cls: string }> = {
  right: { text: 'Right eye', cls: 'right' },
  left: { text: 'Left eye', cls: 'left' },
  both: { text: 'Both eyes', cls: '' },
}

export function Stepper({ phase }: { phase: Phase }) {
  const idx = STEPS.findIndex((s) => s.phase === phase)
  return (
    <ol className="stepper" aria-label="Viva progress">
      {STEPS.map((s, i) => (
        <li key={s.phase} className={i < idx || phase === 'done' ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}

export function EyeChip({ eye }: { eye: string | null }) {
  const c = eye ? EYE_CHIP[eye] : undefined
  return <span className={`chip ${c?.cls ?? ''}`}>{c?.text ?? 'General'}</span>
}

export function FindingCard({ c }: { c: Card }) {
  if (c.kind === 'available')
    return (
      <li className="finding">
        <div className="top">
          <EyeChip eye={c.eye} />
          <span className="label">{c.label}</span>
        </div>
        <div className="value">{c.value}</div>
        {c.method && <div className="meta">{c.method}</div>}
      </li>
    )
  if (c.kind === 'unavailable')
    return (
      <li className="finding unavailable">
        <div className="top">
          <EyeChip eye={c.eye} />
          <span className="label">{c.label}</span>
          <span className="chip na">Not available</span>
        </div>
        <div className="value">Not available: {c.reason}</div>
      </li>
    )
  if (c.kind === 'history')
    return (
      <li className="finding history">
        <div className="top">
          <span className="chip history">History</span>
          <span className="label">{c.label}</span>
        </div>
        <div className="value">{c.text}</div>
      </li>
    )
  return (
    <li className="finding nic">
      <div className="top">
        <span className="chip">Not in case</span>
        <span className="label">{c.label}</span>
      </div>
      <div className="meta">This is not part of the case.</div>
    </li>
  )
}

export function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" />
    </svg>
  )
}

