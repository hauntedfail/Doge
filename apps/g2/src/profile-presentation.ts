import type { UserProfile } from '@even-g2-x-reader/contracts'

export interface ProfileSummary {
  author: string
  body: string
  stats: string
  avatarUrl: string | null
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
}

function compact(value: number): string {
  if (value >= 100_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function profileSummary(profile: UserProfile): ProfileSummary {
  const identity = `${clean(profile.name)}\n@${profile.handle}`
  return {
    author: profile.verified ? `${identity} · Verified` : identity,
    body: [clean(profile.bio), clean(profile.location)].filter(Boolean).join('\n'),
    stats: `${compact(profile.followingCount)} Following  ·  ${compact(profile.followerCount)} Followers  ·  ${compact(profile.postCount)} Posts`,
    avatarUrl: profile.avatarUrl,
  }
}
