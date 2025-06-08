import { json, type ActionFunction } from "@remix-run/node";
import { google } from 'googleapis';
import { setGoogleCredentials, type GoogleCredentials } from "~/utils/session.google.server";

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
    const accessToken = formData.get("access_token")?.toString();

    if (!accessToken) {
      return json({ error: "Access token is required" }, { status: 400 });
    }

    // Initialize the Admin SDK client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    const admin = google.admin({ version: 'directory_v1', auth });
    
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

    // Prepare credentials for session storage
    const credentials: GoogleCredentials = {
      access_token: accessToken,
      scope: formData.get("scope")?.toString() || '',
      authuser: formData.get("authuser")?.toString() || '',
      expires_in: Number(formData.get("expires_in")) || 0,
      token_type: formData.get("token_type")?.toString() || '',
      users: users
    };

    // Store credentials in session
    const cookieHeader = await setGoogleCredentials(request, credentials);

    // Log success (without sensitive data)
    console.log(`Successfully fetched ${users.length} users from Google Workspace`);

    return json(
      { 
        success: true,
        users,
        userCount: users.length
      },
      {
        headers: {
          "Set-Cookie": cookieHeader
        }
      }
    );
  } catch (error: any) {
    console.error("Error processing Google credentials:", error);
    
    if (error.response) {
      console.error("Google API Error Details:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    return json(
      { 
        error: "Failed to fetch users from Google Workspace",
        details: error.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}; 