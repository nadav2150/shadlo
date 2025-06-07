import { useLoaderData } from "@remix-run/react";
import type { UserDetails, RoleDetails, ShadowPermissionRisk } from "~/lib/iam/types";
import { calculateSecurityScore } from "~/lib/security/scoreEngine";
import { Info } from "lucide-react";
import { useState } from "react";
import { Modal } from "~/components/ui/modal";

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
  const [showRiskScoreModal, setShowRiskScoreModal] = useState(false);
  
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
  
  const RiskScoreModal = () => (
    <Modal
      isOpen={showRiskScoreModal}
      onClose={() => setShowRiskScoreModal(false)}
      title="Understanding Risk Scores"
      maxWidth="xl"
    >
      <div className="space-y-6 text-gray-300">
        <div className="bg-white/5 rounded-lg p-4 border border-gray-800">
          <p className="text-base leading-relaxed">
            The Risk Score is calculated based on specific security conditions in your AWS environment. 
            Each condition contributes points to your total score based on its severity level.
          </p>
        </div>
        
        <div className="grid gap-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h4 className="font-semibold text-red-400">Critical Risk (10 points each)</h4>
            </div>
            <ul className="list-disc list-inside space-y-2 text-gray-400 ml-1">
              <li>Users with admin privileges but no MFA enabled</li>
              <li>Access keys older than 90 days</li>
              <li>IAM policies with wildcard permissions (*)</li>
              <li>Root account access keys in use</li>
            </ul>
          </div>

          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <h4 className="font-semibold text-orange-400">High Risk (5 points each)</h4>
            </div>
            <ul className="list-disc list-inside space-y-2 text-gray-400 ml-1">
              <li>Users with multiple access keys</li>
              <li>Unused IAM roles (no activity in 90 days)</li>
              <li>Policies with excessive permissions</li>
              <li>Users with direct S3 bucket access</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <h4 className="font-semibold text-yellow-400">Medium Risk (2 points each)</h4>
            </div>
            <ul className="list-disc list-inside space-y-2 text-gray-400 ml-1">
              <li>Users without MFA (non-admin)</li>
              <li>Access keys not rotated in 30 days</li>
              <li>Inline policies instead of managed policies</li>
              <li>Groups with too many permissions</li>
            </ul>
          </div>

          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h4 className="font-semibold text-green-400">Low Risk (1 point each)</h4>
            </div>
            <ul className="list-disc list-inside space-y-2 text-gray-400 ml-1">
              <li>Users with no recent activity</li>
              <li>Unused IAM groups</li>
              <li>Policies with deprecated actions</li>
              <li>Missing resource tags</li>
            </ul>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 border border-gray-800">
          <h4 className="font-semibold text-white mb-3">Example Calculation</h4>
          <div className="space-y-3 text-gray-400">
            <p>If your environment has:</p>
            <div className="grid gap-2">
              <div className="flex items-center justify-between bg-white/5 p-2 rounded">
                <span>2 admin users without MFA</span>
                <span className="font-medium">2 × 10 = 20 points</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded">
                <span>3 unused IAM roles</span>
                <span className="font-medium">3 × 5 = 15 points</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded">
                <span>5 users without MFA</span>
                <span className="font-medium">5 × 2 = 10 points</span>
              </div>
              <div className="flex items-center justify-between bg-white/5 p-2 rounded">
                <span>2 unused groups</span>
                <span className="font-medium">2 × 1 = 2 points</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
              <span className="font-medium text-white">Total Risk Score</span>
              <span className="text-xl font-bold text-white">47 points</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="font-semibold text-blue-400 mb-3">How to Improve Your Score</h4>
          <ol className="list-decimal list-inside space-y-2 text-gray-400 ml-1">
            <li>Enable MFA for all users, especially admins</li>
            <li>Remove or rotate old access keys</li>
            <li>Clean up unused IAM roles and groups</li>
            <li>Replace wildcard permissions with specific ones</li>
            <li>Use managed policies instead of inline policies</li>
          </ol>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      <RiskScoreModal />
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
            {hasCredentials && (
              <button 
                onClick={() => setShowRiskScoreModal(true)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
                title="Learn more about risk scores"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
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
    </>
  );
} 