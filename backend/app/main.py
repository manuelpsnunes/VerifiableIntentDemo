"""FastAPI app: REST endpoints to run the demo and fetch its events.

The demo is deterministic and computed in a single pass, so every endpoint is
plain request/response — no WebSocket. `run`/`inject` return the full ordered
event list; the frontend paces their reveal client-side. This keeps the app
hostable on free serverless/static tiers with no long-lived connections.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Load .env from the repo root (parent of backend/) before anything else.
_repo_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_repo_root / ".env")

from .catalog import MERCHANTS, PAYMENT_INSTRUMENT, PRODUCTS  # noqa: E402
from .keys import _ROLE_KIDS, all_role_jwks  # noqa: E402
from .orchestrator import (  # noqa: E402
    INJECTION_MODES,
    InjectionConfig,
    advance_demo,
    reset_demo,
    run_demo,
    session_status,
    start_demo,
    step_table,
)

logger = logging.getLogger("vi-demo")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

app = FastAPI(title="Verifiable Intent Demo", version="0.1.0")

# Allow the Vite dev server (and any local origin) for the demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DemoRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    budget_usd: float = Field(..., gt=0, le=10_000)


class InjectRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    budget_usd: float = Field(..., gt=0, le=10_000)
    mode: str = Field(..., min_length=1)


class DemoResponse(BaseModel):
    ok: bool
    summary: dict | None = None
    events: list[dict] | None = None
    error: str | None = None


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@app.get("/api/catalog")
async def get_catalog() -> dict:
    products = [{**p, "price_dollars": p["price"] / 100.0} for p in PRODUCTS]
    return {
        "merchant": MERCHANTS[0],
        "merchants": MERCHANTS,
        "products": products,
        "payment_instrument": PAYMENT_INSTRUMENT,
    }


@app.get("/api/roles")
async def get_roles() -> dict:
    jwks = all_role_jwks()
    roles_list = [
        {"role": role, "kid": _ROLE_KIDS[role], "jwk": jwk}
        for role, jwk in jwks.items()
    ]
    return {"roles": roles_list, "public_jwks": jwks}


_demo_lock = asyncio.Lock()


@app.post("/api/demo/run", response_model=DemoResponse)
async def post_demo_run(req: DemoRequest) -> DemoResponse:
    # Serialize demo runs so two clients don't interleave shared key state.
    async with _demo_lock:
        try:
            result = await run_demo(req.prompt, req.budget_usd)
            return DemoResponse(
                ok=True, summary=result["summary"], events=result["events"]
            )
        except Exception as exc:  # noqa: BLE001 — surface any failure to the UI
            logger.exception("demo run failed")
            return DemoResponse(ok=False, error=str(exc))


@app.post("/api/demo/inject", response_model=DemoResponse)
async def post_demo_inject(req: InjectRequest) -> DemoResponse:
    """Run an injection track that deliberately tampers an input.

    The chain breaks at a real SDK verifier (no shortcuts). The frontend
    layers these events on top of the reference run so the user can compare.
    """
    if req.mode not in INJECTION_MODES:
        return DemoResponse(
            ok=False,
            error=f"unknown injection mode '{req.mode}'. Valid: {sorted(INJECTION_MODES)}",
        )
    async with _demo_lock:
        try:
            result = await run_demo(
                req.prompt,
                req.budget_usd,
                injection=InjectionConfig(mode=req.mode),
                track="injection",
            )
            return DemoResponse(
                ok=True, summary=result["summary"], events=result["events"]
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("injection run failed")
            return DemoResponse(ok=False, error=str(exc))


# ----- Stepped (manual) demo mode ----------------------------------------


@app.get("/api/demo/steps")
async def get_demo_steps() -> dict:
    """Return the full step table so the UI can render a roadmap."""
    return {"steps": step_table(), "total": len(step_table())}


@app.get("/api/demo/session")
async def get_demo_session() -> dict:
    return session_status()


@app.post("/api/demo/start")
async def post_demo_start(req: DemoRequest) -> dict:
    async with _demo_lock:
        return await start_demo(req.prompt, req.budget_usd)


@app.post("/api/demo/step")
async def post_demo_step() -> dict:
    async with _demo_lock:
        try:
            return await advance_demo()
        except RuntimeError as exc:
            return {"error": str(exc), **session_status()}
        except Exception as exc:  # noqa: BLE001 — surface failures to the UI
            logger.exception("demo step failed")
            failed_event = {
                "ts": 0,
                "step": -1,
                "role": "system",
                "action": "demo_failed",
                "summary": f"Demo step failed: {exc}",
                "payload": {"error": str(exc), "error_type": type(exc).__name__},
                "track": "reference",
            }
            return {"error": str(exc), "events": [failed_event], **session_status()}


@app.post("/api/demo/reset")
async def post_demo_reset() -> dict:
    async with _demo_lock:
        return await reset_demo()


# ----- Static frontend (single same-origin deployment) ---------------------
# In production the Vite build is served by this same process so the app has
# one origin (no CORS, relative API URLs). Mounted LAST so every /api route
# above takes precedence over the catch-all. Skipped in local dev when no
# build exists (the Vite dev server serves the frontend on :5173 instead).
_frontend_dist_env = os.environ.get("FRONTEND_DIST")
_dist_candidates = ([Path(_frontend_dist_env)] if _frontend_dist_env else []) + [
    _repo_root / "frontend" / "dist",
    Path(__file__).resolve().parent / "static",
]
for _dist in _dist_candidates:
    if _dist.is_dir():
        app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
        logger.info("Serving frontend from %s", _dist)
        break
