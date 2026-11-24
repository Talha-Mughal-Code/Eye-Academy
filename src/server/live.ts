import { createServerFn } from '@tanstack/react-start'
import { verifyIdToken } from '../lib/firebase/admin'
import { mintLiveToken } from '../lib/viva/mintToken'
import { pickFollowUp } from '../lib/viva/followup'

/** Verifies the Firebase ID token, then returns an ephemeral Gemini Live token. */
export const getLiveToken = createServerFn({ method: 'POST' })
  .validator((d: { idToken: string }) => {
    if (!d || typeof d.idToken !== 'string') throw new Error('idToken required')
    return d
  })
  .handler(async ({ data }) => {
    await verifyIdToken(data.idToken)
    return mintLiveToken()
  })

/** Server-side follow-up selection from examiner_notes (kept off the prompt). */
export const chooseFollowUp = createServerFn({ method: 'POST' })
  .validator((d: { idToken: string; answer: string }) => {
    if (!d || typeof d.idToken !== 'string' || typeof d.answer !== 'string') throw new Error('bad input')
    return d
  })
  .handler(async ({ data }) => {
    await verifyIdToken(data.idToken)
    return pickFollowUp(data.answer)
  })
