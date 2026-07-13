import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock-api-key-for-local-demo-readiness',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'heartsync-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'heartsync-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'heartsync-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://heartsync-demo-default-rtdb.firebaseio.com'
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
  QUERY = 'query',
  GET = 'get'
}

export const handleFirestoreError = (err: any, op: any, context: any) => {};
export const parseFirestoreError = (err: any) => '';
