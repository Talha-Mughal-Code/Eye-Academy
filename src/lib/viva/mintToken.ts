// Server-only: mint a short-lived, single-use Gemini Live token with the
// examiner config locked in. The long-lived GEMINI_API_KEY never leaves the server.
import { GoogleGenAI } from '@google/genai'
import { buildLiveConfig } from './liveConfig'

// Docs (aistudio.google.com/docs/live-api/ephemeral-tokens) say v1beta; the SDK comment says v1alpha.
// Verified empirically by scripts/live-smoke.ts; see docs/HANDOVER.md.
export const LIVE_API_VERSION = process.env.GEMINI_LIVE_API_VERSION || 'v1beta'

export async function mintLiveToken() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set on the server')
  const model = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live'
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: LIVE_API_VERSION } })
  const now = Date.now()
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: { model, config: buildLiveConfig() as never },
      lockAdditionalFields: [],
    },
  })
  if (!token.name) throw new Error('Token creation returned no name')
  return { token: token.name, model, apiVersion: LIVE_API_VERSION }
}
