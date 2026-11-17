import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingForm } from '../components/BookingForm'
import type { BookableResource } from '../components/BookingForm'
import { validateBooking } from '../lib/rules'

const lab: BookableResource = { type: 'lab', name: 'Computer Lab A', capacity: 40, openTime: '08:00', closeTime: '17:00' }
const now = new Date('2030-01-01T00:00:00Z') // 05:30 on 2030-01-01 in Asia/Colombo
const ctx = { isLab: true, capacity: 40, openTime: '08:00', closeTime: '17:00', timeZone: 'Asia/Colombo', now }
const ok = { date: '2030-01-05', start: '10:00', end: '12:00', attendees: 10, purpose: 'Group project work' }

describe('validateBooking', () => {
  it('accepts a valid draft', () => {
    expect(validateBooking(ok, ctx)).toEqual({})
  })
  it('BR-1 rejects a start in the past', () => {
    expect(validateBooking({ ...ok, date: '2029-12-31' }, ctx).start).toBe('The start time must be in the future')
  })
  it('BR-2 rejects durations outside 30 min - 4 h', () => {
    expect(validateBooking({ ...ok, start: '10:00', end: '10:00' }, ctx).end).toBe('The end time must be after the start time')
    expect(validateBooking({ ...ok, start: '09:00', end: '13:30' }, ctx).end).toBe('A booking must last between 30 minutes and 4 hours')
  })
  it('BR-3 rejects a date more than 30 days ahead', () => {
    expect(validateBooking({ ...ok, date: '2030-02-05' }, ctx).date).toBe('Bookings can be made at most 30 days ahead')
  })
  it('BR-4 rejects times outside opening hours', () => {
    expect(validateBooking({ ...ok, start: '16:00', end: '17:30' }, ctx).end).toBe('The resource is only available 08:00-17:00')
  })
  it('BR-5 rejects attendees above capacity', () => {
    expect(validateBooking({ ...ok, attendees: 41 }, ctx).attendees).toBe('Attendees must be between 1 and 40')
  })
  it('requires a purpose of 5+ characters', () => {
    expect(validateBooking({ ...ok, purpose: 'abc' }, ctx).purpose).toBe('Purpose must be 5 to 500 characters')
  })
})

describe('BookingForm', () => {
  function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
    render(<BookingForm resource={lab} initialDate="2030-01-05" timeZone="Asia/Colombo" onSubmit={onSubmit} now={() => now} />)
    return onSubmit
  }

  it('shows validation messages and does not submit an empty form', async () => {
    const onSubmit = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Request booking' }))
    expect(await screen.findByText('Choose a start time')).toBeInTheDocument()
    expect(screen.getByText('Choose an end time')).toBeInTheDocument()
    expect(screen.getByText('Purpose must be 5 to 500 characters')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid draft', async () => {
    const onSubmit = setup()
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '12:00' } })
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Group project work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request booking' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ date: '2030-01-05', start: '10:00', end: '12:00', attendees: 1 })
  })

  it('shows a server error above the form', () => {
    render(
      <BookingForm resource={lab} initialDate="2030-01-05" timeZone="Asia/Colombo" serverError="That time slot is already booked" onSubmit={vi.fn()} now={() => now} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('That time slot is already booked')
  })
})
