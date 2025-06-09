import { redirect, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { auth, signOut } from "~/lib/firebase";
import { clearAwsCredentials, clearGSuiteCredentials } from "~/utils/session.server";
import { clearGoogleCredentials } from "~/utils/session.google.server";

// Handle both GET and POST requests
export const loader: LoaderFunction = async ({ request }) => {
  return handleSignOut(request);
};

export const action: ActionFunction = async ({ request }) => {
  return handleSignOut(request);
};

async function handleSignOut(request: Request) {
  try {
    // Get current user before signing out
    const currentUser = auth.currentUser;
    console.log("Signing out user:", currentUser?.email);

    // Sign out from Firebase
    await signOut(auth);
    console.log("Firebase sign out successful");

    // Clear all provider credentials
    console.log("Clearing all provider credentials...");
    
    // Clear AWS credentials
    const awsCookieHeader = await clearAwsCredentials(request);
    console.log("AWS credentials cleared");
    
    // Clear Google credentials
    const googleCookieHeader = await clearGoogleCredentials(request);
    console.log("Google credentials cleared");
    
    // Clear GSuite credentials (legacy)
    const gsuiteCookieHeader = await clearGSuiteCredentials(request);
    console.log("GSuite credentials cleared");

    // Create headers with cookies
    const headers = new Headers();
    
    // Add provider credential cookies
    if (awsCookieHeader) {
      headers.append("Set-Cookie", awsCookieHeader);
    }
    if (googleCookieHeader) {
      headers.append("Set-Cookie", googleCookieHeader);
    }
    if (gsuiteCookieHeader) {
      headers.append("Set-Cookie", gsuiteCookieHeader);
    }
    
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

    console.log("All credentials and sessions cleared successfully");

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