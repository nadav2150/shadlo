import React from "react";
import { AlertTriangle, Key, User, Shield, ExternalLink, Lock, AlertCircle, AlertOctagon, Search, Filter, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Settings, Cloud, Mail } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useState, useMemo } from "react";
import { getGoogleCredentials } from "~/utils/session.google.server";
import { calculateRiskScore } from "~/lib/iam/google-risk-assessment";

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
        console.log("AWS not connected or error:", await awsResponse.text());
      }
    } catch (error) {
      console.log("Error fetching AWS data:", error);
      // Continue without AWS data
    }

    // Try to fetch Google data
    try {
      const googleResponse = await fetch(`${baseUrl}/api/google-users`, {
        headers: {
          Cookie: cookieHeader || "",
        },
      });
      
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
      } else {
        console.log("Google not connected or error:", await googleResponse.text());
      }
    } catch (error) {
      console.log("Error fetching Google users:", error);
      // Continue without Google data
    }
    
    console.log("Debug - API Response:", { 
      hasAwsCredentials: !!awsData.credentials,
      awsUserCount: awsData.users?.length,
      awsRoleCount: awsData.roles?.length,
      googleUserCount: googleUsers.length
    });
    
    // Combine AWS and Google users
    const allUsers = [
      ...(awsData.users || []),
      ...googleUsers
    ];
    
    // Return the combined data
    return json<LoaderData>({ 
      users: allUsers,
      roles: awsData.roles || [],
      credentials: awsData.credentials || null,
      error: awsData.error || null
    });
  } catch (error) {
    console.error("Error in loader:", error);
    return json<LoaderData>(
      { 
        users: [], 
        roles: [], 
        credentials: null,
        error: error instanceof Error ? error.message : "Failed to fetch IAM data"
      }
    );
  }
};

// Helper function to get user display name
const getUserDisplayName = (user: IAMUser | GoogleUser): string => {
  if (user.provider === 'google') {
    return (user as GoogleUser).primaryEmail;
  }
  return (user as IAMUser).userName;
};

// Helper function to get provider info
const getProviderInfo = (provider: 'aws' | 'azure' | 'gcp' | 'google') => {
  switch (provider) {
    case 'aws':
      return {
        label: 'AWS',
        icon: Cloud,
        color: 'text-blue-400'
      };
    case 'google':
      return {
        label: 'Google',
        icon: Mail,
        color: 'text-red-400'
      };
    case 'azure':
      return {
        label: 'Azure',
        icon: Shield,
        color: 'text-blue-500'
      };
    case 'gcp':
      return {
        label: 'GCP',
        icon: Cloud,
        color: 'text-green-400'
      };
    default:
      return {
        label: 'Unknown',
        icon: Settings,
        color: 'text-gray-400'
      };
  }
};

// Helper function to get risk level info
const getRiskLevelInfo = (riskLevel: 'low' | 'medium' | 'high' | 'critical') => {
  switch (riskLevel) {
    case 'critical':
      return {
        label: 'Critical',
        icon: AlertOctagon,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10'
      };
    case 'high':
      return {
        label: 'High',
        icon: AlertTriangle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10'
      };
    case 'medium':
      return {
        label: 'Medium',
        icon: AlertCircle,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10'
      };
    case 'low':
    default:
      return {
        label: 'Low',
        icon: Shield,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10'
      };
  }
};

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

type SortField = 'type' | 'provider' | 'name' | 'created' | 'lastUsed' | 'mfa' | 'risk' | 'policies';
type SortDirection = 'asc' | 'desc';

export default function Permissions() {
  const { users = [], roles = [], credentials, error } = useLoaderData<LoaderData>();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "user" | "role">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Check which providers are connected
  const isAwsConnected = !!credentials?.accessKeyId;
  const isGoogleConnected = users.some(user => user.provider === 'google');
  const hasConnectedProviders = isAwsConnected || isGoogleConnected;

  // Format dates safely
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      // Check if date is Unix epoch (1970-01-01)
      if (date.getTime() === 0 || dateStr.startsWith('1970-01-01')) {
        return 'Never';
      }
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Combine users and roles into a single array for filtering and sorting
  const allEntities = useMemo(() => {
    const combined = [
      ...users.map(user => ({ ...user, type: 'user' as const })),
      ...roles.map(role => ({ ...role, type: 'role' as const }))
    ];

    // First filter
    const filtered = combined.filter(entity => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const entityName = entity.type === 'user' 
        ? (entity as IAMUser).userName 
        : (entity as IAMRole).roleName;
      
      const matchesSearch = searchQuery === "" || 
        (entityName?.toLowerCase() || '').includes(searchLower);

      // Type filter
      const matchesType = typeFilter === "all" || entity.type === typeFilter;

      // Risk filter
      const matchesRisk = riskFilter === "all" || 
        entity.riskAssessment?.riskLevel === riskFilter;

      return matchesSearch && matchesType && matchesRisk;
    });

    // Then sort
    return filtered.sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'type':
          return modifier * (a.type.localeCompare(b.type));
        case 'provider':
          return modifier * (a.provider.localeCompare(b.provider));
        case 'name':
          const aName = a.type === 'user' ? (a as IAMUser).userName : (a as IAMRole).roleName;
          const bName = b.type === 'user' ? (b as IAMUser).userName : (b as IAMRole).roleName;
          return modifier * ((aName || '').localeCompare(bName || ''));
        case 'created':
          const aDate = a.createDate ? new Date(a.createDate).getTime() : 0;
          const bDate = b.createDate ? new Date(b.createDate).getTime() : 0;
          return modifier * (aDate - bDate);
        case 'lastUsed':
          const aLastUsed = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
          const bLastUsed = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
          return modifier * (aLastUsed - bLastUsed);
        case 'mfa':
          if (a.type === 'user' && b.type === 'user') {
            const aMFA = (a as IAMUser).hasMFA;
            const bMFA = (b as IAMUser).hasMFA;
            if (aMFA === bMFA) return 0;
            return modifier * (aMFA ? 1 : -1);
          } else if (a.type === 'user') {
            return modifier * -1;
          } else if (b.type === 'user') {
            return modifier * 1;
          } else {
            return 0;
          }
        case 'risk':
          const aRisk = a.riskAssessment?.riskLevel || 'low';
          const bRisk = b.riskAssessment?.riskLevel || 'low';
          const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          return modifier * (riskOrder[aRisk] - riskOrder[bRisk]);
        case 'policies':
          const aPolicies = a.policies?.length || 0;
          const bPolicies = b.policies?.length || 0;
          return modifier * (aPolicies - bPolicies);
        default:
          return 0;
      }
    });
  }, [users, roles, searchQuery, typeFilter, riskFilter, sortField, sortDirection]);

  // Calculate total access keys safely
  const totalAccessKeys = users?.reduce((acc, user) => {
    if ('accessKeys' in user) {
      return acc + (user.accessKeys?.length || 0);
    }
    return acc;
  }, 0) || 0;
  const totalEntities = (users?.length || 0) + (roles?.length || 0);

  // Helper function to render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  // Helper function to render connection status
  const ConnectionStatus = () => {
    if (!hasConnectedProviders) {
      return (
        <div className="mb-6 bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <span>No identity providers connected. Please connect at least one provider in the Settings page.</span>
            </div>
            <a 
              href="/providers" 
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2 w-fit"
            >
              <Settings className="w-4 h-4" />
              Go to Providers
            </a>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
      {/* Header Section */}
      <div className="px-8 py-6 border-b border-gray-800">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white">Permissions Management</h1>
          <p className="text-gray-400">
            View and manage user permissions across your connected identity providers
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <ConnectionStatus />

      {/* Stats Cards */}
      <div className="flex-none px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-6">
          <div className="bg-white/5 border border-gray-800 rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Total Entities</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {hasConnectedProviders ? `${totalEntities} entities` : 'N/A'}
            </div>
          </div>
          <div className="bg-white/5 border border-gray-800 rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Users</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {hasConnectedProviders ? `${users?.length || 0} users` : 'N/A'}
            </div>
          </div>
          <div className="bg-white/5 border border-gray-800 rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Roles</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {hasConnectedProviders ? `${roles?.length || 0} roles` : 'N/A'}
            </div>
          </div>
          <div className="bg-white/5 border border-gray-800 rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">API Keys</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {hasConnectedProviders ? `${totalAccessKeys} active keys` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 px-8 pb-8 min-h-0">
        <div className="h-full flex flex-col">
          <div className="flex-none mb-4">
            <h2 className="text-2xl font-bold text-white">
              {hasConnectedProviders ? 'Identity Entities' : 'No Providers Connected'}
            </h2>
          </div>

          {/* Only show search and filters if we have connected providers */}
          {hasConnectedProviders && (
            <>
              {/* Search and Filter Controls */}
              <div className="flex-none mb-4 flex flex-wrap gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Type Filter */}
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                    className="appearance-none pl-4 pr-10 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="user">Users</option>
                    <option value="role">Roles</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Filter className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Risk Level Filter */}
                <div className="relative">
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
                    className="appearance-none pl-4 pr-10 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <Filter className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 text-lg text-blue-300 uppercase bg-[#1a1f28]">
                    <tr>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center">
                          Type
                          <SortIndicator field="type" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('provider')}
                      >
                        <div className="flex items-center">
                          Provider
                          <SortIndicator field="provider" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Name
                          <SortIndicator field="name" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('created')}
                      >
                        <div className="flex items-center">
                          Created
                          <SortIndicator field="created" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('lastUsed')}
                      >
                        <div className="flex items-center">
                          Last Used
                          <SortIndicator field="lastUsed" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('mfa')}
                      >
                        <div className="flex items-center">
                          MFA
                          <SortIndicator field="mfa" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('risk')}
                      >
                        <div className="flex items-center">
                          Risk Level
                          <SortIndicator field="risk" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                        onClick={() => handleSort('policies')}
                      >
                        <div className="flex items-center">
                          Policies
                          <SortIndicator field="policies" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {error ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                            <span>{error}</span>
                          </div>
                        </td>
                      </tr>
                    ) : allEntities.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                          No entities found
                        </td>
                      </tr>
                    ) : (
                      allEntities.map((entity, index) => {
                        const riskInfo = getRiskLevelInfo(entity?.riskAssessment?.riskLevel || 'low');
                        const RiskIcon = riskInfo.icon;
                        const providerInfo = getProviderInfo(entity.provider);
                        const ProviderIcon = providerInfo.icon;
                        const entityId = entity.type === 'user' 
                          ? getUserDisplayName(entity as IAMUser | GoogleUser)
                          : (entity as IAMRole).roleName;

                        const createDate = formatDate(entity.createDate);
                        const lastUsed = formatDate(entity.lastUsed);

                        return (
                          <React.Fragment key={entityId}>
                            <tr className="border-b border-[#23272f] hover:bg-[#1a1f28]/50 transition-colors">
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {entity.type === 'user' ? (
                                    <>
                                      <User className="w-5 h-5 text-blue-400" />
                                      <span className="text-blue-400">User</span>
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-5 h-5 text-purple-400" />
                                      <span className="text-purple-400">Role</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                  {entity.provider === 'aws' ? (
                                    <img 
                                      src="/amazon-aws.svg"
                                      alt="AWS"
                                      className="w-8 h-8 invert brightness-0"
                                    />
                                  ) : entity.provider === 'google' ? (
                                    <img 
                                      src="/google-workspace.svg"
                                      alt="Google"
                                      className="h-12 invert brightness-0"
                                    />
                                  ) : (
                                    <Cloud className="w-8 h-8 text-blue-400" />
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5 font-medium text-white whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <a 
                                    href={entity.provider === 'google' 
                                      ? 'https://admin.google.com/ac/users'
                                      : `https://console.aws.amazon.com/iam/home?region=us-east-1#/${entity.type === 'user' ? 'users' : 'roles'}/${entityId}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-1 ${
                                      entity.type === 'user' ? 'text-blue-400 hover:text-blue-300' : 'text-purple-400 hover:text-purple-300'
                                    } transition-colors`}
                                  >
                                    {entityId}
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap text-gray-300">
                                {createDate}
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap text-gray-300">
                                {lastUsed}
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {entity.type === 'user' && (entity as IAMUser).hasMFA ? (
                                    <span className="flex items-center gap-1 text-green-400">
                                      <Lock className="w-4 h-4" />
                                      Enabled
                                    </span>
                                  ) : entity.type === 'user' ? (
                                    <span className="flex items-center gap-1 text-red-400">
                                      <AlertTriangle className="w-4 h-4" />
                                      Disabled
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">N/A</span>
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
                                      
                                      <div className="space-y-1">
                                        <div className="font-semibold text-white">Risk Factors</div>
                                        <ul className="list-disc list-inside space-y-1">
                                          {entity?.riskAssessment?.factors?.map((factor, i) => (
                                            <li key={i} className="text-gray-300">{factor}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5 whitespace-nowrap">
                                <div className="space-y-2">
                                  {/* Inline Policies */}
                                  {(entity?.policies?.filter(p => p.type === 'inline') || []).length > 0 && (
                                    <div>
                                      <div className="text-sm text-gray-400 mb-1">Inline Policies:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {(entity?.policies?.filter(p => p.type === 'inline') || []).map(policy => (
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
                                  {(entity?.policies?.filter(p => p.type === 'managed') || []).length > 0 && (
                                    <div>
                                      <div className="text-sm text-gray-400 mb-1">Attached Policies:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {(entity?.policies?.filter(p => p.type === 'managed') || []).map(policy => (
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

                                  {(!entity?.policies?.filter(p => p.type === 'inline')?.length && !entity?.policies?.filter(p => p.type === 'managed')?.length) && (
                                    <span className="text-gray-500">No policies</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 