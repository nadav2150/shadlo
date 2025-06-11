import { google } from 'googleapis';

import { getGoogleCredentials, refreshGoogleAccessToken } from "~/utils/session.google.server";

export async function validateGoogleCredentials(request: Request): Promise<{ isValid: boolean; error?: string }> {
  try {
    const googleCredentials = await getGoogleCredentials(request);
    

    
    if (!googleCredentials?.access_token) {
      return { isValid: false, error: "No Google credentials found" };
    }

    // Check if token is expired
    const isExpired = googleCredentials.expires_at && googleCredentials.expires_at < Math.floor(Date.now() / 1000);
    
    if (isExpired && googleCredentials.refresh_token) {
      const refreshResult = await refreshGoogleAccessToken(request);
      
      if (!refreshResult.success) {
        return { isValid: false, error: refreshResult.error || "Failed to refresh access token" };
      }
      
      // Get the updated credentials after refresh
      const updatedCredentials = await getGoogleCredentials(request);
      if (!updatedCredentials?.access_token) {
        return { isValid: false, error: "Failed to get updated credentials after refresh" };
      }
    } else if (isExpired && !googleCredentials.refresh_token) {
      return { isValid: false, error: "Access token expired and no refresh token available" };
    }

    // Get the current credentials (might be updated after refresh)
    const currentCredentials = await getGoogleCredentials(request);
    if (!currentCredentials?.access_token) {
      return { isValid: false, error: "No valid access token available" };
    }

    // Initialize the Admin SDK client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: currentCredentials.access_token });
    
    const admin = google.admin({ version: 'directory_v1', auth });
    
    // Try to make a simple API call to test credentials
    // We'll use a minimal request to check if the token is valid
    const testResponse = await admin.users.list({
      customer: 'my_customer',
      maxResults: 1, // Just get 1 user to test the connection
      orderBy: 'email'
    });



    return { isValid: true };
  } catch (error: any) {
    console.error("Google credentials validation failed:", error);
    
    // Check for specific error types
    if (error.response?.status === 401) {
      return { isValid: false, error: "Invalid or expired access token" };
    }
    
    if (error.response?.status === 403) {
      return { isValid: false, error: "Insufficient permissions for Google Admin API" };
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return { isValid: false, error: "Network error connecting to Google API" };
    }
    
    // Handle token expired errors
    if (error.message?.includes('invalid_grant') || error.message?.includes('expired')) {
      return { isValid: false, error: "Access token has expired" };
    }
    
    return { isValid: false, error: error.message || "Unknown error validating credentials" };
  }
} 