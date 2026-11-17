import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, PageHeader, Spinner, inputCls } from '../components/feedback'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

export default function EquipmentPage() {
  const { data, error, loading, reload } = useAsync(() => api.equipment(), [])
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')

  const categories = useMemo(() => [...new Set((data ?? []).map((e) => e.category))].sort(), [data])
  const rows = (data ?? []).filter((e) => (!category || e.category === category) && (!status || e.status === status))

  return (
    <div>
      <PageHeader title="Equipment" subtitle="Instruments and kits you can book." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-52">
          <label htmlFor="cat" className="sr-only">
            Category
          </label>
          <select id="cat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label htmlFor="st" className="sr-only">
            Status
          </label>
          <select id="st" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && rows.length === 0 && <EmptyState title="No equipment matches">Try a different filter.</EmptyState>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Lab</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{e.name}</p>
                    <p className="text-xs text-slate-500">{e.assetTag}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.category}</td>
                  <td className="px-4 py-3 text-slate-600">{e.labCode ?? '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.status === 'available' ? (
                      <Link to={`/book?type=equipment&id=${e.id}`} className="font-medium text-indigo-600 hover:underline">
                        Book
                      </Link>
                    ) : (
                      <span className="text-slate-400">Unavailable</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
