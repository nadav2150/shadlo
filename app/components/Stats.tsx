import { useLoaderData } from "@remix-run/react";
import type { UserDetails, RoleDetails } from "~/lib/iam/types";
import { calculateSecurityScore } from "~/lib/security/scoreEngine";

interface StatsProps {
  users: UserDetails[];
  roles: RoleDetails[];
}

function getScoreColorClass(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function Stats({ users, roles }: StatsProps) {
  const { overallScore, riskLevel, factors, recommendations } = calculateSecurityScore(users, roles);
  
  // Calculate total high risk factors
  const highRiskFactors = factors.filter(f => f.score < 40).length;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className={`text-3xl font-bold ${getScoreColorClass(overallScore)}`}>
          {overallScore}%
        </span>
        <span className="text-gray-400 mt-2">Security Score</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          <div>Risk Level: {riskLevel.toUpperCase()}</div>
          {factors.map((factor, index) => (
            <div key={index} className="mt-1">
              {factor.category}: {factor.score}%
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{highRiskFactors}</span>
        <span className="text-red-400 text-sm">High Risk Factors</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          {recommendations.slice(0, 2).map((rec, index) => (
            <div key={index} className="mt-1">{rec}</div>
          ))}
        </div>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{users.length + roles.length}</span>
        <span className="text-gray-400 mt-2">Total IAM Entities</span>
        <div className="text-xs text-gray-500 mt-2 text-center">
          <div>{users.length} Users</div>
          <div>{roles.length} Roles</div>
        </div>
      </div>
    </div>
  );
} 