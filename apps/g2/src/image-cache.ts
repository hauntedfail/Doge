export interface CacheLookup<V> {
  hit: boolean
  value: Promise<V>
}

export class LruPromiseCache<K, V> {
  readonly #capacity: number
  readonly #entries = new Map<K, Promise<V>>()

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Cache capacity must be a positive integer')
    }
    this.#capacity = capacity
  }

  has(key: K): boolean {
    return this.#entries.has(key)
  }

  get(key: K): Promise<V> | undefined {
    const value = this.#entries.get(key)
    if (!value) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, value)
    return value
  }

  set(key: K, value: Promise<V>): Promise<V> {
    this.#entries.delete(key)
    const guarded = value.catch((error: unknown) => {
      if (this.#entries.get(key) === guarded) this.#entries.delete(key)
      throw error
    })
    this.#entries.set(key, guarded)
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }
    return guarded
  }

  delete(key: K): boolean {
    return this.#entries.delete(key)
  }

  getOrLoad(key: K, load: () => Promise<V>): CacheLookup<V> {
    const cached = this.get(key)
    if (cached) return { hit: true, value: cached }
    return { hit: false, value: this.set(key, load()) }
  }
}
