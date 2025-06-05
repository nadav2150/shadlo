import { AlertTriangle, Key, UserX } from "lucide-react";

export function Alerts() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">Recent Alerts</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-white/5 border border-gray-700 rounded-lg">
          <AlertTriangle className="w-6 h-6 text-orange-400" />
          <div>
            <div className="font-semibold text-white">Excessive Admin Privileges Detected</div>
            <div className="text-gray-400 text-sm">User 'john.doe' has unnecessary admin access to 3 services</div>
          </div>
          <span className="ml-auto text-xs text-gray-500">2 hours ago</span>
        </div>
        <div className="flex items-center gap-4 p-4 bg-white/5 border border-gray-700 rounded-lg">
          <Key className="w-6 h-6 text-red-400" />
          <div>
            <div className="font-semibold text-white">Exposed API Key Found</div>
            <div className="text-gray-400 text-sm">Production API key exposed in GitHub repository</div>
          </div>
          <span className="ml-auto text-xs text-gray-500">5 hours ago</span>
        </div>
        <div className="flex items-center gap-4 p-4 bg-white/5 border border-gray-700 rounded-lg">
          <UserX className="w-6 h-6 text-yellow-400" />
          <div>
            <div className="font-semibold text-white">Inactive Account with Permissions</div>
            <div className="text-gray-400 text-sm">User 'sarah.smith' inactive for 90 days with active permissions</div>
          </div>
          <span className="ml-auto text-xs text-gray-500">1 day ago</span>
        </div>
      </div>
    </div>
  );
} 