import { redirect, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { auth, signOut } from "~/lib/firebase";

// Handle both GET and POST requests
export const loader: LoaderFunction = async () => {
  return handleSignOut();
};

export const action: ActionFunction = async () => {
  return handleSignOut();
};

async function handleSignOut() {
  try {
    // Get current user before signing out
    const currentUser = auth.currentUser;
    console.log("Signing out user:", currentUser?.email);

    // Sign out from Firebase
    await signOut(auth);
    console.log("Firebase sign out successful");

    // Create headers with cookies
    const headers = new Headers();
    
    // Clear all possible auth cookies
    const cookiesToClear = [
      "session",
      "firebase:authUser:",
      "__session",
      "auth",
      "token"
    ];

    cookiesToClear.forEach(cookie => {
      headers.append("Set-Cookie", `${cookie}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; Secure; SameSite=Lax`);
    });

    // Add cache control headers
    headers.append("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.append("Pragma", "no-cache");
    headers.append("Expires", "0");

    // Return redirect with headers
    return redirect("/sign-in", { 
      headers,
      status: 303 // Use 303 See Other for redirect after POST
    });
  } catch (error) {
    console.error("Error during sign out:", error);
    // Even if there's an error, try to redirect to sign-in
    return redirect("/sign-in", { status: 303 });
  }
} 