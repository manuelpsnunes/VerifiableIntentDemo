"""Merchant role — owns the catalog, signs the checkout JWT, verifies L3b.

The checkout JWT format mirrors the one used in the SDK's
``examples/helpers.py``. The merchant's verification uses the SDK's
``verify_chain`` against the L3b (checkout-side) presentation.
"""

from __future__ import annotations

import hashlib
import time

from verifiable_intent.crypto.disclosure import _b64url_encode
from verifiable_intent.crypto.sd_jwt import SdJwt, decode_sd_jwt
from verifiable_intent.crypto.signing import _jwt_encode
from verifiable_intent.verification.chain import (
    ChainVerificationResult,
    verify_chain,
)

from ..catalog import MERCHANTS, PRODUCTS, find_product
from ..keys import get_keys

MERCHANT_URL = "https://tennis-warehouse.com"


def get_catalog() -> list[dict]:
    """Return products with dollar-formatted prices for the UI."""
    return [
        {
            **p,
            "price_dollars": p["price"] / 100.0,
        }
        for p in PRODUCTS
    ]


def get_merchant_record() -> dict:
    return MERCHANTS[0]


def create_checkout_jwt(items: list[dict]) -> tuple[str, dict]:
    """Build and sign a checkout JWT for the given cart.

    Each item is ``{"sku": str, "quantity": int}``. Returns ``(jwt, cart_summary)``.
    """
    merchant = get_keys("merchant")
    now = int(time.time())
    cart_items: list[dict] = []
    total_cents = 0
    for item in items:
        product = find_product(item["sku"])
        if product is None:
            raise ValueError(f"Unknown SKU: {item['sku']}")
        qty = int(item.get("quantity", 1))
        unit_cents = int(product["price"])
        total_cents += unit_cents * qty
        cart_items.append(
            {
                "sku": product["sku"],
                "name": product["name"],
                "brand": product.get("brand"),
                "category": product.get("category"),
                "quantity": qty,
                "unitPrice": unit_cents / 100.0,
            }
        )
    payload = {
        "iss": MERCHANT_URL,
        "sub": "cart_checkout",
        "iat": now,
        "exp": now + 3600,
        # KNOWN v0.1 GAP: spec recommends a machine-readable merchant id
        # (e.g. `merchant.id` / `payee_id`) here so verifiers can enforce
        # L2 `allowed_merchants` directly off the checkout JWT. v0.1 relies
        # on the single-merchant catalog + `iss` URL for identification.
        "cart": {
            "items": cart_items,
            "subTotal": {"amount": total_cents / 100.0, "currencyCode": "USD"},
            "total_cents": total_cents,
        },
    }
    header = {"alg": "ES256", "typ": "JWT", "kid": merchant.kid}
    jwt = _jwt_encode(header, payload, merchant.private_key)
    return jwt, payload


def checkout_hash(checkout_jwt: str) -> str:
    return _b64url_encode(hashlib.sha256(checkout_jwt.encode("utf-8")).digest())


def verify_l3b(
    l1: SdJwt,
    l2_checkout_view_ser: str,
    l3b: SdJwt,
    l1_serialized: str,
    l2_serialized: str,
    l2_checkout_serialized: str,
) -> ChainVerificationResult:
    """Verify the checkout-side chain (L1 → L2 → L3b) from the merchant's PoV.

    In addition to the SDK chain verification, this performs the merchant's own
    integrity check: recompute ``SHA-256(L3b.checkout_jwt)`` and compare it
    against ``L3b.final_checkout.checkout_hash``. The SDK only runs this
    binding check when BOTH L3a and L3b are passed to a single verify_chain
    call; in our split-disclosure topology the merchant only sees L3b, so the
    merchant is responsible for the local integrity check (which is also what
    a real merchant would do — they just signed the JWT, they can trivially
    recompute its hash).
    """
    issuer_pub = get_keys("issuer").public_key
    l1_parsed = decode_sd_jwt(l1.serialize())
    l2_checkout_parsed = decode_sd_jwt(l2_checkout_view_ser)
    result = verify_chain(
        l1_parsed,
        l2_checkout_parsed,
        l3_checkout=l3b,
        issuer_public_key=issuer_pub,
        l1_serialized=l1_serialized,
        l2_serialized=l2_serialized,
        l2_checkout_serialized=l2_checkout_serialized,
    )

    if result.valid:
        # Pull the L3b checkout mandate disclosure and recompute the binding.
        claimed_jwt: str | None = None
        claimed_hash: str | None = None
        for delegate in result.l3_checkout_claims.get("delegate_payload", []):
            if isinstance(delegate, dict) and delegate.get("vct") == "mandate.checkout.1":
                claimed_jwt = delegate.get("checkout_jwt")
                claimed_hash = delegate.get("checkout_hash")
                break
        if isinstance(claimed_jwt, str) and isinstance(claimed_hash, str):
            recomputed = _b64url_encode(
                hashlib.sha256(claimed_jwt.encode("ascii")).digest()
            )
            if recomputed != claimed_hash:
                result.valid = False
                result.errors.append(
                    "L3b checkout_hash mismatch: "
                    f"SHA-256(checkout_jwt)={recomputed} != claimed={claimed_hash}"
                )
            else:
                result.checks_performed.append("merchant_checkout_hash_recompute")
    return result
