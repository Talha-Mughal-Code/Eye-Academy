import { describe, it, expect } from 'vitest'
import { pickFollowUp } from '../src/lib/viva/followup'
import { vivaReducer, initialVivaState, isSpokenReady, toolsAllowed } from '../src/lib/viva/phase'
import { buildSystemInstruction } from '../src/lib/viva/liveConfig'
import { CASE } from '../src/lib/case/findings'

describe('pickFollowUp', () => {
  it('asks about allergy when acetazolamide is proposed without it', () => {
    const f = pickFollowUp('Acute angle closure. Timolol, apraclonidine, IV acetazolamide, then laser to both eyes.')
    expect(f.rule).toBe('allergy')
    expect(f.question).toMatch(/acetazolamide/i)
  })
  it('asks about allergy/systemic treatment when neither is mentioned', () => {
    expect(pickFollowUp('Angle closure, laser iridotomy both eyes.').rule).toBe('allergy')
  })
  it('asks about pilocarpine when strong/early pilocarpine is proposed', () => {
    const f = pickFollowUp("Check her sulfonamide allergy. I'd give strong pilocarpine immediately and laser both eyes.")
    expect(f.rule).toBe('pilocarpine')
    expect(CASE.examiner_notes.follow_up_ideas).toContain(f.question)
  })
  it('asks about the fellow eye when not mentioned', () => {
    const f = pickFollowUp('Sulfonamide allergy so avoid acetazolamide. Topical drops and laser iridotomy.')
    expect(f.rule).toBe('fellow_eye')
    expect(f.question).toBe('Why treat the left eye as well?')
  })
  it('falls back to a remaining follow-up idea', () => {
    const f = pickFollowUp('Note sulfonamide allergy, topical drops, stop chlorphenamine, laser both eyes.')
    expect(f.rule).toBe('idea')
    expect(f.question).toBe("What would you do if the pressure doesn't come down?")
  })
})

describe('vivaReducer', () => {
  it('walks findings -> answer -> followup -> done and allows only one follow-up', () => {
    let s = vivaReducer(initialVivaState, { type: 'TRAINEE_TURN_DONE', text: 'right IOP?' })
    expect(s.phase).toBe('findings')
    s = vivaReducer(s, { type: 'READY' })
    expect(s.phase).toBe('answer')
    expect(vivaReducer(s, { type: 'FOLLOWUP_CHOSEN', question: 'q' }).phase).toBe('answer') // no answer yet
    s = vivaReducer(s, { type: 'TRAINEE_TURN_DONE', text: 'Angle closure.' })
    s = vivaReducer(s, { type: 'FOLLOWUP_CHOSEN', question: 'Why treat the left eye?' })
    expect(s).toMatchObject({ phase: 'followup', followUpQuestion: 'Why treat the left eye?' })
    expect(vivaReducer(s, { type: 'TRAINEE_TURN_DONE', text: 'early' }).phase).toBe('followup') // not asked yet
    s = vivaReducer(s, { type: 'EXAMINER_TURN_DONE' })
    s = vivaReducer(s, { type: 'TRAINEE_TURN_DONE', text: 'Because the angle is narrow.' })
    expect(s.phase).toBe('done')
    expect(vivaReducer(s, { type: 'READY' })).toBe(s)
    expect(toolsAllowed(s.phase)).toBe(false)
  })
  it('detects the spoken ready phrase', () => {
    expect(isSpokenReady("I'm ready to give my diagnosis and management")).toBe(true)
    expect(isSpokenReady('What is the right pressure?')).toBe(false)
  })
})

describe('system instruction', () => {
  it('contains no finding values and no diagnosis', () => {
    const p = buildSystemInstruction()
    for (const f of CASE.findings) if (f.value != null && String(f.value).length > 2) expect(p).not.toContain(String(f.value))
    expect(p).not.toContain(CASE.examiner_notes.diagnosis)
    expect(p).toContain(CASE.opening_prompt)
  })
})
