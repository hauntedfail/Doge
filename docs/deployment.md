# Deployment and distribution

## Hosting model

Live Doge requires a running Mac, a signed-in Safe Relay browser and a Doge
gateway. Keep the Mac powered and connected to the network when using the
glasses away from home. The iPhone and glasses reach that backend over HTTPS.

Expose only the gateway at `127.0.0.1:8787`. Safe Relay must remain on
`127.0.0.1:6900` and must never be connected directly to a tunnel. See the
[security model](security.md).

Public G2 packages contain no preset gateway origin or access key. Each user
provides an HTTPS gateway implementing the [v1 contract](gateway-protocol.md)
and pairs it through the phone companion. X cookies remain on the gateway host.

## Maintainer deployment

The repository's `production:*` helpers target the maintainer's configured
named Cloudflare Tunnel at `https://doge.h1ka.ru`. This is a server-side
operational setting, not a default destination for public builds. The start
script expects the existing tunnel credentials on the maintainer's Mac;
it does not provision a new tunnel for another host.

For your own installation, provide your own HTTPS tunnel or reverse proxy to
the gateway. Configure `GATEWAY_BEARER_TOKEN` and accept the installed Even
WebView's origin. `ALLOW_BEARER_CORS=1` supports varying WebView origins while
keeping bearer authentication mandatory. The
[server entry point](../apps/gateway/src/server.ts) and
[configuration example](../.env.example) define the available settings.

On the configured maintainer host, first generate or reuse the persistent Doge
key and copy it to the clipboard:

```sh
npm run production:key
```

The script stores the key in `var/doge-access-key` with file mode `600` and
does not print it. In the Even App's Doge companion, enter the configured
HTTPS origin, paste the key and select **Save and test connection** once the
gateway is running.

With Safe Relay running and signed in, prepare the catalogue and build, then
start the gateway and named tunnel:

```sh
npm run relay:sync
npm run build
npm run production:start
```

The start script checks the local authenticated timeline, public health,
rejection of a tokenless timeline request and success of an authenticated
timeline request. It requires port 8787 to be free.

After changing gateway source, rebuild and restart `production:start`. A
running Node process keeps the code loaded from `dist/server.js`; building
alone does not update it. Confirm that authenticated `/api/v1/session` returns
HTTP 200 and a tokenless request returns HTTP 401 before treating an update
as deployed.

## Packaging and distribution

For local development packaging:

```sh
npm run verify
npm run pack:g2
```

For a package intended for distribution:

```sh
npm run verify:release
```

Both write `apps/g2/doge.ehpk`. Generated packages and build outputs are
excluded from Git. Record the package hash when reporting a release build.

The development manifest permits only the loopback mock gateway. The tracked
production manifest, `apps/g2/app.production.json`, allows user-selected HTTPS
services through its `https://` network whitelist. Do not embed a maintainer
origin or access key in frontend source, build-time variables or packages.

## Even Hub testing

Use a Beta tester group containing only your own Even account to evaluate the
installed app before submitting it to the Store:

1. Run `npm run verify:release`.
2. Create a Beta tester group in Even Hub and add your account's email address.
3. Upload `apps/g2/doge.ehpk` as a build and push it to the group.
4. In the iPhone Even App, open **Me → Beta tester → Doge → Install**.
5. Start Doge from the glasses home screen and pair your gateway in the phone
   companion.

Validate saved settings restoration, recovery from the background, phone
locking and profile rendering on physical glasses before Store submission.
Use the bundled [Doge icon](../apps/g2/public/doge-icon.png) for the listing.

Beta and Private testing are distinct Hub workflows. Consult the official
[Beta testing](https://hub.evenrealities.com/docs/test/beta-testing) and
[Private testing](https://hub.evenrealities.com/docs/test/private-testing)
guides for current eligibility, distribution and lifecycle rules.

Package verification, Hub upload, simulator testing and physical-device
testing are separate outcomes. Track outstanding hardware checks in
[`Backlog.md`](../Backlog.md).
