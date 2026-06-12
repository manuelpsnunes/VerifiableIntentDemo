"""Demo orchestrator — runs the full VI autonomous flow and emits events.

Exposes both a streaming `run_demo` (one event every ``STEP_PACING_S`` seconds)
and a stepped API (`start_demo` + `advance_demo` + `reset_demo`) so the UI can
walk through the same 12-event sequence one click at a time.

Both paths share the same `STEPS` table so behaviour stays in lock-step.

Supports an optional `InjectionConfig` to deliberately tamper inputs so a
verifier rejects the chain — used by the failure-injection demo track.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from verifiable_intent.crypto.sd_jwt import decode_sd_jwt

from .events import bus
from .keys import get_keys
from .roles import agent as agent_role
from .roles import issuer as issuer_role
from .roles import merchant as merchant_role
from .roles import network as network_role
from .roles import wallet as wallet_role
from .sd_jwt_view import describe_sd_jwt, describe_serialized

STEP_PACING_S = 0.6

# Injection modes the UI can request via POST /api/demo/inject.
INJECTION_MODES = {
    "tamper_l2_sd_hash",
    "exceed_budget",
    "bad_checkout_hash",
}


@dataclass
class InjectionConfig:
    """Configures one tamper strategy. Triggers a real SDK rejection downstream."""

    mode: str


async def _emit(
    state: "DemoState",
    step: int,
    role: str,
    action: str,
    summary: str,
    payload: dict[str, Any] | None = None,
):
    """Publish one event, tagging it with the current track + run_id."""
    await bus.publish(
        {
            "step": step,
            "role": role,
            "action": action,
            "summary": summary,
            "payload": payload or {},
            "track": state.track,
            "run_id": state.run_id,
        }
    )


# ---------------------------------------------------------------------------
# Shared state container
# ---------------------------------------------------------------------------


@dataclass
class DemoState:
    """Mutable scratchpad shared across the 12 orchestrator steps."""

    prompt: str
    budget_usd: float
    budget_cents: int

    # Track tagging — every emitted event carries these.
    track: str = "reference"  # "reference" | "injection"
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    injection: InjectionConfig | None = None

    l1: Any = None
    l1_ser: str | None = None
    l2: Any = None
    l2_ser: str | None = None
    view: Any = None
    run: Any = None
    merchant_result: Any = None
    network_result: Any = None
    auth: Any = None
    summary: dict | None = None
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Individual step functions — each emits exactly one event
# ---------------------------------------------------------------------------


async def _step_0_demo_started(state: DemoState) -> None:
    await bus.reset_history()
    await _emit(
        state,
        0,
        "system",
        "demo_started",
        f"Demo started — prompt='{state.prompt}', budget=${state.budget_usd:.2f}"
        + (f" · injection={state.injection.mode}" if state.injection else ""),
        {
            "prompt": state.prompt,
            "budget_usd": state.budget_usd,
            "budget_cents": state.budget_cents,
            "injection_mode": state.injection.mode if state.injection else None,
        },
    )


async def _step_1_enrollment(state: DemoState) -> None:
    issuer = get_keys("issuer")
    user = get_keys("wallet")
    agent = get_keys("agent")
    merchant = get_keys("merchant")
    network = get_keys("network")
    await _emit(
        state,
        1,
        "system",
        "enrollment",
        "Every party loaded its ES256 keypair (one per role).",
        {
            "keys": {
                "issuer": {"kid": issuer.kid, "public_jwk": issuer.public_jwk},
                "wallet": {"kid": user.kid, "public_jwk": user.public_jwk},
                "agent": {"kid": agent.kid, "public_jwk": agent.public_jwk},
                "merchant": {"kid": merchant.kid, "public_jwk": merchant.public_jwk},
                "network": {"kid": network.kid, "public_jwk": network.public_jwk},
            },
        },
    )


async def _step_2_l1_issued(state: DemoState) -> None:
    user = get_keys("wallet")
    state.l1 = issuer_role.issue_l1(user.public_jwk)
    state.l1_ser = state.l1.serialize()
    await _emit(
        state,
        2,
        "issuer",
        "l1_issued",
        "Issuer signed L1 (binds user's public key via cnf.jwk).",
        {
            "credential_layer": "L1",
            "credential": describe_sd_jwt(state.l1, serialized=state.l1_ser),
            "transmitted_to": "wallet",
        },
    )


async def _step_3_l2_created(state: DemoState) -> None:
    agent = get_keys("agent")
    assert state.l1 is not None
    # INJECTION: tamper_l2_sd_hash — use a hash of a slightly different L1 byte
    # string so L2's sd_hash claim no longer matches the real L1 the verifier
    # walks back to. The L2 signature is still valid; only the chain binding is broken.
    force_override = None
    if state.injection and state.injection.mode == "tamper_l2_sd_hash":
        from verifiable_intent.crypto.disclosure import hash_bytes
        # Tamper input: append one extra byte before hashing.
        force_override = hash_bytes((state.l1.serialize() + "X").encode("ascii"))

    state.l2 = wallet_role.create_l2(
        state.l1,
        prompt=state.prompt,
        budget_cents=state.budget_cents,
        agent_pub_jwk=agent.public_jwk,
        agent_kid=agent.kid,
        force_sd_hash_override=force_override,
    )
    state.l2_ser = state.l2.serialize()
    summary = "User wallet signed L2 mandate (autonomous mode, binds agent's key)."
    if force_override is not None:
        summary = (
            "User wallet signed L2 mandate, but sd_hash was tampered "
            "to bind a DIFFERENT L1 (real SDK signature, broken chain anchor)."
        )
    await _emit(
        state,
        3,
        "wallet",
        "l2_created",
        summary,
        {
            "credential_layer": "L2",
            "credential": describe_sd_jwt(state.l2, serialized=state.l2_ser),
            "mode": "AUTONOMOUS",
            "transmitted_to": "agent",
            "tampered": force_override is not None,
        },
    )


async def _step_4_constraints_extracted(state: DemoState) -> None:
    assert state.l2 is not None
    state.view = agent_role.inspect_l2(state.l2)
    await _emit(
        state,
        4,
        "agent",
        "constraints_extracted",
        (
            f"Agent extracted {len(state.view.acceptable_items)} acceptable items, "
            f"budget ${(state.view.max_amount_cents or 0) / 100:.2f}, "
            f"{len(state.view.allowed_merchants)} allowed merchant(s)."
        ),
        {
            "prompt_summary": state.view.prompt_summary,
            "acceptable_items": state.view.acceptable_items,
            "allowed_merchants": state.view.allowed_merchants,
            "max_amount_cents": state.view.max_amount_cents,
            "currency": state.view.currency,
            "payment_instrument": state.view.payment_instrument,
        },
    )


async def _step_5_product_selected(state: DemoState) -> None:
    assert state.l2 is not None
    # INJECTION HOOKS — applied here because agent.run() builds L3a/L3b inline.
    #   exceed_budget: bumps amount above L2 max → L3a is signed with the bad
    #     amount, so network constraint verification fails on real SDK signals.
    #   bad_checkout_hash: corrupts the checkout hash used for L3a.transaction_id
    #     and L3b.final_checkout.checkout_hash BEFORE either L3 is signed, so
    #     SDK integrity check (SHA-256(checkout_jwt) vs checkout_hash) rejects.
    price_override: int | None = None
    tampered_price = False
    tamper_checkout_hash = False
    if state.injection:
        if state.injection.mode == "exceed_budget":
            price_override = state.budget_cents + 10_000
            tampered_price = True
        elif state.injection.mode == "bad_checkout_hash":
            tamper_checkout_hash = True
    state.run = agent_role.run(
        state.l2,
        price_override_cents=price_override,
        tamper_checkout_hash=tamper_checkout_hash,
    )

    summary = (
        f"Agent (LLM) selected {state.run.product['name']} (SKU {state.run.product['sku']}) "
        f"for ${state.run.product['price'] / 100:.2f}."
    )
    if tampered_price:
        summary += " (price tampered above budget — will fail network constraints)."
    await _emit(
        state,
        5,
        "agent",
        "product_selected",
        summary,
        {
            "sku": state.run.pick.sku,
            "rationale": state.run.pick.rationale,
            "product": state.run.product,
            "raw_llm_response": state.run.pick.raw_response,
            "tampered": tampered_price,
        },
    )


async def _step_6_checkout_jwt_signed(state: DemoState) -> None:
    assert state.run is not None
    # bad_checkout_hash injection was already applied in step 5 (so the tampered
    # hash is signed INTO L3a/L3b); here we just surface that to the UI.
    tampered_hash = bool(
        state.injection and state.injection.mode == "bad_checkout_hash"
    )

    summary = "Merchant signed checkout JWT for the selected cart."
    if tampered_hash:
        summary = (
            "Merchant signed checkout JWT, but the checkout_hash baked into "
            "L3a/L3b was tampered (no longer == SHA-256(checkout_jwt)) — "
            "merchant verifier will reject on integrity check."
        )
    await _emit(
        state,
        6,
        "merchant",
        "checkout_jwt_signed",
        summary,
        {
            "checkout_jwt": state.run.checkout_jwt,
            "checkout_payload": state.run.checkout_payload,
            "checkout_hash": state.run.checkout_hash_value,
            "transmitted_to": "agent",
            "tampered": tampered_hash,
        },
    )


async def _step_7_l3_built(state: DemoState) -> None:
    assert state.run is not None
    l2_payment_view_desc = describe_serialized(state.run.l2_payment_view_ser)
    l2_checkout_view_desc = describe_serialized(state.run.l2_checkout_view_ser)
    await _emit(
        state,
        7,
        "agent",
        "l3_built",
        "Agent built L3a (payment) for network and L3b (checkout) for merchant, plus split L2 views.",
        {
            "credential_layer": "L3",
            "l3a": describe_sd_jwt(state.run.l3a),
            "l3b": describe_sd_jwt(state.run.l3b),
            "l2_payment_view": l2_payment_view_desc,
            "l2_checkout_view": l2_checkout_view_desc,
            "transmissions": [
                {"to": "network", "credentials": ["L1", "L2(payment view)", "L3a"]},
                {"to": "merchant", "credentials": ["L1", "L2(checkout view)", "L3b"]},
            ],
        },
    )


async def _step_8_merchant_verifies(state: DemoState) -> None:
    assert state.l1 is not None and state.l2 is not None and state.run is not None
    state.merchant_result = merchant_role.verify_l3b(
        l1=state.l1,
        l2_checkout_view_ser=state.run.l2_checkout_view_ser,
        l3b=state.run.l3b,
        l1_serialized=state.l1_ser,
        l2_serialized=state.l2_ser,
        l2_checkout_serialized=state.run.l2_checkout_view_ser,
    )
    mr = state.merchant_result
    await _emit(
        state,
        8,
        "merchant",
        "merchant_verified",
        (
            "Merchant verified the checkout-side chain (L1 → L2(checkout) → L3b)."
            if mr.valid
            else "Merchant rejected the checkout-side chain."
        ),
        {
            "chain_valid": mr.valid,
            "errors": list(mr.errors),
            "checks_performed": list(mr.checks_performed),
            "checks_skipped": list(mr.checks_skipped),
            "l2_checkout_disclosed": mr.l2_checkout_disclosed,
            "l2_payment_disclosed": mr.l2_payment_disclosed,
        },
    )


async def _step_9_network_verifies(state: DemoState) -> None:
    assert state.l1 is not None and state.l2 is not None and state.run is not None
    state.network_result = network_role.verify_l3a(
        l1=state.l1,
        l2_payment_view_ser=state.run.l2_payment_view_ser,
        l3a=state.run.l3a,
        l2_full=state.l2,
        l1_serialized=state.l1_ser,
        l2_serialized=state.l2_ser,
        l2_payment_serialized=state.run.l2_payment_view_ser,
    )
    nr = state.network_result
    await _emit(
        state,
        9,
        "network",
        "network_verified",
        (
            "Network verified the payment-side chain and checked all constraints."
            if nr.chain_result.valid and nr.constraints_satisfied
            else "Network rejected the payment-side chain or constraints."
        ),
        {
            "chain_valid": nr.chain_result.valid,
            "chain_errors": list(nr.chain_result.errors),
            "constraints_satisfied": nr.constraints_satisfied,
            "constraint_checks": nr.constraint_checks_performed,
            "constraint_violations": nr.constraint_violations,
            "fulfillment": nr.fulfillment,
        },
    )


async def _step_10_authorize(state: DemoState) -> None:
    assert state.network_result is not None
    nr = state.network_result
    mr = state.merchant_result
    state.auth = network_role.AuthResult(
        approved=False, authorization_id="", mode="mock", reason="not run"
    )
    # Real-world flow: a merchant who rejects L3b will not honor the order, so
    # the network authorizing in isolation produces a broken transaction. Gate
    # authorization on BOTH legs so the demo decline path matches reality.
    if mr and not mr.valid:
        state.auth = network_role.AuthResult(
            approved=False,
            authorization_id="",
            mode="mock",
            reason=f"merchant rejected L3b: {mr.errors[0] if mr.errors else 'unknown'}",
        )
    elif nr.chain_result.valid and nr.constraints_satisfied:
        state.auth = network_role.authorize(nr.fulfillment)
    auth = state.auth
    await _emit(
        state,
        10,
        "network",
        "authorized" if auth.approved else "declined",
        (
            f"Payment {'approved' if auth.approved else 'declined'}: "
            f"{auth.authorization_id or auth.reason}"
        ),
        {
            "approved": auth.approved,
            "authorization_id": auth.authorization_id,
            "mode": auth.mode,
            "reason": auth.reason,
            "extra": auth.extra,
        },
    )


async def _step_11_demo_complete(state: DemoState) -> None:
    mr = state.merchant_result
    nr = state.network_result
    auth = state.auth
    run = state.run
    state.summary = {
        "chain_valid": bool(mr and nr and mr.valid and nr.chain_result.valid),
        "constraints_satisfied": bool(nr and nr.constraints_satisfied),
        "authorized": bool(auth and auth.approved),
        "authorization_id": auth.authorization_id if auth else "",
        "product": run.product if run else None,
        "amount_cents": int(run.product["price"]) if run else 0,
        "currency": "USD",
        "merchant": (
            run.l2_view.allowed_merchants[0]
            if run and run.l2_view.allowed_merchants
            else None
        ),
        "prompt": state.prompt,
        "budget_cents": state.budget_cents,
        "completed_at": time.time(),
        "injection_mode": state.injection.mode if state.injection else None,
    }
    await _emit(
        state,
        11,
        "system",
        "demo_complete",
        "Demo run finished.",
        {"summary": state.summary},
    )


# ---------------------------------------------------------------------------
# Step table — names are surfaced to the UI so users know what's next
# ---------------------------------------------------------------------------


StepFn = Callable[[DemoState], Awaitable[None]]


@dataclass
class StepMeta:
    index: int
    action: str
    title: str
    role: str
    fn: StepFn


STEPS: list[StepMeta] = [
    StepMeta(0, "demo_started", "Kick off the demo", "system", _step_0_demo_started),
    StepMeta(1, "enrollment", "Load every role's keypair", "system", _step_1_enrollment),
    StepMeta(2, "l1_issued", "Issuer signs L1 card credential", "issuer", _step_2_l1_issued),
    StepMeta(3, "l2_created", "Wallet signs L2 mandate", "wallet", _step_3_l2_created),
    StepMeta(4, "constraints_extracted", "Agent inspects L2 constraints", "agent", _step_4_constraints_extracted),
    StepMeta(5, "product_selected", "Agent picks a product (Claude)", "agent", _step_5_product_selected),
    StepMeta(6, "checkout_jwt_signed", "Merchant signs checkout JWT", "merchant", _step_6_checkout_jwt_signed),
    StepMeta(7, "l3_built", "Agent signs L3a + L3b", "agent", _step_7_l3_built),
    StepMeta(8, "merchant_verified", "Merchant verifies L1→L2(checkout)→L3b", "merchant", _step_8_merchant_verifies),
    StepMeta(9, "network_verified", "Network verifies L1→L2(payment)→L3a + constraints", "network", _step_9_network_verifies),
    StepMeta(10, "authorized", "Network authorizes payment", "network", _step_10_authorize),
    StepMeta(11, "demo_complete", "Wrap up & summarize", "system", _step_11_demo_complete),
]


# ---------------------------------------------------------------------------
# Public APIs
# ---------------------------------------------------------------------------


async def run_demo(
    prompt: str,
    budget_usd: float,
    *,
    injection: InjectionConfig | None = None,
    track: str = "reference",
    preserve_history: bool = False,
) -> dict:
    """Run all 12 steps back-to-back with ``STEP_PACING_S`` between each.

    ``injection`` triggers a tampered run that real verifiers will reject.
    ``preserve_history`` skips the bus history wipe so a prior reference
    track stays on the WebSocket replay buffer.
    """
    state = DemoState(
        prompt=prompt,
        budget_usd=budget_usd,
        budget_cents=int(round(budget_usd * 100)),
        injection=injection,
        track=track,
    )
    # When running an injection track on top of a reference one, suppress the
    # reset_history side-effect of step 0 so the UI keeps both tracks visible.
    if preserve_history:
        # Monkey-patch a no-op reset for this run by stashing the original.
        original_reset = bus.reset_history
        async def _noop():  # type: ignore[no-redef]
            return None
        bus.reset_history = _noop  # type: ignore[assignment]
        try:
            for i, step in enumerate(STEPS):
                await step.fn(state)
                if i < len(STEPS) - 1:
                    await asyncio.sleep(STEP_PACING_S)
        finally:
            bus.reset_history = original_reset  # type: ignore[assignment]
    else:
        for i, step in enumerate(STEPS):
            await step.fn(state)
            if i < len(STEPS) - 1:
                await asyncio.sleep(STEP_PACING_S)
    _ = decode_sd_jwt  # keep import live
    return state.summary or {}
    return state.summary or {}


# ----- Stepped (manual) mode -----------------------------------------------


_session_state: DemoState | None = None
_session_cursor: int = 0


def step_table() -> list[dict[str, Any]]:
    """Return the step list as plain dicts for API responses."""
    return [
        {"index": s.index, "action": s.action, "title": s.title, "role": s.role}
        for s in STEPS
    ]


def session_status() -> dict[str, Any]:
    """Snapshot of the current manual session, if any."""
    total = len(STEPS)
    active = _session_state is not None
    next_step = STEPS[_session_cursor] if active and _session_cursor < total else None
    return {
        "active": active,
        "total_steps": total,
        "next_step_index": _session_cursor if active else None,
        "next_step": (
            {
                "index": next_step.index,
                "action": next_step.action,
                "title": next_step.title,
                "role": next_step.role,
            }
            if next_step
            else None
        ),
        "done": active and _session_cursor >= total,
        "summary": _session_state.summary if _session_state else None,
    }


async def start_demo(prompt: str, budget_usd: float) -> dict[str, Any]:
    """Initialize a stepped session. Resets event history. Does NOT run any step yet."""
    global _session_state, _session_cursor
    _session_state = DemoState(
        prompt=prompt,
        budget_usd=budget_usd,
        budget_cents=int(round(budget_usd * 100)),
    )
    _session_cursor = 0
    await bus.reset_history()
    return session_status()


async def advance_demo() -> dict[str, Any]:
    """Run exactly one step and return updated status."""
    global _session_cursor
    if _session_state is None:
        raise RuntimeError("no demo session — call /api/demo/start first")
    if _session_cursor >= len(STEPS):
        return session_status()
    step = STEPS[_session_cursor]
    await step.fn(_session_state)
    _session_cursor += 1
    status = session_status()
    status["just_ran"] = {
        "index": step.index,
        "action": step.action,
        "title": step.title,
        "role": step.role,
    }
    return status


async def reset_demo() -> dict[str, Any]:
    """Clear any in-progress session and wipe the event bus history."""
    global _session_state, _session_cursor
    _session_state = None
    _session_cursor = 0
    await bus.reset_history()
    return session_status()
