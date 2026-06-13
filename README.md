---
title: Verifiable Intent Demo
emoji: 🔐
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Verifiable Intent — End-to-End Demo

> **Disclaimer.** This is a personal experiment built independently and on personal time, using only the public open-source [`verifiable-intent`](https://github.com/agent-intent/verifiable-intent) SDK and publicly available specifications. It is not an official project of, and is not affiliated with or endorsed by, any employer or payment network. No proprietary or confidential information is included. All card-network references in the code are generic placeholders (`card-network.example`, `ExampleCard`) used only to illustrate the protocol's roles.

A local demo that runs a real [Verifiable Intent](https://verifiableintent.dev/spec/) **autonomous-mode**
purchase end-to-end and visualizes every credential, disclosure, and verification step in a live web UI.

![Verifiable Intent demo screenshot — completed run showing the full L1→L2→L3a+L3b credential chain, 12-step timeline, disclosure matrix, and role history](docs/screenshot.png)

Built on top of the official [`verifiable-intent`](https://github.com/agent-intent/verifiable-intent)
Python SDK. The crypto chain (L1 → L2 → L3a / L3b SD-JWTs) is real; the merchant and payment
network are role modules we run locally; the agent uses **Anthropic Claude** to pick a product
that satisfies the user's constraints.

> **Payment rails**: The payment network is mocked in v1 (returns approved/declined based on
> simple rules) so the demo runs without any external accounts. The interface is kept clean so a
> real Stripe Test Mode adapter can drop in for v2.

## Architecture

Five logical roles, one FastAPI backend process (each role is a Python module with its own ES256
keypair). The orchestrator runs **12 steps** (1–9: success path; 10–12: optional failure-injection
divergence) and returns the full ordered list of structured events from a single HTTP
call, which the Vite + React frontend reveals one at a time (client-side paced). One
panel per role.

```
Issuer ==(L1, at enrollment)==> User Wallet ──L2──▶ Agent ──┬──L3b──▶ Merchant
                                                            └──L3a──▶ Payment Network
```

The `==>` arrow happens once during card enrollment; the `──▶` arrows happen on every purchase.

## Quick start

```powershell
# Backend (Python 3.11+)
cd backend
uv venv
.\.venv\Scripts\Activate.ps1
uv pip install -e .
copy ..\.env.example ..\.env   # then edit .env and paste your Anthropic key
uvicorn app.main:app --reload

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>, paste a prompt like *"Buy a Babolat tennis racket under $400"*,
click **Run Demo**, and watch the credential chain build itself.

## Layout

| Path | What's in it |
| --- | --- |
| `backend/app/` | FastAPI app, orchestrator, event bus |
| `backend/app/roles/` | One module per VI role (issuer, wallet, agent, merchant, network) |
| `backend/tests/` | End-to-end smoke test with a stub LLM |
| `frontend/src/` | React dashboard |
| `docs/architecture.md` | Mermaid sequence diagram of the 12-step flow |

## Known v0.1 simplifications (vs full spec)

- **Payment network is mock.** Approves ≤ $1,000; no Stripe yet. Interface is shaped
  so a `PAYMENT_NETWORK_MODE=stripe` adapter drops in for v2.
- **Network is stateless.** No nonce / replay tracking, no one-L3-per-pair enforcement,
  no cumulative spend tracking across L2-scoped calls. Real network MUSTs.
- **Checkout JWT carries no machine-readable merchant id.** Allowlist enforcement falls
  back to `iss` URL + the single-merchant catalog. Spec recommends an explicit `payee_id`.
- **Network verifier sees the full L2** (not just the payment view) so it can resolve the
  `allowed_payees` SD references. Marked in `roles/network.py`.
- **Spec anchors in `frontend/src/specRefs.ts` are best-effort** — the published spec page
  may have moved sections; update anchors there if you spot a stale link.
- **L1 issuance is inlined.** In production, L1 is issued ONCE during user
  enrollment with the Credential Provider (via the chosen issuance protocol,
  e.g. OpenID4VCI) and stored in the wallet. Every later purchase reuses that
  stored L1 — the issuer is not contacted per transaction. The demo re-issues
  L1 on every run so the full L1→L2→L3 chain is visible in one timeline.

## Status

Work in progress. See `docs/` and the inline comments in each role module for the spec sections
each piece implements.
