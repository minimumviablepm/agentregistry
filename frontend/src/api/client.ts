import type {
  Agent,
  AgentDetail,
  Artifact,
  Experiment,
  HealthStatus,
  MetricPoint,
  ModelVersion,
  Run,
  RunDetail,
  WorkforceAgent,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// Health
export const fetchHealth = () => request<HealthStatus>("/api/health");

// Agents
export const fetchAgents = (filter = "") =>
  request<Agent[]>(`/api/agents?filter=${encodeURIComponent(filter)}`);

export const fetchAgent = (name: string) =>
  request<AgentDetail>(`/api/agents/${encodeURIComponent(name)}`);

export const registerAgent = (body: {
  name: string;
  description?: string;
  tags?: Record<string, string>;
}) =>
  request<Agent>("/api/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const transitionStage = (
  name: string,
  version: string,
  stage: string,
  archive_existing = true
) =>
  request<ModelVersion>(
    `/api/agents/${encodeURIComponent(name)}/versions/${version}/stage`,
    {
      method: "PUT",
      body: JSON.stringify({ stage, archive_existing }),
    }
  );

// Experiments
export const fetchExperiments = () => request<Experiment[]>("/api/experiments");

// Runs
export const fetchRuns = (experimentIds?: string[], filter = "", max = 50) => {
  const params = new URLSearchParams();
  experimentIds?.forEach((id) => params.append("experiment_ids", id));
  if (filter) params.set("filter", filter);
  params.set("max_results", String(max));
  return request<Run[]>(`/api/runs?${params}`);
};

export const fetchRun = (runId: string) =>
  request<RunDetail>(`/api/runs/${runId}`);

export const fetchMetricHistory = (runId: string, metricKey: string) =>
  request<MetricPoint[]>(`/api/runs/${runId}/metrics/${encodeURIComponent(metricKey)}`);

export const fetchArtifacts = (runId: string, path = "") =>
  request<Artifact[]>(`/api/runs/${runId}/artifacts?path=${encodeURIComponent(path)}`);

// Workforce
export const fetchWorkforce = () => request<WorkforceAgent[]>("/api/workforce");
