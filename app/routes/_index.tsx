import type { MetaFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { IAMClient } from "@aws-sdk/client-iam";
import { Stats } from "~/components/Stats";
import { Alerts } from "~/components/Alerts";
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

export const loader: LoaderFunction = async ({ request }) => {
  const credentials = await getAwsCredentials(request);
  
  if (!credentials) {
    return json({ 
      credentials: null,
      users: [],
      roles: [],
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

    return json({ 
      credentials,
      users,
      roles,
      error: null
    });
  } catch (error) {
    console.error("Error fetching IAM data:", error);
    return json({ 
      credentials,
      users: [],
      roles: [],
      error: "Failed to fetch IAM data. Please check your AWS credentials."
    });
  }
};

const Index = () => {
  const { credentials, users, roles, error } = useLoaderData<typeof loader>();

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

      {/* Main Content Grid: Alerts and Service Connections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Alerts Section - Takes up 2 columns on xl screens */}
        <div className="xl:col-span-2">
          <Alerts 
            shadowPermissions={shadowPermissions} 
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

      {/* Quick Actions Grid */}
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-secondary" />
          Quick Security Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            className={`group p-6 bg-gradient-to-br from-red-500/10 to-red-600/10 hover:from-red-500/20 hover:to-red-600/20 border border-red-500/20 rounded-lg transition-all duration-200 text-left ${!credentials ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!credentials}
          >
            <div className="flex items-center gap-3 mb-3">
              <Scan className="w-6 h-6 text-red-400 group-hover:text-red-300" />
              <h3 className="font-semibold text-white">Shadow Scan</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              Discover hidden permissions and access patterns
            </p>
          </button>

          <button 
            className={`group p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 border border-blue-500/20 rounded-lg transition-all duration-200 text-left ${!credentials ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!credentials}
          >
            <div className="flex items-center gap-3 mb-3">
              <Eye className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />
              <h3 className="font-semibold text-white">Access Review</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              Review and audit user access policies
            </p>
          </button>

          <button 
            className={`group p-6 bg-gradient-to-br from-green-500/10 to-green-600/10 hover:from-green-500/20 hover:to-green-600/20 border border-green-500/20 rounded-lg transition-all duration-200 text-left ${!credentials ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!credentials}
          >
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-6 h-6 text-green-400 group-hover:text-green-300" />
              <h3 className="font-semibold text-white">Security Report</h3>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300">
              Generate comprehensive security analysis
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
