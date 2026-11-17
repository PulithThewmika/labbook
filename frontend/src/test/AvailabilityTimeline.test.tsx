import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvailabilityTimeline } from '../components/AvailabilityTimeline'

// Asia/Colombo is UTC+05:30: 10:00-11:00 local = 04:30-05:30Z
const busy = [
  { startAt: '2030-01-01T04:30:00Z', endAt: '2030-01-01T05:30:00Z', status: 'approved' },
  { startAt: '2030-01-01T07:30:00Z', endAt: '2030-01-01T08:00:00Z', status: 'pending' },
]

describe('AvailabilityTimeline', () => {
  it('renders a row per 30 minutes between open and close', () => {
    render(<AvailabilityTimeline openTime="08:00" closeTime="17:00" busy={[]} timeZone="Asia/Colombo" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(18)
    expect(screen.getByTestId('slot-08:00')).toBeInTheDocument()
    expect(screen.queryByTestId('slot-17:00')).not.toBeInTheDocument()
  })

  it('marks busy and pending slots in the right rows', () => {
    render(<AvailabilityTimeline openTime="08:00" closeTime="17:00" busy={busy} timeZone="Asia/Colombo" />)
    expect(screen.getByTestId('slot-09:30')).toHaveAttribute('data-state', 'free')
    expect(screen.getByTestId('slot-10:00')).toHaveAttribute('data-state', 'busy')
    expect(screen.getByTestId('slot-10:30')).toHaveAttribute('data-state', 'busy')
    expect(screen.getByTestId('slot-11:00')).toHaveAttribute('data-state', 'free')
    expect(screen.getByTestId('slot-13:00')).toHaveAttribute('data-state', 'pending')
    expect(screen.getByTestId('slot-13:30')).toHaveAttribute('data-state', 'free')
  })
})
