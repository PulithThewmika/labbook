import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

export interface Async<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** Runs `fn` on mount and whenever `deps` change. Ignores results of superseded calls. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    fn().then(
      (d) => {
        if (live) {
          setData(d)
          setLoading(false)
        }
      },
      (e: unknown) => {
        if (live) {
          setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
          setLoading(false)
        }
      },
    )
    return () => {
      live = false
    }
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
