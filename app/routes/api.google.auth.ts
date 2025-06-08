import { json, type ActionFunction } from "@remix-run/node";
import { google } from 'googleapis';

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
      customer: 'my_customer', // This will fetch users from your organization
      maxResults: 100,
      orderBy: 'email',
    });

    const users: GoogleUser[] = response.data.users?.map((user: any) => ({
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

    // Log the credentials and user count (in a real app, you'd want to store these securely)
    console.log("Received Google credentials:", {
      access_token: accessToken?.slice(0, 10) + '...', // Only log a portion of the token
      scope: formData.get("scope"),
      authuser: formData.get("authuser"),
      expires_in: formData.get("expires_in"),
      token_type: formData.get("token_type"),
    });
    console.log(`Successfully fetched ${users.length} users from Google Workspace`);

    return json({ 
      success: true,
      users,
      userCount: users.length
    });
  } catch (error: any) {
    console.error("Error processing Google credentials:", error);
    
    // Log detailed error information
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