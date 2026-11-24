import { describe, it, expect } from 'vitest'
import { lookupFinding, getHistory, formatFinding, CASE, type CaseFile } from '../src/lib/case/findings'

// Expected values are read from case.json so the tests track the data file,
// with a couple of literal checks against the shipped case (spec examples).
const row = (id: string) => CASE.findings.find((f) => f.id === id)!

describe('lookupFinding', () => {
  it('available finding with eye: right IOP', () => {
    const r = lookupFinding({ finding: 'intraocular pressure', eye: 'right' })
    expect(r).toMatchObject({ status: 'available', id: 'iop_right', eye: 'right', value: row('iop_right').value, unit: 'mmHg' })
    if (r.status !== 'available') throw new Error()
    expect(r.display).toBe(formatFinding(row('iop_right')))
    // Spec example against the shipped case.json
    expect(r.display).toBe('Right intraocular pressure: 58 mmHg (Goldmann applanation, 23:55)')
  })

  it('same finding without eye returns both eyes (right first)', () => {
    const r = lookupFinding({ finding: 'pressure' })
    expect(r.status).toBe('both_eyes')
    if (r.status !== 'both_eyes') throw new Error()
    expect(r.results.map((x) => x.id)).toEqual(['iop_right', 'iop_left'])
    expect(r.display).toContain('Right intraocular pressure: 58 mmHg')
    expect(r.display).toContain('Left intraocular pressure: 18 mmHg')
  })

  it('eye inside the finding text and synonyms work ("IOP", "right gonioscopy")', () => {
    expect(lookupFinding({ finding: 'IOP', eye: 'left' })).toMatchObject({ id: 'iop_left' })
    expect(lookupFinding({ finding: 'right gonioscopy' })).toMatchObject({ id: 'gonio_right' })
  })

  it('unavailable finding: right gonioscopy, no value', () => {
    const r = lookupFinding({ finding: 'gonioscopy', eye: 'right' })
    expect(r).toEqual({
      status: 'unavailable',
      id: 'gonio_right',
      label: 'Gonioscopy',
      eye: 'right',
      reason: 'No view: corneal oedema',
      display: 'Right gonioscopy: not available (No view: corneal oedema)',
    })
    expect(r).not.toHaveProperty('value')
  })

  it('RAPD is unavailable and never leaks its value field', () => {
    const r = lookupFinding({ finding: 'RAPD' })
    expect(r.status).toBe('unavailable')
    if (r.status !== 'unavailable') throw new Error()
    expect(r.reason).toBe(row('rapd').unavailable_reason)
    expect(JSON.stringify(r)).not.toContain(String(row('rapd').value))
  })

  it('not_in_case for colour vision and B-scan', () => {
    expect(lookupFinding({ finding: 'colour vision', eye: 'right' }).status).toBe('not_in_case')
    expect(lookupFinding({ finding: 'B-scan ultrasound' }).status).toBe('not_in_case')
  })

  it('null unit never prints "null"', () => {
    const r = lookupFinding({ finding: 'cornea', eye: 'right' })
    expect(r).toMatchObject({ status: 'available', unit: null })
    if (r.status !== 'available') throw new Error()
    expect(r.display).toBe('Right cornea: Hazy with microcystic epithelial oedema (Slit lamp)')
    for (const f of CASE.findings) expect(formatFinding(f)).not.toMatch(/null|undefined/)
  })

  it('unit is not duplicated when the descriptive value already contains it', () => {
    const r = lookupFinding({ finding: 'pupil', eye: 'right' })
    if (r.status !== 'available') throw new Error()
    expect(r.display).toBe('Right pupil: Mid-dilated, 5 mm, unreactive to light (Pen torch)')
    expect(lookupFinding({ finding: 'visual acuity', eye: 'right' })).toMatchObject({
      display: 'Right visual acuity: 6/36 Snellen (Unaided, distance)',
    })
  })

  it('systemic finding (eye null) ignores eye', () => {
    expect(lookupFinding({ finding: 'blood pressure' })).toMatchObject({ status: 'available', id: 'bp', display: 'Blood pressure: 168/94 mmHg (Automated cuff)' })
  })

  it('editing the data changes behaviour (value change and flip to unavailable)', () => {
    const edited: CaseFile = structuredClone(CASE)
    const iop = edited.findings.find((f) => f.id === 'iop_right')!
    iop.value = 44
    expect(lookupFinding({ finding: 'iop', eye: 'right' }, edited)).toMatchObject({ value: 44, display: 'Right intraocular pressure: 44 mmHg (Goldmann applanation, 23:55)' })
    iop.available = false
    iop.unavailable_reason = 'Tonometer broken'
    const r = lookupFinding({ finding: 'iop', eye: 'right' }, edited)
    expect(r).toMatchObject({ status: 'unavailable', reason: 'Tonometer broken' })
    expect(r).not.toHaveProperty('value')
  })
})

describe('getHistory', () => {
  it('returns each history topic from case.json', () => {
    expect(getHistory({ topic: 'allergies' })).toMatchObject({ status: 'available', text: 'Sulfonamide antibiotics (rash)' })
    expect(getHistory({ topic: 'family history' })).toMatchObject({ text: 'Mother had glaucoma.' })
    expect(getHistory({ topic: 'past_medical_history' })).toMatchObject({ text: 'Hypertension.' })
    expect(getHistory({ topic: 'past ocular history' })).toMatchObject({ topic: 'past_ocular_history' })
    expect(getHistory({ topic: 'presenting complaint' })).toMatchObject({ topic: 'presenting_complaint' })
    const meds = getHistory({ topic: 'drug history' })
    expect(meds).toMatchObject({ topic: 'medications' })
    if (meds.status !== 'available') throw new Error()
    for (const m of CASE.patient.medications as string[]) expect(meds.text).toContain(m)
  })

  it('unknown topic returns not_in_case', () => {
    expect(getHistory({ topic: 'social history' }).status).toBe('not_in_case')
    expect(getHistory({ topic: '' }).status).toBe('not_in_case')
  })
})
