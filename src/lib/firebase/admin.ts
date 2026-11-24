// Server-only Firebase Admin. Imported only from server functions.
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function app() {
  if (getApps().length) return getApps()[0]
  const projectId = process.env.FIREBASE_PROJECT_ID
  // With FIREBASE_AUTH_EMULATOR_HOST set, no credentials are needed.
  return process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? initializeApp({ projectId })
    : initializeApp({ projectId, credential: applicationDefault() })
}

/** Verifies a Firebase ID token and returns the uid, or throws. */
export async function verifyIdToken(idToken: string): Promise<string> {
  if (!idToken) throw new Error('Missing ID token')
  const decoded = await getAuth(app()).verifyIdToken(idToken)
  return decoded.uid
}
