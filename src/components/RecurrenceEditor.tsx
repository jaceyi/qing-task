import { useMemo } from 'react'
import dayjs from 'dayjs'
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import RepeatOutlined from '@mui/icons-material/RepeatOutlined'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { addDays, formatDateRange, startOfLocalDay } from '../lib/date'
import {
  createRecurrenceRule,
  describeRecurrence,
  parseLocalDateTime,
  previewRecurrence,
  toLocalDateTime,
  weekdayFor,
} from '../lib/recurrence'
import type { RecurrenceFrequency, RecurrenceRule, Weekday } from '../types'
import { FieldLabel } from './FieldLabel'

interface RecurrenceEditorProps {
  value: RecurrenceRule | null | undefined
  startDate: string
  endDate: string
  onChange: (value: RecurrenceRule | null) => void
  onTimingChange: (startDate: string, endDate: string) => void
}

const weekdayOptions: Array<{ value: Weekday; label: string }> = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
]

const frequencyOptions: Array<{ value: Exclude<RecurrenceFrequency, 'hourly'>; label: string }> = [
  { value: 'daily', label: '天' },
  { value: 'weekly', label: '周' },
  { value: 'monthly', label: '月' },
  { value: 'yearly', label: '年' },
]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function nextDefaultStart() {
  const value = new Date()
  value.setSeconds(0, 0)
  value.setMinutes(0)
  value.setHours(value.getHours() + 1)
  return value
}

function validCalendarDate(year: number, month: number, day: number, hour: number, minute: number) {
  const value = new Date(year, month - 1, day, hour, minute, 0, 0)
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day
    ? value
    : null
}

function alignStart(rule: RecurrenceRule, base: Date, time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const safeHour = Number.isInteger(hour) ? Math.max(0, Math.min(23, hour)) : 9
  const safeMinute = Number.isInteger(minute) ? Math.max(0, Math.min(59, minute)) : 0

  if (rule.frequency === 'daily' || rule.frequency === 'hourly') {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), safeHour, safeMinute, 0, 0)
  }

  if (rule.frequency === 'weekly') {
    const weekdays = rule.byWeekdays?.length ? rule.byWeekdays : [weekdayFor(base)]
    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, safeHour, safeMinute, 0, 0)
      if (weekdays.includes(weekdayFor(candidate))) return candidate
    }
  }

  if (rule.frequency === 'monthly') {
    const day = Math.max(1, Math.min(31, rule.byMonthDay ?? base.getDate()))
    for (let offset = 0; offset < 24; offset += 1) {
      const monthIndex = base.getMonth() + offset
      const year = base.getFullYear() + Math.floor(monthIndex / 12)
      const month = ((monthIndex % 12) + 12) % 12 + 1
      const candidate = validCalendarDate(year, month, day, safeHour, safeMinute)
      if (candidate && (offset > 0 || day >= base.getDate())) return candidate
    }
  }

  const month = Math.max(1, Math.min(12, rule.byMonth ?? base.getMonth() + 1))
  const day = Math.max(1, Math.min(31, rule.byMonthDay ?? base.getDate()))
  for (let offset = 0; offset < 12; offset += 1) {
    const candidate = validCalendarDate(base.getFullYear() + offset, month, day, safeHour, safeMinute)
    if (candidate && (
      offset > 0
      || month > base.getMonth() + 1
      || (month === base.getMonth() + 1 && day >= base.getDate())
    )) return candidate
  }
  return base
}

function timeFrom(value: string) {
  const parsed = parseLocalDateTime(value)
  return parsed ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : '09:00'
}

function formatPreviewDate(startDate: string, endDate: string, includeYear: boolean) {
  const display = formatDateRange(startDate, endDate)
  if (!includeYear) return display
  const start = parseLocalDateTime(startDate)
  return start ? `${start.getFullYear()}年 ${display}` : display
}

function withoutUndefined(rule: RecurrenceRule) {
  return Object.fromEntries(Object.entries(rule).filter(([, item]) => item !== undefined)) as unknown as RecurrenceRule
}

export function RecurrenceEditor({
  value,
  startDate,
  endDate,
  onChange,
  onTimingChange,
}: RecurrenceEditorProps) {
  const rule = value ?? null
  const time = timeFrom(startDate || endDate)
  // “后续三次”按自然日理解：从明天零点起取未来的期，今天已不属于“后续”
  const previews = useMemo(() => {
    if (!rule) return []
    return previewRecurrence(rule, 3, startOfLocalDay(addDays(new Date(), 1)))
  }, [rule])

  const commitRule = (nextRule: RecurrenceRule, nextTime = time, baseOverride?: Date) => {
    const base = baseOverride
      ?? parseLocalDateTime(startDate)
      ?? parseLocalDateTime(endDate)
      ?? nextDefaultStart()
    const nextStart = alignStart(nextRule, base, nextTime)
    const duration = Math.max(0, rule?.durationMinutes ?? 0)
    const nextEnd = new Date(nextStart.getTime() + duration * 60_000)
    const normalized = withoutUndefined({
      ...nextRule,
      anchorStart: toLocalDateTime(nextStart),
      durationMinutes: duration,
      ...(nextRule.end.kind === 'until' && nextRule.end.date < toLocalDateTime(nextStart).slice(0, 10)
        ? { end: { kind: 'until' as const, date: toLocalDateTime(nextStart).slice(0, 10) } }
        : {}),
    })
    onTimingChange(normalized.anchorStart, toLocalDateTime(nextEnd))
    onChange(normalized)
  }

  const enableRecurrence = () => {
    if (rule) return
    const base = parseLocalDateTime(startDate) ?? parseLocalDateTime(endDate) ?? nextDefaultStart()
    const point = toLocalDateTime(base)
    commitRule(createRecurrenceRule(point, point, 'daily'), timeFrom(point), base)
  }

  const changeFrequency = (frequency: Exclude<RecurrenceFrequency, 'hourly'>) => {
    if (!rule) return
    const currentStart = parseLocalDateTime(startDate) ?? nextDefaultStart()
    commitRule(withoutUndefined({
      ...rule,
      frequency,
      interval: Math.max(1, rule.interval),
      byWeekdays: frequency === 'weekly'
        ? rule.byWeekdays?.length ? rule.byWeekdays : [weekdayFor(currentStart)]
        : undefined,
      byMonth: frequency === 'yearly' ? rule.byMonth ?? currentStart.getMonth() + 1 : undefined,
      byMonthDay: frequency === 'monthly' || frequency === 'yearly'
        ? rule.byMonthDay ?? currentStart.getDate()
        : undefined,
    }))
  }

  const toggleWeekdays = (weekdays: Weekday[]) => {
    if (!rule || weekdays.length === 0) return
    commitRule({ ...rule, byWeekdays: [...weekdays].sort() as Weekday[] })
  }

  return (
    <FormControl component="fieldset" fullWidth className="mui-recurrence-field">
      <FieldLabel sx={{ mb: 1.5 }}>任务周期</FieldLabel>

      <ToggleButtonGroup
        exclusive
        fullWidth
        value={rule ? 'repeat' : 'once'}
        onChange={(_, next) => {
          if (next === 'repeat') enableRecurrence()
          if (next === 'once') onChange(null)
        }}
        aria-label="选择任务是否重复"
        sx={{ '& .MuiToggleButton-root': { flex: 1, justifyContent: 'flex-start', gap: 1, px: 1.5, py: 1 } }}
      >
        <ToggleButton value="once" aria-label="不重复">
          <CheckOutlined sx={{ fontSize: 17 }} />
          <Box sx={{ display: 'grid', textAlign: 'left' }}><strong>不重复</strong><Typography variant="caption">默认，仅执行一次</Typography></Box>
        </ToggleButton>
        <ToggleButton value="repeat" aria-label="重复">
          <RepeatOutlined sx={{ fontSize: 17 }} />
          <Box sx={{ display: 'grid', textAlign: 'left' }}><strong>重复</strong><Typography variant="caption">按计划自动生成下一次</Typography></Box>
        </ToggleButton>
      </ToggleButtonGroup>

      {rule && (
        <Paper
          className="mui-recurrence-panel"
          variant="outlined"
          sx={{ mt: 2, p: 2, display: 'grid', gap: 2, borderColor: 'divider' }}
        >
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={rule.frequency}
            onChange={(_, frequency) => frequency && changeFrequency(frequency)}
            aria-label="按什么周期重复"
            sx={{ mb: 0.5 }}
          >
            {frequencyOptions.map((option) => <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>)}
          </ToggleButtonGroup>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="重复间隔"
              type="number"
              value={rule.interval}
              onChange={(event) => commitRule({ ...rule, interval: Math.max(1, Math.min(999, Number(event.target.value) || 1)) })}
              slotProps={{ htmlInput: { min: 1, max: 999, 'aria-label': '重复间隔' } }}
              helperText={`每 ${rule.interval} ${rule.frequency === 'daily' ? '天' : rule.frequency === 'weekly' ? '周' : rule.frequency === 'monthly' ? '个月' : '年'}`}
            />
            <TimePicker
              label="执行时间"
              value={dayjs(`2000-01-01T${time}`)}
              onChange={(value) => value?.isValid() && commitRule(rule, value.format('HH:mm'))}
              timeSteps={{ minutes: 1 }}
              slotProps={{ actionBar: { actions: ['cancel', 'accept'] } }}
            />
          </Box>

          {rule.frequency === 'weekly' && (
            <FormControl fullWidth>
              <FieldLabel component="label" sx={{ mb: 0.75 }}>每周的哪几天</FieldLabel>
              <ToggleButtonGroup
                value={rule.byWeekdays ?? []}
                onChange={(_, weekdays) => toggleWeekdays(weekdays)}
                aria-label="选择重复星期"
                fullWidth
                sx={{ gap: 0.5, '& .MuiToggleButton-root': { flex: 1, minWidth: 0, px: 0.5 } }}
              >
                {weekdayOptions.map((day) => <ToggleButton key={day.value} value={day.value}>{day.label}</ToggleButton>)}
              </ToggleButtonGroup>
            </FormControl>
          )}

          {rule.frequency === 'monthly' && (
            <TextField
              label="每月日期"
              type="number"
              value={rule.byMonthDay ?? 1}
              onChange={(event) => commitRule({ ...rule, byMonthDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })}
              helperText="当月没有这一天时，将跳过该月。"
              slotProps={{ htmlInput: { min: 1, max: 31, 'aria-label': '每月日期' } }}
            />
          )}

          {rule.frequency === 'yearly' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField select label="每年月份" value={rule.byMonth ?? 1} onChange={(event) => commitRule({ ...rule, byMonth: Number(event.target.value) })} slotProps={{ htmlInput: { 'aria-label': '每年月份' } }}>
                {Array.from({ length: 12 }, (_, index) => <MenuItem key={index + 1} value={index + 1}>{index + 1} 月</MenuItem>)}
              </TextField>
              <TextField
                label="日期"
                type="number"
                value={rule.byMonthDay ?? 1}
                onChange={(event) => commitRule({ ...rule, byMonthDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })}
                slotProps={{ htmlInput: { min: 1, max: 31, 'aria-label': '每年日期' } }}
              />
            </Box>
          )}



          <Box sx={{ display: 'grid', gridTemplateColumns: rule.end.kind === 'until' ? { xs: '1fr', sm: '1fr 1fr' } : '1fr', gap: 1.5 }}>
            <TextField
              select
              label="重复结束"
              value={rule.end.kind}
              onChange={(event) => commitRule({
                ...rule,
                end: event.target.value === 'never' ? { kind: 'never' } : { kind: 'until', date: startDate.slice(0, 10) },
              })}
            >
              <MenuItem value="never">永不结束</MenuItem>
              <MenuItem value="until">截止日期</MenuItem>
            </TextField>
            {rule.end.kind === 'until' && (
              <DatePicker
                label="截止到"
                value={rule.end.date ? dayjs(rule.end.date) : null}
                minDate={startDate ? dayjs(startDate.slice(0, 10)) : undefined}
                onChange={(value) => value?.isValid() && onChange({ ...rule, end: { kind: 'until', date: value.format('YYYY-MM-DD') } })}
                slotProps={{ actionBar: { actions: ['cancel', 'accept'] } }}
              />
            )}
          </Box>

          <Paper sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>{describeRecurrence(rule).split(' · ')[0]}，后续三次</Typography>
            </Stack>
            {previews.length ? (
              <Box component="ol" sx={{ m: '8px 0 0 28px', p: 0, color: 'text.secondary', fontSize: 10, display: 'grid', gap: 0.5 }}>
                {previews.map((item) => <li key={item.startDate}>{formatPreviewDate(item.startDate, item.endDate, rule.frequency === 'yearly')}</li>)}
              </Box>
            ) : <FormHelperText sx={{ ml: 0, mt: 1 }}>当前规则在截止日期前没有下一次。</FormHelperText>}
          </Paper>
        </Paper>
      )}

      {!rule && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2, display: 'grid', gap: 1.5, borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <DateTimePicker
              label="开始时间"
              value={startDate ? dayjs(startDate) : null}
              onChange={(value) => onTimingChange(value?.isValid() ? value.format('YYYY-MM-DDTHH:mm') : '', endDate)}
              timeSteps={{ minutes: 1 }}
              slotProps={{ actionBar: { actions: ['clear', 'cancel', 'accept'] } }}
            />
            <DateTimePicker
              label="结束时间"
              value={endDate ? dayjs(endDate) : null}
              onChange={(value) => onTimingChange(startDate, value?.isValid() ? value.format('YYYY-MM-DDTHH:mm') : '')}
              timeSteps={{ minutes: 1 }}
              slotProps={{ actionBar: { actions: ['clear', 'cancel', 'accept'] } }}
            />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 0.5 }}>
            <FormHelperText sx={{ m: 0 }}>开始和结束均可单独设置；都留空时仅显示在“全部”看板。</FormHelperText>
            {(startDate || endDate) && <Button variant="text" onClick={() => onTimingChange('', '')}>清除时间</Button>}
          </Stack>
        </Paper>
      )}
    </FormControl>
  )
}
