import React from "react";
import { AlertTriangle, Key, User, Shield, ExternalLink, Lock, AlertCircle, AlertOctagon, Search, Filter, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useState, useMemo } from "react";

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
    factors: string[];
    shadowPermissions: {
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      details: string;
    }[];
  };
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
    
    // Make the request to the IAM API using the full URL and forwarding cookies
    const response = await fetch(`${baseUrl}/api/iam-entities`, {
      headers: {
        Cookie: cookieHeader || "",
      },
    });
    
    const data = await response.json();
    console.log("Debug - API Response:", { 
      status: response.status, 
      ok: response.ok, 
      hasCredentials: !!data.credentials,
      userCount: data.users?.length,
      roleCount: data.roles?.length
    });
    
    // Return the data even if response is not ok, but include the error
    return json<LoaderData>({ 
      users: data.users || [], 
      roles: data.roles || [],
      credentials: data.credentials || null,
      error: data.error || null
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
    default:
      // Default to AWS if provider is undefined or unknown
      return {
        icon: '/amazon-aws.svg',
        label: 'AWS',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10'
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Debug log to check what data we have
  console.log("Debug - Component Data:", {
    hasCredentials: !!credentials,
    userCount: users.length,
    roleCount: roles.length,
    error
  });

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
          return modifier * (new Date(a.createDate).getTime() - new Date(b.createDate).getTime());
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
  const totalAccessKeys = users?.reduce((acc, user) => acc + (user?.accessKeys?.length || 0), 0) || 0;
  const totalEntities = (users?.length || 0) + (roles?.length || 0);

  // Helper function to render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  // Helper function to render credential status
  const CredentialStatus = () => {
    if (!credentials) {
      return (
        <div className="mb-6 bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="w-5 h-5" />
            <span>AWS credentials not found. Please add your credentials in the Settings page.</span>
          </div>
        </div>
      );
    }
    return null;
  };

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

  return (
    <div className="flex flex-col h-screen bg-[#181C23]">
      {/* Header Section - Fixed height */}
      <div className="flex-none p-8 pt-6">
        <h1 className="text-4xl font-bold text-white leading-tight">Permissions Analysis</h1>
        <p className="text-gray-400 text-base mt-1">Detailed view of IAM users, roles, and access patterns</p>
        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}
        {!credentials && !error && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <span>AWS credentials not found. Please add your credentials in the Settings page.</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards - Fixed height */}
      <div className="flex-none px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-6">
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">Total Entities</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {credentials ? `${totalEntities} IAM entities` : 'N/A'}
            </div>
          </div>
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">IAM Users</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {credentials ? `${users?.length || 0} users` : 'N/A'}
            </div>
          </div>
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">IAM Roles</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {credentials ? `${roles?.length || 0} roles` : 'N/A'}
            </div>
          </div>
          <div className="bg-[#181C23] border border-[#23272f] rounded-xl px-8 py-8 flex flex-col justify-center w-full min-h-[140px]">
            <div className="mb-4">
              <span className="text-lg font-semibold text-white">API Keys</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-1">
              {credentials ? `${totalAccessKeys} active API keys` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Table Section - Flexible height */}
      <div className="flex-1 px-8 pb-8 min-h-0">
        <div className="h-full flex flex-col">
          <div className="flex-none mb-4">
            <h2 className="text-2xl font-bold text-white">IAM Entities</h2>
          </div>

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
          
          <div className="flex-1 relative bg-[#181C23] rounded-xl border border-[#23272f] overflow-hidden">
            <div className="absolute inset-0 overflow-auto">
              <table className="w-full text-lg text-left">
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
                <tbody className="divide-y divide-[#23272f]">
                  {!credentials && !error ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="w-8 h-8 text-yellow-500" />
                          <span>Connect your AWS account to view IAM entities</span>
                          <button 
                            onClick={() => window.location.href = '/providers'}
                            className="mt-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                          >
                            Go to Settings
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
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
                        No IAM entities found
                      </td>
                    </tr>
                  ) : (
                    allEntities.map((entity, index) => {
                      const riskInfo = getRiskLevelInfo(entity?.riskAssessment?.riskLevel || 'low');
                      const RiskIcon = riskInfo.icon;
                      const providerInfo = getProviderInfo(entity.provider);
                      const ProviderIcon = providerInfo.icon;
                      const entityId = entity.type === 'user' ? (entity as IAMUser).userName : (entity as IAMRole).roleName;
                      const isExpanded = expandedRows.has(entityId);

                      return (
                        <React.Fragment key={entityId}>
                          <tr className="border-b border-[#23272f] hover:bg-[#1a1f28]/50 transition-colors">
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-400" />
                                <span className="text-blue-400">User</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <img 
                                  src={providerInfo.icon}
                                  alt={providerInfo.label}
                                  className="w-8 h-8 invert brightness-0"
                                />
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
                              {entity?.createDate ? new Date(entity.createDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-gray-300">
                              {entity?.lastUsed 
                                ? new Date(entity.lastUsed).toLocaleDateString()
                                : "Never"
                              }
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
                                        {entity?.riskAssessment?.factors.map((factor, i) => (
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
                                <div className="space-y-4">
                                  {/* Score Breakdown */}
                                  <div className="grid grid-cols-3 gap-4">
                                    {/* Activity Score */}
                                    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                      <h4 className="text-sm font-semibold text-white mb-2">Activity Score</h4>
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-400 text-sm">Last Activity</span>
                                          <span className="text-white text-sm">
                                            {entity.lastUsed ? new Date(entity.lastUsed).toLocaleDateString() : 'Never'}
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
                                      <h4 className="text-sm font-semibold text-white mb-2">Permission Score</h4>
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
                                      <h4 className="text-sm font-semibold text-white mb-2">Identity Context</h4>
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
                                            {Math.floor((Date.now() - new Date(entity.createDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Shadow Permissions */}
                                  {entity.riskAssessment?.shadowPermissions && entity.riskAssessment.shadowPermissions.length > 0 && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-semibold text-white mb-3">Shadow Permissions</h4>
                                      <div className="grid grid-cols-2 gap-4">
                                        {entity.riskAssessment.shadowPermissions.map((permission, i) => (
                                          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
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
                                            <p className="text-gray-300 text-xs">{permission.description}</p>
                                            <p className="text-gray-400 text-xs mt-1">{permission.details}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Score Calculation */}
                                  <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
                                    <h4 className="text-sm font-semibold text-white mb-2">Score Calculation</h4>
                                    <div className="space-y-2 text-sm text-gray-300">
                                      <p>The risk score is calculated based on three main factors:</p>
                                      <ul className="list-disc list-inside space-y-1 ml-2">
                                        <li>Activity Score (30%): Based on last activity and access key usage</li>
                                        <li>Permission Score (40%): Based on policy complexity and high-risk permissions</li>
                                        <li>Identity Context (30%): Based on MFA status and account age</li>
                                      </ul>
                                      <p className="mt-2">Final Score: {entity.riskAssessment?.score || 0}/100</p>
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
          </div>
        </div>
      </div>
    </div>
  );
} 