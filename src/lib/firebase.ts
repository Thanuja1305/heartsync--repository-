import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBw7vNIJ_tDogV4zTN9eR90OmGZR7hBwNE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'brilliant-observer-ctgzl.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'brilliant-observer-ctgzl',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'brilliant-observer-ctgzl.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '368808691828',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:368808691828:web:dae8faaba55482c789e921',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://brilliant-observer-ctgzl-default-rtdb.firebaseio.com'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  QUERY = 'query'
}

export const handleFirestoreError = (err: any, op: any, context: any) => {};
export const parseFirestoreError = (err: any) => '';
