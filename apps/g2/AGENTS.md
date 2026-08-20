# G2 App Instructions

This package owns both the iPhone WebView companion and the Even G2 display.
The glasses UI is rendered through the Even Hub SDK, not through the phone DOM.

## Read first

- Root `AGENTS.md` and `docs/INDEX.md`
- `README.md` sections “操作”, “Public buildとGateway pairing”, and
  “Private buildとBeta build”
- `app.json` and `app.production.json` before changing permissions or versions

## Invariants

- The glasses canvas is 576x288. Preserve full post text through paging and
  keep persistent chrome minimal.
- Input semantics are shared: tap confirms, swipe/scroll navigates, double tap
  goes back; only double tap on the top-level view selector exits Doge.
- Treat image transfer as asynchronous and stale-render prone. Keep render epoch
  checks, sequential bridge writes, and bounded caches intact.
- Persist Gateway URL and access key with Even SDK device storage. WebView
  storage is migration/fallback only; never expose the saved key in the form.
- Public builds accept user-selected HTTPS Gateways and must not embed the
  maintainer origin. Development manifests may allow loopback HTTP only.
- Keep `app.json` and `app.production.json` identity, version, SDK/app minimums,
  entrypoint, and languages aligned.

## Verification

- Focused UI/state test: `npm test -- apps/g2/src/<name>.test.ts`
- Type check: `npm run check --workspace @even-g2-x-reader/g2`
- Build: `npm run build --workspace @even-g2-x-reader/g2`
- Any manifest, pairing, or package change: `npm run verify:release`

Simulator results do not prove BLE timing, background restore, phone lock, or
physical-glasses rendering. Leave those outcomes in `Backlog.md` until tested.
