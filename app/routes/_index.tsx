import type { MetaFunction } from "@remix-run/node";
import { Stats } from "~/components/Stats";
import { Timeline } from "~/components/Timeline";
import { Button } from "~/components/ui/button";
import { Cloud, Shield, Scan, FileText, Eye, Plus, CheckCircle, AlertCircle, Settings, RefreshCw } from "lucide-react";
import { calculateRiskScore } from "~/lib/iam/risk-assessment";
import type { ShadowPermissionRisk, UserDetails, RoleDetails } from "~/lib/iam/types";
import { useDashboard } from "~/hooks/useDashboard";
import { LoadingSpinner } from "~/components/LoadingSpinner";

export const meta: MetaFunction = () => {
  return [
    { title: "Shadlo - Cloud Security Dashboard" },
    { name: "description", content: "Detect and score hidden cloud permissions risks" },
  ];
};

const Index = () => {
  // Use React Query instead of useLoaderData
  const { data, isLoading, isError, error, refetch } = useDashboard();
  
  // Extract data with fallbacks
  const credentials = data?.credentials || { aws: null, google: null };
  const users = data?.users || [];
  const roles = data?.roles || [];
  const scoreHistory = data?.scoreHistory || [];
  const googleCredentialsValid = data?.googleCredentialsValid || false;
  const hasGoogleRefreshToken = data?.hasGoogleRefreshToken || false;
  const refreshTokenValid = data?.refreshTokenValid || false;
  const errorMessage = data?.error || error?.message;

  // Calculate shadow permissions for all entities and deduplicate them
  const shadowPermissions: ShadowPermissionRisk[] = (credentials.aws || (googleCredentialsValid && !!credentials.google)) ? [
    ...users.map((user: UserDetails) => calculateRiskScore(user).shadowPermissions || []),
    ...roles.map((role: RoleDetails) => calculateRiskScore(role).shadowPermissions || [])
  ]
    .flat()
    // Deduplicate based on policy name and type
    .filter((permission, index, self) => 
      index === self.findIndex(p => 
        p.type === permission.type && 
        p.details.includes(permission.details.split('"')[1]) // Extract policy name from details
      )
    ) as ShadowPermissionRisk[] : [];

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Security Dashboard</h1>
            <p className="text-gray-300 text-lg">
              Monitor and manage your cloud security posture across all platforms
            </p>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed border border-gray-500 rounded-lg text-sm font-medium text-white transition-colors"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        
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
        {errorMessage && (
          <div className="mt-4 bg-red-900/20 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading dashboard data..." />
        </div>
      )}

      {/* Dashboard Content */}
      {!isLoading && (
        <>
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
        </>
      )}
    </div>
  );
};

export default Index;
