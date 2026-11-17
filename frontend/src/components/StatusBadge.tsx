const STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  completed: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  expired: 'bg-slate-100 text-slate-500 ring-slate-200',
  // equipment statuses
  available: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  maintenance: 'bg-amber-100 text-amber-800 ring-amber-200',
  retired: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      data-status={status}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STYLES[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {statusLabel(status)}
    </span>
  )
}
