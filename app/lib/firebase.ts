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
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  type Firestore
} from "firebase/firestore";

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
const db = getFirestore(app);

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

// Function to save client sign-in data to Firestore
export async function saveClientSignInData(email: string): Promise<void> {
  try {
    // Check if user already exists in clients collection
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // User exists, update their lastSignInAt
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "clients", userDoc.id), {
        lastSignInAt: serverTimestamp()
      });
      console.log("Updated existing client sign-in data for:", email);
    } else {
      // User doesn't exist, create new document with default settings
      // Calculate sendOnEmailDate based on default report frequency (weekly = 7 days)
      const currentDate = new Date();
      const defaultReportFrequency = "weekly"; // Default to weekly
      const defaultEmailNotificationsEnabled = true; // Default to enabled
      
      // Calculate days to add based on frequency
      const getDaysToAdd = (frequency: string) => {
        return frequency === "monthly" ? 30 : 7;
      };
      
      const daysToAdd = getDaysToAdd(defaultReportFrequency);
      const sendOnEmailDate = defaultEmailNotificationsEnabled 
        ? new Date(currentDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000))
        : null;
      
      const clientData = {
        email: email,
        lastSignInAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        // Default email notification settings
        emailNotificationsEnabled: defaultEmailNotificationsEnabled,
        reportFrequency: defaultReportFrequency,
        reportEmailAddress: email, // Use the user's sign-in email as default
        companyName: "",
        lastSettingsUpdate: serverTimestamp(),
        sendOnEmailDate: sendOnEmailDate
      };

      const docRef = await addDoc(collection(db, "clients"), clientData);
      console.log("Created new client document with default settings, ID:", docRef.id);
    }
  } catch (error) {
    console.error("Error saving client sign-in data:", error);
    throw error;
  }
}

export { 
  auth, 
  signInWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  db
}; 