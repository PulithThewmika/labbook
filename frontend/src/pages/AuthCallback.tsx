import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorState, Spinner } from '../components/feedback'
import { useAuth } from '../lib/auth'
import { finishLogin } from '../lib/oidc'

/** Landing route for the identity provider's redirect (/auth/callback). */
export default function AuthCallback() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false) // StrictMode runs effects twice; the code can only be used once

  useEffect(() => {
    if (started.current) return
    started.current = true
    finishLogin(window.location.search)
      .then(() => refresh())
      .then(() => navigate('/labs', { replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sign-in failed.'))
  }, [refresh, navigate])

  if (error) return <ErrorState message={error} onRetry={() => navigate('/', { replace: true })} />
  return <Spinner label="Signing you in" />
}
