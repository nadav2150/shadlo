import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { 
  setGSuiteCredentials as setSessionCredentials, 
  clearGSuiteCredentials as clearSessionCredentials,
  getGSuiteCredentials as getSessionCredentials 
} from "./session.server";

async function verifyClientCredentials(clientId: string, clientSecret: string): Promise<boolean> {
  try {
    // Create OAuth2 client
    const oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob'
    });

    // Try to get the discovery document
    // This will fail if the client ID is invalid
    const discoveryUrl = 'https://accounts.google.com/.well-known/openid-configuration';
    const response = await fetch(discoveryUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Google OAuth discovery document');
    }

    // Try to get a token with invalid code
    // This will fail with invalid_client if credentials are invalid
    try {
      await oauth2Client.getToken('invalid_code');
    } catch (error: any) {
      // If we get an invalid_client error, the credentials are invalid
      if (error.message?.includes('invalid_client')) {
        throw new Error('Invalid credentials');
      }
      // For other errors (like invalid_grant), the credentials might be valid
      // but the code is invalid, which is expected
    }

    return true;
  } catch (error) {
    console.error('Error verifying client credentials:', error);
    return false;
  }
}

export async function validateGSuiteCredentials(clientId: string, clientSecret: string) {
  try {
    // First, verify the client ID and secret format
    if (!clientId.match(/^[0-9]+-[a-zA-Z0-9]+\.apps\.googleusercontent\.com$/)) {
      return {
        isValid: false,
        error: 'Invalid Client ID format. It should end with .apps.googleusercontent.com'
      };
    }

    if (!clientSecret.match(/^[a-zA-Z0-9_-]{24,}$/)) {
      return {
        isValid: false,
        error: 'Invalid Client Secret format'
      };
    }

    // Verify the credentials with Google
    const areCredentialsValid = await verifyClientCredentials(clientId, clientSecret);
    if (!areCredentialsValid) {
      return {
        isValid: false,
        error: 'Invalid credentials. This Client ID and Client Secret combination does not exist in Google\'s system.'
      };
    }

    // Create OAuth2 client for generating the auth URL
    const oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob'
    });

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.group.readonly'
      ],
      prompt: 'consent'
    });

    return {
      isValid: true,
      authUrl,
      message: 'Credentials are valid. Please complete the OAuth2 flow to connect your Google Workspace.'
    };

  } catch (error) {
    console.error('Error in validateGSuiteCredentials:', error);
    if (error instanceof Error && error.message === 'Invalid credentials') {
      return {
        isValid: false,
        error: 'Invalid credentials. This Client ID and Client Secret combination does not exist in Google\'s system.'
      };
    }
    return {
      isValid: false,
      error: 'Failed to validate credentials. Please check your Client ID and Client Secret.'
    };
  }
}

// Function to exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
  try {
    const oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob'
    });

    const { tokens } = await oauth2Client.getToken(code);
    
    // Verify the tokens by making a test API call
    oauth2Client.setCredentials(tokens);
    const admin = google.admin({ version: 'directory_v1', auth: oauth2Client });
    
    try {
      await admin.users.list({
        customer: 'my_customer',
        maxResults: 1
      });
      
      return {
        success: true,
        tokens,
        message: 'Successfully connected to Google Workspace'
      };
    } catch (error: any) {
      if (error.code === 401 || error.code === 403) {
        return {
          success: false,
          error: 'Access denied. Please make sure you have the necessary permissions in your Google Workspace.'
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return {
      success: false,
      error: 'Failed to complete authentication. Please try again.'
    };
  }
}

// Function to store G Suite credentials in session
export async function setGSuiteCredentials(request: Request, credentials: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  try {
    const cookieHeader = await setSessionCredentials(request, credentials);
    if (!cookieHeader) {
      throw new Error("Failed to save credentials to session");
    }
    return {
      success: true,
      message: 'G Suite credentials stored successfully',
      cookieHeader
    };
  } catch (error) {
    console.error("Error storing G Suite credentials:", error);
    return {
      success: false,
      message: 'Failed to store G Suite credentials',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Function to get G Suite credentials from session
export async function getGSuiteCredentials(request: Request) {
  return await getSessionCredentials(request);
}

// Function to clear G Suite credentials from session
export async function clearGSuiteCredentials(request: Request) {
  try {
    const cookieHeader = await clearSessionCredentials(request);
    return {
      success: true,
      message: 'G Suite credentials cleared successfully',
      cookieHeader
    };
  } catch (error) {
    console.error("Error clearing G Suite credentials:", error);
    return {
      success: false,
      message: 'Failed to clear G Suite credentials',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 