"""Per-role ES256 keypair management.

Each VI role (issuer, user wallet, agent, merchant) has its own ES256 keypair.
Keys are generated on first run and persisted as PEM files under ``backend/keys/``
so the demo is reproducible across reloads (helpful for the UI when inspecting
kids and JWKs).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from verifiable_intent.crypto.signing import (
    generate_es256_key,
    private_key_to_jwk,
    public_key_to_jwk,
)

KEYS_DIR = Path(__file__).resolve().parent.parent / "keys"


@dataclass(frozen=True)
class KeyPair:
    role: str
    kid: str
    private_key: ec.EllipticCurvePrivateKey

    @property
    def public_key(self) -> ec.EllipticCurvePublicKey:
        return self.private_key.public_key()

    @property
    def public_jwk(self) -> dict:
        return public_key_to_jwk(self.private_key)

    @property
    def private_jwk(self) -> dict:
        return private_key_to_jwk(self.private_key)


# kid for each role (stable across runs so the UI can show consistent labels).
# Role names match orchestrator event roles for 1:1 UI mapping.
_ROLE_KIDS = {
    "issuer": "mastercard-issuer-key-1",
    "wallet": "user-device-key-1",
    "agent": "agent-key-1",
    "merchant": "merchant-key-1",
    "network": "network-key-1",  # currently unused (network only verifies) but reserved
}


def _key_path(role: str) -> Path:
    return KEYS_DIR / f"{role}.pem"


def _load_or_create(role: str) -> ec.EllipticCurvePrivateKey:
    path = _key_path(role)
    if path.exists():
        return serialization.load_pem_private_key(path.read_bytes(), password=None)
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    key = generate_es256_key()
    path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return key


_cache: dict[str, KeyPair] = {}


def get_keys(role: str) -> KeyPair:
    """Return (and cache) the keypair for the given role."""
    if role not in _ROLE_KIDS:
        raise ValueError(f"Unknown role: {role}")
    if role not in _cache:
        priv = _load_or_create(role)
        _cache[role] = KeyPair(role=role, kid=_ROLE_KIDS[role], private_key=priv)
    return _cache[role]


def all_role_jwks() -> dict[str, dict]:
    """Return a snapshot of public JWKs for every role (for UI 'who holds what')."""
    return {role: get_keys(role).public_jwk for role in _ROLE_KIDS}
