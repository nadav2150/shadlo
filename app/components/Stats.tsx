import { useLoaderData } from "@remix-run/react";
import type { UserDetails, RoleDetails, ShadowPermissionRisk } from "~/lib/iam/types";
import { calculateSecurityScore } from "~/lib/security/scoreEngine";
import { useState } from "react";
import { AlertTriangle, AlertCircle, Shield, CheckCircle } from "lucide-react";

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

// Circular Progress Component
function CircularProgress({ percentage, color, size = 60 }: { percentage: number; color: string; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="transparent"
          className="text-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-300 ${color}`}
        />
      </svg>
      <span className="absolute text-xs font-medium text-white">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

// Circular Progress Risk Distribution Component
function CircularProgressRiskDistribution({ data }: { 
  data: Array<{ 
    level: string; 
    count: number; 
    percentage: number; 
    color: string; 
    bgColor: string; 
    icon: any;
  }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {data.map(({ level, count, percentage, color, bgColor, icon: Icon }) => (
        <div key={level} className={`${bgColor} rounded-lg p-3 text-center`}>
          <div className="flex justify-center mb-2">
            <CircularProgress 
              percentage={percentage} 
              color={color} 
              size={50}
            />
          </div>
          <div className={`text-xs font-medium ${color} mb-1`}>
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </div>
          <div className="text-xs text-white">
            {count} entities
          </div>
        </div>
      ))}
    </div>
  );
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

  // Calculate risk distribution with circular progress approach
  const riskDistribution = hasCredentials ? [
    { 
      level: 'critical', 
      color: 'text-red-400', 
      bgColor: 'bg-red-500/10', 
      icon: AlertTriangle 
    },
    { 
      level: 'high', 
      color: 'text-orange-400', 
      bgColor: 'bg-orange-500/10', 
      icon: AlertCircle 
    },
    { 
      level: 'medium', 
      color: 'text-yellow-400', 
      bgColor: 'bg-yellow-500/10', 
      icon: Shield 
    },
    { 
      level: 'low', 
      color: 'text-green-400', 
      bgColor: 'bg-green-500/10', 
      icon: CheckCircle 
    }
  ].map(({ level, color, bgColor, icon }) => {
    const count = allEntities.filter(e => e.riskAssessment?.riskLevel === level).length;
    const percentage = totalEntities > 0 ? (count / totalEntities) * 100 : 0;
    
    return {
      level,
      count,
      percentage,
      color,
      bgColor,
      icon
    };
  }) : [];
  
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
            <div>Connect a provider to view security metrics</div>
          )}
        </div>
      </div>
      
      <div className="bg-white/5 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-400">Risk Distribution</span>
          {hasCredentials && (
            <span className="text-xs text-gray-500">
              {totalEntities} total
            </span>
          )}
        </div>
        
        {hasCredentials ? (
          <CircularProgressRiskDistribution data={riskDistribution} />
        ) : (
          <div className="text-center text-xs text-gray-400">
            Connect a provider to view risk distribution
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
            <div>Connect a provider to view entities</div>
          )}
        </div>
      </div>
    </div>
  );
} 