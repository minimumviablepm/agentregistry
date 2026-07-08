import os
from contextlib import asynccontextmanager
from typing import Optional

import mlflow
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mlflow.exceptions import MlflowException
from mlflow.tracking import MlflowClient
from pydantic import BaseModel

# Stage priority for deriving "primary stage" per agent
_STAGE_PRIORITY = {"Production": 0, "Staging": 1, "None": 2, "Archived": 3}

load_dotenv()

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    yield


app = FastAPI(title="Agent Registry API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client() -> MlflowClient:
    return MlflowClient(tracking_uri=MLFLOW_TRACKING_URI)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    try:
        client = get_client()
        client.search_registered_models(max_results=1)
        return {"status": "ok", "mlflow_uri": MLFLOW_TRACKING_URI, "connected": True}
    except Exception as e:
        return {"status": "degraded", "mlflow_uri": MLFLOW_TRACKING_URI, "connected": False, "error": str(e)}


# ── Agents (Registered Models) ────────────────────────────────────────────────

@app.get("/api/agents")
def list_agents(
    filter_string: str = Query("", alias="filter"),
    max_results: int = Query(100),
):
    client = get_client()
    try:
        models = client.search_registered_models(
            filter_string=filter_string or None,
            max_results=max_results,
        )
        return [_serialize_registered_model(m) for m in models]
    except MlflowException as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/agents/{name}")
def get_agent(name: str):
    client = get_client()
    try:
        model = client.get_registered_model(name)
        versions = client.search_model_versions(f"name='{name}'")
        return {
            **_serialize_registered_model(model),
            "versions": [_serialize_model_version(v) for v in versions],
        }
    except MlflowException as e:
        raise HTTPException(status_code=404, detail=str(e))


class RegisterAgentRequest(BaseModel):
    name: str
    description: Optional[str] = None
    tags: Optional[dict[str, str]] = None


@app.post("/api/agents")
def register_agent(body: RegisterAgentRequest):
    client = get_client()
    try:
        model = client.create_registered_model(
            name=body.name,
            description=body.description,
            tags=body.tags,
        )
        return _serialize_registered_model(model)
    except MlflowException as e:
        raise HTTPException(status_code=400, detail=str(e))


class TransitionStageRequest(BaseModel):
    stage: str  # Staging | Production | Archived | None
    archive_existing: bool = True


@app.put("/api/agents/{name}/versions/{version}/stage")
def transition_stage(name: str, version: str, body: TransitionStageRequest):
    client = get_client()
    try:
        mv = client.transition_model_version_stage(
            name=name,
            version=version,
            stage=body.stage,
            archive_existing_versions=body.archive_existing,
        )
        return _serialize_model_version(mv)
    except MlflowException as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Experiments ───────────────────────────────────────────────────────────────

@app.get("/api/experiments")
def list_experiments():
    client = get_client()
    try:
        exps = client.search_experiments()
        return [_serialize_experiment(e) for e in exps]
    except MlflowException as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Runs ──────────────────────────────────────────────────────────────────────

@app.get("/api/runs")
def list_runs(
    experiment_ids: list[str] = Query(None),
    filter_string: str = Query("", alias="filter"),
    max_results: int = Query(50),
    order_by: str = Query("start_time DESC"),
):
    client = get_client()
    try:
        if not experiment_ids:
            exps = client.search_experiments()
            experiment_ids = [e.experiment_id for e in exps]
        runs = client.search_runs(
            experiment_ids=experiment_ids,
            filter_string=filter_string or None,
            max_results=max_results,
            order_by=[order_by],
        )
        return [_serialize_run(r) for r in runs]
    except MlflowException as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    client = get_client()
    try:
        run = client.get_run(run_id)
        return _serialize_run(run, full=True)
    except MlflowException as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/runs/{run_id}/metrics/{metric_key}")
def get_metric_history(run_id: str, metric_key: str):
    client = get_client()
    try:
        history = client.get_metric_history(run_id, metric_key)
        return [{"step": m.step, "value": m.value, "timestamp": m.timestamp} for m in history]
    except MlflowException as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/runs/{run_id}/artifacts")
def list_artifacts(run_id: str, path: str = Query("")):
    client = get_client()
    try:
        artifacts = client.list_artifacts(run_id, path or None)
        return [{"path": a.path, "is_dir": a.is_dir, "file_size": a.file_size} for a in artifacts]
    except MlflowException as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Workforce ─────────────────────────────────────────────────────────────────

@app.get("/api/workforce")
def get_workforce():
    client = get_client()
    try:
        # 1. All registered models
        models = client.search_registered_models(max_results=200)

        # 2. All versions per model → collect run_ids
        agent_versions: dict[str, list] = {}
        all_run_ids: set[str] = set()
        for m in models:
            versions = client.search_model_versions(f"name='{m.name}'")
            agent_versions[m.name] = list(versions)
            for v in versions:
                if v.run_id:
                    all_run_ids.add(v.run_id)

        # 3. Bulk-fetch runs across all experiments (single search_runs call)
        run_lookup: dict[str, object] = {}
        if all_run_ids:
            exps = client.search_experiments()
            exp_ids = [e.experiment_id for e in exps]
            if exp_ids:
                runs = client.search_runs(
                    experiment_ids=exp_ids,
                    max_results=500,
                    order_by=["start_time DESC"],
                )
                for r in runs:
                    if r.info.run_id in all_run_ids:
                        run_lookup[r.info.run_id] = r

        # 4. Build workforce summary per agent
        result = []
        for m in models:
            versions = agent_versions[m.name]
            agent_runs = [
                run_lookup[v.run_id]
                for v in versions
                if v.run_id and v.run_id in run_lookup
            ]

            # Primary stage: highest-priority stage across all versions
            stages = [v.current_stage for v in versions]
            primary_stage = min(stages, key=lambda s: _STAGE_PRIORITY.get(s, 99)) if stages else "None"

            # Compute stats
            stats = _compute_run_stats(agent_runs)

            result.append({
                "name": m.name,
                "description": m.description,
                "primary_stage": primary_stage,
                "total_versions": len(versions),
                "activity_status": stats["activity_status"],
                "run_stats": {
                    "total": stats["total"],
                    "running_count": stats["running_count"],
                    "success_rate": stats["success_rate"],
                    "avg_duration_ms": stats["avg_duration_ms"],
                    "last_run_id": stats["last_run_id"],
                    "last_run_status": stats["last_run_status"],
                    "last_run_time": stats["last_run_time"],
                    "last_run_duration_ms": stats["last_run_duration_ms"],
                },
                "tags": {t.key: t.value for t in (m.tags or [])},
                "last_updated_timestamp": m.last_updated_timestamp,
            })

        return result
    except MlflowException as e:
        raise HTTPException(status_code=502, detail=str(e))


def _compute_run_stats(runs: list) -> dict:
    if not runs:
        return {
            "activity_status": "no_data",
            "total": 0,
            "running_count": 0,
            "success_rate": None,
            "avg_duration_ms": None,
            "last_run_id": None,
            "last_run_status": None,
            "last_run_time": None,
            "last_run_duration_ms": None,
        }

    running = [r for r in runs if r.info.status == "RUNNING"]
    completed = [r for r in runs if r.info.status in ("FINISHED", "FAILED", "KILLED")]
    finished = [r for r in runs if r.info.status == "FINISHED"]

    # Sort by start_time descending to find the most recent run
    sorted_runs = sorted(runs, key=lambda r: r.info.start_time or 0, reverse=True)
    last = sorted_runs[0]

    # Derive activity status
    if running:
        activity_status = "running"
    elif last.info.status in ("FAILED", "KILLED"):
        activity_status = "failed"
    else:
        activity_status = "idle"

    # Avg duration only from runs that have both start and end times
    timed = [
        r for r in completed
        if r.info.start_time and r.info.end_time
    ]
    avg_duration_ms = (
        sum(r.info.end_time - r.info.start_time for r in timed) / len(timed)
        if timed else None
    )

    last_duration_ms = (
        last.info.end_time - last.info.start_time
        if last.info.start_time and last.info.end_time
        else None
    )

    success_rate = (
        round(len(finished) / len(completed), 4)
        if completed else None
    )

    return {
        "activity_status": activity_status,
        "total": len(runs),
        "running_count": len(running),
        "success_rate": success_rate,
        "avg_duration_ms": avg_duration_ms,
        "last_run_id": last.info.run_id,
        "last_run_status": last.info.status,
        "last_run_time": last.info.start_time,
        "last_run_duration_ms": last_duration_ms,
    }


# ── Serialisers ───────────────────────────────────────────────────────────────

def _serialize_registered_model(m):
    latest = getattr(m, "latest_versions", [])
    return {
        "name": m.name,
        "description": m.description,
        "creation_timestamp": m.creation_timestamp,
        "last_updated_timestamp": m.last_updated_timestamp,
        "tags": {t.key: t.value for t in (m.tags or [])},
        "latest_versions": [_serialize_model_version(v) for v in latest],
    }


def _serialize_model_version(v):
    return {
        "name": v.name,
        "version": v.version,
        "stage": v.current_stage,
        "status": v.status,
        "run_id": v.run_id,
        "description": v.description,
        "creation_timestamp": v.creation_timestamp,
        "last_updated_timestamp": v.last_updated_timestamp,
        "tags": {t.key: t.value for t in (v.tags or [])},
    }


def _serialize_experiment(e):
    return {
        "experiment_id": e.experiment_id,
        "name": e.name,
        "artifact_location": e.artifact_location,
        "lifecycle_stage": e.lifecycle_stage,
        "tags": {t.key: t.value for t in (e.tags or [])},
    }


def _serialize_run(r, full: bool = False):
    data = {
        "run_id": r.info.run_id,
        "experiment_id": r.info.experiment_id,
        "status": r.info.status,
        "start_time": r.info.start_time,
        "end_time": r.info.end_time,
        "artifact_uri": r.info.artifact_uri,
        "run_name": r.info.run_name,
        "metrics": dict(r.data.metrics),
        "params": dict(r.data.params),
        "tags": dict(r.data.tags),
    }
    if full:
        data["lifecycle_stage"] = r.info.lifecycle_stage
    return data
