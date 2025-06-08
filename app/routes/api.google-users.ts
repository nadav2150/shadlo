import { json, type LoaderFunction } from "@remix-run/node";
import { google } from 'googleapis';
import { getGoogleCredentials } from "~/utils/session.google.server";
import { calculateRiskScore } from "~/lib/iam/google-risk-assessment";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const googleCredentials = await getGoogleCredentials(request);
    
    if (!googleCredentials?.access_token) {
      return json({ error: "No Google credentials found" }, { status: 401 });
    }

    // Initialize the Admin SDK client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleCredentials.access_token });
    
    const admin = google.admin({ version: 'directory_v1', auth });
    
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
      users,
      userCount: users.length
    });
  } catch (error: any) {
    console.error("Error fetching Google users:", error);
    
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