# Doge Repository Knowledge Map

This index is the stable entry point for engineers and coding agents. Follow the
smallest relevant reading set instead of loading the entire repository history.

## Product and architecture

- [`README.md`](../README.md) — product overview, quick start and contribution
  entry points.
- [`reader-guide.md`](reader-guide.md) — controls, text, images and pairing.
- [`security.md`](security.md) — authentication, relay restrictions and data
  handling.
- [`gateway-protocol.md`](gateway-protocol.md) — public Gateway protocol and
  compatibility contract.
- [`../apps/g2/AGENTS.md`](../apps/g2/AGENTS.md) — G2/WebView implementation
  boundaries and package-specific verification.
- [`../apps/gateway/AGENTS.md`](../apps/gateway/AGENTS.md) — Gateway security
  boundaries and package-specific verification.
- `packages/contracts/src/index.ts` — executable request/response schema shared
  by the client and Gateway.

## Operations

- [`development.md`](development.md) — deterministic local startup, live X
  relay setup, authenticated preview and verification.
- [`deployment.md`](deployment.md) — HTTPS hosting, maintainer operation,
  Even Hub distribution and device test boundaries.
- [`.env.example`](../.env.example) — non-secret configuration names and safe
  loopback defaults.

## Verification and release

- `npm run verify` — formatting, repository invariants, TypeScript, all tests,
  and all builds. This is the required local and CI baseline.
- `npm run verify:release` — baseline verification, production EHPK packaging,
  and artefact boundary checks.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — clean-install CI
  using the same release verification entry point.
- [`../Backlog.md`](../Backlog.md) — durable outcomes that still require real
  hardware or external validation.

## Knowledge ownership

- Keep the product overview and quick start in `README.md`; put detailed reader,
  development, deployment and security guidance in the linked guides above.
- Write maintained documentation in British English. Preserve exact identifiers,
  commands, UI labels and third-party legal text.
- Put wire compatibility rules in `gateway-protocol.md` and executable schemas.
- Put package-specific agent constraints in the nearest `AGENTS.md`.
- Put durable unfinished outcomes in `Backlog.md`; keep it under 20 items.
- Keep temporary plans and session notes out of the repository unless a task
  explicitly requires a versioned execution plan.
- When a prose rule repeatedly prevents defects, encode it in a test, repository
  check, or CI job and leave only a pointer in documentation.
