"""Helpers for decoding SD-JWTs into the rich, UI-friendly shapes our events use.

The frontend wants to render each credential with:
- the serialized form (so users can copy/paste into jwt.io)
- the decoded header
- the decoded payload (with selective disclosures resolved)
- a per-disclosure breakdown: salt, claim name (if any), claim value, hash, and
  whether this particular party can see it.
"""

from __future__ import annotations

from verifiable_intent.crypto.disclosure import hash_disclosure
from verifiable_intent.crypto.sd_jwt import SdJwt, decode_sd_jwt, resolve_disclosures


def describe_disclosure(disc_str: str, decoded: list) -> dict:
    """Turn a single disclosure into a UI-friendly dict."""
    if len(decoded) == 3:
        salt, name, value = decoded
    elif len(decoded) == 2:
        salt = decoded[0]
        name = None
        value = decoded[1]
    else:
        salt = None
        name = None
        value = decoded
    return {
        "salt": salt,
        "name": name,
        "value": value,
        "hash": hash_disclosure(disc_str),
        "encoded": disc_str,
    }


def describe_sd_jwt(sd_jwt: SdJwt, serialized: str | None = None) -> dict:
    """Render an SdJwt for transport over the event bus."""
    return {
        "serialized": serialized if serialized is not None else sd_jwt.serialize(),
        "header": dict(sd_jwt.header),
        "payload": dict(sd_jwt.payload),
        "resolved": resolve_disclosures(sd_jwt),
        "disclosures": [
            describe_disclosure(d, v)
            for d, v in zip(sd_jwt.disclosures, sd_jwt.disclosure_values)
        ],
    }


def describe_serialized(serialized: str) -> dict:
    """Decode and describe a serialized SD-JWT string."""
    sd = decode_sd_jwt(serialized)
    return describe_sd_jwt(sd, serialized=serialized)
