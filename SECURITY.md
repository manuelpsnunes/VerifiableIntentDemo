# Security Policy

## Status

This repository is a **personal demo / educational reference** for the [Verifiable Intent](https://verifiableintent.dev/spec/) protocol. It is **not intended for production use** and has not been independently security-reviewed.

### What this demo does *not* provide

- ❌ No real payment processing — the card network is a local Python module that always approves amounts ≤ $1000.
- ❌ No persistent storage of credentials or transactions — all state is in-memory and lost on restart.
- ❌ No replay-attack / nonce-tracking protection in the mock network.
- ❌ No rate limiting, authentication, or authorization on the FastAPI endpoints (it binds to `127.0.0.1` only).
- ❌ No key-rotation, revocation, or HSM-backed key storage — ES256 keys are written as plaintext PEMs under `backend/keys/` (gitignored).

If you want to build on Verifiable Intent for a real system, start from the upstream [`verifiable-intent`](https://github.com/agent-intent/verifiable-intent) SDK and treat the role modules in this repo only as illustrative examples.

## Reporting a vulnerability

If you believe you have found a security issue in **this demo repository** (not in the upstream SDK or the protocol itself), please open a private security advisory via [GitHub Security Advisories](https://github.com/manuelpsnunes/VerifiableIntentDemo/security/advisories/new) rather than a public issue.

For vulnerabilities in the upstream `verifiable-intent` SDK or the protocol specification, please follow the disclosure process documented at that project, not here.

## Supported versions

Only the latest commit on `main` is "supported"; this is a demo, not a released product.
