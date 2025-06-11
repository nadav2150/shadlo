import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { getGoogleCredentials } from "~/utils/session.google.server";
import { calculateRiskScore } from "~/lib/iam/google-risk-assessment";
import { validateGoogleCredentials } from "~/utils/google-credentials.server";

interface Policy {
  name: string;
  description?: string;
  createDate: string;
  updateDate: string;
  type: 'inline' | 'managed';
}

interface AccessKey {
  id: string;
  createDate: string;
  lastUsed?: string;
  status: 'Active' | 'Inactive';
}

interface IAMUser {
  userName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  hasMFA: boolean;
  accessKeys?: AccessKey[];
  provider: 'aws' | 'azure' | 'gcp';
  type: 'user';
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: {
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      details: string;
    }[];
  };
}

interface GoogleApiUser {
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
  lastLoginTime: string | null;
  suspended?: boolean;
  isDelegatedAdmin?: boolean;
  changePasswordAtNextLogin?: boolean;
}

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
  provider: 'google';
  type: 'user';
  createDate?: string;
  lastUsed?: string;
  policies: Policy[];
  hasMFA: boolean;
  suspended?: boolean;
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: {
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      details: string;
    }[];
  };
  accessKeys?: AccessKey[];
}

interface IAMRole {
  roleName: string;
  createDate: string;
  lastUsed?: string;
  policies: Policy[];
  provider: 'aws' | 'azure' | 'gcp';
  type: 'role';
  description?: string;
  trustPolicy?: string;
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    lastUsedScore: number;
    permissionScore: number;
    identityScore: number;
    factors: string[];
    shadowPermissions: {
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      details: string;
    }[];
  };
}

interface LoaderData {
  users: (IAMUser | GoogleUser)[];
  roles: IAMRole[];
  error: string | null;
  credentials?: {
    accessKeyId: string;
    region: string;
  } | null;
  googleCredentialsValid: boolean;
  hasGoogleRefreshToken?: boolean;
  refreshTokenValid?: boolean;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get the cookie header from the original request
    const cookieHeader = request.headers.get("Cookie");
    
    // Initialize empty data
    let awsData = { users: [], roles: [], credentials: null, error: null };
    let googleUsers: GoogleUser[] = [];
    let googleCredentialsValid = false;
    
    // Try to fetch AWS data
    try {
      const awsResponse = await fetch(`${baseUrl}/api/iam-entities`, {
        headers: {
          Cookie: cookieHeader || "",
        },
      });
      
      if (awsResponse.ok) {
        awsData = await awsResponse.json();
      } else {
      }
    } catch (error) {
      // Continue without AWS data
    }

    // Check if user has Google refresh token in database and validate it
    const { getCurrentUser, getGoogleRefreshToken } = await import("~/lib/firebase");
    const currentUser = await getCurrentUser();
    let hasGoogleRefreshToken = false;
    let refreshTokenValid = false;
    
    if (currentUser?.email) {
      const refreshToken = await getGoogleRefreshToken(currentUser.email);
      hasGoogleRefreshToken = !!refreshToken;
      
      // If we have a refresh token, test if it's still valid
      if (hasGoogleRefreshToken) {
        try {
          const { google } = await import('googleapis');
          const clientId = process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
          const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000";

          if (clientId && clientSecret) {
            const oauth2Client = new google.auth.OAuth2(
              clientId,
              clientSecret,
              redirectUri
            );

            oauth2Client.setCredentials({
              refresh_token: refreshToken
            });

            // Try to refresh the access token to validate the refresh token
            const tokenResponse = await oauth2Client.refreshAccessToken();
            refreshTokenValid = !!tokenResponse.credentials.access_token;
          }
        } catch (error) {
          // Refresh token is invalid or expired
          refreshTokenValid = false;
        }
      }
    }

    // Validate Google credentials before attempting to fetch data
    const googleValidation = await validateGoogleCredentials(request);
    googleCredentialsValid = googleValidation.isValid;
    

    // Try to fetch Google data using auto-fetch if user has valid refresh token, otherwise use session credentials
    if (refreshTokenValid || googleValidation.isValid) {
      try {
        const googleResponse = await fetch(
          refreshTokenValid 
            ? `${baseUrl}/api/google-users-auto`
            : `${baseUrl}/api/google-users`,
          {
            headers: {
              Cookie: cookieHeader || "",
            },
          }
        );
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();

          
          // Transform Google users to match the common interface
          googleUsers = googleData.users?.map((user: GoogleApiUser) => {
            const riskAssessment = calculateRiskScore({
              lastLoginTime: user.lastLoginTime || null,
              suspended: user.suspended || false,
              isAdmin: user.isAdmin || false,
              isDelegatedAdmin: user.isDelegatedAdmin || false,
              changePasswordAtNextLogin: user.changePasswordAtNextLogin || false,
              isMailboxSetup: user.isMailboxSetup || false,
              isEnrolledIn2Sv: user.isEnrolledIn2Sv || false
            });

            return {
              ...user,
              provider: 'google' as const,
              type: 'user' as const,
              createDate: new Date().toISOString(), // Google API doesn't provide creation date
              lastUsed: user.lastLoginTime || undefined,
              policies: [], // Google API doesn't provide policies in the same way
              hasMFA: user.isEnrolledIn2Sv,
              suspended: user.suspended || false,
              riskAssessment: {
                riskLevel: riskAssessment.level.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
                score: riskAssessment.score,
                lastUsedScore: user.lastLoginTime ? 0 : 3, // Add points for never logged in
                permissionScore: user.isAdmin ? 2 : 0, // Add points for admin access
                identityScore: user.isEnrolledIn2Sv ? 0 : 1, // Add points for no 2SV
                factors: riskAssessment.factors,
                shadowPermissions: [] // Google doesn't have shadow permissions concept
              }
            };
          }) || [];
          
          // Update credentials valid status based on successful fetch
          googleCredentialsValid = true;
        } else {
          const errorText = await googleResponse.text();
          googleCredentialsValid = false; // Mark as invalid if API call fails
        }
      } catch (error) {
        googleCredentialsValid = false; // Mark as invalid if fetch fails
      }
    } else {
    }
    
    
    // Combine AWS and Google users
    const allUsers = [
      ...(awsData.users || []),
      ...googleUsers
    ];
    
    // Return the combined data with Google credentials status
    return json<LoaderData>({ 
      users: allUsers,
      roles: awsData.roles || [],
      credentials: awsData.credentials || null,
      error: awsData.error || null,
      googleCredentialsValid,
      hasGoogleRefreshToken,
      refreshTokenValid
    });
  } catch (error) {
    console.error("Error in loader:", error);
    return json<LoaderData>(
      { 
        users: [], 
        roles: [], 
        credentials: null,
        error: error instanceof Error ? error.message : "Failed to fetch IAM data",
        googleCredentialsValid: false
      }
    );
  }
}; 