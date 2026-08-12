import { describe, expect, it } from 'vitest'
import {
  createRecurrenceRule,
  describeRecurrence,
  nextOccurrence,
  previewRecurrence,
  syncRecurrenceTiming,
} from './recurrence'
import type { Weekday } from '../types'

describe('recurrence', () => {
  it('完成后取严格晚于本期开始的第一个计划点', () => {
    const recurrence = createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:30', 'daily')
    expect(nextOccurrence(
      { startDate: '2026-08-03T09:00', endDate: '2026-08-03T09:30', recurrence },
    )).toEqual({ startDate: '2026-08-04T09:00', endDate: '2026-08-04T09:30' })
  })

  it('逾期完成逐期顺延，不跳过已错过的期', () => {
    // 每天任务：本期 8/10，12 号才完成 → 下一期仍是 8/11
    const recurrence = createRecurrenceRule('2026-08-10T09:00', '2026-08-10T09:30', 'daily')
    expect(nextOccurrence(
      { startDate: '2026-08-10T09:00', endDate: '2026-08-10T09:30', recurrence },
    )).toEqual({ startDate: '2026-08-11T09:00', endDate: '2026-08-11T09:30' })
  })

  it('提前完成仍取下一个计划点，不从完成时刻重新计时', () => {
    // 周三任务周一提前完成 → 下一个周三
    const recurrence = {
      ...createRecurrenceRule('2026-08-05T18:00', '2026-08-05T19:00', 'weekly'),
      byWeekdays: [3] as Weekday[],
    }
    expect(nextOccurrence(
      { startDate: '2026-08-05T18:00', endDate: '2026-08-05T19:00', recurrence },
    )?.startDate).toBe('2026-08-12T18:00')
  })

  it('supports multiple weekdays', () => {
    const recurrence = {
      ...createRecurrenceRule('2026-08-03T18:00', '2026-08-03T19:00', 'weekly'),
      byWeekdays: [1, 3] as Weekday[],
    }
    expect(nextOccurrence(
      { startDate: '2026-08-03T18:00', endDate: '2026-08-03T19:00', recurrence },
    )?.startDate).toBe('2026-08-05T18:00')
  })

  it('skips months that do not contain the selected day', () => {
    const recurrence = createRecurrenceRule('2026-01-31T09:00', '2026-01-31T10:00', 'monthly')
    expect(nextOccurrence(
      { startDate: '2026-01-31T09:00', endDate: '2026-01-31T10:00', recurrence },
    )?.startDate).toBe('2026-03-31T09:00')
  })

  it('respects an inclusive end date', () => {
    const base = createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:30', 'daily')
    const recurrence = { ...base, end: { kind: 'until' as const, date: '2026-08-04' } }
    expect(previewRecurrence(recurrence, 3, new Date('2026-08-03T10:00:00'))).toEqual([
      { startDate: '2026-08-04T09:00', endDate: '2026-08-04T09:30' },
    ])
    // 参考时刻已过截止日期：没有后续计划
    expect(previewRecurrence(recurrence, 3, new Date('2026-08-05T10:00:00'))).toEqual([])
  })

  it('预览从参考时刻向后取未来的期，不包含已逾期的历史期', () => {
    // 每天任务锚点 8/10，8/12 查看（编辑器传明天零点）→ 后续三次是 8/13、8/14、8/15
    const recurrence = createRecurrenceRule('2026-08-10T19:00', '2026-08-10T19:30', 'daily')
    expect(previewRecurrence(recurrence, 3, new Date('2026-08-13T00:00:00'))).toEqual([
      { startDate: '2026-08-13T19:00', endDate: '2026-08-13T19:30' },
      { startDate: '2026-08-14T19:00', endDate: '2026-08-14T19:30' },
      { startDate: '2026-08-15T19:00', endDate: '2026-08-15T19:30' },
    ])
    // 新建任务：锚点在未来时，预览包含首期本身
    expect(previewRecurrence(recurrence, 2, new Date('2026-08-08T09:00:00')).map((item) => item.startDate)).toEqual([
      '2026-08-10T19:00',
      '2026-08-11T19:00',
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

  it('supports an explicit month and day for yearly schedules', () => {
    const recurrence = {
      ...createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:00', 'yearly'),
      interval: 2,
      byMonth: 12,
      byMonthDay: 18,
    }
    expect(nextOccurrence(
      { startDate: '2026-08-03T09:00', endDate: '2026-08-03T09:00', recurrence },
    )).toEqual({ startDate: '2028-12-18T09:00', endDate: '2028-12-18T09:00' })
    expect(describeRecurrence(recurrence)).toBe('每 2 年的 12 月 18 日 · 永不结束')
  })

  it('removes undefined frequency fields before persisting', () => {
    const recurrence = {
      ...createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:00', 'daily'),
      byWeekdays: undefined,
      byMonth: undefined,
      byMonthDay: undefined,
    }
    expect(syncRecurrenceTiming(recurrence, recurrence.anchorStart, recurrence.anchorStart)).toEqual(
      expect.not.objectContaining({ byWeekdays: undefined, byMonth: undefined, byMonthDay: undefined }),
    )
    expect(Object.values(syncRecurrenceTiming(recurrence, recurrence.anchorStart, recurrence.anchorStart)!)).not.toContain(undefined)
  })
})
