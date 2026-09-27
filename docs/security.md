# Security model

Doge's public boundary is its authenticated gateway. Safe Relay and the X
browser session stay on the host. The client receives validated data and image
bytes, never X cookies or internal upstream headers.

## Authentication and pairing

- Public gateways require a bearer access key for data and reaction requests
  under `/api/v1/*`. Health checks and CORS preflight responses remain public.
- Public builds contain no maintainer origin or access key. Each device pairs
  a user-selected HTTPS origin through the [session handshake](gateway-protocol.md#pairing-handshake).
- The gateway can accept varying installed WebView origins while retaining
  bearer authentication. CORS is not an authentication mechanism.
- Set `GATEWAY_BEARER_TOKEN` before exposing a gateway. The raw development
  server permits an unset token; the production and live-preview helpers
  supply one explicitly.
- API responses use `no-store` and security headers.

## Relay boundary

The relay base URL must be loopback HTTP. An explicit allowlist permits six
read operations and six reaction operations:

| Purpose              | Relay operations                                  |
| -------------------- | ------------------------------------------------- |
| Feeds                | `HomeTimeline`, `HomeLatestTimeline`, `Bookmarks` |
| Threads and profiles | `TweetDetail`, `UserByScreenName`, `UserTweets`   |
| Likes                | `FavoriteTweet`, `UnfavoriteTweet`                |
| Reposts              | `CreateRetweet`, `DeleteRetweet`                  |
| Bookmarks            | `CreateBookmark`, `DeleteBookmark`                |

The gateway exposes no arbitrary X request endpoint and no routes for creating
posts, replying, following accounts or deleting posts. Feed names, cursors and
post IDs are validated against schemas. Upstream responses are normalised into
the shared contract, and GraphQL errors count as failures even when returned
with HTTP 200. Relay requests have a 15-second timeout and a 5 MB response limit.

## Image proxies

| Proxy      | Allowed source                                                 | Limits                                                                       |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Avatar     | HTTPS `pbs.twimg.com/profile_images/` paths                    | 5 seconds; 512 KiB; JPEG, PNG or WebP content type                           |
| Post media | Allowlisted HTTPS `pbs.twimg.com` photo and video-poster paths | 5 seconds; 4 MiB; matching JPEG, PNG or WebP content type and file signature |

Both proxies reject redirects. Media fetching excludes `video.twimg.com`, MP4
and HLS; video and animated GIF posts use still posters only.

## Files that stay local

Never commit X cookies, access keys, browser profiles, Cloudflare credentials,
relay catalogues or real `.env` files. The repository also excludes generated
`dist/`, coverage and `.ehpk` files. Keep secrets out of logs and review output.

Non-secret configuration examples such as [`.env.example`](../.env.example)
are tracked deliberately. The [repository checks](../scripts/check-repository.mjs)
guard tracked-file boundaries, and production
[artefact checks](../scripts/check-production-artifact.mjs) inspect packages for
fixed gateway origins and the local access key when available.
