import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, RefreshCw, Search, ChevronRight } from "lucide-react";
import { fetchRuns, fetchExperiments } from "../api/client";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { Spinner } from "../components/Spinner";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Run } from "../types";

function formatDuration(start: number | null, end: number | null) {
  if (!start) return "—";
  const ms = (end ?? Date.now()) - start;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatTime(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function MetricPill({ k, v }: { k: string; v: number }) {
  const formatted = Math.abs(v) < 0.001 || Math.abs(v) >= 1e6
    ? v.toExponential(2)
    : v.toPrecision(4);
  return (
    <span className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300">
      <span className="text-gray-500">{k}:</span> {formatted}
    </span>
  );
}

function RunRow({ run }: { run: Run }) {
  const topMetrics = Object.entries(run.metrics).slice(0, 4);

  return (
    <Link
      to={`/runs/${run.run_id}`}
      className="flex items-center gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/60 transition-all group flex-wrap"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col gap-1.5">
          <RunStatusBadge status={run.status} />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-200 text-sm group-hover:text-brand-400 transition-colors truncate">
            {run.run_name ?? run.run_id.slice(0, 8)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatTime(run.start_time)} · {formatDuration(run.start_time, run.end_time)}
          </p>
        </div>
      </div>

      {topMetrics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {topMetrics.map(([k, v]) => <MetricPill key={k} k={k} v={v} />)}
          {Object.keys(run.metrics).length > 4 && (
            <span className="text-xs text-gray-600">+{Object.keys(run.metrics).length - 4} more</span>
          )}
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
    </Link>
  );
}

export function RunsPage() {
  const [filter, setFilter] = useState("");
  const [selectedExp, setSelectedExp] = useState<string[]>([]);

  const { data: experiments } = useQuery({
    queryKey: ["experiments"],
    queryFn: fetchExperiments,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["runs", selectedExp, filter],
    queryFn: () => fetchRuns(selectedExp.length ? selectedExp : undefined, filter),
    refetchInterval: 10_000,
  });

  const runningCount = data?.filter((r) => r.status === "RUNNING").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Run Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data ? `${data.length} runs` : "MLflow experiment runs"}
            {runningCount > 0 && (
              <span className="ml-2 text-blue-400">· {runningCount} running</span>
            )}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-ghost" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            className="input w-full pl-9"
            placeholder="Filter runs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {experiments && experiments.length > 1 && (
          <select
            className="input"
            value={selectedExp[0] ?? ""}
            onChange={(e) => setSelectedExp(e.target.value ? [e.target.value] : [])}
          >
            <option value="">All experiments</option>
            {experiments.map((exp) => (
              <option key={exp.experiment_id} value={exp.experiment_id}>
                {exp.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && <ErrorBanner message={(error as Error).message} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No runs found"
          description={filter ? "Try a different filter" : "Start an MLflow run to see it here"}
        />
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.map((run) => <RunRow key={run.run_id} run={run} />)}
        </div>
      )}
    </div>
  );
}
