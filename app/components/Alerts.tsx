import { AlertTriangle, Key, UserX, AlertOctagon, Shield } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import type { ShadowPermissionRisk } from "~/lib/iam/types";

interface AlertsProps {
  shadowPermissions: ShadowPermissionRisk[];
  hasCredentials: boolean;
}

function getShadowPermissionIcon(type: string) {
  switch (type) {
    case 'unused_account':
      return UserX;
    case 'old_access':
      return Key;
    case 'forgotten_policy':
      return AlertTriangle;
    case 'unused_service':
      return AlertOctagon;
    case 'legacy_policy':
      return Shield;
    case 'excessive_permissions':
      return AlertOctagon;
    default:
      return AlertTriangle;
  }
}

function getShadowPermissionColor(type: string) {
  switch (type) {
    case 'unused_account':
      return 'text-red-400';
    case 'old_access':
      return 'text-orange-400';
    case 'forgotten_policy':
      return 'text-yellow-400';
    case 'unused_service':
      return 'text-blue-400';
    case 'legacy_policy':
      return 'text-purple-400';
    case 'excessive_permissions':
      return 'text-pink-400';
    default:
      return 'text-gray-400';
  }
}

export function Alerts({ shadowPermissions, hasCredentials }: AlertsProps) {
  if (!hasCredentials) {
    return (
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-6 h-6 text-secondary" />
          <h2 className="text-xl font-semibold text-white">Security Alerts</h2>
        </div>
        <div className="text-center text-gray-400 py-8">
          Connect your AWS account to view security alerts and shadow permissions
        </div>
      </div>
    );
  }

  // Group shadow permissions by severity
  const groupedPermissions = shadowPermissions.reduce((acc, permission) => {
    const severity = permission.severity;
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push(permission);
    return acc;
  }, {} as Record<string, ShadowPermissionRisk[]>);

  // Define severity levels and their colors
  const severityLevels = [
    { level: 'high', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: AlertOctagon },
    { level: 'medium', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20', icon: AlertTriangle },
    { level: 'low', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20', icon: Shield }
  ];

  return (
    <div className="bg-white/5 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-6 h-6 text-secondary" />
        <h2 className="text-xl font-semibold text-white">Security Alerts</h2>
      </div>

      {shadowPermissions.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          No security alerts found. Your AWS environment appears to be secure.
        </div>
      ) : (
        <div className="space-y-4">
          {severityLevels.map(({ level, color, bgColor, borderColor, icon: Icon }) => {
            const permissions = groupedPermissions[level] || [];
            if (permissions.length === 0) return null;

            return (
              <div key={level} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <h3 className={`font-semibold ${color}`}>
                    {level.charAt(0).toUpperCase() + level.slice(1)} Risk Alerts
                  </h3>
                  <span className="text-sm text-gray-400">({permissions.length})</span>
                </div>
                <div className="space-y-3">
                  {permissions.map((permission, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-white mb-1">{permission.type}</div>
                          <div className="text-sm text-gray-400">{permission.description}</div>
                          <div className="mt-2 text-xs text-gray-500">{permission.details}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 