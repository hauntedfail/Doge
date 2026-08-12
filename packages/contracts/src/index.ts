import { z } from 'zod'

export const feedSchema = z.enum(['home', 'following', 'bookmarks'])
export type Feed = z.infer<typeof feedSchema>

export const postSchema = z.object({
  id: z.string().min(1),
  authorName: z.string().min(1),
  authorHandle: z.string().min(1),
  text: z.string(),
  createdAt: z.string(),
  replyCount: z.number().int().nonnegative(),
  repostCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative().nullable(),
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

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
