import { AlertTriangle, Key, UserX, AlertOctagon, Shield } from "lucide-react";
import { useLoaderData } from "@remix-run/react";
import type { ShadowPermissionRisk } from "~/lib/iam/types";

interface AlertsProps {
  shadowPermissions: ShadowPermissionRisk[];
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

export function Alerts({ shadowPermissions }: AlertsProps) {
  // Filter for high-risk shadow permissions only
  const highRiskAlerts = shadowPermissions.filter(permission => permission.severity === 'high');

  if (highRiskAlerts.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Recent Alerts</h2>
        <div className="p-4 bg-white/5 border border-gray-700 rounded-lg text-gray-400">
          No high-risk shadow permissions detected
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">High-Risk Shadow Permissions</h2>
      <div className="space-y-4">
        {highRiskAlerts.map((alert, index) => {
          const Icon = getShadowPermissionIcon(alert.type);
          const iconColor = getShadowPermissionColor(alert.type);
          
          return (
            <div key={index} className="flex items-center gap-4 p-4 bg-white/5 border border-gray-700 rounded-lg">
              <Icon className={`w-6 h-6 ${iconColor}`} />
              <div>
                <div className="font-semibold text-white">{alert.description}</div>
                <div className="text-gray-400 text-sm">{alert.details}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 