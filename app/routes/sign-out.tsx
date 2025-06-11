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

    // Sign out from Firebase
    await signOut(auth);
    
    // Clear AWS credentials
    const awsCookieHeader = await clearAwsCredentials(request);
    // Clear Google credentials
    const googleCookieHeader = await clearGoogleCredentials(request);
    
    // Clear GSuite credentials (legacy)
    const gsuiteCookieHeader = await clearGSuiteCredentials(request);

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