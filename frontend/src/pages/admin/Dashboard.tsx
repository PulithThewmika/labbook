import { ErrorState, PageHeader, Spinner } from '../../components/feedback'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.stats(), [])
  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="How the labs are being used." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="Bookings today" value={data.bookingsToday} />
        <Card label="Pending approval" value={data.pendingCount} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="util-h" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="util-h" className="font-semibold text-slate-900">
            Lab utilisation, last 7 days
          </h2>
          <ul className="mt-4 space-y-4">
            {data.labUtilisation7d.map((l) => {
              const pct = Math.min(100, Math.round(l.ratio * 100))
              return (
                <li key={l.labId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{l.code}</span>
                    <span className="tabular-nums text-slate-500">
                      {pct}% · {l.hoursBooked} of {l.hoursOpen} h
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.code} utilisation`}>
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="top-h" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="top-h" className="font-semibold text-slate-900">
            Most booked equipment, last 30 days
          </h2>
          {data.topEquipment30d.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No equipment bookings yet.</p>
          ) : (
            <ol className="mt-4 divide-y divide-slate-100">
              {data.topEquipment30d.map((e, i) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-700">
                    <span className="mr-3 tabular-nums text-slate-400">{i + 1}</span>
                    {e.name}
                  </span>
                  <span className="tabular-nums text-slate-500">{e.count} bookings</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
