import type { BoardScope, Task } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function toDateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function getScopeRange(scope: BoardScope, reference = new Date()) {
  if (scope === 'all') return null

  const today = startOfLocalDay(reference)
  if (scope === 'today') return { start: today, end: today }

  const day = today.getDay() || 7
  const start = addDays(today, 1 - day)
  return { start, end: addDays(start, 6) }
}

export function taskOverlapsScope(
  task: Pick<Task, 'startDate' | 'endDate'>,
  scope: BoardScope,
  reference = new Date(),
) {
  const scopeRange = getScopeRange(scope, reference)
  if (!scopeRange) return true

  const taskStart = parseLocalDate(task.startDate)
  const taskEnd = parseLocalDate(task.endDate)
  return taskStart <= scopeRange.end && taskEnd >= scopeRange.start
}

export function formatDateRange(startDate: string, endDate: string) {
  const format = (value: string) => {
    const date = parseLocalDate(value)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  if (startDate === endDate) return format(startDate)
  return `${format(startDate)} – ${format(endDate)}`
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export function formatLogDate(date: Date | null) {
  if (!date) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
