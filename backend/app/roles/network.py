"""Payment network role — verifies L3a, runs constraints, authorizes the payment.

The ``authorize()`` step is currently a mock so the demo runs offline. The
interface (``AuthResult`` + ``authorize(payment_mandate, mode)``) is shaped so a
real Stripe Test Mode adapter can drop in for v2 without changing callers.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from typing import Literal

from verifiable_intent.crypto.disclosure import hash_disclosure
from verifiable_intent.crypto.sd_jwt import SdJwt, decode_sd_jwt
from verifiable_intent.verification.chain import (
    ChainVerificationResult,
    verify_chain,
)
from verifiable_intent.verification.constraint_checker import (
    StrictnessMode,
    check_constraints,
)

from ..keys import get_keys

NETWORK_URL = "https://www.mastercard.com"


@dataclass
class AuthResult:
    approved: bool
    authorization_id: str
    network: str = "vi-mock-network"
    mode: Literal["mock", "stripe"] = "mock"
    reason: str | None = None
    extra: dict = field(default_factory=dict)


@dataclass
class NetworkVerifyResult:
    chain_result: ChainVerificationResult
    constraints_satisfied: bool
    constraint_checks_performed: list[str]
    constraint_violations: list[str]
    fulfillment: dict
    payment_constraints: list[dict]


def verify_l3a(
    l1: SdJwt,
    l2_payment_view_ser: str,
    l3a: SdJwt,
    l2_full: SdJwt,
    l1_serialized: str,
    l2_serialized: str,
    l2_payment_serialized: str,
) -> NetworkVerifyResult:
    """Verify the payment-side chain + check constraints from the network's PoV.

    ``l2_full`` is the wallet's full L2 SdJwt — needed only so we can resolve
    merchant SD refs for the ``mandate.payment.allowed_payees`` constraint. In a
    real deployment the network would receive only ``l2_payment_view_ser``.
    """
    issuer_pub = get_keys("issuer").public_key
    l1_parsed = decode_sd_jwt(l1.serialize())
    l2_payment_parsed = decode_sd_jwt(l2_payment_view_ser)

    chain = verify_chain(
        l1_parsed,
        l2_payment_parsed,
        l3_payment=l3a,
        issuer_public_key=issuer_pub,
        l1_serialized=l1_serialized,
        l2_serialized=l2_serialized,
        l2_payment_serialized=l2_payment_serialized,
    )

    constraints_satisfied = True
    constraint_checks: list[str] = []
    constraint_violations: list[str] = []
    fulfillment: dict = {}
    payment_constraints: list[dict] = []

    if chain.valid:
        # Pull payment constraints out of L2 and the fulfillment out of L3a.
        for delegate in chain.l2_claims.get("delegate_payload", []):
            if isinstance(delegate, dict) and delegate.get("vct") == "mandate.payment.open.1":
                payment_constraints = list(delegate.get("constraints", []))
                break
        for delegate in chain.l3_payment_claims.get("delegate_payload", []):
            if isinstance(delegate, dict) and delegate.get("vct") == "mandate.payment.1":
                fulfillment = dict(delegate)
                break

        # The allowed_payees constraint references merchant SD disclosures by
        # hash; resolve them from the full L2 so the constraint checker can
        # match the L3a payee against the allowlist.
        disc_by_hash: dict = {}
        for ds, dv in zip(l2_full.disclosures, l2_full.disclosure_values):
            disc_by_hash[hash_disclosure(ds)] = dv
        for c in payment_constraints:
            if c.get("type") == "mandate.payment.allowed_payees":
                resolved = []
                for ref in c.get("allowed", []):
                    h = ref.get("...") if isinstance(ref, dict) else None
                    if h and h in disc_by_hash:
                        # disclosure values are [salt, value] for array elements
                        resolved.append(disc_by_hash[h][-1])
                fulfillment["allowed_merchants"] = resolved
                break

        if fulfillment and payment_constraints:
            cr = check_constraints(
                payment_constraints,
                fulfillment,
                mode=StrictnessMode.STRICT,
                is_open_mandate=True,
            )
            constraints_satisfied = cr.satisfied
            constraint_checks = list(cr.checked)
            constraint_violations = list(cr.violations)

    return NetworkVerifyResult(
        chain_result=chain,
        constraints_satisfied=constraints_satisfied,
        constraint_checks_performed=constraint_checks,
        constraint_violations=constraint_violations,
        fulfillment=fulfillment,
        payment_constraints=payment_constraints,
    )


def authorize(payment_mandate: dict, *, max_amount_cents: int = 100_000) -> AuthResult:
    """Approve / decline the payment.

    v1 = mock: approves anything <= ``max_amount_cents`` (default $1,000).
    v2 = real Stripe: drop in a ``stripe_adapter.authorize()`` here when
    ``PAYMENT_NETWORK_MODE=stripe``.

    KNOWN v0.1 SIMPLIFICATIONS (vs spec MUST-level network behavior):
    - No nonce / replay tracking. A duplicate L3a with the same nonce would
      still authorize.
    - No one-L3-per-(L2, merchant) pair enforcement.
    - No cumulative spend tracking across calls under the same L2 budget.
    A real network adapter would persist these and reject on violation.
    """
    mode = os.environ.get("PAYMENT_NETWORK_MODE", "mock").lower()
    if mode != "mock":
        # Reserved for v2 — keeping the surface clean.
        return AuthResult(
            approved=False,
            authorization_id="",
            mode="stripe",
            reason=f"PAYMENT_NETWORK_MODE='{mode}' not implemented in v1",
        )

    amount = int(payment_mandate.get("payment_amount", {}).get("amount", 0))
    payee = payment_mandate.get("payee", {})
    if amount <= 0:
        return AuthResult(
            approved=False,
            authorization_id="",
            mode="mock",
            reason="non-positive amount",
        )
    if amount > max_amount_cents:
        return AuthResult(
            approved=False,
            authorization_id="",
            mode="mock",
            reason=f"amount {amount} exceeds mock-network ceiling {max_amount_cents}",
        )
    return AuthResult(
        approved=True,
        authorization_id=f"AUTH-{uuid.uuid4().hex[:12].upper()}",
        mode="mock",
        extra={
            "payee": payee.get("name"),
            "amount_cents": amount,
            "currency": payment_mandate.get("payment_amount", {}).get("currency", "USD"),
        },
    )
