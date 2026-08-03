import { describe, expect, it } from 'vitest'
import {
  createRecurrenceRule,
  describeRecurrence,
  nextOccurrence,
  previewRecurrence,
} from './recurrence'
import type { Weekday } from '../types'

describe('recurrence', () => {
  it('advances a daily task after the completion time and skips missed dates', () => {
    const recurrence = createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:30', 'daily')
    expect(nextOccurrence(
      { startDate: '2026-08-03T09:00', endDate: '2026-08-03T09:30', recurrence },
      new Date('2026-08-05T11:00:00'),
    )).toEqual({ startDate: '2026-08-06T09:00', endDate: '2026-08-06T09:30' })
  })

  it('supports multiple weekdays', () => {
    const recurrence = {
      ...createRecurrenceRule('2026-08-03T18:00', '2026-08-03T19:00', 'weekly'),
      byWeekdays: [1, 3] as Weekday[],
    }
    expect(nextOccurrence(
      { startDate: '2026-08-03T18:00', endDate: '2026-08-03T19:00', recurrence },
      new Date('2026-08-03T19:00:00'),
    )?.startDate).toBe('2026-08-05T18:00')
  })

  it('skips months that do not contain the selected day', () => {
    const recurrence = createRecurrenceRule('2026-01-31T09:00', '2026-01-31T10:00', 'monthly')
    expect(nextOccurrence(
      { startDate: '2026-01-31T09:00', endDate: '2026-01-31T10:00', recurrence },
      new Date('2026-01-31T10:00:00'),
    )?.startDate).toBe('2026-03-31T09:00')
  })

  it('respects an inclusive end date', () => {
    const base = createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:30', 'daily')
    const recurrence = { ...base, end: { kind: 'until' as const, date: '2026-08-04' } }
    expect(previewRecurrence(recurrence)).toEqual([
      { startDate: '2026-08-04T09:00', endDate: '2026-08-04T09:30' },
    ])
  })

  it('creates a concise natural-language summary', () => {
    const recurrence = {
      ...createRecurrenceRule('2026-08-03T09:00', '2026-08-03T10:00', 'weekly'),
      interval: 2,
      byWeekdays: [1, 3] as Weekday[],
    }
    expect(describeRecurrence(recurrence)).toBe('每 2 周的周一、周三 · 永不结束')
  })
})
