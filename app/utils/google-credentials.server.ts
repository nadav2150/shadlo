import { google } from 'googleapis';

import { getGoogleCredentials } from "~/utils/session.google.server";

export async function validateGoogleCredentials(request: Request): Promise<{ isValid: boolean; error?: string }> {
  try {
    const googleCredentials = await getGoogleCredentials(request);
    
    console.log("Debug - Google credentials validation:", {
      hasCredentials: !!googleCredentials,
      hasAccessToken: !!googleCredentials?.access_token,
      tokenLength: googleCredentials?.access_token?.length
    });
    
    if (!googleCredentials?.access_token) {
      return { isValid: false, error: "No Google credentials found" };
    }

    // Initialize the Admin SDK client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: googleCredentials.access_token });
    
    const admin = google.admin({ version: 'directory_v1', auth });
    
    // Try to make a simple API call to test credentials
    // We'll use a minimal request to check if the token is valid
    const testResponse = await admin.users.list({
      customer: 'my_customer',
      maxResults: 1, // Just get 1 user to test the connection
      orderBy: 'email'
    });

    console.log("Debug - Google API test successful:", {
      hasUsers: !!testResponse.data.users,
      userCount: testResponse.data.users?.length
    });

    return { isValid: true };
  } catch (error: any) {
    console.error("Google credentials validation failed:", error);
    
    // Check for specific error types
    if (error.response?.status === 401) {
      console.log("Google credentials validation: Invalid or expired access token");
      return { isValid: false, error: "Invalid or expired access token" };
    }
    
    if (error.response?.status === 403) {
      console.log("Google credentials validation: Insufficient permissions for Google Admin API");
      return { isValid: false, error: "Insufficient permissions for Google Admin API" };
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.log("Google credentials validation: Network error connecting to Google API");
      return { isValid: false, error: "Network error connecting to Google API" };
    }
    
    // Handle token expired errors
    if (error.message?.includes('invalid_grant') || error.message?.includes('expired')) {
      console.log("Google credentials validation: Token expired");
      return { isValid: false, error: "Access token has expired" };
    }
    
    console.log("Google credentials validation: Unknown error:", error.message);
    return { isValid: false, error: error.message || "Unknown error validating credentials" };
  }
} 