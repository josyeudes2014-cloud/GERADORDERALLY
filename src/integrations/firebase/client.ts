import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBx2F_8g2N780kud762VlXrimIVowmSIik',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'rallyfjuniteroi.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rallyfjuniteroi',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'rallyfjuniteroi.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1032707908409',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1032707908409:web:d492b01cb7b51fa42d3ee8',
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const firebaseProjectId = firebaseConfig.projectId;
