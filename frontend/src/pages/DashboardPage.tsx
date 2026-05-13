import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, Activity, Rocket, AlertCircle, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { fetchAgents, fetchRuns, fetchHealth } from "../api/client";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { StageBadge } from "../components/StageBadge";
import { Spinner } from "../components/Spinner";

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-100">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  if (!data) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
        data.connected
          ? "bg-emerald-950 border-emerald-800 text-emerald-300"
          : "bg-red-950 border-red-800 text-red-300"
      }`}
    >
      {data.connected ? (
        <Wifi className="w-3.5 h-3.5" />
      ) : (
        <WifiOff className="w-3.5 h-3.5" />
      )}
      <span>{data.connected ? "MLflow connected" : "MLflow unreachable"}</span>
      <span className="text-xs opacity-60 ml-1 hidden sm:block">{data.mlflow_uri}</span>
    </div>
  );
}

export function DashboardPage() {
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents", ""],
    queryFn: () => fetchAgents(),
    refetchInterval: 30_000,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["runs", [], ""],
    queryFn: () => fetchRuns(undefined, "", 20),
    refetchInterval: 10_000,
  });

  const productionCount = agents?.flatMap((a) => a.latest_versions).filter((v) => v.stage === "Production").length ?? 0;
  const runningCount = runs?.filter((r) => r.status === "RUNNING").length ?? 0;
  const failedCount = runs?.filter((r) => r.status === "FAILED").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of your agent fleet</p>
        </div>
        <ConnectionStatus />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Registered Agents"
          value={agentsLoading ? "—" : (agents?.length ?? 0)}
          icon={Bot}
          color="bg-brand-600/20 text-brand-400"
        />
        <StatCard
          label="In Production"
          value={agentsLoading ? "—" : productionCount}
          icon={Rocket}
          color="bg-emerald-900/50 text-emerald-400"
        />
        <StatCard
          label="Active Runs"
          value={runsLoading ? "—" : runningCount}
          icon={Activity}
          color="bg-blue-900/50 text-blue-400"
        />
        <StatCard
          label="Failed Runs"
          value={runsLoading ? "—" : failedCount}
          sub="recent 20"
          icon={failedCount > 0 ? AlertCircle : CheckCircle2}
          color={failedCount > 0 ? "bg-red-900/50 text-red-400" : "bg-gray-800 text-gray-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Agents */}
        <div className="card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-100">Recent Agents</h2>
            <Link to="/agents" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          </div>

          {agentsLoading && <div className="flex justify-center py-6"><Spinner /></div>}

          {agents && agents.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No agents registered yet</p>
          )}

          {agents && agents.slice(0, 5).map((agent) => {
            const prod = agent.latest_versions.find((v) => v.stage === "Production");
            const latest = agent.latest_versions[0];
            return (
              <Link
                key={agent.name}
                to={`/agents/${encodeURIComponent(agent.name)}`}
                className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0 hover:text-brand-400 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bot className="w-4 h-4 text-gray-600 shrink-0" />
                  <span className="text-sm text-gray-300 group-hover:text-brand-400 transition-colors truncate">
                    {agent.name}
                  </span>
                </div>
                {(prod ?? latest) && <StageBadge stage={(prod ?? latest)!.stage} />}
              </Link>
            );
          })}
        </div>

        {/* Recent Runs */}
        <div className="card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-100">Recent Runs</h2>
            <Link to="/runs" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              View all →
            </Link>
          </div>

          {runsLoading && <div className="flex justify-center py-6"><Spinner /></div>}

          {runs && runs.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No runs recorded yet</p>
          )}

          {runs && runs.slice(0, 5).map((run) => (
            <Link
              key={run.run_id}
              to={`/runs/${run.run_id}`}
              className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0 group"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-300 group-hover:text-brand-400 transition-colors truncate">
                  {run.run_name ?? run.run_id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {run.start_time ? new Date(run.start_time).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  }) : "—"}
                </p>
              </div>
              <RunStatusBadge status={run.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
