import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if API key is present
let app = null;
let analytics = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined') {
  app = initializeApp(firebaseConfig);
  
  // Initialize Analytics only in browser environment
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    try {
      analytics = getAnalytics(app);
    } catch (err) {
      console.warn("Firebase Analytics failed to initialize:", err);
    }
  }
} else {
  console.warn("Firebase API key is missing. Firebase features will be disabled.");
}

export { app, analytics };
