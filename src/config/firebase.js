import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAeNAlQKQ6MxSiU29YElTUyyBEKncJ2rpw',
  authDomain: 'universitariorc.firebaseapp.com',
  projectId: 'universitariorc',
  storageBucket: 'universitariorc.firebasestorage.app',
  messagingSenderId: '643639767934',
  appId: '1:643639767934:web:80a72fc7767df8dd97b92f',
  measurementId: 'G-K1EXM3JNJZ',
};

const app = initializeApp(firebaseConfig);
export const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
