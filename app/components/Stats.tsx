import { useLoaderData } from "@remix-run/react";
import type { UserDetails, RoleDetails, ShadowPermissionRisk } from "~/lib/iam/types";
import { calculateSecurityScore } from "~/lib/security/scoreEngine";
import { useState } from "react";

interface StatsProps {
  users: UserDetails[];
  roles: RoleDetails[];
  shadowPermissions: ShadowPermissionRisk[];
  hasCredentials: boolean;
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

export function Stats({ users, roles, shadowPermissions, hasCredentials }: StatsProps) {
  const { overallScore, riskLevel, factors } = hasCredentials ? calculateSecurityScore(users, roles) : {
    overallScore: 0,
    riskLevel: 'N/A',
    factors: []
  };
  
  // Calculate risk scores for each factor
  const riskScores = hasCredentials ? factors.map(factor => ({
    category: factor.category,
    riskLevel: factor.score >= 80 ? 'low' : 
               factor.score >= 60 ? 'medium' : 
               factor.score >= 40 ? 'high' : 'critical',
    score: getRiskScore(factor.score >= 80 ? 'low' : 
                       factor.score >= 60 ? 'medium' : 
                       factor.score >= 40 ? 'high' : 'critical')
  })) : [];

  // Calculate total risk score
  const totalRiskScore = hasCredentials ? riskScores.reduce((sum, factor) => sum + factor.score, 0) : 0;

  // Calculate total entities and create combined array
  const allEntities = [...users, ...roles];
  const totalEntities = allEntities.length;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <span className={`text-3xl font-bold ${hasCredentials ? getRiskLevelColor(riskLevel) : 'text-gray-400'}`}>
          {hasCredentials ? riskLevel.toUpperCase() : 'N/A'}
        </span>
        <span className="text-gray-400 mt-2">Overall Risk Level</span>
        <div className="text-xs text-gray-500 mt-2">
          {hasCredentials ? (
            <div className="flex flex-col items-center">
              <div>Security Score: {overallScore}%</div>
              <div className="mt-1 text-xs">
                {riskLevel === 'critical' ? 'Critical Risk' :
                 riskLevel === 'high' ? 'High Risk' :
                 riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk'}
              </div>
            </div>
          ) : (
            <div>Connect AWS to view security metrics</div>
          )}
        </div>
      </div>
      
      <div className="bg-white/5 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Risk Distribution</span>
        </div>
        
        {hasCredentials ? (
          <div className="space-y-1.5">
            {[
              { level: 'critical', color: 'bg-red-500/10', textColor: 'text-red-400', borderColor: 'border-red-500/20' },
              { level: 'high', color: 'bg-orange-500/10', textColor: 'text-orange-400', borderColor: 'border-orange-500/20' },
              { level: 'medium', color: 'bg-yellow-500/10', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/20' },
              { level: 'low', color: 'bg-green-500/10', textColor: 'text-green-400', borderColor: 'border-green-500/20' }
            ].map(({ level, color, textColor, borderColor }) => {
              const count = allEntities.filter(e => e.riskAssessment?.riskLevel === level).length;
              const percentage = totalEntities > 0 ? (count / totalEntities) * 100 : 0;
              
              return (
                <div key={level} className={`px-2 py-1 rounded-lg border ${borderColor} ${color}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-medium ${textColor}`}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <span className="text-xs text-white">{count}</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1">
                    <div 
                      className={`h-1 rounded-full ${color.replace('/10', '')}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400">
            Connect AWS to view risk distribution
          </div>
        )}
      </div>

      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold text-white">{hasCredentials ? users.length + roles.length : 'N/A'}</span>
        <span className="text-gray-400 mt-2">Total Entities</span>
        <div className="text-xs text-gray-500 mt-2">
          {hasCredentials ? (
            <div className="flex flex-col items-center">
              <div>{users.length} Users</div>
              <div>{roles.length} Roles</div>
            </div>
          ) : (
            <div>Connect AWS to view entities</div>
          )}
        </div>
      </div>
    </div>
  );
} 