import type { UserDetails, RoleDetails, ShadowPermissionRisk } from "~/lib/iam/types";

export interface DashboardData {
  credentials: {
    aws: any;
    google: any;
  };
  users: UserDetails[];
  roles: RoleDetails[];
  scoreHistory: Array<{
    date: string;
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  error: string | null;
  googleCredentialsValid: boolean;
  hasGoogleRefreshToken: boolean;
  refreshTokenValid: boolean;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch('/api/dashboard', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
  }

  return response.json();
}

// For now, use the main dashboard endpoint for all data
export async function fetchScoreHistory(): Promise<DashboardData['scoreHistory']> {
  const data = await fetchDashboardData();
  return data.scoreHistory;
}

// For now, use the main dashboard endpoint for all data
export async function fetchStatsData(): Promise<{
  users: UserDetails[];
  roles: RoleDetails[];
  shadowPermissions: ShadowPermissionRisk[];
}> {
  const data = await fetchDashboardData();
  // Calculate shadow permissions here since we have the data
  const { calculateRiskScore } = await import("~/lib/iam/risk-assessment");
  
  const shadowPermissions: ShadowPermissionRisk[] = [
    ...data.users.map((user: UserDetails) => calculateRiskScore(user).shadowPermissions || []),
    ...data.roles.map((role: RoleDetails) => calculateRiskScore(role).shadowPermissions || [])
  ]
    .flat()
    .filter((permission, index, self) => 
      index === self.findIndex(p => 
        p.type === permission.type && 
        p.details.includes(permission.details.split('"')[1])
      )
    ) as ShadowPermissionRisk[];

  return {
    users: data.users,
    roles: data.roles,
    shadowPermissions,
  };
} 