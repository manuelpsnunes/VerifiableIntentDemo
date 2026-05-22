"""Static catalog data for the merchant + canonical payment instrument.

Modeled on the SDK's ``examples/helpers.py`` but expanded with a few more
products so the LLM-driven agent has a non-trivial choice to make.
"""

from __future__ import annotations

# Merchants the wallet is willing to transact with.
MERCHANTS: list[dict] = [
    {
        "id": "merchant-uuid-1",
        "name": "Tennis Warehouse",
        "website": "https://tennis-warehouse.com",
    },
]

# Products the merchant sells. Price is in integer minor units (cents).
PRODUCTS: list[dict] = [
    {
        "sku": "BAB86345",
        "name": "Babolat Pure Aero Tennis Racket",
        "price": 27999,
        "currency": "USD",
        "brand": "Babolat",
        "category": "racket",
    },
    {
        "sku": "BAB86412",
        "name": "Babolat Pure Drive Tennis Racket",
        "price": 25999,
        "currency": "USD",
        "brand": "Babolat",
        "category": "racket",
    },
    {
        "sku": "HEA23102",
        "name": "Head Graphene 360 Speed Tennis Racket",
        "price": 24999,
        "currency": "USD",
        "brand": "HEAD",
        "category": "racket",
    },
    {
        "sku": "WIL97211",
        "name": "Wilson Pro Staff RF97",
        "price": 32999,
        "currency": "USD",
        "brand": "Wilson",
        "category": "racket",
    },
    {
        "sku": "BAB88012",
        "name": "Babolat Pure Aero Junior 26",
        "price": 13999,
        "currency": "USD",
        "brand": "Babolat",
        "category": "racket",
    },
]

# ``acceptable_items`` form for the L2 line_items constraint — id + title only,
# the rest of the product detail stays at the merchant.
def acceptable_items() -> list[dict]:
    return [{"id": p["sku"], "title": p["name"]} for p in PRODUCTS]


# The payment instrument the wallet authorizes for this mandate.
PAYMENT_INSTRUMENT: dict = {
    "type": "mastercard.srcDigitalCard",
    "id": "f199c3dd-7106-478b-9b5f-7af9ca725170",
    "description": "Mastercard **** 1234",
}


def find_product(sku: str) -> dict | None:
    for p in PRODUCTS:
        if p["sku"] == sku:
            return p
    return None
