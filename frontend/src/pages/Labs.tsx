import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/feedback'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

export default function Labs() {
  const { data, error, loading, reload } = useAsync(() => api.labs(), [])

  return (
    <div>
      <PageHeader title="Labs" subtitle="Pick a lab to see its equipment and what is free." />
      {loading && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No labs yet">An admin needs to add the first lab.</EmptyState>}
      {data && data.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((lab) => (
            <li key={lab.id}>
              <Link
                to={`/labs/${lab.id}`}
                className="block h-full rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-slate-900">{lab.name}</h2>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{lab.code}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {lab.building}, room {lab.room}
                </p>
                <dl className="mt-4 flex gap-6 text-sm">
                  <div>
                    <dt className="text-slate-500">Capacity</dt>
                    <dd className="font-medium text-slate-900">{lab.capacity} seats</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Open</dt>
                    <dd className="font-medium text-slate-900">
                      {lab.openTime} - {lab.closeTime}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
