import { initializeApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

let app = null;

export function getApp() {
  if (!app && isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export const configured = isFirebaseConfigured;
