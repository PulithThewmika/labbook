// Minimal OIDC authorization-code flow with PKCE for the SPA (no library).
// Token exchange goes through the same-origin path /idp/token, which nginx proxies to the identity
// provider, because the provider sends no CORS headers for the token endpoint.
import { getConfig } from './config'

const SESSION_KEY = 'labbook.oidc.session'
const PENDING_KEY = 'labbook.oidc.pending'

interface Session {
  accessToken: string
  expiresAt: number // epoch ms
}

interface Pending {
  state: string
  verifier: string
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomString(byteLength = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

/** S256 code challenge for a PKCE verifier (RFC 7636). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest))
}

export function redirectUri(): string {
  return `${window.location.origin}/auth/callback`
}

export function getToken(): string | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
    return s && s.expiresAt > Date.now() ? s.accessToken : null
  } catch {
    return null
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // storage unavailable
  }
}

/** Redirects the browser to the identity provider's authorization endpoint. */
export async function startLogin(): Promise<void> {
  const cfg = getConfig()
  const verifier = randomString(48)
  const state = randomString(16)
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier } satisfies Pending))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.oidcClientId,
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
  })
  window.location.assign(`${cfg.oidcAuthority}/oauth2/authorize?${params.toString()}`)
}

/** Completes the login on /auth/callback: checks state, exchanges the code, stores the access token. */
export async function finishLogin(search: string): Promise<void> {
  const q = new URLSearchParams(search)
  const error = q.get('error')
  if (error) throw new Error(q.get('error_description') ?? error)
  const code = q.get('code')
  const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null
  if (!code || !pending || pending.state !== q.get('state')) throw new Error('The sign-in response did not match this browser session. Please try again.')

  const res = await fetch('/idp/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: getConfig().oidcClientId,
      code_verifier: pending.verifier,
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !body.access_token) throw new Error(body.error_description ?? 'Could not complete sign-in.')
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 30_000 } satisfies Session))
  sessionStorage.removeItem(PENDING_KEY)
}
