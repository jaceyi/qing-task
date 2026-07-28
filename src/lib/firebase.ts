import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCgvfqRrrpWn7wlwX2MXGmgs3jwpe-F2Kg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'task-914de.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'task-914de',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'task-914de.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '358872230312',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:358872230312:web:1fd8586081ed8b25e2d59d',
}

const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function prepareAuth() {
  await setPersistence(auth, browserLocalPersistence)
}

export async function signInWithGoogle() {
  const mobile = window.matchMedia('(max-width: 760px)').matches
  if (mobile) {
    await signInWithRedirect(auth, googleProvider)
    return
  }
  await signInWithPopup(auth, googleProvider)
}
