import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
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

// Set persistence to LOCAL
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Helper function to get current user
export function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Current auth state:", user ? "User logged in" : "No user");
      unsubscribe();
      resolve(user);
    });
  });
}

// Helper function to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

export { auth, signInWithEmailAndPassword, signOut }; 