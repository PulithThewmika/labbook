import { halfHours, hhmmInZone, minutesOf } from '../lib/format'
import type { BusySlot } from '../lib/types'

interface Props {
  openTime: string
  closeTime: string
  busy: BusySlot[]
  timeZone: string
}

export type SlotState = 'free' | 'busy' | 'pending'

/** State of the 30-minute slot starting at `slotStart` (minutes after midnight, campus time). */
export function slotState(slotStart: number, busy: { start: number; end: number; status: string }[]): SlotState {
  let state: SlotState = 'free'
  for (const b of busy) {
    if (b.start < slotStart + 30 && b.end > slotStart) {
      if (b.status === 'approved') return 'busy'
      state = 'pending'
    }
  }
  return state
}

const STATE_LABEL: Record<SlotState, string> = { free: 'Free', busy: 'Booked', pending: 'Awaiting approval' }

export function AvailabilityTimeline({ openTime, closeTime, busy, timeZone }: Props) {
  const intervals = busy.map((b) => ({
    start: minutesOf(hhmmInZone(b.startAt, timeZone)),
    // an end at exactly 00:00 would wrap to 0; the API guarantees same-day bookings, so treat 0 as end of day
    end: minutesOf(hhmmInZone(b.endAt, timeZone)) || 24 * 60,
    status: b.status,
  }))
  const slots = halfHours(openTime, closeTime).slice(0, -1)

  return (
    <div>
      <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Day timeline">
        {slots.map((t) => {
          const state = slotState(minutesOf(t), intervals)
          return (
            <li key={t} data-testid={`slot-${t}`} data-state={state} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-slate-500">{t}</span>
              <span
                className={`h-6 flex-1 rounded-md ${
                  state === 'free' ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200' : state === 'busy' ? 'bg-slate-300' : 'striped ring-1 ring-inset ring-amber-300'
                }`}
              />
              <span className="w-32 shrink-0 text-right text-xs text-slate-500">{STATE_LABEL[state]}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
