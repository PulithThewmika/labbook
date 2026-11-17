import { useState } from 'react'
import type { FormEvent } from 'react'
import { EmptyState, ErrorState, Field, PageHeader, Spinner, btnPrimary, btnSecondary, inputCls } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { useToast } from '../../components/Toast'
import { api, ApiError } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { Equipment, EquipmentInput, EquipmentStatus, Lab } from '../../lib/types'

const STATUSES: EquipmentStatus[] = ['available', 'maintenance', 'retired']
const EMPTY: EquipmentInput = { labId: null, assetTag: '', name: '', category: '', description: '', status: 'available' }

const toInput = (e: Equipment): EquipmentInput => ({
  labId: e.labId,
  assetTag: e.assetTag,
  name: e.name,
  category: e.category,
  description: e.description,
  status: e.status,
})

function EquipmentDialog({ item, labs, onClose, onSaved }: { item: Equipment | null; labs: Lab[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<EquipmentInput>(item ? toInput(item) : EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const set = <K extends keyof EquipmentInput>(k: K, v: EquipmentInput[K]) => setF((x) => ({ ...x, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (item) await api.updateEquipment(item.id, f)
      else await api.createEquipment(f)
      toast(item ? 'Equipment updated' : 'Equipment created')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the equipment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={item ? `Edit ${item.assetTag}` : 'New equipment'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="eq-form" className={btnPrimary} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <form id="eq-form" onSubmit={save} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
        <Field label="Name" htmlFor="e-name">
          <input id="e-name" required className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Asset tag" htmlFor="e-tag">
            <input id="e-tag" required className={inputCls} value={f.assetTag} onChange={(e) => set('assetTag', e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="e-cat">
            <input id="e-cat" required className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home lab" htmlFor="e-lab">
            <select id="e-lab" className={inputCls} value={f.labId ?? ''} onChange={(e) => set('labId', e.target.value || null)}>
              <option value="">None</option>
              {labs.filter((l) => l.isActive || l.id === f.labId).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="e-status">
            <select id="e-status" className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value as EquipmentStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="e-desc">
          <textarea id="e-desc" rows={2} className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

export default function AdminEquipment() {
  const items = useAsync(() => api.equipment(), [])
  const labs = useAsync(() => api.labs(true), [])
  const [editing, setEditing] = useState<Equipment | 'new' | null>(null)
  const toast = useToast()

  async function setStatus(e: Equipment, status: EquipmentStatus) {
    try {
      await api.updateEquipment(e.id, { ...toInput(e), status })
      toast(`${e.assetTag} is now ${status}`)
      items.reload()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update the status', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Manage equipment"
        subtitle="Add items and change their status."
        action={
          <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
            New equipment
          </button>
        }
      />
      {items.loading && <Spinner />}
      {items.error && <ErrorState message={items.error} onRetry={items.reload} />}
      {items.data && items.data.length === 0 && <EmptyState title="No equipment yet" />}
      {items.data && items.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Lab</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.data.map((e) => (
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
                  <td className="space-x-3 px-4 py-3 text-right">
                    <label className="sr-only" htmlFor={`st-${e.id}`}>
                      Status of {e.assetTag}
                    </label>
                    <select id={`st-${e.id}`} className="rounded-md border-0 py-1 pl-2 pr-7 text-sm ring-1 ring-slate-300" value={e.status} onChange={(ev) => setStatus(e, ev.target.value as EquipmentStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setEditing(e)} aria-label={`Edit ${e.assetTag}`}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EquipmentDialog
          item={editing === 'new' ? null : editing}
          labs={labs.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            items.reload()
          }}
        />
      )}
    </div>
  )
}
