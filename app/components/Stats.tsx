import { useLoaderData } from "@remix-run/react";
import type { UserDetails, RoleDetails, ShadowPermissionRisk } from "~/lib/iam/types";
import { calculateSecurityScore } from "~/lib/security/scoreEngine";

interface StatsProps {
  users: UserDetails[];
  roles: RoleDetails[];
  shadowPermissions: ShadowPermissionRisk[];
}

function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case 'low': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'critical': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getRiskScore(riskLevel: string): number {
  switch (riskLevel.toLowerCase()) {
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 5;
    case 'critical': return 10;
    default: return 0;
  }
}

export function Stats({ users, roles, shadowPermissions }: StatsProps) {
  const { overallScore, riskLevel, factors } = calculateSecurityScore(users, roles);
  
  // Calculate risk scores for each factor
  const riskScores = factors.map(factor => ({
    category: factor.category,
    riskLevel: factor.score >= 80 ? 'low' : 
               factor.score >= 60 ? 'medium' : 
               factor.score >= 40 ? 'high' : 'critical',
    score: getRiskScore(factor.score >= 80 ? 'low' : 
                       factor.score >= 60 ? 'medium' : 
                       factor.score >= 40 ? 'high' : 'critical')
  }));

  // Calculate total risk score
  const totalRiskScore = riskScores.reduce((sum, factor) => sum + factor.score, 0);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className={`text-3xl font-bold ${getRiskLevelColor(riskLevel)}`}>
          {riskLevel.toUpperCase()}
        </span>
        <span className="text-gray-400 mt-2">Overall Risk Level</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          <div>Risk Score: {totalRiskScore}</div>
          <div>Security Score: {overallScore}%</div>
        </div>
      </div>
      
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{totalRiskScore}</span>
        <span className="text-red-400 text-sm">Total Risk Score</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          {riskScores.map((factor, index) => (
            <div key={index} className="mt-1">
              {factor.category}: {factor.riskLevel.toUpperCase()} ({factor.score})
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{users.length + roles.length}</span>
        <span className="text-gray-400 mt-2">Total Entities</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          <div>{users.length} Users</div>
          <div>{roles.length} Roles</div>
        </div>
      </div>
    </div>
  );
} 