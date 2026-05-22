"""LLM client wrapper.

v1 supports Anthropic Claude only. The function signature is intentionally
small (``pick_product``) so swapping providers later is a one-file change.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

import anthropic


@dataclass
class ProductPick:
    sku: str
    rationale: str
    raw_response: dict


_TOOL_NAME = "pick_product"

_PICK_PRODUCT_TOOL = {
    "name": _TOOL_NAME,
    "description": (
        "Select exactly one product SKU from the candidate list that best satisfies the "
        "user's intent and respects the budget. Return the SKU and a short rationale."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "sku": {
                "type": "string",
                "description": "The chosen product's SKU. MUST exactly match one of the candidate SKUs.",
            },
            "rationale": {
                "type": "string",
                "description": "1-3 sentences explaining why this product was chosen.",
            },
        },
        "required": ["sku", "rationale"],
    },
}


class StubLLM:
    """Deterministic fallback used by tests / when no API key is configured."""

    def pick_product(
        self,
        *,
        user_prompt: str,
        candidates: list[dict],
        budget_cents: int,
    ) -> ProductPick:
        affordable = [c for c in candidates if int(c["price"]) <= budget_cents]
        chosen = (affordable or candidates)[0]
        return ProductPick(
            sku=chosen["sku"],
            rationale=f"[stub] Picked first affordable candidate matching '{user_prompt[:40]}…'.",
            raw_response={"stub": True},
        )


class ClaudeLLM:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def pick_product(
        self,
        *,
        user_prompt: str,
        candidates: list[dict],
        budget_cents: int,
    ) -> ProductPick:
        valid_skus = {c["sku"] for c in candidates}
        budget_usd = budget_cents / 100.0
        catalog_for_llm = [
            {
                "sku": c["sku"],
                "name": c["name"],
                "brand": c.get("brand"),
                "category": c.get("category"),
                "price_usd": c["price"] / 100.0,
            }
            for c in candidates
        ]
        system = (
            "You are a delegated shopping agent operating under a Verifiable Intent mandate. "
            "You MUST pick exactly one SKU from the candidate list. You MUST stay within the "
            "budget. If multiple products satisfy the intent, prefer the one that best matches "
            "any brand, model, or category words in the user's prompt; otherwise prefer the "
            "lowest-priced product that fits."
        )
        user = (
            f"User intent: {user_prompt}\n"
            f"Per-transaction budget: ${budget_usd:.2f} USD\n\n"
            f"Candidates (you MUST pick a sku from this list):\n"
            f"{json.dumps(catalog_for_llm, indent=2)}"
        )
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=512,
            system=system,
            tools=[_PICK_PRODUCT_TOOL],
            tool_choice={"type": "tool", "name": _TOOL_NAME},
            messages=[{"role": "user", "content": user}],
        )
        tool_use = next((b for b in resp.content if getattr(b, "type", None) == "tool_use"), None)
        if tool_use is None:
            raise RuntimeError("Claude did not return a tool_use block")
        sku = tool_use.input.get("sku", "")
        rationale = tool_use.input.get("rationale", "")
        if sku not in valid_skus:
            raise RuntimeError(f"Claude chose SKU '{sku}' not in candidate set {sorted(valid_skus)}")
        return ProductPick(
            sku=sku,
            rationale=rationale,
            raw_response={
                "model": resp.model,
                "stop_reason": resp.stop_reason,
                "tool_input": dict(tool_use.input),
            },
        )


def get_llm() -> ClaudeLLM | StubLLM:
    """Build the configured LLM client. Falls back to ``StubLLM`` if no API key."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key.startswith("sk-ant-..."):
        return StubLLM()
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5").strip() or "claude-sonnet-4-5"
    return ClaudeLLM(api_key=api_key, model=model)
