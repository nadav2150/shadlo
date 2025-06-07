import { Link, useLocation, useLoaderData } from "@remix-run/react";
import { cn } from "~/lib/utils";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import type { loader as rootLoader } from "~/root";

export default function AppSidebar() {
  const location = useLocation();
  const { user } = useLoaderData<typeof rootLoader>();

  return (
    <div className="flex h-screen w-64 flex-col bg-[#1A1D24] text-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold">Shadow Access Hunter</h1>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        <Link
          to="/"
          className={cn(
            "flex items-center px-2 py-2 text-sm font-medium rounded-md",
            location.pathname === "/"
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
        >
          Dashboard
        </Link>
        <Link
          to="/providers"
          className={cn(
            "flex items-center px-2 py-2 text-sm font-medium rounded-md",
            location.pathname === "/providers"
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
        >
          Providers
        </Link>
        <Link
          to="/permissions"
          className={cn(
            "flex items-center px-2 py-2 text-sm font-medium rounded-md",
            location.pathname === "/permissions"
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
        >
          Permissions
        </Link>
        <Link
          to="/hunts"
          className={cn(
            "flex items-center px-2 py-2 text-sm font-medium rounded-md",
            location.pathname === "/hunts"
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
        >
          Hunts
        </Link>
        <Link
          to="/settings"
          className={cn(
            "flex items-center px-2 py-2 text-sm font-medium rounded-md",
            location.pathname === "/settings"
              ? "bg-gray-800 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          )}
        >
          Settings
        </Link>
      </nav>

      {/* User Info and Sign Out */}
      {user && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user.email}
              </p>
            </div>
          </div>
          <Link
            to="/sign-out"
            className="w-full"
            onClick={(e) => {
              // Clear any client-side storage
              localStorage.clear();
              sessionStorage.clear();
            }}
          >
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
} 