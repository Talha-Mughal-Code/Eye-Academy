// Viva phase state machine, kept in code (the prompt alone is not trusted).
// findings -> answer -> followup -> done. Exactly one follow-up is allowed.

export type Phase = 'findings' | 'answer' | 'followup' | 'done'

export type VivaState = {
  phase: Phase
  answerText: string
  followUpQuestion: string | null
  followUpAsked: boolean // examiner has finished speaking the follow-up
}

export type VivaEvent =
  | { type: 'READY' } // button or spoken "ready to give my diagnosis"
  | { type: 'TRAINEE_TURN_DONE'; text: string } // one push-to-talk turn finalised
  | { type: 'FOLLOWUP_CHOSEN'; question: string }
  | { type: 'EXAMINER_TURN_DONE' }

export const initialVivaState: VivaState = { phase: 'findings', answerText: '', followUpQuestion: null, followUpAsked: false }

export function vivaReducer(s: VivaState, e: VivaEvent): VivaState {
  switch (s.phase) {
    case 'findings':
      return e.type === 'READY' ? { ...s, phase: 'answer' } : s
    case 'answer':
      if (e.type === 'TRAINEE_TURN_DONE' && e.text.trim()) return { ...s, answerText: (s.answerText + ' ' + e.text).trim() }
      if (e.type === 'FOLLOWUP_CHOSEN' && s.answerText) return { ...s, phase: 'followup', followUpQuestion: e.question }
      return s
    case 'followup':
      if (e.type === 'EXAMINER_TURN_DONE' && !s.followUpAsked) return { ...s, followUpAsked: true }
      // Trainee's reply to the single follow-up ends the viva.
      if (e.type === 'TRAINEE_TURN_DONE' && s.followUpAsked) return { ...s, phase: 'done' }
      return s
    case 'done':
      return s
  }
}

/** Tools are only executed during the findings phase. */
export const toolsAllowed = (p: Phase) => p === 'findings'

/** Spoken equivalent of the "ready" button. */
export const isSpokenReady = (text: string) =>
  /\bready to (give|present|tell you)\b.*\b(diagnosis|management)\b/i.test(text) || /\bi'?m ready\b.*\bdiagnos/i.test(text)
