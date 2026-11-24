// Picks EXACTLY ONE follow-up question tied to what the trainee said or omitted.
// Keyword rules are names of treatments/concepts, not clinical values. Question
// wording comes from examiner_notes.follow_up_ideas where one matches.
import { CASE, normalise, type CaseFile } from '../case/findings'

export type FollowUp = { rule: 'allergy' | 'pilocarpine' | 'fellow_eye' | 'idea'; question: string; why: string }

const has = (text: string, words: string[]) => words.some((w) => ` ${text} `.includes(` ${normalise(w)} `))

const ACETAZOLAMIDE = ['acetazolamide', 'diamox', 'carbonic anhydrase', 'carbonic anhydrase inhibitor']
const ALLERGY = ['sulfonamide', 'sulphonamide', 'sulfa', 'sulpha', 'allergy', 'allergic', 'allergies']
const PILOCARPINE = ['pilocarpine', 'miotic', 'miotics']
const STRONG_OR_EARLY = ['strong', '4%', '4 percent', '2%', '2 percent', 'immediately', 'straight away', 'right away', 'first', 'first line', 'stat', 'intensive', 'high dose', 'every 5 minutes', 'start with']
const FELLOW_EYE = ['left eye', 'fellow eye', 'other eye', 'both eyes', 'bilateral', 'bilaterally', 'contralateral', 'prophylactic']

function idea(c: CaseFile, words: string[]): string | undefined {
  return c.examiner_notes.follow_up_ideas.find((q) => has(normalise(q), words))
}

export function pickFollowUp(answer: string, c: CaseFile = CASE): FollowUp {
  const t = normalise(answer.replace(/%/g, ' percent'))
  const mentionsAcz = has(t, ACETAZOLAMIDE)
  if (!has(t, ALLERGY)) {
    return mentionsAcz
      ? { rule: 'allergy', question: 'You mentioned acetazolamide. Is there anything in her history you would check before giving it?', why: 'Proposed acetazolamide without mentioning the allergy history.' }
      : { rule: 'allergy', question: 'You have not mentioned systemic treatment. What would you give, and is there anything in her history you would check first?', why: 'Did not mention acetazolamide or the allergy history.' }
  }
  if (has(t, PILOCARPINE) && has(t, STRONG_OR_EARLY.map((w) => w.replace('%', ' percent')))) {
    return { rule: 'pilocarpine', question: idea(c, ['pilocarpine']) ?? 'Why might pilocarpine not work when the pressure is very high?', why: 'Proposed strong or early pilocarpine.' }
  }
  if (!has(t, FELLOW_EYE)) {
    return { rule: 'fellow_eye', question: idea(c, ['left eye', 'fellow eye', 'other eye']) ?? 'Why treat the left eye as well?', why: 'Did not mention the fellow eye.' }
  }
  const used = new Set([idea(c, ['pilocarpine']), idea(c, ['left eye', 'fellow eye', 'other eye'])])
  const q = c.examiner_notes.follow_up_ideas.find((x) => !used.has(x)) ?? c.examiner_notes.follow_up_ideas[0]
  return { rule: 'idea', question: q, why: 'Covered allergy, pilocarpine timing and fellow eye; using a remaining follow-up idea.' }
}
