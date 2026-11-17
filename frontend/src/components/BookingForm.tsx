import { useState } from 'react'
import type { FormEvent } from 'react'
import { addDays, dateInZone, halfHours, minutesOf } from '../lib/format'
import { validateBooking } from '../lib/rules'
import type { BookingDraft, BookingErrors } from '../lib/rules'
import { Field, btnPrimary, inputCls } from './feedback'

export interface BookableResource {
  type: 'lab' | 'equipment'
  name: string
  capacity: number
  openTime: string
  closeTime: string
}

interface Props {
  resource: BookableResource
  initialDate: string
  timeZone: string
  /** Server-side error (409 / 422 / other) to show above the form. */
  serverError?: string | null
  onDateChange?: (date: string) => void
  onSubmit: (draft: BookingDraft) => Promise<void>
  now?: () => Date
}

export function BookingForm({ resource, initialDate, timeZone, serverError, onDateChange, onSubmit, now = () => new Date() }: Props) {
  const isLab = resource.type === 'lab'
  const [date, setDate] = useState(initialDate)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [attendees, setAttendees] = useState(1)
  const [purpose, setPurpose] = useState('')
  const [errors, setErrors] = useState<BookingErrors>({})
  const [busy, setBusy] = useState(false)

  const marks = halfHours(resource.openTime, resource.closeTime)
  const startOptions = marks.slice(0, -1)
  const endOptions = marks.filter((t) => !start || minutesOf(t) > minutesOf(start))
  const today = dateInZone(now(), timeZone)

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const draft: BookingDraft = { date, start, end, attendees: isLab ? attendees : 1, purpose }
    const found = validateBooking(draft, {
      isLab,
      capacity: resource.capacity,
      openTime: resource.openTime,
      closeTime: resource.closeTime,
      timeZone,
      now: now(),
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      await onSubmit(draft)
    } finally {
      setBusy(false)
    }
  }

  const aria = (k: keyof BookingErrors) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `${k}-error` : undefined })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {serverError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {serverError}
        </div>
      )}
      <Field label="Date" htmlFor="date" error={errors.date}>
        <input
          id="date"
          type="date"
          className={inputCls}
          value={date}
          min={today}
          max={addDays(today, 30)}
          onChange={(e) => {
            setDate(e.target.value)
            onDateChange?.(e.target.value)
          }}
          {...aria('date')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start" htmlFor="start" error={errors.start}>
          <select id="start" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} {...aria('start')}>
            <option value="">Select</option>
            {startOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="End" htmlFor="end" error={errors.end}>
          <select id="end" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} {...aria('end')}>
            <option value="">Select</option>
            {endOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {isLab && (
        <Field label={`Attendees (max ${resource.capacity})`} htmlFor="attendees" error={errors.attendees}>
          <input
            id="attendees"
            type="number"
            min={1}
            max={resource.capacity}
            className={inputCls}
            value={attendees}
            onChange={(e) => setAttendees(Number(e.target.value))}
            {...aria('attendees')}
          />
        </Field>
      )}
      <Field label="Purpose" htmlFor="purpose" error={errors.purpose}>
        <textarea
          id="purpose"
          rows={3}
          maxLength={500}
          className={inputCls}
          placeholder="e.g. Group project, circuit testing"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          {...aria('purpose')}
        />
      </Field>
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? 'Requesting…' : 'Request booking'}
      </button>
    </form>
  )
}
