export function Stats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">87%</span>
        <span className="text-green-400 text-sm">+2.5%</span>
        <span className="text-gray-400 mt-2">Security Score</span>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">24</span>
        <span className="text-blue-400 text-sm">Shadow Permissions</span>
      </div>
      <div className="bg-white/5 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-white">156</span>
        <span className="text-gray-400 mt-2">Active Users</span>
        <span className="text-red-400 text-sm mt-1">+1</span>
        <span className="text-gray-400">Active Alerts</span>
      </div>
    </div>
  );
} 