import { describe, expect, it } from 'vitest'
import {
  formatDateRange,
  getScopeRange,
  normalizeDateTimeInput,
  taskOverlapsScope,
  validateTaskDateRange,
} from './date'

describe('任务时间看板规则', () => {
  const reference = new Date(2026, 6, 28, 14, 0, 0)

  it('今天看板按区间相交筛选，并包含边界日期', () => {
    expect(
      taskOverlapsScope({ startDate: '2026-07-20', endDate: '2026-07-28' }, 'today', reference),
    ).toBe(true)
    expect(
      taskOverlapsScope({ startDate: '2026-07-28', endDate: '2026-08-03' }, 'today', reference),
    ).toBe(true)
    expect(
      taskOverlapsScope({ startDate: '2026-07-20', endDate: '2026-07-27' }, 'today', reference),
    ).toBe(false)
    expect(
      taskOverlapsScope(
        { startDate: '2026-07-28T23:58', endDate: '2026-07-28T23:59' },
        'today',
        reference,
      ),
    ).toBe(true)
  })

  it('本周使用周一到周日', () => {
    const range = getScopeRange('week', reference)
    expect(range?.start).toEqual(new Date(2026, 6, 27))
    expect(range?.end).toEqual(new Date(2026, 7, 2, 23, 59, 59, 999))
  })

  it('全部看板不受时间限制', () => {
    expect(
      taskOverlapsScope({ startDate: '2020-01-01', endDate: '2020-01-02' }, 'all', reference),
    ).toBe(true)
  })

  it('无时间任务只出现在全部看板', () => {
    const task = { startDate: '', endDate: '' }
    expect(taskOverlapsScope(task, 'all', reference)).toBe(true)
    expect(taskOverlapsScope(task, 'today', reference)).toBe(false)
    expect(taskOverlapsScope(task, 'week', reference)).toBe(false)
    expect(formatDateRange('', '')).toBe('无时间')
    expect(normalizeDateTimeInput('')).toBe('')
  })

  it('时间可以全部留空或只填写一端，但结束不能早于开始', () => {
    expect(validateTaskDateRange('', '')).toBe('')
    expect(validateTaskDateRange('2026-07-28T09:00', '')).toBe('')
    expect(validateTaskDateRange('', '2026-07-28T10:00')).toBe('')
    expect(validateTaskDateRange('2026-07-28T11:00', '2026-07-28T10:00')).toBe(
      '结束日期不能早于开始日期',
    )
    expect(validateTaskDateRange('2026-07-28T09:00', '2026-07-28T10:00')).toBe('')
    expect(taskOverlapsScope({ startDate: '2026-07-28T09:00', endDate: '' }, 'today', reference)).toBe(true)
    expect(taskOverlapsScope({ startDate: '', endDate: '2026-07-28T10:00' }, 'today', reference)).toBe(true)
  })

  it('兼容旧日期数据，并展示分钟级时间范围', () => {
    expect(normalizeDateTimeInput('2026-07-28', 'start')).toBe('2026-07-28T00:00')
    expect(normalizeDateTimeInput('2026-07-28', 'end')).toBe('2026-07-28T23:59')
    expect(formatDateRange('2026-07-28T09:05', '2026-07-28T10:30')).toBe(
      '7/28 09:05 – 10:30',
    )
    expect(formatDateRange('2026-07-28T09:05', '2026-07-28T09:05')).toBe('7/28 09:05')
  })
})
