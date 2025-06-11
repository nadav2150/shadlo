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
    
    // Check current user after persistence is set
    const currentUser = auth.currentUser;

    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {

    });
  } catch (error) {

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
    }
  } catch (error) {
    throw error;
  }
}

// Function to save Google refresh token to client's Firestore document
export async function saveGoogleRefreshToken(email: string, refreshToken: string): Promise<void> {
  try {
    // Check if user exists in clients collection
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // User exists, update their Google refresh token
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "clients", userDoc.id), {
        googleRefreshToken: refreshToken,
        googleTokenUpdatedAt: serverTimestamp()
      });
    } else {
      // User doesn't exist, create new document with Google token
      const clientData = {
        email: email,
        googleRefreshToken: refreshToken,
        googleTokenUpdatedAt: serverTimestamp(),
        lastSignInAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        // Default email notification settings
        emailNotificationsEnabled: true,
        reportFrequency: "weekly",
        reportEmailAddress: email,
        companyName: "",
        lastSettingsUpdate: serverTimestamp(),
        sendOnEmailDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 days from now
      };

      const docRef = await addDoc(collection(db, "clients"), clientData);
    }
  } catch (error) {
    throw error;
  }
}

// Function to get Google refresh token from client's Firestore document
export async function getGoogleRefreshToken(email: string): Promise<string | null> {
  try {
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0].data();
      return userDoc.googleRefreshToken || null;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting Google refresh token from Firestore:", error);
    return null;
  }
}

// Function to check if user has Google refresh token and mark provider as connected
export async function checkAndMarkGoogleProviderConnected(email: string): Promise<{ hasRefreshToken: boolean; isConnected: boolean }> {
  try {
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Check if user has a Google refresh token
      const hasRefreshToken = !!userData.googleRefreshToken;
      
      // If they have a refresh token but no connection status, mark as connected
      if (hasRefreshToken && !userData.googleProviderConnected) {
        await updateDoc(doc(db, "clients", userDoc.id), {
          googleProviderConnected: true,
          googleProviderConnectedAt: serverTimestamp()
        });
        return { hasRefreshToken: true, isConnected: true };
      }
      
      return { 
        hasRefreshToken, 
        isConnected: userData.googleProviderConnected || false 
      };
    }
    
    return { hasRefreshToken: false, isConnected: false };
  } catch (error) {
    console.error("Error checking Google provider connection status:", error);
    return { hasRefreshToken: false, isConnected: false };
  }
}

// Function to remove Google refresh token from client's Firestore document
export async function removeGoogleRefreshToken(email: string): Promise<void> {
  try {
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // User exists, remove their Google refresh token and connection status
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "clients", userDoc.id), {
        googleRefreshToken: null,
        googleProviderConnected: false,
        googleTokenUpdatedAt: null
      });
    }
  } catch (error) {
    console.error("Error removing Google refresh token from Firestore:", error);
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