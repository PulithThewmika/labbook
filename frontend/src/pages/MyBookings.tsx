import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, Spinner, btnSecondary } from '../components/feedback'
import { ConfirmDialog } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import { api, ApiError } from '../lib/api'
import { getConfig } from '../lib/config'
import { formatRange } from '../lib/format'
import { useAsync } from '../lib/hooks'
import type { Booking } from '../lib/types'

type Tab = 'upcoming' | 'past'

export default function MyBookings() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [target, setTarget] = useState<Booking | null>(null)
  const [busy, setBusy] = useState(false)
  const tz = getConfig().timeZone
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.bookings({ scope: 'mine', limit: 100 }), [])

  // Upcoming = still live (pending/approved, not yet ended). Everything else, including cancelled and rejected, is Past.
  const now = Date.now()
  const live = (b: Booking) => (b.status === 'pending' || b.status === 'approved') && new Date(b.endAt).getTime() > now
  const shown = (data ?? [])
    .filter((b) => (tab === 'upcoming') === live(b))
    .sort((a, b) => (tab === 'upcoming' ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)))

  async function cancel() {
    if (!target) return
    setBusy(true)
    try {
      await api.cancelBooking(target.id)
      toast('Booking cancelled')
      setTarget(null)
      reload()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not cancel the booking', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="My bookings" subtitle="Requests you have made, and what happened to them." />
      <div role="tablist" aria-label="Booking period" className="mb-5 inline-flex rounded-lg bg-slate-100 p-1">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && shown.length === 0 && (
        <EmptyState title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}>
          {tab === 'upcoming' && (
            <Link to="/labs" className="text-indigo-600 hover:underline">
              Browse labs to make one
            </Link>
          )}
        </EmptyState>
      )}
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{b.resourceName}</h2>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{formatRange(b.startAt, b.endAt, tz)}</p>
                <p className="mt-1 text-sm text-slate-500">{b.purpose}</p>
                {b.status === 'rejected' && b.adminNote && <p className="mt-2 text-sm text-rose-700">Reason: {b.adminNote}</p>}
              </div>
              {tab === 'upcoming' && (b.status === 'pending' || b.status === 'approved') && (
                <button type="button" className={btnSecondary} onClick={() => setTarget(b)} aria-label={`Cancel booking for ${b.resourceName}`}>
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {target && (
        <ConfirmDialog
          title="Cancel this booking?"
          message={`${target.resourceName}, ${formatRange(target.startAt, target.endAt, tz)}. The slot becomes available to others.`}
          confirmLabel="Cancel booking"
          danger
          busy={busy}
          onConfirm={cancel}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  )
}
