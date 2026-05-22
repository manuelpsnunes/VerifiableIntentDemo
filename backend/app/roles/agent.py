"""Agent role — receives L1 + L2, picks a product, builds L3a + L3b.

The agent:
1. Resolves L2 disclosures to learn allowed merchants, acceptable items, budget.
2. Asks the LLM (or stub) to pick one SKU from the acceptable list.
3. Calls the merchant to mint a signed ``checkout_jwt``.
4. Builds ``FinalPaymentMandate`` / ``FinalCheckoutMandate`` and signs L3a / L3b.
5. Builds the selective L2 presentations the merchant and network will see.

It returns everything the orchestrator needs to drive the verification steps
and the UI events.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from verifiable_intent.crypto.disclosure import (
    build_selective_presentation,
    hash_disclosure,
)
from verifiable_intent.crypto.sd_jwt import SdJwt, resolve_disclosures
from verifiable_intent.issuance.agent import (
    create_layer3_checkout,
    create_layer3_payment,
)
from verifiable_intent.models.agent_mandate import (
    CheckoutL3Mandate,
    FinalCheckoutMandate,
    FinalPaymentMandate,
    PaymentL3Mandate,
)

from ..catalog import find_product
from ..keys import get_keys
from ..llm import ProductPick, get_llm
from . import merchant as merchant_role
from .merchant import MERCHANT_URL

AGENT_ISS = "https://agent.verifiable-intent.example"
NETWORK_AUD = "https://card-network.example"


@dataclass
class AgentL2View:
    """What the agent learned from inspecting L2."""

    prompt_summary: str | None
    acceptable_items: list[dict]
    allowed_merchants: list[dict]
    max_amount_cents: int | None
    currency: str
    payment_instrument: dict


@dataclass
class AgentRun:
    pick: ProductPick
    product: dict
    checkout_jwt: str
    checkout_payload: dict
    checkout_hash_value: str
    l3a: SdJwt
    l3b: SdJwt
    l2_payment_view_ser: str
    l2_checkout_view_ser: str
    l2_view: AgentL2View
    payment_disclosure_b64: str
    merchant_disclosure_b64: str
    checkout_disclosure_b64: str
    item_disclosure_b64: str


def inspect_l2(l2: SdJwt) -> AgentL2View:
    """Pull constraints + acceptable items out of an L2 the agent just received."""
    claims = resolve_disclosures(l2)

    # Build a hash → standalone-disclosure-value map for SD-ref resolution.
    disc_by_hash: dict = {}
    for ds, dv in zip(l2.disclosures, l2.disclosure_values):
        disc_by_hash[hash_disclosure(ds)] = dv[-1] if dv else None

    acceptable_items: list[dict] = []
    allowed_merchants: list[dict] = []
    max_amount: int | None = None
    currency = "USD"
    payment_instrument: dict = {}

    for delegate in claims.get("delegate_payload", []):
        if not isinstance(delegate, dict):
            continue
        vct = delegate.get("vct")
        if vct == "mandate.checkout.open.1":
            for c in delegate.get("constraints", []):
                if c.get("type") == "mandate.checkout.line_items":
                    for entry in c.get("items", []):
                        for ai in entry.get("acceptable_items", []):
                            if isinstance(ai, dict) and "..." in ai:
                                v = disc_by_hash.get(ai["..."])
                                if isinstance(v, dict):
                                    acceptable_items.append(v)
                            elif isinstance(ai, dict):
                                acceptable_items.append(ai)
                elif c.get("type") == "mandate.checkout.allowed_merchants":
                    for m in c.get("allowed", []):
                        if isinstance(m, dict) and "..." in m:
                            v = disc_by_hash.get(m["..."])
                            if isinstance(v, dict):
                                allowed_merchants.append(v)
                        elif isinstance(m, dict):
                            allowed_merchants.append(m)
        elif vct == "mandate.payment.open.1":
            payment_instrument = delegate.get("payment_instrument", {}) or {}
            for c in delegate.get("constraints", []):
                if c.get("type") == "mandate.payment.amount_range":
                    if c.get("max") is not None:
                        max_amount = int(c["max"])
                    if c.get("currency"):
                        currency = c["currency"]

    return AgentL2View(
        prompt_summary=claims.get("prompt_summary"),
        acceptable_items=acceptable_items,
        allowed_merchants=allowed_merchants,
        max_amount_cents=max_amount,
        currency=currency,
        payment_instrument=payment_instrument,
    )


def _find_disclosure(l2: SdJwt, predicate) -> str:
    """Find the (unique) L2 disclosure whose decoded value satisfies ``predicate``."""
    for ds, dv in zip(l2.disclosures, l2.disclosure_values):
        value = dv[-1] if dv else None
        if predicate(value):
            return ds
    raise ValueError("No matching L2 disclosure found for predicate")


def run(
    l2: SdJwt,
    *,
    price_override_cents: int | None = None,
    tamper_checkout_hash: bool = False,
) -> AgentRun:
    """Execute the agent's end-to-end flow against the given L2.

    Failure-injection hooks (demo harness only — both default to safe values):

    - ``price_override_cents``: forces the agent to commit an amount that
      exceeds the L2 budget envelope. When set, the agent skips its own
      pre-flight budget check and stamps the overridden value into both the
      ``AgentRun.product`` summary and the signed L3a ``payment_amount``, so
      downstream network verification fails for real (SDK reports
      "Amount exceeds maximum").
    - ``tamper_checkout_hash``: corrupts the ``checkout_hash`` that gets baked
      into both L3a ``transaction_id`` and L3b ``final_checkout.checkout_hash``
      BEFORE either L3 credential is signed. The merchant's verifier then
      recomputes ``SHA-256(checkout_jwt)`` and rejects on a real binding
      mismatch (see SDK ``verify_checkout_hash_binding`` in
      ``verification/integrity.py``).
    """
    view = inspect_l2(l2)
    # Preserve L2 order so candidate selection is deterministic.
    seen_skus: set[str] = set()
    candidates: list[dict] = []
    for ai in view.acceptable_items:
        if not isinstance(ai, dict):
            continue
        sku = ai.get("id")
        if not isinstance(sku, str) or sku in seen_skus:
            continue
        product = find_product(sku)
        if product is None:
            continue
        seen_skus.add(sku)
        candidates.append(product)
    if not candidates:
        raise ValueError("Agent: no acceptable products resolved from L2")

    budget = view.max_amount_cents or 0
    llm = get_llm()
    pick = llm.pick_product(
        user_prompt=view.prompt_summary or "(no prompt summary)",
        candidates=candidates,
        budget_cents=budget,
    )
    product = find_product(pick.sku)
    if product is None:
        raise ValueError(f"Agent: chosen SKU {pick.sku} not in catalog")
    if price_override_cents is not None:
        # Tamper hook: force L3a amount above L2 budget so the network constraint
        # check fails. Bypass the agent's own budget guard.
        product = {**product, "price": int(price_override_cents)}
    elif budget and int(product["price"]) > budget:
        raise ValueError(
            f"Agent: chosen product price {product['price']} exceeds budget {budget}"
        )

    # Choose the merchant (single-merchant catalog for v1).
    if not view.allowed_merchants:
        raise ValueError("Agent: no allowed merchants in L2")
    selected_merchant = view.allowed_merchants[0]

    # Mint the merchant-signed checkout JWT.
    checkout_jwt, checkout_payload = merchant_role.create_checkout_jwt(
        [{"sku": product["sku"], "quantity": 1}]
    )
    c_hash = merchant_role.checkout_hash(checkout_jwt)
    if tamper_checkout_hash:
        # Tamper hook: corrupt the hash that goes into BOTH L3a.transaction_id
        # and L3b.final_checkout.checkout_hash, before signing either L3. The
        # SDK's integrity check (SHA-256(checkout_jwt) vs checkout_hash) then
        # rejects on a real binding mismatch, not just a UI relabel.
        c_hash = c_hash[:10] + "TAMPERED" + c_hash[18:]

    # Find the exact L2 disclosures that L3 sd_hash + L2 presentations need.
    payment_disc = _find_disclosure(
        l2,
        lambda v: isinstance(v, dict) and v.get("vct") == "mandate.payment.open.1",
    )
    checkout_disc = _find_disclosure(
        l2,
        lambda v: isinstance(v, dict) and v.get("vct") == "mandate.checkout.open.1",
    )
    merchant_disc = _find_disclosure(
        l2,
        lambda v: isinstance(v, dict)
        and v.get("name") == selected_merchant.get("name")
        and v.get("website") == selected_merchant.get("website"),
    )
    item_disc = _find_disclosure(
        l2,
        lambda v: isinstance(v, dict) and v.get("id") == product["sku"],
    )

    # Build L3a (payment, for network) and L3b (checkout, for merchant).
    agent = get_keys("agent")
    now = int(time.time())
    nonce = str(uuid.uuid4())
    l2_base_jwt = l2.serialize().split("~")[0]

    final_payment = FinalPaymentMandate(
        transaction_id=c_hash,
        payee=selected_merchant,
        payment_amount={"currency": "USD", "amount": int(product["price"])},
        payment_instrument=view.payment_instrument,
    )
    l3a = create_layer3_payment(
        PaymentL3Mandate(
            nonce=nonce,
            aud=NETWORK_AUD,
            iat=now,
            iss=AGENT_ISS,
            exp=now + 300,
            final_payment=final_payment,
            final_merchant=selected_merchant,
        ),
        agent.private_key,
        l2_base_jwt,
        payment_disc,
        merchant_disc,
        kid=agent.kid,
    )

    final_checkout = FinalCheckoutMandate(
        checkout_jwt=checkout_jwt,
        checkout_hash=c_hash,
    )
    l3b = create_layer3_checkout(
        CheckoutL3Mandate(
            nonce=nonce,
            aud=MERCHANT_URL,
            iat=now,
            iss=AGENT_ISS,
            exp=now + 300,
            final_checkout=final_checkout,
        ),
        agent.private_key,
        l2_base_jwt,
        checkout_disc,
        item_disc,
        kid=agent.kid,
    )

    l2_payment_view = build_selective_presentation(l2_base_jwt, [payment_disc, merchant_disc])
    l2_checkout_view = build_selective_presentation(l2_base_jwt, [checkout_disc, item_disc])

    return AgentRun(
        pick=pick,
        product=product,
        checkout_jwt=checkout_jwt,
        checkout_payload=checkout_payload,
        checkout_hash_value=c_hash,
        l3a=l3a,
        l3b=l3b,
        l2_payment_view_ser=l2_payment_view,
        l2_checkout_view_ser=l2_checkout_view,
        l2_view=view,
        payment_disclosure_b64=payment_disc,
        merchant_disclosure_b64=merchant_disc,
        checkout_disclosure_b64=checkout_disc,
        item_disclosure_b64=item_disc,
    )
