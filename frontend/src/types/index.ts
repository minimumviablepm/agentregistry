export interface ModelVersion {
  name: string;
  version: string;
  stage: "None" | "Staging" | "Production" | "Archived";
  status: string;
  run_id: string | null;
  description: string | null;
  creation_timestamp: number;
  last_updated_timestamp: number;
  tags: Record<string, string>;
}

export interface Agent {
  name: string;
  description: string | null;
  creation_timestamp: number;
  last_updated_timestamp: number;
  tags: Record<string, string>;
  latest_versions: ModelVersion[];
}

export interface AgentDetail extends Agent {
  versions: ModelVersion[];
}

export interface Experiment {
  experiment_id: string;
  name: string;
  artifact_location: string;
  lifecycle_stage: string;
  tags: Record<string, string>;
}

export interface Run {
  run_id: string;
  experiment_id: string;
  status: "RUNNING" | "SCHEDULED" | "FINISHED" | "FAILED" | "KILLED";
  start_time: number | null;
  end_time: number | null;
  artifact_uri: string;
  run_name: string | null;
  metrics: Record<string, number>;
  params: Record<string, string>;
  tags: Record<string, string>;
}

export interface RunDetail extends Run {
  lifecycle_stage: string;
}

export interface MetricPoint {
  step: number;
  value: number;
  timestamp: number;
}

export interface Artifact {
  path: string;
  is_dir: boolean;
  file_size: number | null;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  mlflow_uri: string;
  connected: boolean;
  error?: string;
}
