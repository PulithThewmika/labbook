import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, getDevUser, setDevUser } from './api'
import { getConfig } from './config'
import type { Me } from './types'

type Status = 'loading' | 'signedIn' | 'signedOut'

interface AuthState {
  status: Status
  user: Me | null
  isAdmin: boolean
  /** Choreo: redirect to managed-auth login. Dev: switch to the given dev user. */
  signIn: (devEmail?: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

// In dev mode there is no IdP: the picked email is sent as X-Dev-User.
// In choreo mode the session cookie is managed by Choreo Managed Authentication.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<Me | null>(null)

  const load = useCallback(async () => {
    if (getConfig().authMode === 'dev' && !getDevUser()) {
      setUser(null)
      setStatus('signedOut')
      return
    }
    try {
      setUser(await api.me())
      setStatus('signedIn')
    } catch (e) {
      setUser(null)
      setStatus('signedOut')
      if (!(e instanceof ApiError) || e.status !== 401) console.error('Could not load profile', e)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      isAdmin: user?.role === 'admin',
      signIn: (devEmail) => {
        if (getConfig().authMode === 'choreo') {
          window.location.href = '/auth/login'
          return
        }
        setDevUser(devEmail ?? 'student@labbook.dev')
        setStatus('loading')
        void load()
      },
      signOut: () => {
        if (getConfig().authMode === 'choreo') {
          // Choreo Managed Authentication logout: /auth/logout?session_hint=<value of the session_hint cookie>
          const hint = document.cookie.split('; ').find((c) => c.startsWith('session_hint='))?.split('=')[1] ?? ''
          window.location.href = `/auth/logout?session_hint=${hint}`
          return
        }
        setDevUser(null)
        setUser(null)
        setStatus('signedOut')
      },
    }),
    [status, user, load],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
