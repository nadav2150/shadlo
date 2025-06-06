import { Shield, Cloud } from "lucide-react";
import { NavLink } from "@remix-run/react";

const navItems = [
  { name: "Dashboard", to: "/", icon: Shield },
  { name: "Providers", to: "/providers", icon: Cloud },
  { name: "Permissions", to: "/permissions" },
  { name: "Users", to: "/users" },
  { name: "Settings", to: "/settings" },
];

export function AppSidebar() {
  return (
    <aside className="bg-[#181C23] text-white w-64 min-h-screen flex flex-col border-r border-gray-800">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-800">
        <span className="font-bold text-lg">Shadow Access<br />Hunter</span>
      </div>
      <nav className="flex-1 px-4 py-8">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium hover:bg-gray-800 ${isActive ? "bg-gray-800" : ""}`
                }
                end
              >
                {item.icon && <item.icon className="w-5 h-5" />}
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
} 