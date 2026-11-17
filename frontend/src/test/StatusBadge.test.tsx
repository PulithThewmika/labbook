import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from '../components/StatusBadge'

describe('StatusBadge', () => {
  const cases: [string, string, string][] = [
    ['pending', 'Pending', 'bg-amber-100'],
    ['approved', 'Approved', 'bg-emerald-100'],
    ['rejected', 'Rejected', 'bg-rose-100'],
    ['cancelled', 'Cancelled', 'bg-slate-100'],
    ['completed', 'Completed', 'bg-indigo-100'],
    ['expired', 'Expired', 'bg-slate-100'],
  ]
  it.each(cases)('%s shows label %s with colour %s', (status, label, colour) => {
    render(<StatusBadge status={status} />)
    const el = screen.getByText(label)
    expect(el).toHaveAttribute('data-status', status)
    expect(el.className).toContain(colour)
  })
})
