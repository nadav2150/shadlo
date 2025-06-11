import type { MetaFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { Stats } from "~/components/Stats";
import { Timeline } from "~/components/Timeline";
import { Button } from "~/components/ui/button";
import { Cloud, Shield, Scan, FileText, Eye, Plus, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { getAwsCredentials } from "~/utils/session.server";
import { getIAMUsers, getIAMRoles } from "~/lib/iam/aws-operations";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import type { ShadowPermissionRisk, UserDetails, RoleDetails } from "~/lib/iam/types";
import { validateGoogleCredentials } from "~/utils/google-credentials.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Shadlo - Cloud Security Dashboard" },
    { name: "description", content: "Detect and score hidden cloud permissions risks" },
  ];
};

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
    console.error("Error fetching IAM data:", error);
    return json({ 
      credentials: {
        aws: null,
        google: null
      },
      users: [],
      roles: [],
      scoreHistory: [],
      error: "Failed to fetch IAM data. Please check your credentials.",
      googleCredentialsValid: false,
      hasGoogleRefreshToken: false,
      refreshTokenValid: false
    });
  }
};

const Index = () => {
  const { credentials, users, roles, scoreHistory, error, googleCredentialsValid, hasGoogleRefreshToken, refreshTokenValid } = useLoaderData<typeof loader>();

  // Calculate shadow permissions for all entities and deduplicate them
  const shadowPermissions: ShadowPermissionRisk[] = (credentials.aws || (googleCredentialsValid && !!credentials.google)) ? [
    ...users.map((user: UserDetails) => calculateRiskScore(user).shadowPermissions),
    ...roles.map((role: RoleDetails) => calculateRiskScore(role).shadowPermissions)
  ]
    .flat()
    // Deduplicate based on policy name and type
    .filter((permission, index, self) => 
      index === self.findIndex(p => 
        p.type === permission.type && 
        p.details.includes(permission.details.split('"')[1]) // Extract policy name from details
      )
    ) : [];



  const connectedServices = {
    AWS: !!credentials.aws?.accessKeyId,
    Google: googleCredentialsValid && !!credentials.google,
    Azure: false,
    Okta: false
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Security Dashboard</h1>
        <p className="text-gray-300 text-lg">
          Monitor and manage your cloud security posture across all platforms
        </p>
        {!credentials.aws && !credentials.google && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-5 h-5" />
              <span>No identity providers connected. Please add your credentials in the Providers page.</span>
            </div>
          </div>
        )}
        {hasGoogleRefreshToken && !refreshTokenValid && (
          <div className="mt-4 bg-orange-900/20 border border-orange-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-orange-400">
              <AlertCircle className="w-5 h-5" />
              <span>Google refresh token found but is invalid or expired. Please reconnect your Google account in the Providers page.</span>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <Stats 
        users={users} 
        roles={roles} 
        shadowPermissions={shadowPermissions} 
        hasCredentials={!!credentials.aws || (googleCredentialsValid && !!credentials.google)}
      />

      {/* Main Content Grid: Timeline and Service Connections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Timeline Section - Takes up 2 columns on xl screens */}
        <div className="xl:col-span-2">
          <Timeline 
            scoreHistory={scoreHistory}
            hasCredentials={!!credentials.aws || (googleCredentialsValid && !!credentials.google)}
          />
        </div>
        
        {/* Service Connections Section - Takes up 1 column on xl screens */}
        <div className="xl:col-span-1 bg-white/5 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Cloud className="w-6 h-6 text-secondary" />
            <h2 className="text-xl font-semibold text-white">Cloud Services</h2>
          </div>
          
          <div className="space-y-4 mb-8">
            {Object.entries(connectedServices).map(([service, isConnected]) => (
              <div key={service} className="flex items-center p-4 bg-white/5 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="font-medium text-white">{service}</span>
                  {isConnected && <CheckCircle className="w-4 h-4 text-green-500" />}
                </div>
              </div>
            ))}
          </div>

          <Button 
            className="w-full bg-secondary hover:bg-secondary/90 text-white flex items-center gap-2"
            onClick={() => window.location.href = '/providers'}
          >
            <Settings className="w-4 h-4" />
            Manage Providers
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
