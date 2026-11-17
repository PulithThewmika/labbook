import { useState } from 'react'
import { EmptyState, ErrorState, Field, PageHeader, Spinner, btnDanger, btnPrimary, btnSecondary, inputCls } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { api, ApiError } from '../../lib/api'
import { getConfig } from '../../lib/config'
import { formatRange } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import type { Booking } from '../../lib/types'

export default function Approvals() {
  const tz = getConfig().timeZone
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(() => api.bookings({ status: 'pending', scope: 'all', limit: 100 }), [])
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function act(b: Booking, fn: () => Promise<unknown>, done: string) {
    setBusyId(b.id)
    try {
      await fn()
      toast(done)
      setRejecting(null)
      setNote('')
      reload()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Action failed'
      if (rejecting) setNoteError(msg)
      else toast(msg, 'error')
    } finally {
      setBusyId(null)
    }
  }

  function reject() {
    if (!rejecting) return
    const n = note.trim()
    if (n.length < 3 || n.length > 300) {
      setNoteError('Enter a note of 3 to 300 characters')
      return
    }
    setNoteError(null)
    void act(rejecting, () => api.rejectBooking(rejecting.id, n), 'Booking rejected')
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Pending requests, oldest first." />
      {loading && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="All caught up">No requests are waiting for approval.</EmptyState>}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">{b.resourceName}</h2>
                <p className="mt-1 text-sm text-slate-600">{formatRange(b.startAt, b.endAt, tz)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {b.userName} · {b.resourceType === 'lab' ? `${b.attendees} attendees` : 'equipment'}
                </p>
                <p className="mt-1 text-sm text-slate-700">{b.purpose}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={btnSecondary} disabled={busyId === b.id} onClick={() => { setRejecting(b); setNote(''); setNoteError(null) }}>
                  Reject
                </button>
                <button type="button" className={btnPrimary} disabled={busyId === b.id} onClick={() => act(b, () => api.approveBooking(b.id), 'Booking approved')}>
                  Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rejecting && (
        <Modal
          title="Reject this request?"
          onClose={() => setRejecting(null)}
          footer={
            <>
              <button type="button" className={btnSecondary} onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button type="button" className={btnDanger} onClick={reject} disabled={busyId === rejecting.id}>
                Reject request
              </button>
            </>
          }
        >
          <p className="mb-3 text-sm text-slate-600">
            {rejecting.resourceName}, {formatRange(rejecting.startAt, rejecting.endAt, tz)}. The student will see your note.
          </p>
          <Field label="Note" htmlFor="note" error={noteError ?? undefined}>
            <textarea id="note" rows={3} maxLength={300} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  )
}
