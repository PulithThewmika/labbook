import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AvailabilityTimeline } from '../components/AvailabilityTimeline'
import { ErrorState, PageHeader, Spinner, btnPrimary, inputCls } from '../components/feedback'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { getConfig } from '../lib/config'
import { addDays, dateInZone, formatDateLabel } from '../lib/format'
import { useAsync } from '../lib/hooks'

export default function LabDetail() {
  const { id = '' } = useParams()
  const tz = getConfig().timeZone
  const today = dateInZone(new Date(), tz)
  const [date, setDate] = useState(today)

  const lab = useAsync(() => api.lab(id), [id])
  const avail = useAsync(() => api.availability('lab', id, date), [id, date])

  if (lab.loading) return <Spinner />
  if (lab.error || !lab.data) return <ErrorState message={lab.error ?? 'Lab not found'} onRetry={lab.reload} />
  const l = lab.data

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link to="/labs" className="text-indigo-600 hover:underline">
          ← All labs
        </Link>
      </p>
      <PageHeader
        title={l.name}
        subtitle={`${l.code} · ${l.building}, room ${l.room} · ${l.capacity} seats · open ${l.openTime} - ${l.closeTime}`}
        action={
          l.isActive ? (
            <Link to={`/book?type=lab&id=${l.id}&date=${date}`} className={btnPrimary}>
              Book this lab
            </Link>
          ) : (
            <StatusBadge status="retired" />
          )
        }
      />
      {l.description && <p className="-mt-3 mb-6 max-w-2xl text-slate-600">{l.description}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="avail-h">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="avail-h" className="font-semibold text-slate-900">
                Availability
              </h2>
              <p className="text-sm text-slate-500">{formatDateLabel(date)}</p>
            </div>
            <div className="w-44">
              <label htmlFor="day" className="sr-only">
                Date
              </label>
              <input id="day" type="date" className={inputCls} value={date} min={today} max={addDays(today, 30)} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </div>
          {avail.loading && <Spinner label="Loading availability" />}
          {avail.error && <ErrorState message={avail.error} onRetry={avail.reload} />}
          {avail.data && !avail.loading && (
            <>
              <AvailabilityTimeline openTime={avail.data.openTime} closeTime={avail.data.closeTime} busy={avail.data.busy} timeZone={tz} />
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded bg-emerald-50 ring-1 ring-emerald-200" /> Free
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded bg-slate-300" /> Booked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="striped size-3 rounded ring-1 ring-amber-300" /> Awaiting approval
                </span>
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="eq-h">
          <h2 id="eq-h" className="mb-3 font-semibold text-slate-900">
            Equipment in this lab
          </h2>
          {l.equipment.length === 0 ? (
            <p className="text-sm text-slate-500">No equipment listed.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {l.equipment.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.name}</p>
                    <p className="text-xs text-slate-500">{e.category}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
