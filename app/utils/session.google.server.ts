import { createCookieSessionStorage } from "@remix-run/node";
import { google } from 'googleapis';
import { getGoogleRefreshToken } from "~/lib/firebase";

// Define the Google credentials type
export interface GoogleCredentials {
  access_token: string;
  refresh_token?: string;
  scope: string;
  authuser: string;
  expires_in: number;
  token_type: string;
  expires_at?: number; // Unix timestamp when token expires
}

// Create a separate session storage for Google credentials
const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "google_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
  },
});

// Helper functions to manage Google credentials in session
export async function getGoogleCredentials(request: Request): Promise<GoogleCredentials | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const credentials = session.get("googleCredentials");
  return credentials || null;
}

export async function setGoogleCredentials(
  request: Request,
  credentials: GoogleCredentials
): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.set("googleCredentials", credentials);
  return commitSession(session);
}

export async function clearGoogleCredentials(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  session.unset("googleCredentials");
  return commitSession(session);
}

// Function to refresh access token using refresh token
export async function refreshGoogleAccessToken(
  request: Request
): Promise<{ success: boolean; newCredentials?: GoogleCredentials; error?: string }> {
  try {
    const currentCredentials = await getGoogleCredentials(request);
    
    // Try to get refresh token from session first, then from Firestore
    let refreshToken = currentCredentials?.refresh_token;
    
    if (!refreshToken && currentCredentials?.authuser) {
      // If no refresh token in session, try to get it from Firestore
      console.log("No refresh token in session, trying to get from Firestore...");
      const firestoreRefreshToken = await getGoogleRefreshToken(currentCredentials.authuser);
      if (firestoreRefreshToken) {
        refreshToken = firestoreRefreshToken;
      }
    }
    
    if (!refreshToken) {
      return { success: false, error: "No refresh token available" };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000";

    if (!clientId || !clientSecret) {
      return { success: false, error: "Missing Google OAuth2 credentials" };
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Set current credentials
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: currentCredentials?.access_token
    });

    // Refresh the access token
    const tokenResponse = await oauth2Client.refreshAccessToken();
    const newTokens = tokenResponse.credentials;

    if (!newTokens.access_token) {
      return { success: false, error: "Failed to refresh access token" };
    }

    // Calculate new expiration
    const expiresAt = newTokens.expiry_date 
      ? Math.floor(newTokens.expiry_date / 1000) 
      : undefined;

    // Create new credentials object
    const newCredentials: GoogleCredentials = {
      access_token: newTokens.access_token,
      refresh_token: refreshToken, // Keep the same refresh token
      scope: newTokens.scope || currentCredentials?.scope || '',
      authuser: currentCredentials?.authuser || '',
      expires_in: newTokens.expiry_date ? Math.floor((newTokens.expiry_date - Date.now()) / 1000) : 0,
      token_type: newTokens.token_type || 'Bearer',
      expires_at: expiresAt
    };

    // Update session with new credentials
    await setGoogleCredentials(request, newCredentials);

    return { success: true, newCredentials };
  } catch (error: any) {
    console.error("Error refreshing Google access token:", error);
    return { 
      success: false, 
      error: error.message || "Failed to refresh access token" 
    };
  }
}

export { getSession, commitSession, destroySession }; 