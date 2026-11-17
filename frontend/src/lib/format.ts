// Date/time helpers. Everything is shown and entered in the campus time zone (config.timeZone).

const pad = (n: number) => String(n).padStart(2, '0')

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** "YYYY-MM-DD" of the instant as seen in `timeZone`. */
export function dateInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
}

/** "HH:MM" of the instant as seen in `timeZone`. */
export function hhmmInZone(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone)
  return `${pad(p.h)}:${pad(p.mi)}`
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** The instant at which the wall clock in `timeZone` reads `date` `time`. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const first = offsetMs(new Date(guess), timeZone)
  let utc = guess - first
  const second = offsetMs(new Date(utc), timeZone)
  if (second !== first) utc = guess - second // across a DST change
  return new Date(utc)
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 30-minute marks from `open` to `close` inclusive, as "HH:MM". */
export function halfHours(open: string, close: string): string[] {
  const out: string[] = []
  for (let t = minutesOf(open); t <= minutesOf(close); t += 30) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`)
  return out
}

export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}

export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  return `${formatDay(startIso, timeZone)}, ${formatTime(startIso, timeZone)} - ${formatTime(endIso, timeZone)}`
}

export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}
