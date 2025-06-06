import type { UserDetails, RoleDetails } from "~/lib/iam/types";

interface SecurityScore {
  overallScore: number;  // 0-100, where 100 is most secure
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    category: string;
    score: number;
    details: string[];
  }[];
  recommendations: string[];
}

function calculateEntityScores(entities: (UserDetails | RoleDetails)[]): {
  lastUsedScore: number;
  permissionScore: number;
  identityScore: number;
  totalEntities: number;
} {
  let totalLastUsedScore = 0;
  let totalPermissionScore = 0;
  let totalIdentityScore = 0;
  const totalEntities = entities.length;

  entities.forEach(entity => {
    // Last Used Score (0-5 points per entity)
    if (!entity.lastUsed) {
      totalLastUsedScore += 5; // No last used date
    } else {
      const lastUsedDate = new Date(entity.lastUsed);
      const now = new Date();
      const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysAgo <= 30) totalLastUsedScore += 0;
      else if (daysAgo <= 90) totalLastUsedScore += 2;
      else if (daysAgo <= 180) totalLastUsedScore += 3;
      else totalLastUsedScore += 5;
    }

    // Permission Score (0-5 points per entity)
    let maxPermissionScore = 0;
    for (const policy of entity.policies) {
      const policyName = policy.name.toLowerCase();
      
      // Check for admin, wildcard, or full access patterns (5 points)
      if (policyName.includes('administrator') || 
          policyName.includes('fullaccess') || 
          policyName.includes('full_access') ||
          policyName.includes('*')) {
        maxPermissionScore = Math.max(maxPermissionScore, 5);
      }
      // Check for write access patterns (2 points)
      else if (policyName.includes('write') || 
               policyName.includes('modify') || 
               policyName.includes('update') ||
               policyName.includes('create') ||
               policyName.includes('delete')) {
        maxPermissionScore = Math.max(maxPermissionScore, 2);
      }
    }
    totalPermissionScore += maxPermissionScore;

    // Identity Context Score (0-5 points per entity)
    if ('type' in entity && entity.type === 'role') {
      // For roles
      if (!entity.trustPolicy) {
        totalIdentityScore += 5; // Orphaned role
      } else {
        try {
          const trustPolicy = JSON.parse(decodeURIComponent(entity.trustPolicy));
          if (!trustPolicy.Statement || 
              !trustPolicy.Statement.some((stmt: any) => 
                stmt.Principal && 
                (stmt.Principal.Service || stmt.Principal.AWS || stmt.Principal.Federated)
              )) {
            totalIdentityScore += 5; // Role with no trusted entities
          }
        } catch (e) {
          totalIdentityScore += 5; // Invalid trust policy
        }
      }
    } else {
      // For users
      const user = entity as UserDetails;
      const isOrphaned = (!user.accessKeys || user.accessKeys.length === 0 || 
                         user.accessKeys.every(key => key.status === 'Inactive')) &&
                         !user.hasMFA && 
                         !user.lastUsed;
      
      const isInactive = !user.lastUsed || 
                        (() => {
                          const lastUsedDate = new Date(user.lastUsed!);
                          const now = new Date();
                          const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
                          return daysAgo > 90;
                        })() ||
                        (user.accessKeys && user.accessKeys.every(key => key.status === 'Inactive'));

      if (isOrphaned) totalIdentityScore += 5;
      else if (isInactive) totalIdentityScore += 3;
    }
  });

  return {
    lastUsedScore: totalLastUsedScore / totalEntities,
    permissionScore: totalPermissionScore / totalEntities,
    identityScore: totalIdentityScore / totalEntities,
    totalEntities
  };
}

function generateRecommendations(scores: {
  lastUsedScore: number;
  permissionScore: number;
  identityScore: number;
  totalEntities: number;
}): string[] {
  const recommendations: string[] = [];

  // Last Used Score recommendations
  if (scores.lastUsedScore >= 3) {
    recommendations.push("Review and remove unused IAM entities (no activity in 90+ days)");
  } else if (scores.lastUsedScore >= 2) {
    recommendations.push("Monitor IAM entities with no recent activity (31-90 days)");
  }

  // Permission Score recommendations
  if (scores.permissionScore >= 4) {
    recommendations.push("Review and reduce excessive permissions (administrator/full access)");
  } else if (scores.permissionScore >= 2) {
    recommendations.push("Audit write/modify permissions and implement least privilege");
  }

  // Identity Context Score recommendations
  if (scores.identityScore >= 4) {
    recommendations.push("Address orphaned roles and users (no trust policy or inactive access keys)");
  } else if (scores.identityScore >= 2) {
    recommendations.push("Enable MFA for users and review inactive accounts");
  }

  return recommendations;
}

export function calculateSecurityScore(users: UserDetails[], roles: RoleDetails[]): SecurityScore {
  const allEntities = [...users, ...roles];
  const scores = calculateEntityScores(allEntities);

  // Calculate weighted average score (0-100)
  // Weights: Last Used (30%), Permissions (40%), Identity Context (30%)
  const weightedScore = 100 - (
    (scores.lastUsedScore * 0.30) +
    (scores.permissionScore * 0.40) +
    (scores.identityScore * 0.30)
  ) * (100 / 5); // Convert from 0-5 scale to 0-100

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (weightedScore >= 80) riskLevel = 'low';
  else if (weightedScore >= 60) riskLevel = 'medium';
  else if (weightedScore >= 40) riskLevel = 'high';
  else riskLevel = 'critical';

  // Generate factors
  const factors = [
    {
      category: "Activity Score",
      score: 100 - (scores.lastUsedScore * (100 / 5)),
      details: [
        `Average last used score: ${scores.lastUsedScore.toFixed(1)}/5`,
        scores.lastUsedScore >= 3 ? "High number of inactive entities" : 
        scores.lastUsedScore >= 2 ? "Some entities showing inactivity" : 
        "Good activity levels across entities"
      ]
    },
    {
      category: "Permission Score",
      score: 100 - (scores.permissionScore * (100 / 5)),
      details: [
        `Average permission score: ${scores.permissionScore.toFixed(1)}/5`,
        scores.permissionScore >= 4 ? "Excessive permissions detected" :
        scores.permissionScore >= 2 ? "Moderate permission levels" :
        "Good permission management"
      ]
    },
    {
      category: "Identity Context Score",
      score: 100 - (scores.identityScore * (100 / 5)),
      details: [
        `Average identity context score: ${scores.identityScore.toFixed(1)}/5`,
        scores.identityScore >= 4 ? "Critical identity management issues" :
        scores.identityScore >= 2 ? "Identity management needs improvement" :
        "Good identity management practices"
      ]
    }
  ];

  return {
    overallScore: Math.round(weightedScore),
    riskLevel,
    factors,
    recommendations: generateRecommendations(scores)
  };
}

// Helper function to get a color class based on score
export function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

// Helper function to get a color class based on trend
export function getTrendColorClass(trend: number): string {
  if (trend > 0) return 'text-green-400';
  if (trend < 0) return 'text-red-400';
  return 'text-gray-400';
} 