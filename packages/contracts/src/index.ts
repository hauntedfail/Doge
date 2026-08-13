import { z } from 'zod'

export const feedSchema = z.enum(['home', 'following', 'bookmarks'])
export type Feed = z.infer<typeof feedSchema>

export const reactionSchema = z.enum(['like', 'repost', 'bookmark'])
export type Reaction = z.infer<typeof reactionSchema>

export const postImageSchema = z.object({
  kind: z.enum(['photo', 'video_thumbnail', 'animated_gif_thumbnail']).default('photo'),
  url: z.url(),
  width: z.number().int().positive().max(32_768).nullable(),
  height: z.number().int().positive().max(32_768).nullable(),
})
export type PostImage = z.infer<typeof postImageSchema>
export type PostImageKind = PostImage['kind']

export const postSchema = z.object({
  id: z.string().min(1),
  authorName: z.string().min(1),
  authorHandle: z.string().min(1),
  authorAvatarUrl: z.url().nullable(),
  text: z.string(),
  createdAt: z.string(),
  replyCount: z.number().int().nonnegative(),
  repostCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative().nullable(),
  bookmarkCount: z.number().int().nonnegative().nullable().default(null),
  images: z.array(postImageSchema).max(4).default([]),
  viewerHasLiked: z.boolean().default(false),
  viewerHasReposted: z.boolean().default(false),
  viewerHasBookmarked: z.boolean().default(false),
})
export type Post = z.infer<typeof postSchema>

export const timelinePageSchema = z.object({
  feed: feedSchema,
  posts: z.array(postSchema),
  nextCursor: z.string().min(1).nullable(),
})
export type TimelinePage = z.infer<typeof timelinePageSchema>

export const threadSchema = z.object({
  rootId: z.string().min(1),
  posts: z.array(postSchema),
})
export type Thread = z.infer<typeof threadSchema>

export const userProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/u),
  avatarUrl: z.url().nullable(),
  bio: z.string().max(1000),
  location: z.string().max(256),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  postCount: z.number().int().nonnegative(),
  verified: z.boolean(),
})
export type UserProfile = z.infer<typeof userProfileSchema>

export const profilePageSchema = z.object({
  profile: userProfileSchema,
  posts: z.array(postSchema),
  nextCursor: z.string().min(1).nullable(),
})
export type ProfilePage = z.infer<typeof profilePageSchema>

export const reactionResultSchema = z.object({
  postId: z.string().min(1),
  reaction: reactionSchema,
  active: z.boolean(),
})
export type ReactionResult = z.infer<typeof reactionResultSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
