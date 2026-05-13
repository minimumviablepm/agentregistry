import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Bot, Activity } from "lucide-react";

const NAV = [
  { to: "/",       label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/agents", label: "Agents",    icon: Bot },
  { to: "/runs",   label: "Runs",      icon: Activity },
];

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-56 md:min-h-screen bg-gray-900 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100">AgentRegistry</p>
              <p className="text-xs text-gray-500">MLflow powered</p>
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto md:overflow-x-visible">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block mt-auto p-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center">
            Powered by{" "}
            <a
              href="https://mlflow.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:text-brand-400"
            >
              MLflow
            </a>
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-5 sm:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
