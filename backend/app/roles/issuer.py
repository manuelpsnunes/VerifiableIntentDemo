"""Layer 1 issuer — the Credential Provider.

Plays the role of the bank / payment-network credential provider that signs the
long-lived L1 SD-JWT binding the user's public key to their card.
"""

from __future__ import annotations

import time

from verifiable_intent.crypto.sd_jwt import SdJwt
from verifiable_intent.issuance.issuer import create_layer1
from verifiable_intent.models.issuer_credential import IssuerCredential

from ..keys import get_keys

ISSUER_URL = "https://card-network.example"
WALLET_AUD = "https://wallet.example.com"


def issue_l1(
    user_pub_jwk: dict,
    *,
    user_sub: str = "user-alice-001",
    email: str = "alice@example.com",
    pan_last_four: str = "1234",
    scheme: str = "ExampleCard",
    lifetime_seconds: int = 60 * 60 * 24 * 365,
) -> SdJwt:
    """Issue the L1 SD-JWT binding the user's public key (``cnf.jwk``)."""
    issuer = get_keys("issuer")
    now = int(time.time())
    cred = IssuerCredential(
        iss=ISSUER_URL,
        sub=user_sub,
        iat=now,
        exp=now + lifetime_seconds,
        aud=WALLET_AUD,
        cnf_jwk=user_pub_jwk,
        email=email,
        pan_last_four=pan_last_four,
        scheme=scheme,
    )
    return create_layer1(cred, issuer.private_key, kid=issuer.kid)
