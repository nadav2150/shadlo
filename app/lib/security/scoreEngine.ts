import type { ShadowPermissionRisk, UserDetails } from "~/lib/iam/types";

interface SecurityScoreFactors {
  shadowPermissions: ShadowPermissionRisk[];
  users: UserDetails[];
  previousScore?: number; // For trend calculation
}

interface SecurityScore {
  score: number;
  trend: number;
  breakdown: {
    baseScore: number;
    highRiskDeduction: number;
    mediumRiskDeduction: number;
    userActivityImpact: number;
  };
}

// Constants for scoring
const SCORE_CONSTANTS = {
  BASE_SCORE: 100,
  HIGH_RISK_DEDUCTION: 10,
  MEDIUM_RISK_DEDUCTION: 5,
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  USER_ACTIVITY_WEIGHT: 0.1, // Weight for user activity impact
} as const;

export function calculateSecurityScore({
  shadowPermissions,
  users,
  previousScore,
}: SecurityScoreFactors): SecurityScore {
  // Initialize score components
  const breakdown = {
    baseScore: SCORE_CONSTANTS.BASE_SCORE,
    highRiskDeduction: 0,
    mediumRiskDeduction: 0,
    userActivityImpact: 0,
  };

  // Calculate risk-based deductions
  const highRiskCount = shadowPermissions.filter(p => p.severity === 'high').length;
  const mediumRiskCount = shadowPermissions.filter(p => p.severity === 'medium').length;
  
  breakdown.highRiskDeduction = highRiskCount * SCORE_CONSTANTS.HIGH_RISK_DEDUCTION;
  breakdown.mediumRiskDeduction = mediumRiskCount * SCORE_CONSTANTS.MEDIUM_RISK_DEDUCTION;

  // Calculate user activity impact
  // This is a simple implementation - you might want to make this more sophisticated
  const totalPermissions = shadowPermissions.length;
  const activeUsers = users.length;
  
  // If there are no permissions or users, we don't apply the user activity impact
  if (totalPermissions > 0 && activeUsers > 0) {
    const permissionsPerUser = totalPermissions / activeUsers;
    // Penalize if there are too many permissions per user (indicating potential permission sprawl)
    if (permissionsPerUser > 10) {
      breakdown.userActivityImpact = -5;
    } else if (permissionsPerUser > 5) {
      breakdown.userActivityImpact = -2;
    }
  }

  // Calculate final score
  let score = breakdown.baseScore - 
              breakdown.highRiskDeduction - 
              breakdown.mediumRiskDeduction + 
              breakdown.userActivityImpact;

  // Ensure score stays within bounds
  score = Math.max(SCORE_CONSTANTS.MIN_SCORE, Math.min(SCORE_CONSTANTS.MAX_SCORE, score));

  // Calculate trend
  let trend = 0;
  if (previousScore !== undefined) {
    trend = ((score - previousScore) / previousScore) * 100;
    // Round to 1 decimal place
    trend = Math.round(trend * 10) / 10;
  }

  return {
    score: Math.round(score),
    trend,
    breakdown,
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