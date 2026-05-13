import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, Tag, Clock, ChevronDown, ExternalLink,
  Play, Archive, Rocket, Minus,
} from "lucide-react";
import { fetchAgent, transitionStage } from "../api/client";
import { StageBadge } from "../components/StageBadge";
import { Spinner } from "../components/Spinner";
import { ErrorBanner } from "../components/ErrorBanner";
import type { ModelVersion } from "../types";

const STAGES: ModelVersion["stage"][] = ["None", "Staging", "Production", "Archived"];

const STAGE_ICONS: Record<ModelVersion["stage"], React.ReactNode> = {
  None:       <Minus className="w-3.5 h-3.5" />,
  Staging:    <Play className="w-3.5 h-3.5" />,
  Production: <Rocket className="w-3.5 h-3.5" />,
  Archived:   <Archive className="w-3.5 h-3.5" />,
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}

function StageTransitionDropdown({
  agentName,
  version,
  currentStage,
}: {
  agentName: string;
  version: string;
  currentStage: ModelVersion["stage"];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (stage: string) => transitionStage(agentName, version, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", agentName] });
      setOpen(false);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const available = STAGES.filter((s) => s !== currentStage);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={mutation.isPending}
        className="btn-ghost text-xs px-2 py-1.5 gap-1"
      >
        {mutation.isPending ? <Spinner size={12} /> : null}
        Transition
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-xl shadow-xl py-1 min-w-36">
            {available.map((stage) => (
              <button
                key={stage}
                onClick={() => mutation.mutate(stage)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
              >
                {STAGE_ICONS[stage]}
                {stage}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="absolute right-0 top-full mt-1 text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-2 py-1 w-max max-w-xs z-20">
          {error}
        </p>
      )}
    </div>
  );
}

function VersionRow({ v, agentName }: { v: ModelVersion; agentName: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-gray-300">v{v.version}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge stage={v.stage} />
            <span className="text-xs text-gray-500">{v.status}</span>
          </div>
          {v.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{v.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {v.run_id && (
          <Link
            to={`/runs/${v.run_id}`}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            Run
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
        <span className="text-xs text-gray-600 hidden sm:block">
          {formatDate(v.creation_timestamp)}
        </span>
        <StageTransitionDropdown
          agentName={agentName}
          version={v.version}
          currentStage={v.stage}
        />
      </div>
    </div>
  );
}

export function AgentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const agentName = decodeURIComponent(name ?? "");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["agent", agentName],
    queryFn: () => fetchAgent(agentName),
    refetchInterval: 15_000,
    enabled: !!agentName,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner message={(error as Error).message} />;
  }

  if (!data) return null;

  const versionsByStage = {
    Production: data.versions.filter((v) => v.stage === "Production"),
    Staging:    data.versions.filter((v) => v.stage === "Staging"),
    None:       data.versions.filter((v) => v.stage === "None"),
    Archived:   data.versions.filter((v) => v.stage === "Archived"),
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to="/agents"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Registry
        </Link>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{data.name}</h1>
            {data.description && (
              <p className="text-gray-400 text-sm mt-1">{data.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total Versions</p>
          <p className="text-2xl font-bold text-gray-100">{data.versions.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Production</p>
          <p className="text-2xl font-bold text-emerald-400">{versionsByStage.Production.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Staging</p>
          <p className="text-2xl font-bold text-yellow-400">{versionsByStage.Staging.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Archived</p>
          <p className="text-2xl font-bold text-gray-500">{versionsByStage.Archived.length}</p>
        </div>
      </div>

      {/* Tags */}
      {Object.keys(data.tags).length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-medium text-gray-300">Tags</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.tags).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300">
                <span className="text-gray-500">{k}:</span> {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Versions */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-100">Versions</h2>
          <span className="text-xs text-gray-600 ml-auto">
            Created {new Date(data.creation_timestamp).toLocaleDateString()}
          </span>
        </div>

        {data.versions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No versions registered yet. Log a model with <code className="bg-gray-800 px-1.5 py-0.5 rounded text-brand-400">mlflow.register_model()</code>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {["Production", "Staging", "None", "Archived"].map((stage) => {
              const versions = versionsByStage[stage as ModelVersion["stage"]];
              if (versions.length === 0) return null;
              return (
                <div key={stage}>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-2 mt-3 first:mt-0">
                    {stage}
                  </p>
                  {versions.map((v) => (
                    <VersionRow key={v.version} v={v} agentName={data.name} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
