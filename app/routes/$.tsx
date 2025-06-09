import { Link, useLocation } from "@remix-run/react";
import { 
  Home, 
  ArrowLeft, 
  Search, 
  AlertTriangle,
  Shield,
  Server
} from "lucide-react";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  const location = useLocation();

  const suggestedRoutes = [
    { to: "/", label: "Dashboard", icon: Home, description: "Main security dashboard" },
    { to: "/providers", label: "Providers", icon: Server, description: "Manage identity providers" },
    { to: "/entities", label: "Entities", icon: Shield, description: "View IAM entities and users" },
    { to: "/settings", label: "Settings", icon: Search, description: "Application settings" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1D24] px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header with Logo */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <img
              src="/logo.svg"
              alt="Shadow Access Hunter Logo"
              className="h-24 w-auto"
            />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-400 text-lg">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Error Details */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700/30 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-white mb-2">
                Requested URL Not Found
              </h3>
              <p className="text-gray-400 mb-3">
                The page at <code className="bg-gray-700/50 px-2 py-1 rounded text-sm font-mono text-gray-300">
                  {location.pathname}
                </code> could not be found.
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Error Code:</span>
                <span className="bg-gray-700/50 px-2 py-1 rounded font-mono">404</span>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Routes */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-white mb-4 text-center">
            Try these pages instead:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestedRoutes.map((route) => {
              const Icon = route.icon;
              return (
                <Link
                  key={route.to}
                  to={route.to}
                  className="group bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors duration-200">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors duration-200">
                        {route.label}
                      </h4>
                      <p className="text-sm text-gray-400">
                        {route.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="flex items-center gap-2 bg-gray-800/30 border-gray-700/30 text-gray-300 hover:bg-gray-700/50 hover:text-white hover:border-gray-600/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Link to="/">
            <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Home className="w-4 h-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Shadlo System</span>
            <span>•</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
} 