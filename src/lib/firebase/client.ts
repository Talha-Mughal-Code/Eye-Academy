// Browser Firebase SDK. Only public web config lives here.
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'

let _auth: Auth | undefined
let _db: Firestore | undefined

function init() {
  if (_auth && _db) return
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    })
  _auth = getAuth(app)
  _db = getFirestore(app)
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(_auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(_db, '127.0.0.1', 8080)
  }
}

export function auth(): Auth {
  init()
  return _auth!
}
export function db(): Firestore {
  init()
  return _db!
}
