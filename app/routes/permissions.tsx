import React from "react";
import { AlertTriangle, Key, User, Shield, ExternalLink, Lock, AlertCircle, AlertOctagon, Search, Filter, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Settings, Cloud, Mail } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useState, useMemo } from "react";
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
        console.log("AWS not connected or error:", await awsResponse.text());
      }
    } catch (error) {
      console.log("Error fetching AWS data:", error);
      // Continue without AWS data
    }

    // Validate Google credentials before attempting to fetch data
    const googleValidation = await validateGoogleCredentials(request);
    googleCredentialsValid = googleValidation.isValid;
    
    console.log("Debug - Google validation result:", {
      isValid: googleValidation.isValid,
      error: googleValidation.error
    });
    
    if (googleValidation.isValid) {
      // Try to fetch Google data only if credentials are valid
      try {
        const googleResponse = await fetch(`${baseUrl}/api/google-users`, {
          headers: {
            Cookie: cookieHeader || "",
          },
        });
        
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          console.log("Debug - Google API response successful:", {
            userCount: googleData.users?.length
          });
          
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
          const errorText = await googleResponse.text();
          console.log("Google API error:", errorText);
          googleCredentialsValid = false; // Mark as invalid if API call fails
        }
      } catch (error) {
        console.log("Error fetching Google users:", error);
        googleCredentialsValid = false; // Mark as invalid if fetch fails
      }
    } else {
      console.log("Google credentials validation failed:", googleValidation.error);
    }
    
    console.log("Debug - API Response:", { 
      hasAwsCredentials: !!awsData.credentials,
      awsUserCount: awsData.users?.length,
      awsRoleCount: awsData.roles?.length,
      googleUserCount: googleUsers.length,
      googleCredentialsValid
    });
    
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
      googleCredentialsValid
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
  const { users = [], roles = [], credentials, error, googleCredentialsValid } = useLoaderData<LoaderData>();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "user" | "role">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [providerFilter, setProviderFilter] = useState<"all" | "aws" | "google">("all");
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [riskFactorFilter, setRiskFactorFilter] = useState<string | null>(null);

  // Check which providers are connected
  const isAwsConnected = !!credentials?.accessKeyId;
  const isGoogleConnected = googleCredentialsValid && users.some(user => user.provider === 'google');
  const hasConnectedProviders = isAwsConnected || isGoogleConnected;

  // Format dates safely
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      // Check if date is Unix epoch (1970-01-01)
      if (date.getTime() === 0 || dateStr.startsWith('1970-01-01')) {
        return 'N/A';
      }
      return date.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  // Helper function to check if user is inactive (no activity for 90+ days)
  const isInactive = (lastUsed: string): boolean => {
    try {
      const lastUsedDate = new Date(lastUsed);
      const now = new Date();
      const daysSinceLastActivity = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastActivity >= 90; // Consider inactive after 90 days
    } catch {
      return false;
    }
  };

  // Helper function to get all unique risk factors from the data
  const getAllRiskFactors = () => {
    const riskFactors = new Map<string, { count: number; color: string; icon: any; label: string }>();
    
    // Add hardcoded risk factors that are always relevant
    const noMfaCount = users.filter(user => !user.hasMFA).length;
    if (noMfaCount > 0) {
      riskFactors.set('no-mfa', {
        count: noMfaCount,
        color: 'red',
        icon: Lock,
        label: 'No MFA'
      });
    }

    const neverLoggedInCount = users.filter(user => !user.lastUsed).length;
    if (neverLoggedInCount > 0) {
      riskFactors.set('never-logged-in', {
        count: neverLoggedInCount,
        color: 'orange',
        icon: User,
        label: 'Never Logged In'
      });
    }

    const noActivityCount = users.filter(user => user.lastUsed && isInactive(user.lastUsed)).length;
    if (noActivityCount > 0) {
      riskFactors.set('no-activity', {
        count: noActivityCount,
        color: 'yellow',
        icon: AlertCircle,
        label: 'No Activity'
      });
    }

    const adminAccessCount = users.filter(user => 
      user.provider === 'google' ? (user as GoogleUser).isAdmin : false
    ).length;
    if (adminAccessCount > 0) {
      riskFactors.set('admin-access', {
        count: adminAccessCount,
        color: 'purple',
        icon: Shield,
        label: 'Admin Access'
      });
    }

    const suspendedCount = users.filter(user => 
      user.provider === 'google' && (user as GoogleUser).riskAssessment?.factors?.some(factor => 
        factor.includes('suspended')
      )
    ).length;
    if (suspendedCount > 0) {
      riskFactors.set('suspended', {
        count: suspendedCount,
        color: 'gray',
        icon: AlertCircle,
        label: 'Suspended'
      });
    }

    const highRiskCount = allEntities.filter(entity => 
      entity.riskAssessment?.riskLevel === 'high' || entity.riskAssessment?.riskLevel === 'critical'
    ).length;
    if (highRiskCount > 0) {
      riskFactors.set('high-risk', {
        count: highRiskCount,
        color: 'red',
        icon: AlertTriangle,
        label: 'High Risk'
      });
    }

    // Extract dynamic risk factors from risk assessment factors
    const allEntitiesWithRiskFactors = [...users, ...roles].filter(entity => 
      entity.riskAssessment?.factors && entity.riskAssessment.factors.length > 0
    );

    allEntitiesWithRiskFactors.forEach(entity => {
      entity.riskAssessment?.factors?.forEach(factor => {
        // Clean up the factor text for better display
        const cleanFactor = factor.toLowerCase().trim();
        
        // Skip if it's already covered by hardcoded factors
        if (cleanFactor.includes('mfa') || cleanFactor.includes('2sv') || 
            cleanFactor.includes('never logged') || cleanFactor.includes('suspended') ||
            cleanFactor.includes('admin') || cleanFactor.includes('inactive')) {
          return;
        }

        // Create a key for the factor
        const factorKey = cleanFactor.replace(/[^a-z0-9]/g, '-');
        
        if (!riskFactors.has(factorKey)) {
          // Count how many entities have this factor
          const factorCount = allEntitiesWithRiskFactors.filter(e => 
            e.riskAssessment?.factors?.some(f => 
              f.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') === factorKey
            )
          ).length;

          if (factorCount > 0) {
            riskFactors.set(factorKey, {
              count: factorCount,
              color: 'blue', // Default color for dynamic factors
              icon: AlertTriangle,
              label: factor.charAt(0).toUpperCase() + factor.slice(1) // Capitalize first letter
            });
          }
        }
      });
    });

    return riskFactors;
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

  // Filter and sort entities
  const allEntities = useMemo(() => {
    let filtered = [...users, ...roles];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entity => {
        const name = entity.type === 'user' 
          ? getUserDisplayName(entity as IAMUser | GoogleUser)
          : (entity as IAMRole).roleName;
        return name.toLowerCase().includes(query);
      });
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(entity => entity.type === typeFilter);
    }

    // Apply risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(entity => entity.riskAssessment?.riskLevel === riskFilter);
    }

    // Apply provider filter
    if (providerFilter !== 'all') {
      filtered = filtered.filter(entity => entity.provider === providerFilter);
    }

    // Apply risk factor filter
    if (riskFactorFilter) {
      filtered = filtered.filter(entity => {
        switch (riskFactorFilter) {
          case 'no-mfa':
            return entity.type === 'user' && !(entity as IAMUser).hasMFA;
          case 'never-logged-in':
            return entity.type === 'user' && !entity.lastUsed;
          case 'no-activity':
            return entity.type === 'user' && entity.lastUsed && isInactive(entity.lastUsed);
          case 'admin-access':
            return entity.type === 'user' && entity.provider === 'google' && (entity as GoogleUser).isAdmin;
          case 'suspended':
            return entity.type === 'user' && entity.provider === 'google' && 
              (entity as GoogleUser).riskAssessment?.factors?.some(factor => factor.includes('suspended'));
          case 'high-risk':
            return entity.riskAssessment?.riskLevel === 'high' || entity.riskAssessment?.riskLevel === 'critical';
          default:
            // Handle dynamic risk factors
            if (riskFactorFilter.startsWith('dynamic-')) {
              const factorKey = riskFactorFilter.replace('dynamic-', '');
              return entity.riskAssessment?.factors?.some(factor => 
                factor.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') === factorKey
              ) || false;
            }
            return true;
        }
      });
    }

    // Sort entities
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.type === 'user' ? getUserDisplayName(a as IAMUser | GoogleUser) : (a as IAMRole).roleName;
          bValue = b.type === 'user' ? getUserDisplayName(b as IAMUser | GoogleUser) : (b as IAMRole).roleName;
          break;
        case 'created':
          aValue = a.createDate;
          bValue = b.createDate;
          break;
        case 'lastUsed':
          aValue = a.lastUsed;
          bValue = b.lastUsed;
          break;
        case 'mfa':
          if (a.type === 'user' && b.type === 'user') {
            aValue = (a as IAMUser).hasMFA;
            bValue = (b as IAMUser).hasMFA;
          } else {
            return 0;
          }
          break;
        case 'risk':
          aValue = a.riskAssessment?.riskLevel || 'low';
          bValue = b.riskAssessment?.riskLevel || 'low';
          break;
        case 'policies':
          aValue = a.policies?.length || 0;
          bValue = b.policies?.length || 0;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'provider':
          aValue = a.provider;
          bValue = b.provider;
          break;
        default:
          return 0;
      }

      if (sortField === 'created' || sortField === 'lastUsed') {
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [users, roles, searchQuery, typeFilter, riskFilter, providerFilter, riskFactorFilter, sortField, sortDirection]);

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

    // Check if Google credentials are invalid but we have Google users (from previous valid session)
    const hasGoogleUsers = users.some(user => user.provider === 'google');
    if (hasGoogleUsers && !googleCredentialsValid) {
      return (
        <div className="mb-6 bg-red-900/20 border border-red-500/20 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>Google credentials are invalid or expired. Please reconnect your Google account in the Settings page.</span>
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
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">Permissions</h1>
            <ConnectionStatus />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-gray-800 rounded-xl px-6 py-6 flex flex-col justify-center">
              <div className="mb-2">
                <span className="text-lg font-semibold text-white">Total Entities</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {hasConnectedProviders ? `${totalEntities} entities` : 'N/A'}
              </div>
            </div>
            <div className="bg-white/5 border border-gray-800 rounded-xl px-6 py-6 flex flex-col justify-center">
              <div className="mb-2">
                <span className="text-lg font-semibold text-white">Users</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {hasConnectedProviders ? `${users?.length || 0} users` : 'N/A'}
              </div>
            </div>
            <div className="bg-white/5 border border-gray-800 rounded-xl px-6 py-6 flex flex-col justify-center">
              <div className="mb-2">
                <span className="text-lg font-semibold text-white">Roles</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {hasConnectedProviders ? `${roles?.length || 0} roles` : 'N/A'}
              </div>
            </div>
            <div className="bg-white/5 border border-gray-800 rounded-xl px-6 py-6 flex flex-col justify-center">
              <div className="mb-2">
                <span className="text-lg font-semibold text-white">API Keys</span>
              </div>
              <div className="text-2xl font-extrabold text-white">
                {hasConnectedProviders ? `${totalAccessKeys} active keys` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users and roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "user" | "role")}
              className="px-4 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="user">Users</option>
              <option value="role">Roles</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as "all" | "low" | "medium" | "high" | "critical")}
              className="px-4 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as "all" | "aws" | "google")}
              className="px-4 py-2 bg-[#1a1f28] border border-[#23272f] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Providers</option>
              {isAwsConnected && <option value="aws">AWS</option>}
              {isGoogleConnected && <option value="google">Google</option>}
            </select>
          </div>

          {/* Quick Risk Factor Filters */}
          <div className="bg-[#1a1f28] border border-[#23272f] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Quick Risk Factor Filters</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(getAllRiskFactors().entries()).map(([key, factor]) => {
                const isActive = riskFactorFilter === key || riskFactorFilter === `dynamic-${key}`;
                const isDynamic = !['no-mfa', 'never-logged-in', 'no-activity', 'admin-access', 'suspended', 'high-risk'].includes(key);
                const filterKey = isDynamic ? `dynamic-${key}` : key;
                
                // Get color classes based on factor color
                const getColorClasses = (color: string, isActive: boolean) => {
                  const colorMap = {
                    red: isActive ? 'bg-red-900/50 border border-red-500/50 text-red-200' : 'bg-red-900/30 border border-red-500/30 text-red-300 hover:bg-red-900/50 hover:border-red-500/50',
                    orange: isActive ? 'bg-orange-900/50 border border-orange-500/50 text-orange-200' : 'bg-orange-900/30 border border-orange-500/30 text-orange-300 hover:bg-orange-900/50 hover:border-orange-500/50',
                    yellow: isActive ? 'bg-yellow-900/50 border border-yellow-500/50 text-yellow-200' : 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-900/50 hover:border-yellow-500/50',
                    purple: isActive ? 'bg-purple-900/50 border border-purple-500/50 text-purple-200' : 'bg-purple-900/30 border border-purple-500/30 text-purple-300 hover:bg-purple-900/50 hover:border-purple-500/50',
                    gray: isActive ? 'bg-gray-900/50 border border-gray-500/50 text-gray-200' : 'bg-gray-900/30 border border-gray-500/30 text-gray-300 hover:bg-gray-900/50 hover:border-gray-500/50',
                    blue: isActive ? 'bg-blue-900/50 border border-blue-500/50 text-blue-200' : 'bg-blue-900/30 border border-blue-500/30 text-blue-300 hover:bg-blue-900/50 hover:border-blue-500/50'
                  };
                  return colorMap[color as keyof typeof colorMap] || colorMap.blue;
                };

                const IconComponent = factor.icon;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSearchQuery('');
                      setTypeFilter('all');
                      setRiskFilter('all');
                      setProviderFilter('all');
                      setRiskFactorFilter(isActive ? null : filterKey);
                    }}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${getColorClasses(factor.color, isActive)}`}
                  >
                    <IconComponent className="w-3 h-3" />
                    {factor.label} ({factor.count})
                  </button>
                );
              })}

              {/* Clear Filters */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setRiskFilter('all');
                  setProviderFilter('all');
                  setRiskFactorFilter(null);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-900/30 border border-blue-500/30 rounded-full text-xs font-medium text-blue-300 hover:bg-blue-900/50 hover:border-blue-500/50 transition-colors"
              >
                <Filter className="w-3 h-3" />
                Clear All
              </button>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-[#1a1f28] border border-[#23272f] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#23272f]">
              <h2 className="text-xl font-semibold text-white">
                {hasConnectedProviders ? 'Identity Entities' : 'No Providers Connected'}
              </h2>
            </div>

            {/* Only show table if we have connected providers */}
            {hasConnectedProviders && (
              <div className="relative h-[calc(100vh-400px)] min-h-[500px]">
                <div className="absolute inset-0 overflow-auto 
                  [&::-webkit-scrollbar]:w-2 
                  [&::-webkit-scrollbar]:h-2
                  [&::-webkit-scrollbar-track]:bg-transparent 
                  [&::-webkit-scrollbar-thumb]:bg-gray-600 
                  [&::-webkit-scrollbar-thumb]:rounded-full 
                  [&::-webkit-scrollbar-thumb:hover]:bg-gray-500 
                  [&::-webkit-scrollbar-corner]:bg-transparent
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-track]:mx-1">
                  <table className="w-full text-base">
                    <thead className="sticky top-0 z-10 text-sm text-blue-300 uppercase bg-[#1a1f28] shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28]">Name</th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28]">Type</th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28]">Provider</th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28] cursor-pointer" onClick={() => handleSort('created')}>
                          <div className="flex items-center gap-1">
                            Created
                            {sortField === 'created' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28] cursor-pointer" onClick={() => handleSort('lastUsed')}>
                          <div className="flex items-center gap-1">
                            Last Used
                            {sortField === 'lastUsed' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28] cursor-pointer" onClick={() => handleSort('mfa')}>
                          <div className="flex items-center gap-1">
                            MFA
                            {sortField === 'mfa' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28] cursor-pointer" onClick={() => handleSort('risk')}>
                          <div className="flex items-center gap-1">
                            Risk Level
                            {sortField === 'risk' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-medium bg-[#1a1f28] cursor-pointer" onClick={() => handleSort('policies')}>
                          <div className="flex items-center gap-1">
                            Policies
                            {sortField === 'policies' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23272f]">
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
                        allEntities.map((entity) => {
                          const riskInfo = getRiskLevelInfo(entity?.riskAssessment?.riskLevel || 'low');
                          const entityName = entity.type === 'user' 
                            ? getUserDisplayName(entity as IAMUser | GoogleUser)
                            : (entity as IAMRole).roleName;
                          const entityId = entity.type === 'user'
                            ? (entity as IAMUser).userName || (entity as GoogleUser).primaryEmail
                            : (entity as IAMRole).roleName;

                          return (
                            <tr key={entityId} className="hover:bg-white/5">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {entity.type === 'user' ? (
                                    <User className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <Shield className="w-5 h-5 text-gray-400" />
                                  )}
                                  <a 
                                    href={entity.provider === 'google' 
                                      ? 'https://admin.google.com/ac/users'
                                      : entity.type === 'role'
                                        ? `https://us-east-1.console.aws.amazon.com/iam/home?region=us-east-1#/roles/${entityName}`
                                        : `https://console.aws.amazon.com/iam/home?region=us-east-1#/users/${entityName}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-white hover:text-blue-400 flex items-center gap-1"
                                  >
                                    {entityName}
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-gray-300 capitalize">{entity.type}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
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
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-gray-300">
                                  {formatDate(entity.createDate)}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-gray-300">
                                  {formatDate(entity.lastUsed)}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
                                  entity.type === 'user' && (entity as IAMUser).hasMFA ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
                                }`}>
                                  {entity.type === 'user' && (entity as IAMUser).hasMFA ? 'Enabled' : 'Disabled'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="group relative inline-block">
                                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded text-sm font-medium ${riskInfo.bgColor} cursor-help`}>
                                    <riskInfo.icon className={`w-4 h-4 ${riskInfo.color}`} />
                                    <span className={riskInfo.color}>{riskInfo.label}</span>
                                  </div>
                                  
                                  {/* Risk Factors Tooltip */}
                                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#1a1f28] border border-[#23272f] rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 max-h-[300px] overflow-y-auto 
                                    [&::-webkit-scrollbar]:w-1.5 
                                    [&::-webkit-scrollbar]:h-1.5
                                    [&::-webkit-scrollbar-track]:bg-transparent 
                                    [&::-webkit-scrollbar-thumb]:bg-gray-600 
                                    [&::-webkit-scrollbar-thumb]:rounded-full 
                                    [&::-webkit-scrollbar-thumb:hover]:bg-gray-500 
                                    [&::-webkit-scrollbar-corner]:bg-transparent
                                    [&::-webkit-scrollbar-track]:rounded-full
                                    [&::-webkit-scrollbar-track]:mx-1">
                                    <div className="text-sm space-y-3">
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
                              <td className="px-4 py-3 whitespace-nowrap">
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
                                            <div className="absolute left-0 top-full mt-1 w-64 bg-[#1a1f28] border border-[#23272f] rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 max-h-[300px] overflow-y-auto 
                                              [&::-webkit-scrollbar]:w-1.5 
                                              [&::-webkit-scrollbar]:h-1.5
                                              [&::-webkit-scrollbar-track]:bg-transparent 
                                              [&::-webkit-scrollbar-thumb]:bg-gray-600 
                                              [&::-webkit-scrollbar-thumb]:rounded-full 
                                              [&::-webkit-scrollbar-thumb:hover]:bg-gray-500 
                                              [&::-webkit-scrollbar-corner]:bg-transparent
                                              [&::-webkit-scrollbar-track]:rounded-full
                                              [&::-webkit-scrollbar-track]:mx-1">
                                              <div className="text-sm space-y-1">
                                                <div className="font-semibold text-white">{policy.name}</div>
                                                {policy.description && (
                                                  <div className="text-gray-400">{policy.description}</div>
                                                )}
                                                <div className="text-gray-500">
                                                  Created: {formatDate(policy.createDate)}
                                                </div>
                                                <div className="text-gray-500">
                                                  Updated: {formatDate(policy.updateDate)}
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
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 