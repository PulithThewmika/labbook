import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AvailabilityTimeline } from '../components/AvailabilityTimeline'
import { BookingForm } from '../components/BookingForm'
import type { BookableResource } from '../components/BookingForm'
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/feedback'
import { useToast } from '../components/Toast'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getConfig } from '../lib/config'
import { dateInZone, zonedToUtc } from '../lib/format'
import { useAsync } from '../lib/hooks'
import type { BookingDraft } from '../lib/rules'

export default function Book() {
  const [params] = useSearchParams()
  const type = params.get('type') === 'equipment' ? 'equipment' : 'lab'
  const id = params.get('id') ?? ''
  const tz = getConfig().timeZone
  const initialDate = params.get('date') ?? dateInZone(new Date(), tz)
  const [date, setDate] = useState(initialDate)
  const [serverError, setServerError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const { isAdmin } = useAuth()

  const resource = useAsync<BookableResource & { id: string }>(async () => {
    if (type === 'lab') {
      const [lab, a] = await Promise.all([api.lab(id), api.availability('lab', id, initialDate)])
      return { id, type, name: lab.name, capacity: lab.capacity, openTime: a.openTime, closeTime: a.closeTime }
    }
    const [all, a] = await Promise.all([api.equipment(), api.availability('equipment', id, initialDate)])
    const eq = all.find((e) => e.id === id)
    if (!eq) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found')
    return { id, type, name: eq.name, capacity: 1, openTime: a.openTime, closeTime: a.closeTime }
  }, [type, id])

  const avail = useAsync(() => api.availability(type, id, date), [type, id, date])

  if (!id) return <EmptyState title="Nothing selected">Choose a lab or piece of equipment to book.</EmptyState>
  if (resource.loading) return <Spinner />
  if (resource.error || !resource.data) return <ErrorState message={resource.error ?? 'Not found'} onRetry={resource.reload} />
  const r = resource.data

  async function submit(d: BookingDraft) {
    setServerError(null)
    try {
      await api.createBooking({
        resourceType: type,
        resourceId: id,
        startAt: zonedToUtc(d.date, d.start, tz).toISOString(),
        endAt: zonedToUtc(d.date, d.end, tz).toISOString(),
        purpose: d.purpose.trim(),
        attendees: d.attendees,
      })
      toast(isAdmin ? 'Booking confirmed' : 'Request sent. An admin will review it.')
      navigate('/bookings')
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 422 || e.status === 400)) setServerError(e.message)
      else toast(e instanceof ApiError ? e.message : 'Could not create the booking', 'error')
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link to={type === 'lab' ? `/labs/${id}` : '/equipment'} className="text-indigo-600 hover:underline">
          ← Back
        </Link>
      </p>
      <PageHeader title={`Book ${r.name}`} subtitle={`Open ${r.openTime} - ${r.closeTime}. Bookings last 30 minutes to 4 hours.`} />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <BookingForm resource={r} initialDate={initialDate} timeZone={tz} serverError={serverError} onDateChange={setDate} onSubmit={submit} />
        </div>
        <section aria-label="Availability on the chosen date">
          <h2 className="mb-3 font-semibold text-slate-900">Already booked on {date}</h2>
          {avail.loading && <Spinner label="Loading availability" />}
          {avail.error && <ErrorState message={avail.error} onRetry={avail.reload} />}
          {avail.data && !avail.loading && (
            <AvailabilityTimeline openTime={avail.data.openTime} closeTime={avail.data.closeTime} busy={avail.data.busy} timeZone={tz} />
          )}
        </section>
      </div>
    </div>
  )
}
