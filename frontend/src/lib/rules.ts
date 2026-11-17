// Client-side mirror of booking rules BR-1..BR-5 (backend/rules.bal). The server stays the authority.
import { addDays, dateInZone, minutesOf, zonedToUtc } from './format'

export interface BookingDraft {
  date: string // YYYY-MM-DD in campus time
  start: string // HH:MM
  end: string // HH:MM
  attendees: number
  purpose: string
}

export interface BookingContext {
  isLab: boolean
  capacity: number
  openTime: string
  closeTime: string
  timeZone: string
  now: Date
}

export type BookingField = 'date' | 'start' | 'end' | 'attendees' | 'purpose'
export type BookingErrors = Partial<Record<BookingField, string>>

export function validateBooking(d: BookingDraft, ctx: BookingContext): BookingErrors {
  const e: BookingErrors = {}
  if (!d.date) e.date = 'Choose a date'
  if (!d.start) e.start = 'Choose a start time'
  if (!d.end) e.end = 'Choose an end time'

  if (d.date && d.start) {
    const startAt = zonedToUtc(d.date, d.start, ctx.timeZone)
    if (startAt.getTime() <= ctx.now.getTime()) e.start = 'The start time must be in the future' // BR-1
    else if (d.date > addDays(dateInZone(ctx.now, ctx.timeZone), 30)) e.date = 'Bookings can be made at most 30 days ahead' // BR-3
  }

  if (d.start && d.end && !e.start && !e.end) {
    const mins = minutesOf(d.end) - minutesOf(d.start)
    if (mins <= 0) e.end = 'The end time must be after the start time'
    else if (mins < 30 || mins > 240) e.end = 'A booking must last between 30 minutes and 4 hours' // BR-2
    else if (minutesOf(d.start) < minutesOf(ctx.openTime) || minutesOf(d.end) > minutesOf(ctx.closeTime))
      e.end = `The resource is only available ${ctx.openTime}-${ctx.closeTime}` // BR-4
  }

  if (ctx.isLab && (!Number.isInteger(d.attendees) || d.attendees < 1 || d.attendees > ctx.capacity))
    e.attendees = `Attendees must be between 1 and ${ctx.capacity}` // BR-5

  const len = d.purpose.trim().length
  if (len < 5 || len > 500) e.purpose = 'Purpose must be 5 to 500 characters'
  return e
}
