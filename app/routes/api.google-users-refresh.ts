import { json, type LoaderFunction } from "@remix-run/node";
import { google } from 'googleapis';
import { getGoogleRefreshToken } from "~/lib/firebase";
import { calculateRiskScore } from "~/lib/iam/google-risk-assessment";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get email from URL parameters
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return json({ 
        error: "Email parameter is required. Use ?email=user@example.com" 
      }, { status: 400 });
    }

    // Get the refresh token from the client's Firestore document
    const refreshToken = await getGoogleRefreshToken(email);
    
    if (!refreshToken) {
      return json({ 
        error: `No Google refresh token found for ${email}. Please authenticate with Google first.` 
      }, { status: 401 });
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

    // Set the refresh token to get a new access token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Refresh the access token
    const tokenResponse = await oauth2Client.refreshAccessToken();
    const newTokens = tokenResponse.credentials;

    if (!newTokens.access_token) {
      return json({ 
        error: "Failed to refresh access token. The refresh token may be invalid or expired." 
      }, { status: 401 });
    }

    // Set the new access token for API calls
    oauth2Client.setCredentials({
      access_token: newTokens.access_token,
      refresh_token: refreshToken
    });

    // Initialize the Admin SDK client
    const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
    
    // Fetch users from Google Workspace
    const response = await admin.users.list({
      customer: 'my_customer',
      maxResults: 100,
      orderBy: 'email',
      projection: 'full',
      viewType: 'admin_view'
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
      isDelegatedAdmin: user.isDelegatedAdmin || false,
      isEnforcedIn2Sv: user.isEnforcedIn2Sv || false,
      isEnrolledIn2Sv: user.isEnrolledIn2Sv || false,
      isMailboxSetup: user.isMailboxSetup || false,
      orgUnitPath: user.orgUnitPath || '',
      lastLoginTime: user.lastLoginTime || null,
      suspended: user.suspended || false,
      changePasswordAtNextLogin: user.changePasswordAtNextLogin || false,
      connectedToAWS: false,
      sensitiveGroups: user.orgUnitPath?.split('/').filter(Boolean) || [],
      riskAssessment: calculateRiskScore({
        lastLoginTime: user.lastLoginTime || null,
        suspended: user.suspended || false,
        isAdmin: user.isAdmin || false,
        isDelegatedAdmin: user.isDelegatedAdmin || false,
        changePasswordAtNextLogin: user.changePasswordAtNextLogin || false,
        isMailboxSetup: user.isMailboxSetup || false,
        isEnrolledIn2Sv: user.isEnrolledIn2Sv || false,
        connectedToAWS: false,
        sensitiveGroups: user.orgUnitPath?.split('/').filter(Boolean) || []
      })
    })) || [];

    return json({ 
      success: true,
      users,
      userCount: users.length,
      message: `Successfully fetched users using refresh token for ${email}`,
      tokenInfo: {
        accessTokenExpiresIn: newTokens.expiry_date ? Math.floor((newTokens.expiry_date - Date.now()) / 1000) : null,
        tokenType: newTokens.token_type || 'Bearer'
      }
    });
  } catch (error: any) {
    console.error("Error fetching Google users with refresh token:", error);
    
    if (error.response) {
      console.error("Google API Error Details:", {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }

    // Handle specific error cases
    if (error.message?.includes('invalid_grant') || error.message?.includes('expired')) {
      return json(
        { 
          error: "Refresh token is invalid or expired. Please re-authenticate with Google.",
          details: error.message
        },
        { status: 401 }
      );
    }

    if (error.response?.status === 403) {
      return json(
        { 
          error: "Insufficient permissions to access Google Admin API",
          details: error.message
        },
        { status: 403 }
      );
    }

    return json(
      { 
        error: "Failed to fetch users from Google Workspace using refresh token",
        details: error.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}; 