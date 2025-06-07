import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  sendEmailVerification,
  type User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC9D6SPLK7RvJxq-DhtSRrlIibDxUGSilE",
  authDomain: "shadlo-e7fe1.firebaseapp.com",
  projectId: "shadlo-e7fe1",
  storageBucket: "shadlo-e7fe1.firebasestorage.app",
  messagingSenderId: "350534525285",
  appId: "1:350534525285:web:4305700f20aee16a96818c",
  measurementId: "G-7NNFYYX382"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize auth persistence
const initAuth = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log("Firebase auth persistence initialized successfully");
    
    // Check current user after persistence is set
    const currentUser = auth.currentUser;
    console.log("Current user after persistence init:", currentUser ? {
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      uid: currentUser.uid
    } : "No current user");

    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed after persistence init:", user ? {
        email: user.email,
        emailVerified: user.emailVerified,
        uid: user.uid
      } : "No user");
    });
  } catch (error) {
    console.error("Error initializing Firebase auth persistence:", error);
  }
};

// Initialize auth immediately
initAuth();

// Helper function to get current user
export async function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Helper function to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  console.log("isAuthenticated check:", user ? {
    email: user.email,
    emailVerified: user.emailVerified,
    uid: user.uid
  } : "No user");
  return !!user;
}

export { 
  auth, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification 
}; 