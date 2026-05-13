import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, BarChart3, SlidersHorizontal, Tag, FolderOpen, ChevronRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchRun, fetchMetricHistory, fetchArtifacts } from "../api/client";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { Spinner } from "../components/Spinner";
import { ErrorBanner } from "../components/ErrorBanner";

function formatDuration(start: number | null, end: number | null) {
  if (!start) return "—";
  const ms = (end ?? Date.now()) - start;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function MetricChart({ runId, metricKey }: { runId: string; metricKey: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["metric", runId, metricKey],
    queryFn: () => fetchMetricHistory(runId, metricKey),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (!data || data.length === 0) return <p className="text-xs text-gray-500 text-center py-4">No history</p>;

  if (data.length === 1) {
    return (
      <p className="text-3xl font-bold text-gray-100 py-4 text-center">
        {data[0].value.toPrecision(5)}
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="step" tick={{ fontSize: 10, fill: "#6b7280" }} />
        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} width={50} />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#9ca3af", fontSize: 12 }}
          itemStyle={{ color: "#a5b4fc", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ArtifactBrowser({ runId, initialPath = "" }: { runId: string; initialPath?: string }) {
  const [path, setPath] = useState(initialPath);
  const [history, setHistory] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["artifacts", runId, path],
    queryFn: () => fetchArtifacts(runId, path),
  });

  function navigate(newPath: string) {
    setHistory((h) => [...h, path]);
    setPath(newPath);
  }

  function goBack() {
    const prev = history[history.length - 1] ?? "";
    setHistory((h) => h.slice(0, -1));
    setPath(prev);
  }

  return (
    <div>
      {history.length > 0 && (
        <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 mb-3 transition-colors">
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>
      )}
      {path && (
        <p className="text-xs text-gray-500 font-mono mb-3">{path}</p>
      )}

      {isLoading && <Spinner size={16} />}

      {data && data.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No artifacts</p>
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-1">
          {data.map((a) => (
            <div
              key={a.path}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                a.is_dir
                  ? "hover:bg-gray-800 cursor-pointer text-brand-400"
                  : "text-gray-300"
              }`}
              onClick={() => a.is_dir && navigate(a.path)}
            >
              <span className="font-mono text-xs flex items-center gap-2 min-w-0">
                <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${a.is_dir ? "text-brand-400" : "text-gray-600"}`} />
                <span className="truncate">{a.path.split("/").pop()}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {a.file_size != null && (
                  <span className="text-xs text-gray-600">
                    {a.file_size > 1024 * 1024
                      ? `${(a.file_size / 1024 / 1024).toFixed(1)} MB`
                      : a.file_size > 1024
                      ? `${(a.file_size / 1024).toFixed(1)} KB`
                      : `${a.file_size} B`}
                  </span>
                )}
                {a.is_dir && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => fetchRun(runId!),
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? 5_000 : false,
    enabled: !!runId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  }
  if (isError) return <ErrorBanner message={(error as Error).message} />;
  if (!data) return null;

  const metricKeys = Object.keys(data.metrics);
  const active = selectedMetric ?? metricKeys[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to="/runs"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Runs
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-100">
                {data.run_name ?? "Unnamed Run"}
              </h1>
              <RunStatusBadge status={data.status} />
            </div>
            <p className="text-xs text-gray-500 font-mono">{data.run_id}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-lg font-bold text-gray-100 mt-0.5">
              {formatDuration(data.start_time, data.end_time)}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      {metricKeys.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-100">Metrics</h2>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            {metricKeys.map((k) => (
              <button
                key={k}
                onClick={() => setSelectedMetric(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active === k
                    ? "bg-brand-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-gray-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {active && <MetricChart runId={data.run_id} metricKey={active} />}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parameters */}
        {Object.keys(data.params).length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-100">Parameters</h2>
            </div>
            <div className="flex flex-col gap-1">
              {Object.entries(data.params).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-xs text-gray-500 font-mono">{k}</span>
                  <span className="text-xs text-gray-300 font-mono truncate max-w-48">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {Object.keys(data.tags).length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-100">Tags</h2>
            </div>
            <div className="flex flex-col gap-1">
              {Object.entries(data.tags)
                .filter(([k]) => !k.startsWith("mlflow."))
                .map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-xs text-gray-500 font-mono shrink-0">{k}</span>
                    <span className="text-xs text-gray-300 font-mono text-right truncate max-w-48">{v}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Artifacts */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-100">Artifacts</h2>
        </div>
        <ArtifactBrowser runId={data.run_id} />
      </div>
    </div>
  );
}
