import { useState } from 'react'
import type { FormEvent } from 'react'
import { EmptyState, ErrorState, Field, PageHeader, Spinner, btnPrimary, btnSecondary, inputCls } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { api, ApiError } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { Lab, LabInput } from '../../lib/types'

const EMPTY: LabInput = {
  code: '',
  name: '',
  building: '',
  room: '',
  capacity: 20,
  description: '',
  openTime: '08:00',
  closeTime: '17:00',
  isActive: true,
}

function toInput(l: Lab): LabInput {
  const { id: _id, ...rest } = l
  return rest
}

function LabDialog({ lab, onClose, onSaved }: { lab: Lab | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<LabInput>(lab ? toInput(lab) : EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = <K extends keyof LabInput>(k: K, v: LabInput[K]) => setF((x) => ({ ...x, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (lab) await api.updateLab(lab.id, f)
      else await api.createLab(f)
      toast(lab ? 'Lab updated' : 'Lab created')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the lab')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={lab ? `Edit ${lab.code}` : 'New lab'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="lab-form" className={btnPrimary} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <form id="lab-form" onSubmit={save} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" htmlFor="l-code">
            <input id="l-code" required pattern="[A-Z0-9\-]{2,16}" title="2-16 capital letters, digits or dashes" className={inputCls} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
          </Field>
          <Field label="Capacity" htmlFor="l-cap">
            <input id="l-cap" type="number" required min={1} max={500} className={inputCls} value={f.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Name" htmlFor="l-name">
          <input id="l-name" required minLength={2} maxLength={100} className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Building" htmlFor="l-bld">
            <input id="l-bld" required className={inputCls} value={f.building} onChange={(e) => set('building', e.target.value)} />
          </Field>
          <Field label="Room" htmlFor="l-room">
            <input id="l-room" required className={inputCls} value={f.room} onChange={(e) => set('room', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Opens" htmlFor="l-open">
            <input id="l-open" type="time" step={1800} required className={inputCls} value={f.openTime} onChange={(e) => set('openTime', e.target.value)} />
          </Field>
          <Field label="Closes" htmlFor="l-close">
            <input id="l-close" type="time" step={1800} required className={inputCls} value={f.closeTime} onChange={(e) => set('closeTime', e.target.value)} />
          </Field>
        </div>
        <Field label="Description" htmlFor="l-desc">
          <textarea id="l-desc" rows={2} className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 rounded border-slate-300 text-indigo-600" />
          Active (can be booked)
        </label>
      </form>
    </Modal>
  )
}

export default function AdminLabs() {
  const { data, error, loading, reload } = useAsync(() => api.labs(true), [])
  const [editing, setEditing] = useState<Lab | 'new' | null>(null)
  const toast = useToast()

  async function toggle(l: Lab) {
    try {
      await api.updateLab(l.id, { ...toInput(l), isActive: !l.isActive })
      toast(l.isActive ? `${l.code} deactivated` : `${l.code} activated`)
      reload()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not update the lab', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Manage labs"
        subtitle="Create, edit and deactivate labs."
        action={
          <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
            New lab
          </button>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No labs yet" />}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Lab</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Seats</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.code}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.building}, {l.room}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.capacity}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.openTime} - {l.closeTime}
                  </td>
                  <td className="px-4 py-3">
                    <span className={l.isActive ? 'text-emerald-700' : 'text-slate-500'}>{l.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setEditing(l)} aria-label={`Edit ${l.code}`}>
                      Edit
                    </button>
                    <button type="button" className="font-medium text-slate-600 hover:underline" onClick={() => toggle(l)} aria-label={`${l.isActive ? 'Deactivate' : 'Activate'} ${l.code}`}>
                      {l.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <LabDialog
          lab={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
