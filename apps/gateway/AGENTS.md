# Gateway Instructions

The Gateway is the authenticated, schema-validated boundary between the public
G2 client and `twitter_api_safe_relay` on loopback.

## Read first

- Root `AGENTS.md` and `docs/INDEX.md`
- `docs/gateway-protocol.md`
- `README.md` sections “Security defaults” and “Maintainer deployment”

## Invariants

- Require bearer authentication before every public data or reaction route.
- Keep Safe Relay restricted to a loopback HTTP origin and an explicit operation
  allowlist. Never proxy an arbitrary operation, URL, header, or request body.
- Parse upstream data into shared Zod DTOs. Never return X cookies, raw GraphQL
  payloads, browser storage, or internal headers.
- Preserve timeouts, byte limits, content-type and signature checks, redirect
  rejection, and host/path allowlists on avatar and media fetches.
- Treat GraphQL `errors` as failures even when upstream HTTP status is 200.
- CORS is not authentication. Installed WebView origins may vary, but bearer
  checks remain mandatory.
- The mock source must remain deterministic and must not require X login or
  network access.

## Verification

- Focused route/security test: `npm test -- apps/gateway/src/<name>.test.ts`
- Type check: `npm run check --workspace @even-g2-x-reader/gateway`
- Build: `npm run build --workspace @even-g2-x-reader/gateway`
- Run root `npm run verify` before finalizing.

After production source changes, rebuilding is insufficient: restart
`npm run production:start`, then verify authenticated `/api/v1/session` returns
200 and the tokenless request returns 401.
