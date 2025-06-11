import type { UserDetails, RoleDetails, Policy } from './types';
import { HIGH_RISK_PATTERNS, MEDIUM_RISK_PATTERNS } from './constants';

interface RiskScore {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  lastUsedScore: number;
  permissionScore: number;
  identityScore: number;
  factors: string[];
  shadowPermissions: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: string;
  }[];
}

function calculateLastUsedScore(entity: UserDetails | RoleDetails): number {
  // For roles, use the existing logic
  if ('type' in entity && entity.type === 'role') {
    if (!entity.lastUsed) return 5; // No last used date means high risk
    
    const lastUsedDate = new Date(entity.lastUsed);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAgo <= 30) return 0;
    if (daysAgo <= 90) return 2;
    if (daysAgo <= 180) return 3;
    return 5;
  }

  // For users, check both user lastUsed and API key usage
  const user = entity as UserDetails;
  
  // Get the most recent activity date from either user lastUsed or API key usage
  let mostRecentActivity: Date | null = null;
  
  // Check user lastUsed
  if (user.lastUsed) {
    mostRecentActivity = new Date(user.lastUsed);
  }
  
  // Check API key usage
  if (user.accessKeys && user.accessKeys.length > 0) {
    const validLastUsedDates = user.accessKeys
      .filter(key => key.lastUsed)
      .map(key => new Date(key.lastUsed!))
      .filter(date => !isNaN(date.getTime()));
    
    if (validLastUsedDates.length > 0) {
      const mostRecentApiUsage = new Date(Math.max(...validLastUsedDates.map(date => date.getTime())));
      if (!mostRecentActivity || mostRecentApiUsage > mostRecentActivity) {
        mostRecentActivity = mostRecentApiUsage;
      }
    }
  }
  
  // If no activity found, return high risk
  if (!mostRecentActivity) return 5;
  
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - mostRecentActivity.getTime()) / (1000 * 60 * 60 * 24));

  if (daysAgo <= 30) return 0;
  if (daysAgo <= 90) return 2;
  if (daysAgo <= 180) return 3;
  return 5;
}

function calculatePermissionLevelScore(policies: Policy[]): number {
  let maxScore = 0;

  for (const policy of policies) {
    const policyName = policy.name.toLowerCase();
    
    // Check for admin, wildcard, or full access patterns (5 points)
    if (policyName.includes('administrator') || 
        policyName.includes('fullaccess') || 
        policyName.includes('full_access') ||
        policyName.includes('*') ||
        HIGH_RISK_PATTERNS.some(pattern => policyName.includes(pattern.toLowerCase()))) {
      maxScore = Math.max(maxScore, 5);
    }
    // Check for write access patterns (2 points)
    else if (policyName.includes('write') || 
             policyName.includes('modify') || 
             policyName.includes('update') ||
             policyName.includes('create') ||
             policyName.includes('delete')) {
      maxScore = Math.max(maxScore, 2);
    }
    // Read-only access is 0 points
  }

  return maxScore;
}

function calculateIdentityContextScore(entity: UserDetails | RoleDetails): number {
  if ('type' in entity && entity.type === 'role') {
    // For roles, we need to check multiple factors to determine status
    let isOrphaned = false;
    
    // Parse trust policy if it exists
    if (entity.trustPolicy) {
      try {
        const trustPolicy = JSON.parse(decodeURIComponent(entity.trustPolicy));
        isOrphaned = !trustPolicy.Statement || 
                    !trustPolicy.Statement.some((stmt: any) => 
                      stmt.Principal && 
                      (stmt.Principal.Service || stmt.Principal.AWS || stmt.Principal.Federated)
                    );
      } catch (e) {
        // If we can't parse the trust policy, consider it orphaned
        isOrphaned = true;
      }
    } else {
      isOrphaned = true;
    }
    
    // Check if role is inactive by looking at last used date
    const isInactive = !entity.lastUsed || 
                      (() => {
                        const lastUsedDate = new Date(entity.lastUsed!);
                        const now = new Date();
                        const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
                        return daysAgo > 90;
                      })();

    if (isOrphaned) {
      return 5; // Orphaned role (no trust policy or no trusted entities)
    }
    if (isInactive) {
      return 3; // Inactive role (no activity in 90+ days)
    }
    return 0; // Active role
  }

  // For users
  const user = entity as UserDetails;
  
  // A user is considered orphaned if:
  // 1. No access keys or all keys are inactive
  // 2. No MFA configured
  // 3. No last used date AND no API key activity
  const hasApiKeyActivity = user.accessKeys && user.accessKeys.some(key => key.lastUsed);
  const isOrphaned = (!user.accessKeys || user.accessKeys.length === 0 || 
                     user.accessKeys.every(key => key.status === 'Inactive')) &&
                     !user.hasMFA && 
                     !user.lastUsed && !hasApiKeyActivity;

  // A user is considered inactive if:
  // 1. No activity in 90+ days (considering both user lastUsed and API key usage)
  // 2. All access keys are inactive
  let mostRecentActivity: Date | null = null;
  
  // Check user lastUsed
  if (user.lastUsed) {
    mostRecentActivity = new Date(user.lastUsed);
  }
  
  // Check API key usage
  if (user.accessKeys && user.accessKeys.length > 0) {
    const validLastUsedDates = user.accessKeys
      .filter(key => key.lastUsed)
      .map(key => new Date(key.lastUsed!))
      .filter(date => !isNaN(date.getTime()));
    
    if (validLastUsedDates.length > 0) {
      const mostRecentApiUsage = new Date(Math.max(...validLastUsedDates.map(date => date.getTime())));
      if (!mostRecentActivity || mostRecentApiUsage > mostRecentActivity) {
        mostRecentActivity = mostRecentApiUsage;
      }
    }
  }
  
  const isInactive = !mostRecentActivity || 
                    (() => {
                      const now = new Date();
                      const daysAgo = Math.floor((now.getTime() - mostRecentActivity!.getTime()) / (1000 * 60 * 60 * 24));
                      return daysAgo > 90;
                    })() ||
                    (user.accessKeys && user.accessKeys.every(key => key.status === 'Inactive'));

  if (isOrphaned) {
    return 5; // Orphaned user
  }
  if (isInactive) {
    return 3; // Inactive user
  }
  return 0; // Active user
}

function generateRiskFactors(
  lastUsedScore: number,
  permissionScore: number,
  identityScore: number,
  entity: UserDetails | RoleDetails
): string[] {
  const factors: string[] = [];

  // Last used factors
  if (lastUsedScore > 0) {
    if (lastUsedScore === 5) {
      factors.push('No activity');
    } else if (lastUsedScore === 3) {
      factors.push('No activity in 91-180 days');
    } else if (lastUsedScore === 2) {
      factors.push('No activity in 31-90 days');
    }
  }

  // Permission level factors
  if (permissionScore === 5) {
    factors.push('full access permissions');
  } else if (permissionScore === 2) {
    factors.push('Has write/modify permissions');
  }

  // Identity context factors
  if ('hasMFA' in entity) {  // Check for hasMFA property to identify users
    const user = entity as UserDetails;
    if (identityScore === 5) {
      if (!user.accessKeys || user.accessKeys.length === 0) {
        factors.push('Orphaned entity');
      } else if (user.accessKeys.every(key => key.status === 'Inactive')) {
        factors.push('All access keys are inactive');
      }
      if ('userName' in entity && !user.hasMFA) {
        factors.push('MFA is not enabled');
      }
    } else if (identityScore === 3) {
      // Check if user has any API key activity before showing "never been used"
      const hasApiKeyActivity = user.accessKeys && user.accessKeys.some(key => key.lastUsed);
      
      if (!user.lastUsed && !hasApiKeyActivity) {
        factors.push('User has never been used');
      } else if (user.lastUsed) {
        const lastUsedDate = new Date(user.lastUsed);
        const now = new Date();
        const daysAgo = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo > 90) {
          factors.push('User is inactive (no activity in 90+ days)');
        }
      }
      if (user.accessKeys && user.accessKeys.every(key => key.status === 'Inactive')) {
        factors.push('Orphaned entity');
      }
    }
  } else {  // This must be a role
    const role = entity as RoleDetails;
    if (identityScore === 5) {
      if (!role.trustPolicy) {
        factors.push('Role has no trust policy');
      } else {
        try {
          const trustPolicy = JSON.parse(decodeURIComponent(role.trustPolicy));
          if (!trustPolicy.Statement || 
              !trustPolicy.Statement.some((stmt: any) => 
                stmt.Principal && 
                (stmt.Principal.Service || stmt.Principal.AWS || stmt.Principal.Federated)
              )) {
            factors.push('Role has no trusted entities in trust policy');
          }
        } catch (e) {
          factors.push('Role has invalid trust policy');
        }
      }
    } else if (identityScore === 3) {
      factors.push('Role is inactive (no activity in 90+ days)');
    }
  }

  return factors;
}

function determineRiskLevel(totalScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (totalScore <= 4) return 'low';
  if (totalScore <= 9) return 'medium';
  if (totalScore <= 14) return 'high';
  return 'critical';
}

function getRiskLevelDescription(riskLevel: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (riskLevel) {
    case 'low':
      return 'No action needed. Permission is considered safe.';
    case 'medium':
      return 'Review the permission. It may be unnecessary or outdated.';
    case 'high':
      return 'Investigate. This permission may pose a significant security risk.';
    case 'critical':
      return 'Immediate action required. The permission is highly risky and should be removed or corrected.';
  }
}

export function calculateRiskScore(entity: UserDetails | RoleDetails): RiskScore {
  // Calculate individual scores
  const lastUsedScore = calculateLastUsedScore(entity);
  const permissionScore = calculatePermissionLevelScore(entity.policies);
  const identityScore = calculateIdentityContextScore(entity);

  // Calculate total score
  const totalScore = lastUsedScore + permissionScore + identityScore;

  // Generate risk factors
  const factors = generateRiskFactors(lastUsedScore, permissionScore, identityScore, entity);

  // Determine risk level
  const riskLevel = determineRiskLevel(totalScore);

  // Generate shadow permissions
  const shadowPermissions = entity.policies
    .filter(policy => {
      const policyName = policy.name.toLowerCase();
      return HIGH_RISK_PATTERNS.some(pattern => policyName.includes(pattern.toLowerCase())) ||
             MEDIUM_RISK_PATTERNS.some(pattern => policyName.includes(pattern.toLowerCase()));
    })
    .map(policy => {
      const policyName = policy.name.toLowerCase();
      const isHighRisk = HIGH_RISK_PATTERNS.some(pattern => policyName.includes(pattern.toLowerCase()));
      const severity: 'low' | 'medium' | 'high' | 'critical' = isHighRisk ? 'high' : 'medium';
      
      return {
        type: isHighRisk ? 'excessive_permissions' : 'unused_service',
        description: isHighRisk ? 'High-risk permissions detected' : 'Medium-risk permissions detected',
        severity,
        details: `Policy "${policy.name}" grants ${isHighRisk ? 'excessive' : 'potentially unnecessary'} permissions. ${getRiskLevelDescription(severity)}`
      };
    });

  return {
    riskLevel,
    score: totalScore,
    lastUsedScore,
    permissionScore,
    identityScore,
    factors,
    shadowPermissions
  };
} 