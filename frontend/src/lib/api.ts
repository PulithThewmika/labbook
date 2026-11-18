import { getConfig } from './config'
import { clearToken, getToken } from './oidc'
import type {
  Availability,
  Booking,
  BookingInput,
  Equipment,
  EquipmentInput,
  Lab,
  LabDetail,
  LabInput,
  Me,
  Stats,
} from './types'

const DEV_USER_KEY = 'labbook.devUser'

export const DEV_USERS = ['student@labbook.dev', 'admin@labbook.dev']

export function getDevUser(): string | null {
  try {
    return localStorage.getItem(DEV_USER_KEY)
  } catch {
    return null
  }
}

export function setDevUser(email: string | null): void {
  try {
    if (email) localStorage.setItem(DEV_USER_KEY, email)
    else localStorage.removeItem(DEV_USER_KEY)
  } catch {
    // storage unavailable: the picker just will not persist
  }
}

export class ApiError extends Error {
  status: number
  code: string
  rule?: string

  constructor(status: number, code: string, message: string, rule?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.rule = rule
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  /** Do not redirect to the login page on 401 (used by the session probe). */
  noRedirect?: boolean
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const cfg = getConfig()
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const devUser = getDevUser()
  if (cfg.authMode === 'dev' && devUser) headers['X-Dev-User'] = devUser
  const token = cfg.authMode === 'oidc' ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(cfg.apiUrl + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.')
  }

  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T

  let payload: { code?: string; message?: string; rule?: string } = {}
  try {
    payload = await res.json()
  } catch {
    // non-JSON error body
  }
  if (res.status === 401 && cfg.authMode === 'oidc') clearToken() // expired or rejected: next sign-in starts fresh
  if (res.status === 401 && cfg.authMode === 'choreo' && !opts.noRedirect) {
    window.location.href = '/auth/login'
  }
  throw new ApiError(
    res.status,
    payload.code ?? 'UNKNOWN',
    payload.message ?? (res.statusText || 'Request failed'),
    payload.rule,
  )
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  me: () => request<Me>('/me', { noRedirect: true }),

  labs: (includeInactive = false) => request<Lab[]>(`/labs${qs({ includeInactive: includeInactive || undefined })}`),
  lab: (id: string) => request<LabDetail>(`/labs/${id}`),
  createLab: (b: LabInput) => request<Lab>('/labs', { method: 'POST', body: b }),
  updateLab: (id: string, b: LabInput) => request<Lab>(`/labs/${id}`, { method: 'PUT', body: b }),

  equipment: (f: { category?: string; status?: string; labId?: string } = {}) =>
    request<Equipment[]>(`/equipment${qs(f)}`),
  createEquipment: (b: EquipmentInput) => request<Equipment>('/equipment', { method: 'POST', body: b }),
  updateEquipment: (id: string, b: EquipmentInput) => request<Equipment>(`/equipment/${id}`, { method: 'PUT', body: b }),

  availability: (resourceType: string, resourceId: string, date: string) =>
    request<Availability>(`/availability${qs({ resourceType, resourceId, date })}`),

  bookings: (f: { status?: string; scope?: 'mine' | 'all'; when?: 'upcoming' | 'past'; limit?: number; offset?: number }) =>
    request<Booking[]>(`/bookings${qs(f)}`),
  booking: (id: string) => request<Booking>(`/bookings/${id}`),
  createBooking: (b: BookingInput) => request<Booking>('/bookings', { method: 'POST', body: b }),
  cancelBooking: (id: string) => request<Booking>(`/bookings/${id}/cancel`, { method: 'POST' }),
  approveBooking: (id: string) => request<Booking>(`/bookings/${id}/approve`, { method: 'POST' }),
  rejectBooking: (id: string, note: string) => request<Booking>(`/bookings/${id}/reject`, { method: 'POST', body: { note } }),

  stats: () => request<Stats>('/stats'),
}
