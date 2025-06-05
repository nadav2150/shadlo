import { UserDetails, RiskAssessment, ShadowPermissionRisk } from './types';
import { RISK_FACTORS, HIGH_RISK_PATTERNS, MEDIUM_RISK_PATTERNS, SHADOW_PERMISSION_PATTERNS } from './constants';

export function calculateRiskScore(user: UserDetails): RiskAssessment {
  const factors: string[] = [];
  let score = 0;
  const shadowPermissions: ShadowPermissionRisk[] = [];

  // Check for unused account (shadow access) - This is now a critical risk
  const lastUsed = user.lastUsed ? new Date(user.lastUsed) : null;
  const now = new Date();
  const accountAge = (now.getTime() - new Date(user.createDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const monthsSinceLastUse = lastUsed ? 
    (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24 * 30) : 
    accountAge; // If never used, use the account age

  if (!lastUsed || (monthsSinceLastUse && monthsSinceLastUse > 3)) {
    score += RISK_FACTORS.UNUSED_ACCOUNT * 2; // Double the score for unused accounts
    const message = !lastUsed ? 
      `Account has never been used `:
      `Account unused for ${Math.round(monthsSinceLastUse)} months`;
    factors.push(message);
    shadowPermissions.push({
      type: 'unused_account',
      description: 'Unused Account - CRITICAL',
      severity: 'high',
      details: !lastUsed ?
        `Account has never been used since creation (${Math.round(accountAge)} months ago). This is a critical security risk as unused accounts should be removed.` :
        `Account has not been used for ${Math.round(monthsSinceLastUse)} months. This is a critical security risk as unused accounts should be removed.`
    });
  }

  // Check MFA status
  if (!user.hasMFA) {
    score += RISK_FACTORS.MFA_DISABLED;
    factors.push('MFA is not enabled');
  }

  // Check for admin access
  const hasAdminAccess = user.policies.some(policy => 
    policy.name === 'AdministratorAccess' || 
    policy.name.includes('Administrator')
  );
  if (hasAdminAccess) {
    score += RISK_FACTORS.ADMIN_ACCESS;
    factors.push('Has administrator access');
  }

  // Check for power user access
  const hasPowerUserAccess = user.policies.some(policy => 
    policy.name === 'PowerUserAccess' || 
    policy.name.includes('PowerUser')
  );
  if (hasPowerUserAccess) {
    score += RISK_FACTORS.POWER_USER_ACCESS;
    factors.push('Has power user access');
  }

  // Check for full service access
  const fullServiceAccess = user.policies.filter(policy => 
    HIGH_RISK_PATTERNS.some(pattern => policy.name.includes(pattern))
  );
  if (fullServiceAccess.length > 0) {
    score += RISK_FACTORS.FULL_SERVICE_ACCESS;
    factors.push(`Has full access to ${fullServiceAccess.length} services`);
  }

  // Check for inline policies
  const inlinePolicies = user.policies.filter(policy => policy.type === 'inline');
  if (inlinePolicies.length > 0) {
    score += RISK_FACTORS.INLINE_POLICIES;
    factors.push(`Has ${inlinePolicies.length} inline policies`);
  }

  // Check for old access keys (shadow access)
  if (user.accessKeys) {
    const oldKeys = user.accessKeys.filter(key => {
      const keyAge = (now.getTime() - new Date(key.createDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      return keyAge > 6; // Keys older than 6 months
    });

    if (oldKeys.length > 0) {
      score += RISK_FACTORS.OLD_ACCESS_KEY;
      factors.push(`Has ${oldKeys.length} old access keys`);
      shadowPermissions.push({
        type: 'old_access',
        description: 'Old Access Keys',
        severity: 'medium',
        details: `${oldKeys.length} access keys are older than 6 months`
      });
    }
  }

  // Check for forgotten policies (shadow access)
  const forgottenPolicies = user.policies.filter(policy => {
    const policyAge = (now.getTime() - new Date(policy.updateDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return policyAge > 12; // Policies not updated in 12 months
  });

  if (forgottenPolicies.length > 0) {
    score += RISK_FACTORS.FORGOTTEN_POLICY;
    factors.push(`${forgottenPolicies.length} policies not reviewed in over a year`);
    shadowPermissions.push({
      type: 'forgotten_policy',
      description: 'Forgotten Policies',
      severity: 'high',
      details: `${forgottenPolicies.length} policies haven't been reviewed in over a year`
    });
  }

  // Check for unused service access (shadow access)
  const unusedServices = user.policies.filter(policy => 
    SHADOW_PERMISSION_PATTERNS.UNUSED_SERVICES.some(service => 
      policy.name.includes(service)
    )
  );

  if (unusedServices.length > 0) {
    score += RISK_FACTORS.UNUSED_SERVICE;
    factors.push(`Has access to ${unusedServices.length} unused services`);
    shadowPermissions.push({
      type: 'unused_service',
      description: 'Unused Service Access',
      severity: 'medium',
      details: `Has access to ${unusedServices.length} services that appear to be unused`
    });
  }

  // Check for legacy policies (shadow access)
  const legacyPolicies = user.policies.filter(policy => 
    SHADOW_PERMISSION_PATTERNS.LEGACY_POLICIES.includes(policy.name)
  );

  if (legacyPolicies.length > 0) {
    score += RISK_FACTORS.LEGACY_POLICY;
    factors.push(`Has ${legacyPolicies.length} legacy policies`);
    shadowPermissions.push({
      type: 'legacy_policy',
      description: 'Legacy Policies',
      severity: 'medium',
      details: `${legacyPolicies.length} legacy policies that should be reviewed`
    });
  }

  // Check for excessive permissions
  const totalPolicies = user.policies.length;
  if (totalPolicies > 5) {
    score += RISK_FACTORS.EXCESSIVE_PERMISSIONS;
    factors.push(`Has ${totalPolicies} total policies`);
    shadowPermissions.push({
      type: 'excessive_permissions',
      description: 'Excessive Permissions',
      severity: 'high',
      details: `User has ${totalPolicies} policies, which may indicate excessive permissions`
    });
  }

  // Calculate risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (!lastUsed || (monthsSinceLastUse && monthsSinceLastUse > 3)) {
    // If account has never been used or unused for more than 3 months, it's automatically high risk
    riskLevel = 'high';
  } else if (score >= 8) {
    riskLevel = 'high';
  } else if (score >= 4) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskLevel,
    score,
    factors,
    shadowPermissions
  };
} 