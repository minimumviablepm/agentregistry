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
