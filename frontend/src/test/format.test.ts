import { describe, expect, it } from 'vitest'
import { addDays, dateInZone, halfHours, hhmmInZone, zonedToUtc } from '../lib/format'

describe('format helpers', () => {
  it('converts campus wall-clock time to a UTC instant', () => {
    expect(zonedToUtc('2030-01-01', '10:00', 'Asia/Colombo').toISOString()).toBe('2030-01-01T04:30:00.000Z')
  })
  it('reads the wall clock back in the zone', () => {
    expect(hhmmInZone('2030-01-01T04:30:00Z', 'Asia/Colombo')).toBe('10:00')
    expect(dateInZone(new Date('2029-12-31T20:00:00Z'), 'Asia/Colombo')).toBe('2030-01-01')
  })
  it('adds days across a month end', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01')
  })
  it('lists half-hour marks', () => {
    expect(halfHours('08:00', '09:30')).toEqual(['08:00', '08:30', '09:00', '09:30'])
  })
})
