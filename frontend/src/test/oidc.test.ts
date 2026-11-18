import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { clearToken, getToken, pkceChallenge, randomString } from '../lib/oidc'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
  window.configs = undefined
})

describe('PKCE', () => {
  it('matches the RFC 7636 appendix B example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('generates URL-safe random strings of the expected length', () => {
    const s = randomString(32)
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomString(32)).not.toBe(s)
  })
})

describe('oidc mode API calls', () => {
  it('sends the stored access token as a Bearer header and no dev header', async () => {
    window.configs = { authMode: 'oidc', apiUrl: '/api', oidcAuthority: 'http://idp.test', oidcClientId: 'labbook-web' }
    sessionStorage.setItem('labbook.oidc.session', JSON.stringify({ accessToken: 'abc.def.ghi', expiresAt: Date.now() + 60_000 }))
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api.labs()
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer abc.def.ghi')
    expect(headers['X-Dev-User']).toBeUndefined()
  })

  it('ignores an expired token and clears it after a 401', async () => {
    window.configs = { authMode: 'oidc', apiUrl: '/api' }
    sessionStorage.setItem('labbook.oidc.session', JSON.stringify({ accessToken: 'old', expiresAt: Date.now() - 1 }))
    expect(getToken()).toBeNull()

    sessionStorage.setItem('labbook.oidc.session', JSON.stringify({ accessToken: 'live', expiresAt: Date.now() + 60_000 }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: 'Invalid token' }), { status: 401 })))
    await expect(api.labs()).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    expect(getToken()).toBeNull()
    clearToken()
  })
})
