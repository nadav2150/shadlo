import { Link, useLocation, useLoaderData } from "@remix-run/react";
import { cn } from "~/lib/utils";
import { 
  LogOut, 
  User as UserIcon, 
  LayoutDashboard, 
  Server, 
  Shield, 
  Settings,
  ChevronRight
} from "lucide-react";
import { Button } from "./ui/button";
import type { loader as rootLoader } from "~/root";

export default function AppSidebar() {
  const location = useLocation();
  const { user } = useLoaderData<typeof rootLoader>();

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/providers", label: "Providers", icon: Server },
    { to: "/permissions", label: "Permissions", icon: Shield },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-[#1A1D24] text-white border-r border-gray-800">
      <div className="flex h-16 items-center justify-center border-b border-gray-800 bg-[#15171D]">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Shadow Access Hunter
        </h1>
      </div>

      <nav className="flex-1 space-y-3 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center px-4 py-3.5 text-base font-medium rounded-lg transition-all duration-200",
                isActive
                  ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
                  : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-6 h-6 mr-4 transition-colors duration-200",
                isActive ? "text-blue-400" : "text-gray-400 group-hover:text-white"
              )} />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-5 h-5 text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info and Sign Out */}
      {user && (
        <div className="border-t border-gray-800/30">
          <div className="p-4">
            {/* User Card */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-3 mb-4 border border-gray-700/30 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-gray-800/30"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {user.email ? user.email.split('@')[0] : 'User'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <Link
              to="/sign-out"
              className="block w-full mb-3"
              onClick={(e) => {
                localStorage.clear();
                sessionStorage.clear();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-center gap-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
              >
                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm">Sign Out</span>
              </Button>
            </Link>

            {/* Version Info */}
            <div className="pt-3 border-t border-gray-800/30">
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>Shadow Access Hunter</span>
                <span>v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 