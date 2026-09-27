# Development

## Requirements

- Node.js from [`.node-version`](../.node-version) and npm from the
  `packageManager` field in [`package.json`](../package.json).
- For physical-device testing, an Even Hub-compatible Even App paired with
  Even G2 glasses.
- For local pairing and interaction, the Even Hub simulator installed by
  `npm ci`. A regular browser alone does not provide the required Even SDK bridge.
- For live X data, Safe Relay and a dedicated signed-in browser session.
- For the live-device preview, `cloudflared` available on your path. The
  preview and production helper scripts target macOS.

Run commands from the repository root. Install dependencies with `npm ci`;
retain `package-lock.json` and the existing package manager.

## Mock development

Follow the [quick start](../README.md#quick-start) to generate a development
bearer key, start both services and pair the companion inside the simulator.
The quick start sets `X_SOURCE=mock` explicitly, so an existing shell setting
cannot select live X data. Mock mode requires no X connection.

| Service                             | Local address           |
| ----------------------------------- | ----------------------- |
| Gateway                             | `http://127.0.0.1:8787` |
| Vite companion                      | `http://127.0.0.1:5173` |
| Safe Relay, when started separately | `http://127.0.0.1:6900` |

The development key is generated in the shell and passed to the gateway through
`GATEWAY_BEARER_TOKEN`. Keep that shell open to reuse it. A new key requires
updating the companion pairing. Never reuse a development key for a public
gateway.

See [`.env.example`](../.env.example) for configuration names. The commands here
pass values through the shell; the gateway entry point reads `process.env`.

## Connect live X data

Doge uses a dedicated Playwright Chromium profile rather than your everyday
browser profile. Install Chromium and start Safe Relay:

```sh
npx playwright install chromium
npm run relay:login
```

Sign in to X in the new Chromium window. Once `https://x.com/home` is visible,
leave the window open. Closing the browser or stopping the command with
`Ctrl-C` also stops the relay.

The session is stored in `var/relay-profile`. It contains X cookies and local
storage, so the entire directory is excluded from Git.

In a second terminal, check the relay and refresh its query catalogue:

```sh
npm run relay:check
npm run relay:sync
```

Stop the mock gateway before starting the live gateway on the same port. In
the shell holding your development key, run:

```sh
X_SOURCE=relay npm run dev:gateway
```

Start the companion in another terminal:

```sh
npm run dev:g2
```

The catalogue records the current X query IDs and feature flags. Refresh it
when those change. `var/requests.ndjson` may contain account-derived IDs and
cursors and must remain untracked. The gateway reloads the catalogue during
operation, so catalogue synchronisation does not require a rebuild.

## Live-device preview

With Safe Relay signed in and its catalogue synchronised, build the app and
start the temporary authenticated preview:

```sh
npm run build
npm run preview:live
```

Stop any other gateway on port 8787 first. The preview creates a random
256-bit bearer token, starts the gateway and opens a disposable Cloudflare
Quick Tunnel. It checks the authenticated live timeline before opening a QR
image on the Mac.

The token is embedded in the QR's URL fragment, which is not sent to the tunnel
server. It is not printed in the terminal. The temporary image has file mode
`600`; keep it private. Scan it for the preview, then save and test the same
HTTPS origin as the Gateway URL in the phone companion. API calls use the
bearer token in the `Authorization` header.

Press `Ctrl-C` to stop the gateway and tunnel and remove the QR image. The
temporary token stops providing access when that gateway exits. Quick Tunnels
have no fixed URL or availability guarantee; use the
[deployment guide](deployment.md) for persistent operation.

## Verification

```sh
npm test -- apps/g2/src/input.test.ts
npm run check --workspace @even-g2-x-reader/g2
npm run check --workspace @even-g2-x-reader/gateway
npm run verify
```

`npm run verify` checks formatting, repository invariants and TypeScript, then
runs all tests and builds all workspaces. Run it before finalising code or
documentation changes.

For a distributable package, use `npm run verify:release`. It also creates the
production EHPK and checks artefact boundaries. See
[packaging and distribution](deployment.md#packaging-and-distribution) for the
distinction between local and public manifests.

Write all maintained documentation in British English, including README files,
guides, agent instructions and backlog entries. Preserve exact API names, code
identifiers, commands, UI labels and third-party legal text.
