/**
 * Firebase — Firestore only (web SDK). Rooms live in the `coup_rooms`
 * collection of the lawazempack4 project (shared with the Lawazem apps;
 * this collection is isolated by security rules).
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDWfIrhOCq_urMb8gfr3n8a8iNYRZXJQCc',
  authDomain: 'lawazempack4.firebaseapp.com',
  projectId: 'lawazempack4',
  storageBucket: 'lawazempack4.firebasestorage.app',
  messagingSenderId: '454755079835',
  appId: '1:454755079835:web:5af26ded7c98cbddbe183e',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
