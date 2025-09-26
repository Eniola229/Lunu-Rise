import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {

  apiKey: "AIzaSyBQXqNUEXuBXble3PEnvQp1Baz22sd2_IU",

  authDomain: "naira-drop-pay.firebaseapp.com",

  projectId: "naira-drop-pay",

  storageBucket: "naira-drop-pay.firebasestorage.app",

  messagingSenderId: "552202822345",

  appId: "1:552202822345:web:c2385bcf2aa973ccd8e318",

  measurementId: "G-9B0Y6PV7Z7"

};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// OAuth Providers
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
