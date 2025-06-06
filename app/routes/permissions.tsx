import { AlertTriangle, Key, User, Shield, ExternalLink, Lock, AlertCircle, AlertOctagon } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";

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
  riskAssessment?: {
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
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
  users: IAMUser[];
  error?: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get the cookie header from the original request
    const cookieHeader = request.headers.get("Cookie");
    console.log("Debug - Permissions route cookie:", cookieHeader);
    
    // Make the request to the IAM users API using the full URL and forwarding cookies
    const response = await fetch(`${baseUrl}/api/iam-users`, {
      headers: {
        Cookie: cookieHeader || "",
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || data.error || "Failed to fetch IAM users");
    }
    
    return json<LoaderData>({ users: data.users });
  } catch (error) {
    console.error("Error in loader:", error);
    return json<LoaderData>(
      { users: [], error: error instanceof Error ? error.message : "Failed to fetch IAM users" },
      { status: 500 }
    );
  }
};

// Helper function to get risk level color and icon
function getRiskLevelInfo(level: 'low' | 'medium' | 'high' | 'critical') {
  switch (level) {
    case 'critical':
      return {
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        icon: AlertOctagon,
        label: 'Critical'
      };
    case 'high':
      return {
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        icon: AlertTriangle,
        label: 'High'
      };
    case 'medium':
      return {
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        icon: AlertCircle,
        label: 'Medium'
      };
    case 'low':
      return {
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        icon: Shield,
        label: 'Low'
      };
  }
}

// Helper function to get shadow permission icon and color
function getShadowPermissionInfo(type: string) {
  switch (type) {
    case 'unused_account':
      return {
        icon: User,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10'
      };
    case 'old_access':
      return {
        icon: Key,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10'
      };
    case 'forgotten_policy':
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10'
      };
    case 'unused_service':
      return {
        icon: AlertCircle,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10'
      };
    case 'legacy_policy':
      return {
        icon: Shield,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10'
      };
    case 'excessive_permissions':
      return {
        icon: AlertOctagon,
        color: 'text-pink-500',
        bgColor: 'bg-pink-500/10'
      };
    default:
      return {
        icon: AlertTriangle,
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10'
      };
  }
}

// Add this helper function after the other helper functions
function getProviderInfo(provider: 'aws' | 'azure' | 'gcp') {
  switch (provider) {
    case 'aws':
      return {
        icon: '/amazon-aws.svg',
        label: 'AWS',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10'
      };
    case 'azure':
      return {
        icon: '/microsoft-azure.svg',
        label: 'Azure',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10'
      };
    case 'gcp':
      return {
        icon: '/google-cloud.svg',
        label: 'GCP',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10'
      };
  }
}

export default function Permissions() {
  const { users = [], error } = useLoaderData<LoaderData>();

  // Add early return for error state
  if (error) {
    return (
      <div className="p-8 pt-6 w-full h-screen bg-[#181C23]">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Permissions Analysis</h1>
          <p className="text-gray-400 text-base mt-1">Detailed view of user permissions and access patterns</p>
        </div>
        <div className="mt-8 bg-red-900/20 border border-red-500/20 rounded-xl p-6 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  // Calculate total access keys safely
  const totalAccessKeys = users?.reduce((acc, user) => acc + (user?.accessKeys?.length || 0), 0) || 0;

  return (
    <div className="flex flex-col h-screen bg-[#181C23]">
      {/* Header Section - Fixed height */}
      <div className="flex-none p-8 pt-6">
        <h1 className="text-4xl font-bold text-white leading-tight">Permissions Analysis</h1>
        <p className="text-gray-400 text-base mt-1">Detailed view of user permissions and access patterns</p>
      </div>

      {/* Stats Cards - Fixed height */}
      <div className="flex-none px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Admin Access</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">{users?.length || 0} IAM users</div>
          </div>
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">API Keys</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {totalAccessKeys} active API keys
            </div>
          </div>
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Risk Level</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {error ? "Error fetching data" : "Medium - Active monitoring"}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section - Flexible height */}
      <div className="flex-1 px-8 pb-8 min-h-0">
        <div className="h-full flex flex-col">
          <div className="flex-none mb-4">
            <h2 className="text-2xl font-bold text-white">IAM Users</h2>
          </div>
          
          {error ? (
            <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-6 text-red-400">
              {error}
            </div>
          ) : (
            <div className="flex-1 relative bg-[#181C23] rounded-xl border border-[#23272f] overflow-hidden">
              <div className="absolute inset-0 overflow-auto">
                <table className="w-full text-lg text-left">
                  <thead className="sticky top-0 z-10 text-lg text-blue-300 uppercase bg-[#1a1f28]">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Provider</th>
                      <th className="px-6 py-4 font-semibold">Username</th>
                      <th className="px-6 py-4 font-semibold">Created</th>
                      <th className="px-6 py-4 font-semibold">Last Used</th>
                      <th className="px-6 py-4 font-semibold">MFA</th>
                      <th className="px-6 py-4 font-semibold">Risk Level</th>
                      <th className="px-6 py-4 font-semibold">Policies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23272f]">
                    {(users || []).map((user, index) => {
                      const riskInfo = getRiskLevelInfo(user?.riskAssessment?.riskLevel || 'low');
                      const RiskIcon = riskInfo.icon;
                      
                      return (
                        <tr 
                          key={user?.userName || index}
                          className="hover:bg-[#282d37] transition-colors duration-200"
                        >
                          <td className="px-6 py-5 whitespace-nowrap rounded-l-xl">
                            <div className="flex items-center justify-center">
                              <img 
                                src="/amazon-aws.svg" 
                                alt="AWS"
                                className="w-8 h-8 invert brightness-0"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-5 font-medium text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <User className="w-5 h-5 text-blue-400" />
                              <a 
                                href={`https://console.aws.amazon.com/iam/home?region=us-east-1#/users/${user?.userName}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {user?.userName || 'Unknown'}
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-gray-300">
                            {user?.createDate ? new Date(user.createDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-gray-300">
                            {user?.lastUsed 
                              ? new Date(user.lastUsed).toLocaleDateString()
                              : "Never"
                            }
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {user?.hasMFA ? (
                                <span className="flex items-center gap-1 text-green-400">
                                  <Lock className="w-4 h-4" />
                                  <span className="text-sm">Enabled</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span className="text-sm">Disabled</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="group relative inline-block">
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${riskInfo.bgColor} cursor-help`}>
                                <RiskIcon className={`w-4 h-4 ${riskInfo.color}`} />
                                <span className={`text-sm font-medium ${riskInfo.color}`}>
                                  {riskInfo.label}
                                </span>
                              </div>
                              
                              {/* Risk Factors Tooltip */}
                              <div className="absolute left-0 top-full mt-1 w-64 bg-[#1a1f28] border border-[#23272f] rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                <div className="text-xs space-y-3">
                                  <div className="font-semibold text-white">Risk Assessment</div>
                                  <div className="text-gray-400">
                                    Overall Score: {user?.riskAssessment?.score || 0}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold text-white">Risk Factors</div>
                                    <ul className="list-disc list-inside space-y-1">
                                      {user?.riskAssessment?.factors.map((factor, i) => (
                                        <li key={i} className="text-gray-300">{factor}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap rounded-r-xl">
                            <div className="space-y-2">
                              {/* Inline Policies */}
                              {(user?.policies?.filter(p => p.type === 'inline') || []).length > 0 && (
                                <div>
                                  <div className="text-sm text-gray-400 mb-1">Inline Policies:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {(user?.policies?.filter(p => p.type === 'inline') || []).map(policy => (
                                      <span 
                                        key={policy.name}
                                        className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded text-xs"
                                      >
                                        {policy.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Attached Policies */}
                              {(user?.policies?.filter(p => p.type === 'managed') || []).length > 0 && (
                                <div>
                                  <div className="text-sm text-gray-400 mb-1">Attached Policies:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {(user?.policies?.filter(p => p.type === 'managed') || []).map(policy => (
                                      <div 
                                        key={policy.name}
                                        className="group relative"
                                      >
                                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs cursor-help">
                                          {policy.name}
                                        </span>
                                        {/* Policy Tooltip */}
                                        <div className="absolute left-0 top-full mt-1 w-64 bg-[#1a1f28] border border-[#23272f] rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                          <div className="text-xs space-y-1">
                                            <div className="font-semibold text-white">{policy.name}</div>
                                            {policy.description && (
                                              <div className="text-gray-400">{policy.description}</div>
                                            )}
                                            <div className="text-gray-500">
                                              Created: {policy.createDate ? new Date(policy.createDate).toLocaleDateString() : 'Unknown'}
                                            </div>
                                            <div className="text-gray-500">
                                              Updated: {policy.updateDate ? new Date(policy.updateDate).toLocaleDateString() : 'Unknown'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(!user?.policies?.filter(p => p.type === 'inline')?.length && !user?.policies?.filter(p => p.type === 'managed')?.length) && (
                                <span className="text-gray-500">No policies</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 