import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, request, setDevUser } from '../lib/api'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  setDevUser(null)
  window.configs = undefined
})

describe('api client', () => {
  it('maps a 409 error body to an ApiError', async () => {
    mockFetch(409, { code: 'BOOKING_CONFLICT', message: 'That time slot is already booked' })
    const err = await request('/bookings', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'BOOKING_CONFLICT', message: 'That time slot is already booked' })
  })

  it('keeps the rule id of a 422', async () => {
    mockFetch(422, { code: 'RULE_VIOLATION', message: 'You can hold at most 3 upcoming bookings', rule: 'BR-7' })
    const err = (await api
      .createBooking({ resourceType: 'lab', resourceId: 'x', startAt: '', endAt: '', purpose: '', attendees: 1 })
      .catch((e: unknown) => e)) as ApiError
    expect(err.rule).toBe('BR-7')
  })

  it('sends X-Dev-User in dev mode and the configured API prefix', async () => {
    const fetchMock = mockFetch(200, [])
    setDevUser('admin@labbook.dev')
    await api.labs()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/labs')
    expect((init.headers as Record<string, string>)['X-Dev-User']).toBe('admin@labbook.dev')
  })
})
