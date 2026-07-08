import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, RefreshCw, ChevronRight, Bot, TrendingUp,
  AlertCircle, CheckCircle2, Clock, Minus,
} from "lucide-react";
import { fetchWorkforce } from "../api/client";
import { StageBadge } from "../components/StageBadge";
import { Spinner } from "../components/Spinner";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import type { ActivityStatus, WorkforceAgent } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(epochMs: number | null): string {
  if (!epochMs) return "—";
  const s = Math.floor((Date.now() - epochMs) / 1000);
  if (s < 5)   return "just now";
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

// ── Activity status ───────────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<
  ActivityStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  running: {
    label: "Running",
    dot:   "bg-blue-400 animate-pulse",
    text:  "text-blue-300",
    bg:    "bg-blue-900/30 border-blue-800/50",
  },
  failed: {
    label: "Failed",
    dot:   "bg-red-400",
    text:  "text-red-300",
    bg:    "bg-red-900/30 border-red-800/50",
  },
  idle: {
    label: "Idle",
    dot:   "bg-gray-500",
    text:  "text-gray-400",
    bg:    "bg-gray-800/40 border-gray-700/50",
  },
  no_data: {
    label: "No Data",
    dot:   "bg-gray-700",
    text:  "text-gray-600",
    bg:    "bg-gray-900/40 border-gray-800/50",
  },
};

function ActivityBadge({ status }: { status: ActivityStatus }) {
  const cfg = ACTIVITY_CONFIG[status];
  return (
    <span className={`badge border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Stat chips in header ──────────────────────────────────────────────────────

function StatChip({
  label, value, color,
}: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${color}`}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

// ── Per-agent row ─────────────────────────────────────────────────────────────

function AgentRow({ agent }: { agent: WorkforceAgent }) {
  const cfg = ACTIVITY_CONFIG[agent.activity_status];
  const { run_stats: s } = agent;

  const lastRunElapsed =
    agent.activity_status === "running" && s.last_run_time
      ? `Started ${timeAgo(s.last_run_time)}`
      : s.last_run_time
      ? `Last run ${timeAgo(s.last_run_time)}`
      : "Never run";

  return (
    <Link
      to={`/agents/${encodeURIComponent(agent.name)}`}
      className="flex items-center gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-800
                 hover:border-gray-700 hover:bg-gray-800/60 transition-all group"
    >
      {/* Status stripe */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${
        agent.activity_status === "running" ? "bg-blue-500" :
        agent.activity_status === "failed"  ? "bg-red-500"  :
        agent.activity_status === "idle"    ? "bg-gray-600" :
                                              "bg-gray-800"
      }`} />

      {/* Agent identity */}
      <div className="flex items-center gap-3 w-56 shrink-0 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-brand-600/20 border border-brand-600/30
                        flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-brand-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-100 text-sm truncate
                        group-hover:text-brand-400 transition-colors">
            {agent.name}
          </p>
          <div className="mt-0.5">
            <StageBadge stage={agent.primary_stage as "Production" | "Staging" | "None" | "Archived"} />
          </div>
        </div>
      </div>

      {/* Activity status */}
      <div className="w-28 shrink-0">
        <ActivityBadge status={agent.activity_status} />
      </div>

      {/* Last run info */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <p className={`text-sm ${cfg.text}`}>{lastRunElapsed}</p>
        {s.last_run_duration_ms != null && (
          <p className="text-xs text-gray-600 mt-0.5">
            Duration: {formatDuration(s.last_run_duration_ms)}
          </p>
        )}
        {agent.activity_status === "running" && s.last_run_time && (
          <p className="text-xs text-gray-600 mt-0.5">
            Elapsed: {formatDuration(Date.now() - s.last_run_time)}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden lg:flex items-center gap-5 shrink-0">
        <div className="text-center w-14">
          <p className="text-sm font-semibold text-gray-200 tabular-nums">{s.total}</p>
          <p className="text-xs text-gray-600 mt-0.5">runs</p>
        </div>
        <div className="text-center w-14">
          <p className={`text-sm font-semibold tabular-nums ${
            s.success_rate == null         ? "text-gray-600" :
            s.success_rate >= 0.9          ? "text-emerald-400" :
            s.success_rate >= 0.7          ? "text-yellow-400" :
                                             "text-red-400"
          }`}>
            {formatRate(s.success_rate)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">success</p>
        </div>
        <div className="text-center w-16">
          <p className="text-sm font-semibold text-gray-200 tabular-nums">
            {formatDuration(s.avg_duration_ms)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">avg time</p>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
    </Link>
  );
}

// ── Status filter options ─────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ActivityStatus | "all"; label: string }[] = [
  { value: "all",     label: "All Status" },
  { value: "running", label: "Running" },
  { value: "idle",    label: "Idle" },
  { value: "failed",  label: "Failed" },
  { value: "no_data", label: "No Data" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkforcePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | "all">("all");

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["workforce"],
    queryFn: fetchWorkforce,
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((a) => {
      const matchName = a.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || a.activity_status === statusFilter;
      return matchName && matchStatus;
    });
  }, [data, search, statusFilter]);

  // Counts from the full dataset (not filtered)
  const counts = useMemo(() => ({
    total:   data?.length ?? 0,
    running: data?.filter((a) => a.activity_status === "running").length ?? 0,
    idle:    data?.filter((a) => a.activity_status === "idle").length    ?? 0,
    failed:  data?.filter((a) => a.activity_status === "failed").length  ?? 0,
  }), [data]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Workforce Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time view of every agent's activity and health
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-600 hidden sm:block">
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="btn-ghost"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="flex flex-wrap gap-2">
        <StatChip
          label="Total"
          value={counts.total}
          color="bg-gray-800 border-gray-700 text-gray-300"
        />
        <StatChip
          label="Running"
          value={counts.running}
          color="bg-blue-900/40 border-blue-800/60 text-blue-300"
        />
        <StatChip
          label="Idle"
          value={counts.idle}
          color="bg-gray-800 border-gray-700 text-gray-400"
        />
        <StatChip
          label="Failed"
          value={counts.failed}
          color={
            counts.failed > 0
              ? "bg-red-900/40 border-red-800/60 text-red-300"
              : "bg-gray-800 border-gray-700 text-gray-600"
          }
        />
      </div>

      {/* ── Summary cards ── */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Fleet Size</span>
            </div>
            <p className="text-3xl font-bold text-gray-100">{counts.total}</p>
            <p className="text-xs text-gray-600 mt-1">registered agents</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Active Now</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">{counts.running}</p>
            <p className="text-xs text-gray-600 mt-1">
              {counts.running === 1 ? "agent running" : "agents running"}
            </p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              {counts.failed > 0
                ? <AlertCircle className="w-4 h-4 text-red-400" />
                : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              <span className="text-xs text-gray-500">Failed</span>
            </div>
            <p className={`text-3xl font-bold ${counts.failed > 0 ? "text-red-400" : "text-gray-600"}`}>
              {counts.failed}
            </p>
            <p className="text-xs text-gray-600 mt-1">last-run failures</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Fleet Health</span>
            </div>
            <p className={`text-3xl font-bold ${
              counts.total === 0 ? "text-gray-600" :
              counts.failed / counts.total > 0.3 ? "text-red-400" :
              counts.failed > 0 ? "text-yellow-400" :
              "text-emerald-400"
            }`}>
              {counts.total === 0
                ? "—"
                : `${Math.round(((counts.total - counts.failed) / counts.total) * 100)}%`}
            </p>
            <p className="text-xs text-gray-600 mt-1">agents healthy</p>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            className="input w-full pl-9"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ActivityStatus | "all")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Agent column headers ── */}
      {data && data.length > 0 && (
        <div className="hidden lg:flex items-center gap-4 px-4 text-xs text-gray-600 uppercase tracking-wider">
          <div className="w-1 shrink-0" />
          <div className="w-56 shrink-0 ml-12">Agent</div>
          <div className="w-28 shrink-0">Status</div>
          <div className="flex-1">Last Run</div>
          <div className="flex items-center gap-5 shrink-0 mr-8">
            <div className="w-14 text-center">Runs</div>
            <div className="w-14 text-center">Success</div>
            <div className="w-16 text-center">Avg Time</div>
          </div>
        </div>
      )}

      {/* ── States ── */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && <ErrorBanner message={(error as Error).message} />}

      {data && filtered.length === 0 && !isLoading && (
        <EmptyState
          icon={search || statusFilter !== "all" ? Minus : Users}
          title={search || statusFilter !== "all" ? "No agents match" : "No agents registered"}
          description={
            search || statusFilter !== "all"
              ? "Try a different name or status filter"
              : "Register agents to start monitoring your fleet"
          }
        />
      )}

      {/* ── Agent roster ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map((agent) => (
            <AgentRow key={agent.name} agent={agent} />
          ))}
        </div>
      )}

      {/* Footer note */}
      {data && data.length > 0 && (
        <p className="text-xs text-gray-700 text-center">
          Auto-refreshes every 10s · Stats derived from MLflow model version run links
        </p>
      )}
    </div>
  );
}
