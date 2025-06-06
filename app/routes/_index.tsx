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

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
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
  const credentials = await getAwsCredentials(request);
  
  if (!credentials) {
    return json({ 
      credentials: null,
      users: [],
      roles: [],
      scoreHistory: [],
      error: null
    });
  }

  try {
    // Initialize AWS IAM client
    const iamClient = new IAMClient({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });

    const [users, roles] = await Promise.all([
      getIAMUsers(iamClient),
      getIAMRoles(iamClient)
    ]);

    // Generate score history
    const scoreHistory = generateScoreHistory(users, roles);

    return json({ 
      credentials,
      users,
      roles,
      scoreHistory,
      error: null
    });
  } catch (error) {
    console.error("Error fetching IAM data:", error);
    return json({ 
      credentials,
      users: [],
      roles: [],
      scoreHistory: [],
      error: "Failed to fetch IAM data. Please check your AWS credentials."
    });
  }
};

const Index = () => {
  const { credentials, users, roles, scoreHistory, error } = useLoaderData<typeof loader>();

  // Calculate shadow permissions for all entities and deduplicate them
  const shadowPermissions: ShadowPermissionRisk[] = credentials ? [
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

  const handleConnect = (service: string) => {
    console.log(`Connecting to ${service}...`);
    // TODO: Implement connection logic
  };

  const connectedServices = {
    AWS: !!credentials?.accessKeyId,
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
        {!credentials && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-5 h-5" />
              <span>AWS credentials not found. Please add your credentials in the Settings page.</span>
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
        hasCredentials={!!credentials}
      />

      {/* Main Content Grid: Timeline and Service Connections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Timeline Section - Takes up 2 columns on xl screens */}
        <div className="xl:col-span-2">
          <Timeline 
            scoreHistory={scoreHistory}
            hasCredentials={!!credentials}
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
