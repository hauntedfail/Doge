# Doge Repository Knowledge Map

This index is the stable entry point for engineers and coding agents. Follow the
smallest relevant reading set instead of loading the entire repository history.

## Product and architecture

- [`README.md`](../README.md) — product behavior, input model, development,
  pairing, deployment, distribution, and security defaults.
- [`gateway-protocol.md`](gateway-protocol.md) — public Gateway protocol and
  compatibility contract.
- [`../apps/g2/AGENTS.md`](../apps/g2/AGENTS.md) — G2/WebView implementation
  boundaries and package-specific verification.
- [`../apps/gateway/AGENTS.md`](../apps/gateway/AGENTS.md) — Gateway security
  boundaries and package-specific verification.
- `packages/contracts/src/index.ts` — executable request/response schema shared
  by the client and Gateway.

## Operations

- README “すぐ試す（mock）” — deterministic local startup.
- README “live X relayへ切り替える” — login-bound Safe Relay workflow.
- README “Maintainer deployment” — named Tunnel production operation.
- README “Private buildとBeta build” — Even Hub distribution and device test
  boundaries.
- [`.env.example`](../.env.example) — non-secret configuration names and safe
  loopback defaults.

## Verification and release

- `npm run verify` — formatting, repository invariants, TypeScript, all tests,
  and all builds. This is the required local and CI baseline.
- `npm run verify:release` — baseline verification, production EHPK packaging,
  and artifact boundary checks.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — clean-install CI
  using the same release verification entry point.
- [`../Backlog.md`](../Backlog.md) — durable outcomes that still require real
  hardware or external validation.

## Knowledge ownership

- Put current user-visible behavior and operator guidance in `README.md`.
- Put wire compatibility rules in `gateway-protocol.md` and executable schemas.
- Put package-specific agent constraints in the nearest `AGENTS.md`.
- Put durable unfinished outcomes in `Backlog.md`; keep it under 20 items.
- Keep temporary plans and session notes out of the repository unless a task
  explicitly requires a versioned execution plan.
- When a prose rule repeatedly prevents defects, encode it in a test, repository
  check, or CI job and leave only a pointer in documentation.
