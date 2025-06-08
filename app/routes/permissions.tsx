import React from "react";
import { AlertTriangle, Key, User, Shield, ExternalLink, Lock, AlertCircle, AlertOctagon, Search, Filter, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Settings, Cloud, Mail } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useState, useMemo } from "react";
import { getGoogleCredentials } from "~/utils/session.google.server";

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
  googleCredentials?: {
    access_token: string;
    users: GoogleUser[];
  } | null;
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get the cookie header from the original request
    const cookieHeader = request.headers.get("Cookie");
    
    // Fetch both AWS and Google data in parallel
    const [awsResponse, googleCredentials] = await Promise.all([
      fetch(`${baseUrl}/api/iam-entities`, {
        headers: {
          Cookie: cookieHeader || "",
        },
      }),
      getGoogleCredentials(request)
    ]);
    
    const awsData = await awsResponse.json();
    console.log("Debug - API Response:", { 
      status: awsResponse.status, 
      ok: awsResponse.ok, 
      hasCredentials: !!awsData.credentials,
      userCount: awsData.users?.length,
      roleCount: awsData.roles?.length,
      hasGoogleCredentials: !!googleCredentials
    });

    // Transform Google users to match the common interface
    const googleUsers: GoogleUser[] = googleCredentials?.users?.map(user => ({
      ...user,
      provider: 'google' as const,
      type: 'user' as const,
      createDate: new Date().toISOString(), // Google API doesn't provide creation date
      policies: [], // Google API doesn't provide policies in the same way
      hasMFA: user.isEnrolledIn2Sv,
      riskAssessment: {
        riskLevel: user.isEnrolledIn2Sv ? 'low' : 'high',
        score: user.isEnrolledIn2Sv ? 90 : 30,
        lastUsedScore: 100,
        permissionScore: user.isAdmin ? 50 : 90,
        identityScore: user.isEnrolledIn2Sv ? 90 : 30,
        factors: [
          ...(user.isEnrolledIn2Sv ? [] : ['No 2SV']),
          ...(user.isAdmin ? ['Admin Access'] : []),
        ],
        shadowPermissions: []
      }
    })) || [];
    
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
      googleCredentials: googleCredentials ? {
        access_token: googleCredentials.access_token,
        users: googleUsers
      } : null,
      error: awsData.error || null
    });
  } catch (error) {
    console.error("Error in loader:", error);
    return json<LoaderData>(
      { 
        users: [], 
        roles: [], 
        credentials: null,
        googleCredentials: null,
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
  const { users = [], roles = [], credentials, googleCredentials, error } = useLoaderData<LoaderData>();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "user" | "role">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Check which providers are connected
  const isAwsConnected = !!credentials?.accessKeyId;
  const isGoogleConnected = !!googleCredentials?.access_token;
  const hasConnectedProviders = isAwsConnected || isGoogleConnected;

  // Helper function to toggle row expansion
  const toggleRow = (entityId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(entityId)) {
      newExpandedRows.delete(entityId);
    } else {
      newExpandedRows.add(entityId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Format dates safely
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
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

    const statusMessages = [];
    if (!isAwsConnected) {
      statusMessages.push(
        <div key="aws" className="flex items-center gap-2 text-gray-400">
          <Cloud className="w-5 h-5" />
          <span>AWS not connected</span>
        </div>
      );
    }
    if (!isGoogleConnected) {
      statusMessages.push(
        <div key="google" className="flex items-center gap-2 text-gray-400">
          <Mail className="w-5 h-5" />
          <span>Google not connected</span>
        </div>
      );
    }

    if (statusMessages.length > 0) {
      return (
        <div className="mb-6 bg-[#1a1f28] border border-gray-800 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="text-white font-medium">Connected Providers:</div>
            <div className="flex flex-wrap gap-4">
              {statusMessages}
            </div>
            <a 
              href="/providers" 
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2 w-fit mt-2"
            >
              <Settings className="w-4 h-4" />
              Manage Providers
            </a>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
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
                      <th 
                        className="px-6 py-4 font-semibold cursor-pointer hover:bg-[#23272f] transition-colors"
                      >
                        <div className="flex items-center">
                          Actions
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
                        const isExpanded = expandedRows.has(entityId);
                        
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
                                    href={`https://console.aws.amazon.com/iam/home?region=us-east-1#/${entity.type === 'user' ? 'users' : 'roles'}/${entityId}`}
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
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => toggleRow(entityId)}
                                  className="text-gray-400 hover:text-white transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                            
                            {/* Expanded Score Details Row */}
                            {isExpanded && (
                              <tr className="border-b border-[#23272f] bg-[#1a1f28]/30">
                                <td colSpan={8} className="px-6 py-4">
                                  <div className="space-y-6">
                                    {/* Risk Overview Card */}
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-[#1a1f28] to-[#23272f] border border-[#23272f]">
                                      <div className="flex items-center gap-4 mb-4">
                                        <div className={`p-3 rounded-lg ${riskInfo.bgColor}`}>
                                          <RiskIcon className={`w-6 h-6 ${riskInfo.color}`} />
                                        </div>
                                        <div>
                                          <h3 className="text-lg font-semibold text-white">Risk Assessment Overview</h3>
                                          <p className="text-gray-400 text-sm">Current Risk Level: {riskInfo.label}</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-3 gap-4">
                                        {/* Activity Score */}
                                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-2 rounded-lg bg-blue-500/10">
                                              <User className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-white">
                                              Activity Score {entity.riskAssessment?.lastUsedScore ? <span className="text-red-400">+{entity.riskAssessment.lastUsedScore}</span> : ''}
                                            </h4>
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                              <span className="text-gray-400 text-sm">Last Activity</span>
                                              <span className="text-white text-sm">
                                                {lastUsed}
                                              </span>
                                            </div>
                                            {entity.type === 'user' && (
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-sm">Access Keys</span>
                                                <span className="text-white text-sm">
                                                  {(entity as IAMUser).accessKeys?.length || 0} active
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Permission Score */}
                                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-2 rounded-lg bg-purple-500/10">
                                              <Key className="w-4 h-4 text-purple-400" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-white">
                                              Permission Score {entity.riskAssessment?.permissionScore ? <span className="text-red-400">+{entity.riskAssessment.permissionScore}</span> : ''}
                                            </h4>
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                              <span className="text-gray-400 text-sm">Total Policies</span>
                                              <span className="text-white text-sm">{entity.policies.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-gray-400 text-sm">High Risk Policies</span>
                                              <span className="text-white text-sm">
                                                {entity.riskAssessment?.shadowPermissions.filter(p => p.severity === 'high').length || 0}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Identity Context Score */}
                                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-2 rounded-lg bg-green-500/10">
                                              <Shield className="w-4 h-4 text-green-400" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-white">
                                              Identity Context {entity.riskAssessment?.identityScore ? <span className="text-red-400">+{entity.riskAssessment.identityScore}</span> : ''}
                                            </h4>
                                          </div>
                                          <div className="space-y-2">
                                            {entity.type === 'user' && (
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-400 text-sm">MFA Status</span>
                                                <span className={`text-sm ${(entity as IAMUser).hasMFA ? 'text-green-400' : 'text-red-400'}`}>
                                                  {(entity as IAMUser).hasMFA ? 'Enabled' : 'Disabled'}
                                                </span>
                                              </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                              <span className="text-gray-400 text-sm">Account Age</span>
                                              <span className="text-white text-sm">
                                                {entity.createDate ? 
                                                  Math.floor((Date.now() - new Date(entity.createDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) + ' months' :
                                                  'N/A'
                                                }
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Shadow Permissions */}
                                    {entity.riskAssessment?.shadowPermissions && entity.riskAssessment.shadowPermissions.length > 0 && (
                                      <div className="p-6 rounded-xl bg-gradient-to-br from-[#1a1f28] to-[#23272f] border border-[#23272f]">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="p-2 rounded-lg bg-red-500/10">
                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                          </div>
                                          <h3 className="text-lg font-semibold text-white">Shadow Permissions</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                          {entity.riskAssessment.shadowPermissions.map((permission, i) => (
                                            <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                                  permission.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                                  permission.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                  'bg-green-500/20 text-green-400'
                                                }`}>
                                                  {permission.severity.toUpperCase()}
                                                </span>
                                                <span className="text-xs font-medium text-white">{permission.type}</span>
                                              </div>
                                              <p className="text-gray-300 text-sm mb-1">{permission.description}</p>
                                              <p className="text-gray-400 text-xs">{permission.details}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Score Calculation */}
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-[#1a1f28] to-[#23272f] border border-[#23272f]">
                                      <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded-lg bg-blue-500/10">
                                          <AlertCircle className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-white">Risk Score</h3>
                                      </div>
                                      <div className="space-y-4">
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                                          {(() => {
                                            const score = entity.riskAssessment?.score ?? 0;
                                            return (
                                              <>
                                                <div className="flex justify-between items-center">
                                                  <span className="text-sm text-gray-400">Current Score</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className={`text-lg font-bold ${
                                                      score <= 4 ? 'text-green-400' :
                                                      score <= 9 ? 'text-yellow-400' :
                                                      score <= 14 ? 'text-orange-400' :
                                                      'text-red-400'
                                                    }`}>
                                                      {score}
                                                    </span>
                                                    <span className="text-sm text-gray-400">
                                                      {score <= 4 ? '(Low Risk)' :
                                                       score <= 9 ? '(Medium Risk)' :
                                                       score <= 14 ? '(High Risk)' :
                                                       '(Critical Risk)'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">
                                                  Risk Levels: Low (≤4) • Medium (5-9) • High (10-14) • Critical ({'>'}14)
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
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