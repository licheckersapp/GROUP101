import admin from "firebase-admin";

const initializeFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    // In a real production environment, you would use a service account.
    // For now, we initialize with default credentials or environment variables.
    try {
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      });
      console.log("Firebase Admin initialized");
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return admin;
};

export const firebaseAdmin = initializeFirebaseAdmin();
