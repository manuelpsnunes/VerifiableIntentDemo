"""End-to-end smoke test: runs the orchestrator with the stub LLM and asserts the final summary."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

# Force the LLM to fall back to the stub so the test runs offline.
os.environ.pop("ANTHROPIC_API_KEY", None)

KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"


@pytest.fixture(autouse=True)
def _clean_keys_dir():
    # Use a fresh keypair set per test so this never depends on prior state.
    if KEYS_DIR.exists():
        shutil.rmtree(KEYS_DIR)
    # Clear cached keys from the module-level singleton too.
    from app import keys as keys_mod

    keys_mod._cache.clear()
    yield


@pytest.mark.asyncio
async def test_full_autonomous_flow():
    from app.orchestrator import run_demo

    summary = await run_demo("Buy a Babolat tennis racket under $400", budget_usd=400.0)

    assert summary["chain_valid"] is True, summary
    assert summary["constraints_satisfied"] is True, summary
    assert summary["authorized"] is True, summary
    assert summary["authorization_id"].startswith("AUTH-")
    # Stub LLM picks the first acceptable item from L2 order; whichever it is,
    # it must be in our catalog and within the budget.
    from app.catalog import PRODUCTS

    sku = summary["product"]["sku"]
    assert sku in {p["sku"] for p in PRODUCTS}, summary["product"]
    assert summary["amount_cents"] <= 40000, summary["amount_cents"]
