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
  apiKey: "AIzaSyBwZTWDV7ZBOFhvj1Rp0LRrcqlazJtVG18",
  authDomain: "admin-test-462316.firebaseapp.com",
  projectId: "admin-test-462316",
  storageBucket: "admin-test-462316.firebasestorage.app",
  messagingSenderId: "758013016055",
  appId: "1:758013016055:web:bc6ce028b876334204e0f2",
  measurementId: "G-ZSCPQ1HWED"
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