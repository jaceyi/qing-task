import { describe, expect, it } from 'vitest'
import { getScopeRange, taskOverlapsScope } from './date'

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
  })

  it('本周使用周一到周日', () => {
    const range = getScopeRange('week', reference)
    expect(range?.start).toEqual(new Date(2026, 6, 27))
    expect(range?.end).toEqual(new Date(2026, 7, 2))
  })

  it('全部看板不受时间限制', () => {
    expect(
      taskOverlapsScope({ startDate: '2020-01-01', endDate: '2020-01-02' }, 'all', reference),
    ).toBe(true)
  })
})
