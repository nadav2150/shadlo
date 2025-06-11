import { json, type ActionFunction } from "@remix-run/node";
import { google } from 'googleapis';
import { setGoogleCredentials, type GoogleCredentials } from "~/utils/session.google.server";
import { getCurrentUser, saveGoogleRefreshToken } from "~/lib/firebase";

interface GoogleUser {
  id: string;
  primaryEmail: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  isAdmin: boolean;
  isEnforcedIn2Sv: boolean;
  isEnrolledIn2Sv: boolean;
  isMailboxSetup: boolean;
  orgUnitPath: string;
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const code = formData.get("code")?.toString();

    if (!code) {
      return json({ error: "Authorization code is required" }, { status: 400 });
    }

    // Get OAuth2 client credentials from environment
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000";

    if (!clientId || !clientSecret) {
      console.error("Missing Google OAuth2 credentials in environment");
      return json({ error: "Server configuration error" }, { status: 500 });
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );


    
    // Manually construct the token request to avoid PKCE issues
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenData.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange failed:", errorData);
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
    }

    const tokens = await tokenResponse.json();
    
    if (!tokens.access_token) {
      throw new Error("Failed to obtain access token from Google");
    }



    // Set credentials for API calls using the Google OAuth2 client
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined
    });
    
    const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
    
    // Fetch users from Google Workspace
    const response = await admin.users.list({
      customer: 'my_customer',
      maxResults: 100,
      orderBy: 'email',
    });

    const users = response.data.users?.map((user: any) => ({
      id: user.id || '',
      primaryEmail: user.primaryEmail || '',
      name: {
        fullName: user.name?.fullName || '',
        givenName: user.name?.givenName || '',
        familyName: user.name?.familyName || '',
      },
      isAdmin: user.isAdmin || false,
      isEnforcedIn2Sv: user.isEnforcedIn2Sv || false,
      isEnrolledIn2Sv: user.isEnrolledIn2Sv || false,
      isMailboxSetup: user.isMailboxSetup || false,
      orgUnitPath: user.orgUnitPath || '',
    })) || [];

    // Calculate expiration timestamp
    const expiresAt = tokens.expires_in 
      ? Math.floor(Date.now() / 1000) + tokens.expires_in 
      : undefined;

    // Prepare credentials for session storage
    const credentials: GoogleCredentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || '',
      authuser: formData.get("authuser")?.toString() || '',
      expires_in: tokens.expires_in || 0,
      token_type: tokens.token_type || 'Bearer',
      expires_at: expiresAt
    };

    // Store credentials in session
    const cookieHeader = await setGoogleCredentials(request, credentials);



    // Save refresh token to Firestore
    const user = await getCurrentUser();
    let firestoreSaved = false;
    if (user?.email && tokens.refresh_token) {
      try {
        await saveGoogleRefreshToken(user.email, tokens.refresh_token);
        firestoreSaved = true;
      } catch (firestoreError) {
        // Don't fail the entire operation if Firestore save fails
      }
    } else {
      console.warn("Cannot save refresh token: user email or refresh token missing");
    }

    return json(
      { 
        success: true,
        users,
        userCount: users.length,
        hasRefreshToken: !!tokens.refresh_token,
        firestoreSaved,
        expiresIn: tokens.expires_in
      },
      {
        headers: {
          "Set-Cookie": cookieHeader
        }
      }
    );
  } catch (error: any) {
    console.error("Error processing Google authorization code:", error);
    
    if (error.response) {
      console.error("Google API Error Details:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    return json(
      { 
        error: "Failed to exchange authorization code for tokens",
        details: error.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}; 