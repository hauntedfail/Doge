import { describe, expect, it } from 'vitest'
import { profileSummary } from './profile-presentation.js'

describe('profileSummary', () => {
  it('renders identity, bio, location, and counts without a header image', () => {
    const summary = profileSummary({
      id: '42',
      name: 'Ada Lovelace',
      handle: 'ada',
      avatarUrl: 'https://pbs.twimg.com/profile_images/42/ada_normal.jpg',
      bio: 'Computing pioneer',
      location: 'London',
      followerCount: 1234,
      followingCount: 20,
      postCount: 300,
      verified: true,
    })

    expect(summary.author).toBe('Ada Lovelace\n@ada · Verified')
    expect(summary.body).toBe('Computing pioneer\nLondon')
    expect(summary.stats).toBe('20 Following  ·  1.2K Followers  ·  300 Posts')
    expect(summary.avatarUrl).toContain('/profile_images/')
    expect(summary).not.toHaveProperty('headerImageUrl')
  })
})
