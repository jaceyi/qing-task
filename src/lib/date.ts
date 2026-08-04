import type { CustomDateRange, Task, TimeFilterScope } from '../types'

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
  if (!value) return ''
  if (value.includes('T')) return value.slice(0, 16)
  return `${value}T${boundary === 'start' ? '00:00' : '23:59'}`
}

export function formatDateTimeDisplay(value: string) {
  if (!value) return '未设置'
  const [date = '', time = ''] = value.split('T')
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return value
  return `${year}/${month}/${day}${time ? ` ${time.slice(0, 5)}` : ''}`
}

export function parseLocalDate(value: string, boundary: 'start' | 'end' = 'start') {
  if (!value) return null
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

export function getScopeRange(
  scope: TimeFilterScope,
  reference = new Date(),
  customRange?: CustomDateRange,
) {
  if (scope === 'all') return null

  if (scope === 'custom') {
    const start = parseLocalDate(customRange?.startDate ?? '', 'start')
    const end = parseLocalDate(customRange?.endDate ?? '', 'end')
    if (!start || !end || start > end) return undefined
    return { start, end }
  }

  const today = startOfLocalDay(reference)
  if (scope === 'today') return { start: today, end: new Date(addDays(today, 1).getTime() - 1) }

  const day = today.getDay() || 7
  const start = addDays(today, 1 - day)
  return { start, end: new Date(addDays(start, 7).getTime() - 1) }
}

export function taskOverlapsScope(
  task: Pick<Task, 'startDate' | 'endDate'>,
  scope: TimeFilterScope,
  reference = new Date(),
  customRange?: CustomDateRange,
) {
  const scopeRange = getScopeRange(scope, reference, customRange)
  if (scopeRange === null) return true
  if (!scopeRange) return false

  const taskStart = parseLocalDate(task.startDate, 'start')
  const taskEnd = parseLocalDate(task.endDate, 'end')
  if (!taskStart && !taskEnd) return false
  const effectiveStart = taskStart ?? taskEnd!
  const effectiveEnd = taskEnd ?? taskStart!
  return effectiveStart <= scopeRange.end && effectiveEnd >= scopeRange.start
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate, 'start')
  const end = parseLocalDate(endDate, 'end')
  if (!start && !end) return '无时间'

  const hasMinute = startDate.includes('T') || endDate.includes('T')
  const formatDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`
  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const formatPoint = (date: Date) =>
    hasMinute ? `${formatDay(date)} ${formatTime(date)}` : formatDay(date)

  if (!start && end) return `截至 ${formatPoint(end)}`
  if (start && !end) return `${formatPoint(start)} 起`
  if (!start || !end) return '无时间'

  if (normalizeDateTimeInput(startDate) === normalizeDateTimeInput(endDate)) {
    return formatPoint(start)
  }

  if (!hasMinute) {
    if (startDate === endDate) return formatDay(start)
    return `${formatDay(start)} – ${formatDay(end)}`
  }

  if (toDateInput(start) === toDateInput(end)) {
    return `${formatDay(start)} ${formatTime(start)} – ${formatTime(end)}`
  }
  return `${formatDay(start)} ${formatTime(start)} – ${formatDay(end)} ${formatTime(end)}`
}

export function validateTaskDateRange(startDate: string, endDate: string) {
  if (startDate && endDate && startDate > endDate) return '结束日期不能早于开始日期'
  return ''
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
