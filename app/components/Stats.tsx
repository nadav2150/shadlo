import { useLoaderData } from "@remix-run/react";
import type { ShadowPermissionRisk, UserDetails } from "~/lib/iam/types";
import { calculateSecurityScore, getScoreColorClass, getTrendColorClass } from "~/lib/security/scoreEngine";

interface StatsProps {
  shadowPermissions: ShadowPermissionRisk[];
  users: UserDetails[];
  previousScore?: number; // Add this prop for trend calculation
}

export function Stats({ shadowPermissions, users, previousScore }: StatsProps) {
  const { score, trend, breakdown } = calculateSecurityScore({
    shadowPermissions,
    users,
    previousScore,
  });
  
  const highRiskCount = shadowPermissions.filter(p => p.severity === 'high').length;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className={`text-3xl font-bold ${getScoreColorClass(score)}`}>
          {score}%
        </span>
        <span className="text-gray-400 mt-2">Security Score</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          <div>High Risk: -{breakdown.highRiskDeduction}%</div>
          <div>Medium Risk: -{breakdown.mediumRiskDeduction}%</div>
          {breakdown.userActivityImpact !== 0 && (
            <div>User Activity: {breakdown.userActivityImpact > 0 ? '+' : ''}{breakdown.userActivityImpact}%</div>
          )}
        </div>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{highRiskCount}</span>
        <span className="text-blue-400 text-sm">Shadow Permissions</span>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{users.length}</span>
        <span className="text-gray-400 mt-2">Active Users</span>
      </div>
    </div>
  );
} 