// Runs against the Firestore + Auth emulators: `npm run test:rules`.
// Signs in as two real emulator users and checks that user B cannot touch user A's attempt.
import { describe, it, expect, beforeAll } from 'vitest'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc,
  type Firestore,
} from 'firebase/firestore'

const projectId = 'demo-eye-academy'

async function denied(p: Promise<unknown>) {
  const err = await p.then(() => null, (e) => e)
  expect(err, 'expected the operation to be rejected').not.toBeNull()
  expect(err.code).toBe('permission-denied')
}

async function userClient(name: string): Promise<{ app: FirebaseApp; db: Firestore; uid: string }> {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  const cred = await createUserWithEmailAndPassword(auth, `${name}-${Date.now()}@test.dev`, 'password123')
  return { app, db, uid: cred.user.uid }
}

describe('firestore.rules: attempts', () => {
  let a: Awaited<ReturnType<typeof userClient>>
  let b: Awaited<ReturnType<typeof userClient>>
  let attemptId: string

  beforeAll(async () => {
    a = await userClient('alice')
    b = await userClient('bob')
    const ref = await addDoc(collection(a.db, 'attempts'), {
      ownerUid: a.uid, caseId: 'EA-VIVA-001', status: 'in_progress', transcript: [], revealedFindings: [],
    })
    attemptId = ref.id
  })

  it('owner can read their attempt', async () => {
    const snap = await getDoc(doc(a.db, 'attempts', attemptId))
    expect(snap.data()?.ownerUid).toBe(a.uid)
  })

  it('second user cannot read the first user\'s attempt', async () => {
    await denied(getDoc(doc(b.db, 'attempts', attemptId)))
  })

  it('second user cannot update or delete it', async () => {
    await denied(updateDoc(doc(b.db, 'attempts', attemptId), { status: 'done' }))
    await denied(deleteDoc(doc(b.db, 'attempts', attemptId)))
  })

  it('cannot create an attempt owned by someone else', async () => {
    await denied(setDoc(doc(b.db, 'attempts', 'forged'), { ownerUid: a.uid }))
  })

  it('owner cannot reassign ownership', async () => {
    await denied(updateDoc(doc(a.db, 'attempts', attemptId), { ownerUid: b.uid }))
  })

  it('cleanup', async () => {
    await deleteDoc(doc(a.db, 'attempts', attemptId))
    await deleteApp(a.app); await deleteApp(b.app)
  })
})
