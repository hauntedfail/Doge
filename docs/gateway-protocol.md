# Doge Gateway protocol v1

Doge public builds discover no default server. The phone companion pairs one user-entered HTTPS
origin with one 43-character bearer access key, validates this contract, and stores the pair on the
Even device only after validation succeeds.

## Pairing handshake

```http
GET /api/v1/session
Authorization: Bearer <access-key>
Accept: application/json
```

The authenticated response must be HTTP 200 with this exact protocol identity:

```json
{
  "ok": true,
  "protocol": "doge-gateway",
  "apiVersion": 1
}
```

An authentication failure returns HTTP 401. A generic HTTP 200 response does not establish a
pairing. Doge sends no timeline, profile, reaction, avatar, or media request before pairing.

## Read routes

- `GET /api/v1/timeline?feed=home|following|bookmarks&cursor=<cursor>&seen=<post-ids>`
- `GET /api/v1/posts/:id/thread`
- `GET /api/v1/users/:handle/profile?cursor=<cursor>`
- `GET /api/v1/avatar?url=<encoded-pbs-url>`
- `GET /api/v1/media?url=<encoded-pbs-url>`

Timeline, thread, profile, and post DTOs are defined by `packages/contracts/src/index.ts`. Avatar and
media routes return validated image bytes and an image content type.

## Reaction routes

- `PUT /api/v1/posts/:id/reactions/like|repost|bookmark` enables a reaction.
- `DELETE /api/v1/posts/:id/reactions/like|repost|bookmark` disables a reaction.

The response is the shared `reactionResultSchema`. No general-purpose X request or arbitrary
mutation endpoint is part of protocol v1.

## Transport

Public origins use HTTPS. Every `/api/v1/*` request carries the bearer access key and omits browser
credentials. A self-hosted Gateway must accept the Even WebView origin while keeping bearer
authentication mandatory.
