import { describe, expect, it } from 'vitest'
import {
  buildSeriesHealth,
  buildTagDistribution,
  collectCompletionEvents,
  dailyCompletionCounts,
  getAnalyticsRange,
  getPreviousRange,
  matchesTagFilter,
  occurrenceOnTime,
  summarizeOverview,
  MAX_CUSTOM_RANGE_DAYS,
  type AnalyticsLog,
} from './analytics'
import type { OccurrenceRecord, Tag, Task } from '../types'

/** 固定参考时刻：2026-08-12 15:30（周三），保证用例不随运行时间漂移。 */
const reference = new Date(2026, 7, 12, 15, 30)

function makeTask(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: partial.id,
    description: '',
    startDate: '',
    endDate: '',
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    createdAt: reference,
    updatedAt: reference,
    ...partial,
  }
}

function makeLog(partial: Partial<AnalyticsLog> & Pick<AnalyticsLog, 'id' | 'taskId'>): AnalyticsLog {
  return {
    type: 'status',
    action: '测试日志',
    payload: {},
    createdAt: reference,
    ...partial,
  }
}

function makeOccurrence(partial: Partial<OccurrenceRecord> & Pick<OccurrenceRecord, 'taskId' | 'occurrenceKey'>): OccurrenceRecord {
  return {
    result: 'completed',
    scheduledStart: '2026-08-11T09:00',
    scheduledEnd: '2026-08-11T10:00',
    count: 0,
    targetCount: 0,
    title: '重复任务',
    tagIds: [],
    completedAt: reference,
    ...partial,
  }
}

const recurrenceRule = {
  frequency: 'daily' as const,
  interval: 1,
  end: { kind: 'never' as const },
  timeZone: 'Asia/Shanghai',
  anchorStart: '2026-08-12T19:00',
  durationMinutes: 30,
}

describe('分析时间范围', () => {
  it('近 7 天覆盖含今天的 7 个自然日', () => {
    const range = getAnalyticsRange('7d', undefined, reference)!
    expect(range.start).toEqual(new Date(2026, 7, 6))
    expect(range.end.getTime()).toBe(new Date(2026, 7, 12, 23, 59, 59, 999).getTime())
    expect(range.days).toHaveLength(7)
    expect(range.days[0]).toEqual(new Date(2026, 7, 6))
  })

  it('近 30 天与本月分别生成 30 天与整月区间', () => {
    expect(getAnalyticsRange('30d', undefined, reference)!.days).toHaveLength(30)
    const month = getAnalyticsRange('month', undefined, reference)!
    expect(month.start).toEqual(new Date(2026, 7, 1))
    expect(month.days).toHaveLength(31)
  })

  it('自定义范围校验起止与最大天数', () => {
    const valid = getAnalyticsRange('custom', { startDate: '2026-08-01', endDate: '2026-08-20' }, reference)
    expect(valid?.days).toHaveLength(20)
    expect(getAnalyticsRange('custom', { startDate: '2026-08-20', endDate: '2026-08-01' }, reference)).toBeNull()
    expect(getAnalyticsRange('custom', { startDate: '', endDate: '2026-08-01' }, reference)).toBeNull()
    // 超过上限的区间返回 null，由页面提示
    expect(MAX_CUSTOM_RANGE_DAYS).toBe(92)
    expect(getAnalyticsRange('custom', { startDate: '2026-01-01', endDate: '2026-08-12' }, reference)).toBeNull()
  })

  it('上一区间与当前区间等长且紧邻', () => {
    const range = getAnalyticsRange('7d', undefined, reference)!
    const previous = getPreviousRange(range)
    expect(previous.end.getTime()).toBe(range.start.getTime() - 1)
    expect(previous.end.getTime() - previous.start.getTime()).toBe(range.end.getTime() - range.start.getTime())
    expect(previous.start).toEqual(new Date(2026, 6, 30))
  })
})

describe('完成事件汇总', () => {
  const singleTask = makeTask({ id: 's1', createdAt: new Date(2026, 7, 10) })
  const progressTask = makeTask({ id: 'p1', type: 'progress', targetCount: 3, count: 3 })
  const recurringTask = makeTask({
    id: 'r1',
    recurrence: recurrenceRule,
    seriesState: 'active',
    startDate: '2026-08-12T19:00',
    endDate: '2026-08-12T19:30',
    currentOccurrenceKey: '20260812T1900',
    occurrenceSequence: 9,
  })
  const instanceTask = makeTask({ id: 'completed-r1-k1', parentTaskId: 'r1', occurrenceKey: 'k1', completed: true })
  const tasks = [singleTask, progressTask, recurringTask, instanceTask]

  const logs: AnalyticsLog[] = [
    makeLog({ id: 'l1', taskId: 's1', payload: { before: false, after: true }, createdAt: new Date(2026, 7, 10, 11, 20) }),
    makeLog({ id: 'l2', taskId: 'p1', type: 'progress', payload: { before: 2, after: 3, delta: 1 }, createdAt: new Date(2026, 7, 8, 20) }),
    // 未达目标的推进与取消完成不构成完成事件
    makeLog({ id: 'l3', taskId: 'p1', type: 'progress', payload: { before: 1, after: 2, delta: 1 }, createdAt: new Date(2026, 7, 8, 19) }),
    makeLog({ id: 'l4', taskId: 's1', payload: { before: true, after: false }, createdAt: new Date(2026, 7, 9) }),
    // 重复任务的日志由账本替代，不应重复计数
    makeLog({ id: 'l5', taskId: 'r1', payload: { before: false, after: true }, createdAt: new Date(2026, 7, 11) }),
  ]

  const occurrences: OccurrenceRecord[] = [
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k1', completedAt: new Date(2026, 7, 11, 9, 30), scheduledStart: '2026-08-11T09:00', scheduledEnd: '2026-08-11T10:00' }),
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k2', completedAt: new Date(2026, 7, 9, 23, 0), scheduledStart: '2026-08-09T09:00', scheduledEnd: '2026-08-09T10:00' }),
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k3', result: 'skipped', completedAt: new Date(2026, 7, 10) }),
    // 窗口之外的完成不计入
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k0', completedAt: new Date(2026, 7, 1, 9) }),
  ]

  const range = getAnalyticsRange('7d', undefined, reference)!
  const events = collectCompletionEvents(tasks, logs, occurrences, range)

  it('合并账本与日志的完成事件并按时间排序', () => {
    expect(events.map((event) => event.key)).toEqual([
      'log:l2',
      'occurrence:r1:k2',
      'log:l1',
      'occurrence:r1:k1',
    ])
    expect(events.map((event) => event.source)).toEqual(['progress', 'occurrence', 'single', 'occurrence'])
  })

  it('完成实例存在时下钻优先打开实例任务', () => {
    const withInstance = events.find((event) => event.key === 'occurrence:r1:k1')!
    expect(withInstance.openTaskId).toBe('completed-r1-k1')
    const withoutInstance = events.find((event) => event.key === 'occurrence:r1:k2')!
    expect(withoutInstance.openTaskId).toBe('r1')
  })

  it('标记是否按期完成', () => {
    expect(events.find((event) => event.key === 'occurrence:r1:k1')!.onTime).toBe(true)
    expect(events.find((event) => event.key === 'occurrence:r1:k2')!.onTime).toBe(false)
  })

  it('按天对齐完成数', () => {
    expect(dailyCompletionCounts(events, range)).toEqual([0, 0, 1, 1, 1, 1, 0])
  })
})

describe('概览与系列健康度', () => {
  const range = getAnalyticsRange('7d', undefined, reference)!
  const previous = getPreviousRange(range)
  const tasks = [
    makeTask({ id: 'new-in-window', createdAt: new Date(2026, 7, 10) }),
    makeTask({ id: 'old', createdAt: new Date(2026, 6, 20) }),
    makeTask({ id: 'completed-instance', parentTaskId: 'r1', occurrenceKey: 'k1', createdAt: new Date(2026, 6, 25) }),
    makeTask({
      id: 'r1',
      recurrence: recurrenceRule,
      seriesState: 'active',
      startDate: '2026-08-12T19:00',
      endDate: '2026-08-12T19:30',
      createdAt: new Date(2026, 6, 25),
    }),
    makeTask({
      id: 'r2',
      recurrence: { ...recurrenceRule, anchorStart: '2026-08-10T09:00' },
      seriesState: 'active',
      startDate: '2026-08-10T09:00',
      endDate: '2026-08-10T09:30',
      tagIds: ['tag-work'],
      createdAt: new Date(2026, 6, 25),
    }),
  ]
  const occurrences: OccurrenceRecord[] = [
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k1', completedAt: new Date(2026, 7, 11, 9, 30) }),
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k2', completedAt: new Date(2026, 7, 9, 23, 0), scheduledStart: '2026-08-09T09:00', scheduledEnd: '2026-08-09T10:00' }),
    makeOccurrence({ taskId: 'r1', occurrenceKey: 'k3', result: 'skipped', completedAt: new Date(2026, 7, 10) }),
  ]
  const events = collectCompletionEvents(tasks, [], occurrences, range)

  it('概览统计完成、新建、准时率与逾期系列', () => {
    const overview = summarizeOverview(events, [events[0]], tasks, range, previous, reference)
    expect(overview.completed).toBe(2)
    expect(overview.completedDelta).toBe(1)
    expect(overview.created).toBe(1)
    expect(overview.createdDelta).toBe(1)
    expect(overview.occurrenceCompletions).toBe(2)
    expect(overview.onTimeRate).toBe(0.5)
    expect(overview.activeSeries).toBe(2)
    expect(overview.overdueSeries).toBe(1)
  })

  it('未提供上一区间时环比为 null', () => {
    const overview = summarizeOverview(events, null, tasks, range, null, reference)
    expect(overview.completedDelta).toBeNull()
    expect(overview.createdDelta).toBeNull()
  })

  it('系列健康度统计完成/跳过/准时率，逾期的系列排在前面', () => {
    const health = buildSeriesHealth(tasks, occurrences, range, reference)
    expect(health.map((item) => item.task.id)).toEqual(['r2', 'r1'])
    const r1 = health.find((item) => item.task.id === 'r1')!
    expect(r1.completed).toBe(2)
    expect(r1.skipped).toBe(1)
    expect(r1.onTimeRate).toBe(0.5)
    expect(r1.overduePending).toBe(false)
    const r2 = health.find((item) => item.task.id === 'r2')!
    expect(r2.overduePending).toBe(true)
    expect(r2.onTimeRate).toBeNull()
  })
})

describe('标签分布与筛选', () => {
  const tagA: Tag = { id: 'tag-a', name: '工作', normalizedName: '工作', color: 'lavender', sortOrder: 1, createdAt: null, updatedAt: null }
  const tagB: Tag = { id: 'tag-b', name: '健康', normalizedName: '健康', color: 'mint', sortOrder: 2, createdAt: null, updatedAt: null }

  it('按完成事件统计标签占比，未关联标签单独成组', () => {
    const events = [
      { key: '1', taskId: 't1', openTaskId: 't1', title: '', tagIds: ['tag-a'], completedAt: reference, source: 'single' as const },
      { key: '2', taskId: 't2', openTaskId: 't2', title: '', tagIds: ['tag-a', 'tag-b'], completedAt: reference, source: 'single' as const },
      { key: '3', taskId: 't3', openTaskId: 't3', title: '', tagIds: [], completedAt: reference, source: 'single' as const },
    ]
    const distribution = buildTagDistribution(events, [tagA, tagB])
    expect(distribution.map((item) => item.tag?.id ?? 'untagged')).toEqual(['tag-a', 'tag-b', 'untagged'])
    expect(distribution[0].count).toBe(2)
    expect(distribution[0].share).toBeCloseTo(2 / 3)
    expect(distribution[2].count).toBe(1)
  })

  it('标签筛选为任一匹配，未选择时全部通过', () => {
    expect(matchesTagFilter(undefined, [])).toBe(true)
    expect(matchesTagFilter(['tag-a'], ['tag-a', 'tag-b'])).toBe(true)
    expect(matchesTagFilter(['tag-c'], ['tag-a'])).toBe(false)
    expect(matchesTagFilter(undefined, ['tag-a'])).toBe(false)
  })
})

describe('周期账本准时判断', () => {
  it('完成时刻不晚于计划结束视为按期', () => {
    const onTime = makeOccurrence({ taskId: 'r1', occurrenceKey: 'a', completedAt: new Date(2026, 7, 11, 10, 0) })
    const late = makeOccurrence({ taskId: 'r1', occurrenceKey: 'b', completedAt: new Date(2026, 7, 11, 10, 1) })
    expect(occurrenceOnTime(onTime)).toBe(true)
    expect(occurrenceOnTime(late)).toBe(false)
  })
})
