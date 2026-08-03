import type { RecurrenceRule, Task, Weekday } from '../types'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function toLocalDateTime(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export function parseLocalDateTime(value: string) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function weekdayFor(value: Date): Weekday {
  const day = value.getDay()
  return (day === 0 ? 7 : day) as Weekday
}

export function durationMinutes(startDate: string, endDate: string) {
  const start = parseLocalDateTime(startDate)
  const end = parseLocalDateTime(endDate)
  if (!start || !end) return 0
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MINUTE))
}

export function occurrenceKey(startDate: string) {
  return startDate.replace(/[^0-9]/g, '')
}

function startOfWeek(value: Date) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - (weekdayFor(result) - 1))
  return result
}

function sameLocalParts(candidate: Date, year: number, month: number, day: number) {
  return candidate.getFullYear() === year && candidate.getMonth() === month && candidate.getDate() === day
}

function afterThreshold(rule: RecurrenceRule, threshold: Date) {
  const anchor = parseLocalDateTime(rule.anchorStart)
  if (!anchor) return null
  const interval = Math.max(1, Math.min(999, Math.round(rule.interval || 1)))
  const hour = anchor.getHours()
  const minute = anchor.getMinutes()

  if (rule.frequency === 'hourly') {
    const step = interval * 60 * MINUTE
    const elapsed = Math.floor((threshold.getTime() - anchor.getTime()) / step) + 1
    return new Date(anchor.getTime() + Math.max(1, elapsed) * step)
  }

  if (rule.frequency === 'daily') {
    const candidate = new Date(anchor)
    do candidate.setDate(candidate.getDate() + interval)
    while (candidate <= threshold)
    return candidate
  }

  if (rule.frequency === 'weekly') {
    const weekdays = rule.byWeekdays?.length ? [...new Set(rule.byWeekdays)].sort() : [weekdayFor(anchor)]
    const anchorWeek = startOfWeek(anchor)
    const candidate = new Date(threshold)
    candidate.setSeconds(0, 0)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate <= threshold) candidate.setDate(candidate.getDate() + 1)
    for (let guard = 0; guard < 3700; guard += 1) {
      const weeks = Math.floor((startOfWeek(candidate).getTime() - anchorWeek.getTime()) / (7 * DAY))
      if (weeks >= 0 && weeks % interval === 0 && weekdays.includes(weekdayFor(candidate))) return candidate
      candidate.setDate(candidate.getDate() + 1)
    }
    return null
  }

  if (rule.frequency === 'monthly') {
    const day = Math.max(1, Math.min(31, rule.byMonthDay ?? anchor.getDate()))
    for (let step = interval; step < interval * 1200; step += interval) {
      const monthIndex = anchor.getMonth() + step
      const year = anchor.getFullYear() + Math.floor(monthIndex / 12)
      const month = ((monthIndex % 12) + 12) % 12
      const candidate = new Date(year, month, day, hour, minute, 0, 0)
      if (!sameLocalParts(candidate, year, month, day)) continue
      if (candidate > threshold) return candidate
    }
    return null
  }

  const month = anchor.getMonth()
  const day = anchor.getDate()
  for (let step = interval; step < interval * 1000; step += interval) {
    const year = anchor.getFullYear() + step
    const candidate = new Date(year, month, day, hour, minute, 0, 0)
    if (!sameLocalParts(candidate, year, month, day)) continue
    if (candidate > threshold) return candidate
  }
  return null
}

function withinEnd(rule: RecurrenceRule, value: Date) {
  if (rule.end.kind === 'never') return true
  return toLocalDateTime(value).slice(0, 10) <= rule.end.date
}

export function nextOccurrence(
  task: Pick<Task, 'startDate' | 'endDate' | 'recurrence'>,
  completedAt = new Date(),
) {
  const rule = task.recurrence
  const currentStart = parseLocalDateTime(task.startDate)
  if (!rule || !currentStart) return null
  const threshold = new Date(Math.max(currentStart.getTime(), completedAt.getTime()))
  const nextStart = afterThreshold(rule, threshold)
  if (!nextStart || !withinEnd(rule, nextStart)) return null
  const minutes = Math.max(1, rule.durationMinutes || durationMinutes(task.startDate, task.endDate))
  const nextEnd = new Date(nextStart.getTime() + minutes * MINUTE)
  return { startDate: toLocalDateTime(nextStart), endDate: toLocalDateTime(nextEnd) }
}

export function previewRecurrence(rule: RecurrenceRule, count = 3) {
  const result: Array<{ startDate: string; endDate: string }> = []
  let currentStart = rule.anchorStart
  let currentEnd = toLocalDateTime(
    new Date((parseLocalDateTime(currentStart)?.getTime() ?? 0) + rule.durationMinutes * MINUTE),
  )
  for (let index = 0; index < count; index += 1) {
    const next = nextOccurrence(
      { startDate: currentStart, endDate: currentEnd, recurrence: rule },
      parseLocalDateTime(currentStart) ?? new Date(),
    )
    if (!next) break
    result.push(next)
    currentStart = next.startDate
    currentEnd = next.endDate
  }
  return result
}

const weekdayLabels: Record<Weekday, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日',
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined) {
  if (!rule) return '不重复'
  const interval = Math.max(1, rule.interval)
  let summary = ''
  if (rule.frequency === 'hourly') summary = interval === 1 ? '每小时' : `每 ${interval} 小时`
  if (rule.frequency === 'daily') summary = interval === 1 ? '每天' : `每 ${interval} 天`
  if (rule.frequency === 'weekly') {
    const days = (rule.byWeekdays ?? []).map((day) => weekdayLabels[day]).join('、')
    summary = `${interval === 1 ? '每周' : `每 ${interval} 周`}${days ? `的${days}` : ''}`
  }
  if (rule.frequency === 'monthly') {
    const day = rule.byMonthDay ?? parseLocalDateTime(rule.anchorStart)?.getDate()
    summary = `${interval === 1 ? '每月' : `每 ${interval} 个月`}${day ? `${day} 日` : ''}`
  }
  if (rule.frequency === 'yearly') summary = interval === 1 ? '每年' : `每 ${interval} 年`
  return `${summary} · ${rule.end.kind === 'never' ? '永不结束' : `至 ${rule.end.date}`}`
}

export function createRecurrenceRule(
  startDate: string,
  endDate: string,
  frequency: RecurrenceRule['frequency'] = 'daily',
): RecurrenceRule {
  const start = parseLocalDateTime(startDate) ?? new Date()
  return {
    frequency,
    interval: 1,
    ...(frequency === 'weekly' ? { byWeekdays: [weekdayFor(start)] } : {}),
    ...(frequency === 'monthly' ? { byMonthDay: start.getDate() } : {}),
    end: { kind: 'never' },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
    anchorStart: startDate,
    durationMinutes: durationMinutes(startDate, endDate),
  }
}

export function syncRecurrenceTiming(
  rule: RecurrenceRule | null | undefined,
  startDate: string,
  endDate: string,
) {
  if (!rule) return null
  const start = parseLocalDateTime(startDate)
  return {
    ...rule,
    anchorStart: startDate,
    durationMinutes: durationMinutes(startDate, endDate),
    ...(rule.frequency === 'weekly' && !rule.byWeekdays?.length && start
      ? { byWeekdays: [weekdayFor(start)] }
      : {}),
    ...(rule.frequency === 'monthly' && start ? { byMonthDay: rule.byMonthDay ?? start.getDate() } : {}),
  }
}
