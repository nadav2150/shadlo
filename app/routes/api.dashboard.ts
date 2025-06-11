import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { getAwsCredentials } from "~/utils/session.server";
import { getIAMUsers, getIAMRoles } from "~/lib/iam/aws-operations";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import type { ShadowPermissionRisk, UserDetails, RoleDetails } from "~/lib/iam/types";
import { validateGoogleCredentials } from "~/utils/google-credentials.server";

// Generate mock score history data for the last 30 days
function generateScoreHistory(users: UserDetails[], roles: RoleDetails[]) {
  const today = new Date();
  const history = [];
  
  // Define risk level thresholds based on risk-assessment.ts
  const RISK_LEVELS = {
    LOW: { max: 4, color: 'green' },
    MEDIUM: { max: 9, color: 'yellow' },
    HIGH: { max: 14, color: 'orange' },
    CRITICAL: { max: 15, color: 'red' }
  };

  // Generate a more varied score history that shows all risk levels
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Create a pattern that cycles through different risk levels
    // Week 1: Low risk (0-4)
    // Week 2: Medium risk (5-9)
    // Week 3: High risk (10-14)
    // Week 4: Critical risk (15)
    const week = Math.floor(i / 7);
    let baseScore;
    
    switch (week) {
      case 0: // Week 1 - Low risk
        baseScore = Math.floor(Math.random() * 5); // 0-4
        break;
      case 1: // Week 2 - Medium risk
        baseScore = 5 + Math.floor(Math.random() * 5); // 5-9
        break;
      case 2: // Week 3 - High risk
        baseScore = 10 + Math.floor(Math.random() * 5); // 10-14
        break;
      case 3: // Week 4 - Critical risk
        baseScore = 15;
        break;
      default:
        baseScore = Math.floor(Math.random() * 15);
    }
    
    // Add some daily variation (±1 point) to make it more realistic
    const variation = Math.random() * 2 - 1;
    const score = Math.max(0, Math.min(15, Math.round(baseScore + variation)));
    
    history.push({
      date: date.toISOString(),
      score: score,
      riskLevel: score <= RISK_LEVELS.LOW.max ? 'low' :
                score <= RISK_LEVELS.MEDIUM.max ? 'medium' :
                score <= RISK_LEVELS.HIGH.max ? 'high' : 'critical'
    });
  }

  return history;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get the cookie header from the original request
    const cookieHeader = request.headers.get("Cookie");
    
    // Validate Google credentials first
    const googleValidation = await validateGoogleCredentials(request);
    const googleCredentialsValid = googleValidation.isValid;
    
    // Check if user has Google refresh token in database and validate it
    const { getCurrentUser } = await import("~/lib/firebase");
    const currentUser = await getCurrentUser();
    let hasGoogleRefreshToken = false;
    let refreshTokenValid = false;
    
    if (currentUser?.email) {
      const { getGoogleRefreshToken } = await import("~/lib/firebase");
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
    
    // Make parallel requests to both AWS and Google APIs
    const [awsResponse, googleResponse] = await Promise.all([
      fetch(`${baseUrl}/api/iam-entities`, {
        headers: {
          Cookie: cookieHeader || "",
        },
      }),
      // Try auto-fetch first if user has valid refresh token, otherwise use session credentials
      refreshTokenValid 
        ? fetch(`${baseUrl}/api/google-users-auto`, {
            headers: {
              Cookie: cookieHeader || "",
            },
          })
        : googleCredentialsValid 
          ? fetch(`${baseUrl}/api/google-users`, {
              headers: {
                Cookie: cookieHeader || "",
              },
            })
          : Promise.resolve(new Response(JSON.stringify({ users: [], credentials: null }), { status: 200 }))
    ]);
    
    const awsData = await awsResponse.json();
    const googleData = await googleResponse.json();

    // Determine if Google is connected based on the response
    const googleConnected = refreshTokenValid && googleData.success || googleCredentialsValid;
    
    // Transform Google users to match AWS user format
    const transformedGoogleUsers = (googleData.users || []).map((user: any) => ({
      userName: user.primaryEmail,
      createDate: new Date().toISOString(), // Google API doesn't provide creation date
      lastUsed: user.lastLoginTime || undefined,
      policies: [], // Add empty policies array to match AWS format
      hasMFA: user.isEnrolledIn2Sv,
      accessKeys: [], // Add empty accessKeys array to match AWS format
      provider: 'google' as const,
      type: 'user' as const,
      riskAssessment: {
        riskLevel: user.riskAssessment.level.toLowerCase(), // Convert to lowercase to match AWS format
        score: user.riskAssessment.score,
        factors: user.riskAssessment.factors,
        shadowPermissions: [],
        lastUsedScore: user.lastLoginTime ? 0 : 5,
        permissionScore: user.isAdmin ? 5 : 0,
        identityScore: user.isEnrolledIn2Sv ? 0 : 2
      }
    }));
    
    // Combine users and roles from both services
    const combinedUsers = [
      ...(awsData.users || []),
      ...transformedGoogleUsers
    ];

    const combinedRoles = [
      ...(awsData.roles || []),
      ...(googleData.roles || []).map((role: any) => ({
        ...role,
        provider: 'google',
        policies: [] // Add empty policies array to match AWS format
      }))
    ];

    // Generate score history using the combined data
    const scoreHistory = generateScoreHistory(combinedUsers, combinedRoles);

    return json({ 
      credentials: {
        aws: awsData.credentials,
        google: googleConnected ? { connected: true, autoConnected: refreshTokenValid } : null
      },
      users: combinedUsers,
      roles: combinedRoles,
      scoreHistory,
      error: awsData.error || (googleConnected ? googleData.error : null) || null,
      googleCredentialsValid: googleConnected,
      hasGoogleRefreshToken: hasGoogleRefreshToken,
      refreshTokenValid: refreshTokenValid
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return json({ 
      credentials: {
        aws: null,
        google: null
      },
      users: [],
      roles: [],
      scoreHistory: [],
      error: "Failed to fetch dashboard data. Please check your credentials.",
      googleCredentialsValid: false,
      hasGoogleRefreshToken: false,
      refreshTokenValid: false
    });
  }
}; 