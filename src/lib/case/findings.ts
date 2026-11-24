// Pure findings/history lookup. The model only chooses WHAT to look up;
// every clinical value comes from data/case.json via these functions.
import caseData from '../../../data/case.json'

export type Eye = 'right' | 'left' | 'both' | null

export interface CaseFinding {
  id: string
  eye: Eye
  label: string
  value: string | number | null
  unit: string | null
  method: string | null
  available: boolean
  unavailable_reason?: string
}

export interface CaseFile {
  case_id: string
  opening_prompt: string
  patient: Record<string, unknown>
  findings: CaseFinding[]
  examiner_notes: { diagnosis: string; key_points: string[]; follow_up_ideas: string[] }
}

export type AvailableResult = {
  status: 'available'
  id: string
  eye: Eye
  label: string
  value: string | number
  unit: string | null
  method: string | null
  /** Value with unit, from the same formatter as display (e.g. "58 mmHg"). */
  valueText: string
  display: string
}
export type UnavailableResult = {
  status: 'unavailable'
  id: string
  label: string
  eye: Eye
  reason: string
  display: string
}
export type NotInCaseResult = { status: 'not_in_case'; query: string; display: string }
export type SingleResult = AvailableResult | UnavailableResult
/** Ambiguity rule: eye-specific finding asked without an eye -> both eyes' rows. */
export type BothEyesResult = { status: 'both_eyes'; label: string; results: SingleResult[]; display: string }
export type FindingResult = SingleResult | NotInCaseResult | BothEyesResult

export const CASE = caseData as unknown as CaseFile

// Words a trainee/model may use for a finding. These are NAMES only, never values.
// Keyed by finding label (lower-case) so editing values in case.json needs no change here.
const SYNONYMS: Record<string, string[]> = {
  'visual acuity': ['visual acuity', 'acuity', 'va', 'vision', 'snellen'],
  'intraocular pressure': ['intraocular pressure', 'iop', 'pressure', 'tonometry', 'applanation'],
  conjunctiva: ['conjunctiva', 'conjunctival', 'injection', 'redness', 'ciliary flush'],
  cornea: ['cornea', 'corneal'],
  'anterior chamber depth': ['anterior chamber', 'ac depth', 'ac', 'chamber depth', 'van herick'],
  pupil: ['pupil', 'pupils', 'pupillary'],
  'relative afferent pupillary defect': ['relative afferent pupillary defect', 'rapd', 'afferent', 'swinging light'],
  lens: ['lens', 'cataract'],
  gonioscopy: ['gonioscopy', 'gonio', 'angle'],
  'optic disc and fundus': ['optic disc', 'disc', 'fundus', 'fundoscopy', 'retina', 'cup to disc', 'cup-to-disc'],
  refraction: ['refraction', 'glasses', 'prescription', 'focimetry'],
  'axial length (biometry)': ['axial length', 'biometry'],
  oct: ['oct', 'optical coherence tomography'],
  'blood pressure': ['blood pressure', 'bp'],
  'urea and electrolytes': ['urea and electrolytes', 'u and e', 'u&e', 'u&es', 'electrolytes', 'renal function', 'bloods'],
}

const NOT_IN_CASE = '__not_in_case__'
const OTHER_EXAMS = ['colour vision', 'color vision', 'visual field', 'visual fields', 'b scan', 'ultrasound', 'ishihara', 'corneal thickness', 'pachymetry']

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' & ')
    .replace(/[^a-z0-9&/+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsTerm(haystack: string, term: string): boolean {
  const h = ` ${normalise(haystack)} `
  return h.includes(` ${normalise(term)} `)
}

/** Parse an eye from free text ("right", "RE", "OD", "left", "both"). */
export function parseEye(text: string | undefined | null): 'right' | 'left' | 'both' | undefined {
  if (!text) return undefined
  const t = ` ${normalise(text)} `
  const r = / (right|re|od) /.test(t)
  const l = / (left|le|os) /.test(t)
  if (/ (both|each|ou|bilateral) /.test(t) || (r && l)) return 'both'
  if (r) return 'right'
  if (l) return 'left'
  return undefined
}

/** Return the label (lower-case) the query refers to, choosing the longest matching term. */
export function resolveLabel(query: string, findings: CaseFinding[] = CASE.findings): string | undefined {
  const labels = new Set(findings.map((f) => f.label.toLowerCase()))
  let best: { label: string; len: number } | undefined
  const consider = (label: string, term: string) => {
    if (containsTerm(query, term) && (!best || term.length > best.len)) best = { label, len: term.length }
  }
  for (const f of findings) {
    consider(f.label.toLowerCase(), f.label)
    consider(f.label.toLowerCase(), f.id.replace(/_(right|left)$/, '').replace(/_/g, ' '))
    if (normalise(query) === normalise(f.id)) best = { label: f.label.toLowerCase(), len: 999 }
  }
  for (const [label, terms] of Object.entries(SYNONYMS)) {
    if (!labels.has(label)) continue
    for (const t of terms) consider(label, t)
  }
  // Exams that are NOT in this case but share words with ones that are ("colour vision" vs "vision").
  // A longer, more specific term wins; a real label of equal length (from case.json) still wins the tie.
  for (const t of OTHER_EXAMS) {
    if (containsTerm(query, t) && (!best || t.length > best.len)) best = { label: NOT_IN_CASE, len: t.length }
  }
  return best?.label === NOT_IN_CASE ? undefined : best?.label
}

const EYE_WORD: Record<string, string> = { right: 'Right', left: 'Left', both: 'Both eyes' }

function shouldAppendUnit(value: string | number, unit: string | null): unit is string {
  if (!unit) return false
  if (typeof value === 'number') return true
  // Descriptive text (contains letters) is shown exactly as written; it may already include the unit.
  return !/[a-z]/i.test(value)
}

/** Value plus unit where appropriate (part of the single formatter). */
export function formatValue(f: CaseFinding): string {
  const v = f.value ?? ''
  return shouldAppendUnit(v, f.unit) ? `${v} ${f.unit}` : String(v)
}

/** The ONE formatter: on-screen card text and spoken readback both use this string. */
export function formatFinding(f: CaseFinding): string {
  const prefix = f.eye && EYE_WORD[f.eye] ? `${EYE_WORD[f.eye]} ${f.label.charAt(0).toLowerCase()}${f.label.slice(1)}` : f.label
  if (!f.available) {
    return `${prefix}: not available (${f.unavailable_reason ?? 'no reason recorded'})`
  }
  const valueText = formatValue(f)
  return f.method ? `${prefix}: ${valueText} (${f.method})` : `${prefix}: ${valueText}`
}

export function toResult(f: CaseFinding): SingleResult {
  if (!f.available) {
    return {
      status: 'unavailable',
      id: f.id,
      label: f.label,
      eye: f.eye,
      reason: f.unavailable_reason ?? 'No reason recorded',
      display: formatFinding(f),
    }
  }
  return {
    status: 'available',
    id: f.id,
    eye: f.eye,
    label: f.label,
    value: f.value as string | number,
    unit: f.unit,
    method: f.method,
    valueText: formatValue(f),
    display: formatFinding(f),
  }
}

export function lookupFinding(
  args: { finding: string; eye?: string | null },
  data: CaseFile = CASE,
): FindingResult {
  const query = String(args?.finding ?? '')
  const label = resolveLabel(query, data.findings)
  if (!label) return { status: 'not_in_case', query, display: `${query || 'That'} is not in this case.` }
  const rows = data.findings.filter((f) => f.label.toLowerCase() === label)
  // Eye from the explicit arg first, else from the finding text ("right gonioscopy").
  const eye = parseEye(args?.eye ?? undefined) ?? parseEye(query)

  const eyeSpecific = rows.filter((f) => f.eye === 'right' || f.eye === 'left')
  if (eyeSpecific.length === 0) return toResult(rows[0]) // 'both' or null (systemic) rows

  if (eye === 'right' || eye === 'left') {
    const row = eyeSpecific.find((f) => f.eye === eye)
    if (row) return toResult(row)
    return { status: 'not_in_case', query: `${eye} ${query}`, display: `${EYE_WORD[eye]} ${query} is not in this case.` }
  }
  const ordered = [...eyeSpecific].sort((a, b) => (a.eye === 'right' ? -1 : b.eye === 'right' ? 1 : 0))
  const results = ordered.map(toResult)
  return { status: 'both_eyes', label: rows[0].label, results, display: results.map((r) => r.display).join('. ') }
}

// ---------- History ----------
export const HISTORY_TOPICS: Record<string, { label: string; terms: string[] }> = {
  presenting_complaint: { label: 'Presenting complaint', terms: ['presenting complaint', 'complaint', 'symptoms', 'history of presenting', 'hpc', 'pc', 'what happened'] },
  past_ocular_history: { label: 'Past ocular history', terms: ['past ocular history', 'ocular history', 'eye history', 'poh', 'previous eye', 'eye surgery'] },
  past_medical_history: { label: 'Past medical history', terms: ['past medical history', 'medical history', 'pmh', 'medical conditions', 'comorbidities'] },
  medications: { label: 'Medications', terms: ['medications', 'medication', 'drugs', 'drug history', 'meds', 'dh', 'tablets'] },
  allergies: { label: 'Allergies', terms: ['allergies', 'allergy', 'allergic'] },
  family_history: { label: 'Family history', terms: ['family history', 'family', 'fh'] },
}

export type HistoryResult =
  | { status: 'available'; topic: string; label: string; text: string; display: string }
  | NotInCaseResult

export function getHistory(args: { topic: string }, data: CaseFile = CASE): HistoryResult {
  const query = String(args?.topic ?? '')
  const n = normalise(query).replace(/ /g, '_')
  let key: string | undefined = HISTORY_TOPICS[n] ? n : undefined
  if (!key) {
    let bestLen = 0
    for (const [k, { terms }] of Object.entries(HISTORY_TOPICS)) {
      for (const t of terms) if (containsTerm(query, t) && t.length > bestLen) ((key = k), (bestLen = t.length))
    }
  }
  const raw = key ? data.patient[key] : undefined
  if (!key || raw == null || (Array.isArray(raw) && raw.length === 0)) {
    return { status: 'not_in_case', query, display: `${query || 'That'} is not in this case.` }
  }
  const text = Array.isArray(raw) ? raw.join('; ') : String(raw)
  const label = HISTORY_TOPICS[key].label
  return { status: 'available', topic: key, label, text, display: `${label}: ${text}` }
}
