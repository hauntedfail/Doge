# Doge Agent Guide

Doge is a TypeScript monorepo for an Even G2 X reader, its authenticated
gateway, and their shared wire contract.

Start with [docs/INDEX.md](docs/INDEX.md). It maps the current architecture,
security contract, operations, and verification sources. Treat current code,
tests, manifests, and linked semantic docs as authoritative; historical chat or
build observations are context only.

## Repository map

- `apps/g2` — iPhone WebView companion and 576x288 Even G2 UI. Read its nearest
  `AGENTS.md` before changing it.
- `apps/gateway` — authenticated HTTP boundary around loopback-only Safe Relay.
  Read its nearest `AGENTS.md` before changing it.
- `packages/contracts` — Zod schemas shared across both sides of the boundary.
- `scripts` — local preview, production operations, and repository guardrails.
- `Backlog.md` — durable open outcomes only; it is not a session log or plan.

## Standard commands

- Install exactly from the lockfile: `npm ci`
- Run focused tests: `npm test -- path/to/file.test.ts`
- Verify a code or documentation change: `npm run verify`
- Verify a distributable G2 package: `npm run verify:release`
- Start deterministic mock development: `npm run dev`

Use the Node version in `.node-version`. Do not replace `package-lock.json` or
switch package managers without an explicit migration task.

## Non-negotiable boundaries

- Never commit or print X cookies, browser profiles, access keys, Cloudflare
  credentials, relay catalogs, `.env` files, generated `dist/`, or `.ehpk` files.
- Keep `twitter_api_safe_relay` loopback-only. Only the bearer-authenticated Doge
  gateway may be exposed through a tunnel.
- Public G2 builds must not contain a maintainer Gateway URL or access key. Users
  configure and persist their own authenticated Gateway pairing on-device.
- Validate external data at boundaries using the shared contract. Do not pass
  raw X responses, cookies, or internal headers to the G2 client.
- A build does not update a running production Gateway. Restart it, then verify
  authenticated and tokenless behavior before claiming deployment success.
- Simulator, package, Hub upload, and physical-glasses behavior are separate
  evidence. State clearly which one was actually verified.

## Working agreement

- Preserve unrelated changes and keep each change reviewable.
- Add or update regression tests for behavior changes. Prefer observable
  contract tests over implementation-detail assertions.
- Run focused checks while iterating, then `npm run verify` before finalizing.
- For release-affecting changes, run `npm run verify:release` and report the
  package hash; never stage the generated package.
- Record lasting architecture or operational knowledge in the owning document
  linked from `docs/INDEX.md`, not as another instruction in this file.
- Keep this file concise and map-like. Promote repeated failures into tests,
  scripts, or CI instead of accumulating prose rules.
