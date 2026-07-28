import type { BoardScope, Task } from '../types'

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function toDateInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function toDateTimeInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function normalizeDateTimeInput(value: string, boundary: 'start' | 'end' = 'start') {
  if (value.includes('T')) return value.slice(0, 16)
  return `${value}T${boundary === 'start' ? '00:00' : '23:59'}`
}

export function parseLocalDate(value: string, boundary: 'start' | 'end' = 'start') {
  const normalized = normalizeDateTimeInput(value, boundary)
  const [datePart, timePart] = normalized.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export function getScopeRange(scope: BoardScope, reference = new Date()) {
  if (scope === 'all') return null

  const today = startOfLocalDay(reference)
  if (scope === 'today') return { start: today, end: new Date(addDays(today, 1).getTime() - 1) }

  const day = today.getDay() || 7
  const start = addDays(today, 1 - day)
  return { start, end: new Date(addDays(start, 7).getTime() - 1) }
}

export function taskOverlapsScope(
  task: Pick<Task, 'startDate' | 'endDate'>,
  scope: BoardScope,
  reference = new Date(),
) {
  const scopeRange = getScopeRange(scope, reference)
  if (!scopeRange) return true

  const taskStart = parseLocalDate(task.startDate, 'start')
  const taskEnd = parseLocalDate(task.endDate, 'end')
  return taskStart <= scopeRange.end && taskEnd >= scopeRange.start
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate, 'start')
  const end = parseLocalDate(endDate, 'end')
  const hasMinute = startDate.includes('T') || endDate.includes('T')
  const formatDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`
  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (!hasMinute) {
    if (startDate === endDate) return formatDay(start)
    return `${formatDay(start)} – ${formatDay(end)}`
  }

  if (toDateInput(start) === toDateInput(end)) {
    return `${formatDay(start)} ${formatTime(start)} – ${formatTime(end)}`
  }
  return `${formatDay(start)} ${formatTime(start)} – ${formatDay(end)} ${formatTime(end)}`
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
