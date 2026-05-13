import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, Plus, Search, RefreshCw, ChevronRight } from "lucide-react";
import { fetchAgents, registerAgent } from "../api/client";
import { StageBadge } from "../components/StageBadge";
import { Spinner } from "../components/Spinner";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Agent } from "../types";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function AgentCard({ agent }: { agent: Agent }) {
  const production = agent.latest_versions.find((v) => v.stage === "Production");
  const staging = agent.latest_versions.find((v) => v.stage === "Staging");
  const latestVersion = agent.latest_versions[0];

  return (
    <Link
      to={`/agents/${encodeURIComponent(agent.name)}`}
      className="card hover:border-gray-700 hover:bg-gray-800/50 transition-all group block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-100 truncate group-hover:text-brand-400 transition-colors">
              {agent.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Updated {formatDate(agent.last_updated_timestamp)}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 mt-1" />
      </div>

      {agent.description && (
        <p className="text-sm text-gray-400 mt-3 line-clamp-2">{agent.description}</p>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {production && <StageBadge stage="Production" />}
        {staging && <StageBadge stage="Staging" />}
        {!production && !staging && latestVersion && (
          <StageBadge stage={latestVersion.stage} />
        )}
        {latestVersion && (
          <span className="text-xs text-gray-500">v{latestVersion.version}</span>
        )}
        {agent.latest_versions.length === 0 && (
          <span className="text-xs text-gray-600">No versions yet</span>
        )}
      </div>

      {Object.keys(agent.tags).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(agent.tags).slice(0, 3).map(([k, v]) => (
            <span key={k} className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400">
              {k}: {v}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: registerAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    mutation.mutate({ name: name.trim(), description: description.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Register New Agent</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Name *</label>
            <input
              className="input w-full"
              placeholder="my-agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Description</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="What does this agent do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner size={16} /> : null}
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AgentsPage() {
  const [filter, setFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["agents", filter],
    queryFn: () => fetchAgents(filter),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Agent Registry</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data ? `${data.length} agent${data.length !== 1 ? "s" : ""} registered` : "Registered MLflow models"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-ghost" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Register Agent
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          className="input w-full pl-9"
          placeholder="Filter agents by name or tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && <ErrorBanner message={(error as Error).message} />}

      {data && data.length === 0 && (
        <EmptyState
          icon={Bot}
          title="No agents found"
          description={filter ? "Try a different filter" : "Register your first agent to get started"}
          action={
            !filter ? (
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Register Agent
              </button>
            ) : undefined
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      )}

      {showModal && <RegisterModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
