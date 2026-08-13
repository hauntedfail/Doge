import type { Post, ProfilePage, UserProfile } from '@even-g2-x-reader/contracts'

export type ProfilePosition = 'summary' | number
export type ProfileStatus = 'loading' | 'ready' | 'error'

export interface ProfileState {
  handle: string
  profile: UserProfile | null
  posts: Post[]
  position: ProfilePosition
  nextCursor: string | null
  status: ProfileStatus
  error: string | null
}

export type ProfileAction =
  | { type: 'loading' }
  | ({ type: 'loaded' } & ProfilePage)
  | ({ type: 'appended' } & ProfilePage)
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'error'; message: string }

export function initialProfileState(handle: string): ProfileState {
  return {
    handle,
    profile: null,
    posts: [],
    position: 'summary',
    nextCursor: null,
    status: 'loading',
    error: null,
  }
}

function appendUnique(current: Post[], incoming: Post[]): Post[] {
  const posts = new Map(current.map((post) => [post.id, post]))
  for (const post of incoming) posts.set(post.id, post)
  return [...posts.values()]
}

export function reduceProfileState(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'loaded':
      return {
        ...state,
        profile: action.profile,
        posts: action.posts,
        position: 'summary',
        nextCursor: action.nextCursor,
        status: 'ready',
        error: null,
      }
    case 'appended':
      return {
        ...state,
        profile: action.profile,
        posts: appendUnique(state.posts, action.posts),
        nextCursor: action.nextCursor,
        status: 'ready',
        error: null,
      }
    case 'next':
      if (state.position === 'summary') {
        return state.posts.length > 0 ? { ...state, position: 0 } : state
      }
      return { ...state, position: Math.min(state.position + 1, state.posts.length - 1) }
    case 'previous':
      if (state.position === 'summary') return state
      return { ...state, position: state.position === 0 ? 'summary' : state.position - 1 }
    case 'error':
      return { ...state, status: 'error', error: action.message }
  }
}
