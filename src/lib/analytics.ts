import { addDays, parseLocalDate, startOfLocalDay } from './date'
import { completedOccurrenceTaskId, isTaskOverdue } from './taskLogic'
import type { CustomDateRange, OccurrenceRecord, Tag, Task, TaskLog } from '../types'

export type AnalyticsRangePreset = '7d' | '30d' | 'month' | 'custom'
export const MAX_CUSTOM_RANGE_DAYS = 92

const DAY = 24 * 60 * 60 * 1000

export interface AnalyticsWindow {
  start: Date
  end: Date
}

export interface AnalyticsRange extends AnalyticsWindow {
  preset: AnalyticsRangePreset
  /** 区间内每一天的本地零点（含首尾），用于按日聚合与绘图。 */
  days: Date[]
}

/** 完成日志附带任务归属：跨任务集合组查询后由父文档路径还原。 */
export interface AnalyticsLog extends TaskLog {
  taskId: string
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function listDays(start: Date, end: Date): Date[] {
  const days: Date[] = []
  for (let day = startOfLocalDay(start); day <= end; day = addDays(day, 1)) {
    days.push(day)
  }
  return days
}

export function getAnalyticsRange(
  preset: AnalyticsRangePreset,
  customRange?: CustomDateRange,
  reference = new Date(),
): AnalyticsRange | null {
  if (preset === 'custom') {
    const start = parseLocalDate(customRange?.startDate ?? '', 'start')
    const end = parseLocalDate(customRange?.endDate ?? '', 'end')
    if (!start || !end || start > end) return null
    const dayCount = Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / DAY) + 1
    if (dayCount > MAX_CUSTOM_RANGE_DAYS) return null
    return { preset, start: startOfLocalDay(start), end: endOfLocalDay(end), days: listDays(start, end) }
  }

  const today = startOfLocalDay(reference)
  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { preset, start, end: endOfLocalDay(end), days: listDays(start, end) }
  }

  const length = preset === '7d' ? 7 : 30
  const start = addDays(today, -(length - 1))
  return { preset, start, end: endOfLocalDay(today), days: listDays(start, today) }
}

/** 与给定区间等长、紧邻其前的上一区间，用于环比。 */
export function getPreviousRange(range: AnalyticsWindow): AnalyticsWindow {
  const lengthMs = range.end.getTime() - range.start.getTime() + 1
  return { start: new Date(range.start.getTime() - lengthMs), end: new Date(range.start.getTime() - 1) }
}

/** 重复任务一期是否按期完成：完成时刻不晚于本期计划结束。 */
export function occurrenceOnTime(record: OccurrenceRecord): boolean {
  if (!record.completedAt) return false
  const end = parseLocalDate(record.scheduledEnd, 'end')
  if (!end) return true
  return record.completedAt.getTime() <= end.getTime()
}

export interface CompletionEvent {
  key: string
  /** 产生事件的任务（重复任务为系列本体）。 */
  taskId: string
  /** 下钻打开的任务：完成实例存在时优先实例，否则回退系列/任务本体。 */
  openTaskId: string
  title: string
  tagIds: string[]
  completedAt: Date
  source: 'single' | 'progress' | 'occurrence'
  scheduledEnd?: string
  onTime?: boolean
}

/**
 * 汇总区间内的完成事件：
 * - 重复任务以 occurrences 账本为准（含准确的计划窗口与完成时刻）；
 * - 非重复任务回退日志流：普通任务取状态变更，进度任务取达到目标次数的那次推进。
 */
export function collectCompletionEvents(
  tasks: Task[],
  logs: AnalyticsLog[],
  occurrences: OccurrenceRecord[],
  window: AnalyticsWindow,
): CompletionEvent[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const inWindow = (date: Date | null) => Boolean(date && date >= window.start && date <= window.end)
  const events: CompletionEvent[] = []

  for (const record of occurrences) {
    if (record.result !== 'completed' || !inWindow(record.completedAt)) continue
    const instanceTaskId = completedOccurrenceTaskId(record.taskId, record.occurrenceKey)
    events.push({
      key: `occurrence:${record.taskId}:${record.occurrenceKey}`,
      taskId: record.taskId,
      openTaskId: taskById.has(instanceTaskId) ? instanceTaskId : record.taskId,
      title: record.title || '重复任务',
      tagIds: record.tagIds,
      completedAt: record.completedAt!,
      source: 'occurrence',
      scheduledEnd: record.scheduledEnd,
      onTime: occurrenceOnTime(record),
    })
  }

  for (const log of logs) {
    if (!inWindow(log.createdAt)) continue
    const task = taskById.get(log.taskId)
    // 重复任务由账本统计；完成实例自身没有日志，两者都跳过
    if (!task || task.recurrence || task.parentTaskId) continue
    const after = log.payload.after
    if (task.type === 'single' && log.type === 'status' && after === true) {
      events.push({
        key: `log:${log.id}`,
        taskId: task.id,
        openTaskId: task.id,
        title: task.title,
        tagIds: task.tagIds ?? [],
        completedAt: log.createdAt!,
        source: 'single',
      })
    } else if (task.type === 'progress' && log.type === 'progress' && task.targetCount > 0 && after === task.targetCount) {
      events.push({
        key: `log:${log.id}`,
        taskId: task.id,
        openTaskId: task.id,
        title: task.title,
        tagIds: task.tagIds ?? [],
        completedAt: log.createdAt!,
        source: 'progress',
      })
    }
  }

  return events.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
}

/** 按 range.days 对齐的每日完成数。 */
export function dailyCompletionCounts(events: CompletionEvent[], range: AnalyticsRange): number[] {
  const counts = new Array<number>(range.days.length).fill(0)
  const base = range.days[0]?.getTime() ?? 0
  for (const event of events) {
    const index = Math.round((startOfLocalDay(event.completedAt).getTime() - base) / DAY)
    if (index >= 0 && index < counts.length) counts[index] += 1
  }
  return counts
}

export interface OverviewStats {
  completed: number
  completedDelta: number | null
  created: number
  createdDelta: number | null
  occurrenceCompletions: number
  /** 重复完成中按期完成的比例；无重复完成时为 null。 */
  onTimeRate: number | null
  activeSeries: number
  overdueSeries: number
}

export function summarizeOverview(
  events: CompletionEvent[],
  previousEvents: CompletionEvent[] | null,
  tasks: Task[],
  window: AnalyticsWindow,
  previousWindow: AnalyticsWindow | null,
  reference = new Date(),
): OverviewStats {
  const createdIn = (target: AnalyticsWindow) =>
    tasks.filter((task) => !task.parentTaskId && task.createdAt && task.createdAt >= target.start && task.createdAt <= target.end).length

  const occurrenceEvents = events.filter((event) => event.source === 'occurrence')
  const onTime = occurrenceEvents.filter((event) => event.onTime).length
  const activeSeries = tasks.filter((task) => task.recurrence && task.seriesState === 'active')

  return {
    completed: events.length,
    completedDelta: previousEvents ? events.length - previousEvents.length : null,
    created: createdIn(window),
    createdDelta: previousWindow ? createdIn(window) - createdIn(previousWindow) : null,
    occurrenceCompletions: occurrenceEvents.length,
    onTimeRate: occurrenceEvents.length ? onTime / occurrenceEvents.length : null,
    activeSeries: activeSeries.length,
    overdueSeries: activeSeries.filter((task) => isTaskOverdue(task, reference)).length,
  }
}

export interface SeriesHealth {
  task: Task
  completed: number
  skipped: number
  onTimeRate: number | null
  /** 当前一期已过计划结束时间仍未完成/跳过。 */
  overduePending: boolean
}

export function buildSeriesHealth(
  tasks: Task[],
  occurrences: OccurrenceRecord[],
  window: AnalyticsWindow,
  reference = new Date(),
): SeriesHealth[] {
  return tasks
    .filter((task) => task.recurrence && !task.parentTaskId)
    .map((task) => {
      const records = occurrences.filter(
        (record) => record.taskId === task.id && record.completedAt && record.completedAt >= window.start && record.completedAt <= window.end,
      )
      const completedRecords = records.filter((record) => record.result === 'completed')
      const onTime = completedRecords.filter(occurrenceOnTime).length
      return {
        task,
        completed: completedRecords.length,
        skipped: records.filter((record) => record.result === 'skipped').length,
        onTimeRate: completedRecords.length ? onTime / completedRecords.length : null,
        overduePending: isTaskOverdue(task, reference),
      }
    })
    .sort(
      (a, b) =>
        Number(b.overduePending) - Number(a.overduePending)
        || (a.task.startDate || '').localeCompare(b.task.startDate || ''),
    )
}

export interface TagDistributionItem {
  /** null 表示未关联标签的完成事件。 */
  tag: Tag | null
  count: number
  /** 相对总完成事件数的占比（一个事件可计入多个标签）。 */
  share: number
}

export function buildTagDistribution(events: CompletionEvent[], tags: Tag[]): TagDistributionItem[] {
  const counts = new Map<string, number>()
  let untagged = 0
  for (const event of events) {
    if (!event.tagIds.length) {
      untagged += 1
      continue
    }
    for (const tagId of new Set(event.tagIds)) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }

  const total = events.length || 1
  const items: TagDistributionItem[] = tags
    .map((tag) => ({ tag, count: counts.get(tag.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((item) => ({ tag: item.tag, count: item.count, share: item.count / total }))
  if (untagged > 0) items.push({ tag: null, count: untagged, share: untagged / total })
  return items
}

/** 分析页标签筛选采用“任一匹配”：选中任一标签即纳入统计。 */
export function matchesTagFilter(tagIds: string[] | undefined, selectedTagIds: string[]): boolean {
  if (!selectedTagIds.length) return true
  return (tagIds ?? []).some((tagId) => selectedTagIds.includes(tagId))
}
