"""Layer 2 user wallet — turns user intent into a signed VI mandate.

Inputs:
- the L1 credential (so we can hash it for ``sd_hash``)
- a natural-language ``prompt`` describing what the user wants
- a ``budget_cents`` ceiling
- the agent the user wants to delegate to (its public key + kid)

Output: an autonomous-mode L2 KB-SD-JWT+KB with:
- AllowedMerchantConstraint (all merchants the wallet trusts)
- CheckoutLineItemsConstraint (all acceptable items, single-line cart)
- PaymentAmountConstraint (1c .. budget_cents)
- AllowedPayeeConstraint (same merchant set)
- PaymentRecurrenceConstraint (one-shot — bounded date window, number=1)
"""

from __future__ import annotations

import time
import uuid

from verifiable_intent.crypto.disclosure import hash_bytes
from verifiable_intent.crypto.sd_jwt import SdJwt
from verifiable_intent.issuance.user import create_layer2_autonomous
from verifiable_intent.models.constraints import (
    AllowedMerchantConstraint,
    AllowedPayeeConstraint,
    CheckoutLineItemsConstraint,
    PaymentAmountConstraint,
)
from verifiable_intent.models.user_mandate import (
    CheckoutMandate,
    MandateMode,
    PaymentMandate,
    UserMandate,
)

from ..catalog import MERCHANTS, PAYMENT_INSTRUMENT, acceptable_items
from ..keys import get_keys

WALLET_ISS = "https://wallet.example.com"
AGENT_AUD = "https://agent.verifiable-intent.example"


def create_l2(
    l1: SdJwt,
    *,
    prompt: str,
    budget_cents: int,
    agent_pub_jwk: dict,
    agent_kid: str,
    lifetime_seconds: int = 60 * 60,  # 1 hour
    force_sd_hash_override: str | None = None,
) -> SdJwt:
    """Build and sign the L2 autonomous mandate.

    ``force_sd_hash_override`` lets the demo orchestrator inject a tampered
    ``sd_hash`` value so downstream verifiers reject the chain. Defaults to
    None (= compute the real binding to ``l1``).
    """
    user = get_keys("wallet")
    now = int(time.time())

    items = acceptable_items()

    checkout_mandate = CheckoutMandate(
        vct="mandate.checkout.open.1",
        cnf_jwk=agent_pub_jwk,
        cnf_kid=agent_kid,
        constraints=[
            AllowedMerchantConstraint(allowed=list(MERCHANTS)),
            CheckoutLineItemsConstraint(
                items=[
                    {
                        "id": "line-item-1",
                        "acceptable_items": list(items),
                        "quantity": 1,
                    }
                ],
                match_mode="minimum",
            ),
        ],
    )

    payment_mandate = PaymentMandate(
        vct="mandate.payment.open.1",
        cnf_jwk=agent_pub_jwk,
        cnf_kid=agent_kid,
        payment_instrument=PAYMENT_INSTRUMENT,
        risk_data={"device_id": "demo-device-001", "ip_address": "127.0.0.1"},
        constraints=[
            PaymentAmountConstraint(currency="USD", min=100, max=budget_cents),
            AllowedPayeeConstraint(allowed=list(MERCHANTS)),
            # NOTE: spec also requires `mandate.payment.reference` for autonomous
            # mode — the SDK's create_layer2_autonomous() auto-injects it with
            # conditional_transaction_id = hash_disclosure(checkout_disc), so we
            # don't (and must not) add it here. Verify via resolve_disclosures()
            # — it appears in the L2 payment constraint list.
        ],
    )

    mandate = UserMandate(
        nonce=str(uuid.uuid4()),
        aud=AGENT_AUD,
        iat=now,
        iss=WALLET_ISS,
        exp=now + lifetime_seconds,
        mode=MandateMode.AUTONOMOUS,
        sd_hash=(
            force_sd_hash_override
            if force_sd_hash_override is not None
            else hash_bytes(l1.serialize().encode("ascii"))
        ),
        prompt_summary=prompt,
        checkout_mandate=checkout_mandate,
        payment_mandate=payment_mandate,
        merchants=list(MERCHANTS),
        acceptable_items=items,
    )

    return create_layer2_autonomous(mandate, user.private_key, kid=user.kid)
