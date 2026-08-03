import { useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Repeat2 } from 'lucide-react'
import { formatDateRange } from '../lib/date'
import {
  createRecurrenceRule,
  describeRecurrence,
  parseLocalDateTime,
  previewRecurrence,
  syncRecurrenceTiming,
  weekdayFor,
} from '../lib/recurrence'
import type { RecurrenceFrequency, RecurrenceRule, Weekday } from '../types'

interface RecurrenceEditorProps {
  value: RecurrenceRule | null | undefined
  startDate: string
  endDate: string
  onChange: (value: RecurrenceRule | null) => void
  compact?: boolean
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

function presetFor(rule: RecurrenceRule | null | undefined) {
  if (!rule) return 'none'
  const days = [...(rule.byWeekdays ?? [])].sort().join(',')
  if (rule.frequency === 'daily' && rule.interval === 1) return 'daily'
  if (rule.frequency === 'weekly' && rule.interval === 1 && days === '1,2,3,4,5') return 'weekdays'
  if (rule.frequency === 'weekly' && rule.interval === 1 && days === '6,7') return 'weekends'
  if (rule.frequency === 'weekly' && rule.interval === 1 && rule.byWeekdays?.length === 1) return 'weekly'
  if (rule.frequency === 'weekly' && rule.interval === 2 && rule.byWeekdays?.length === 1) return 'biweekly'
  if (rule.frequency === 'monthly' && rule.interval === 1) return 'monthly'
  if (rule.frequency === 'monthly' && rule.interval === 3) return 'quarterly'
  if (rule.frequency === 'monthly' && rule.interval === 6) return 'semiannual'
  if (rule.frequency === 'yearly' && rule.interval === 1) return 'yearly'
  return 'custom'
}

export function RecurrenceEditor({ value, startDate, endDate, onChange, compact = false }: RecurrenceEditorProps) {
  const [open, setOpen] = useState(!compact && Boolean(value))
  const [message, setMessage] = useState('')
  const timeReady = Boolean(parseLocalDateTime(startDate) && parseLocalDateTime(endDate))
  const rule = useMemo(
    () => syncRecurrenceTiming(value, startDate, endDate),
    [endDate, startDate, value],
  )
  const preset = presetFor(rule)
  const previews = useMemo(() => rule ? previewRecurrence(rule, 3) : [], [rule])

  const choosePreset = (nextPreset: string) => {
    setMessage('')
    if (nextPreset === 'none') {
      onChange(null)
      setOpen(false)
      return
    }
    if (!timeReady) {
      setMessage('先设置完整的开始和结束时间，再开启重复。')
      setOpen(true)
      return
    }
    const start = parseLocalDateTime(startDate)!
    const next = createRecurrenceRule(startDate, endDate)
    if (nextPreset === 'daily') Object.assign(next, { frequency: 'daily', interval: 1 })
    if (nextPreset === 'weekdays') Object.assign(next, { frequency: 'weekly', interval: 1, byWeekdays: [1, 2, 3, 4, 5] })
    if (nextPreset === 'weekends') Object.assign(next, { frequency: 'weekly', interval: 1, byWeekdays: [6, 7] })
    if (nextPreset === 'weekly') Object.assign(next, { frequency: 'weekly', interval: 1, byWeekdays: [weekdayFor(start)] })
    if (nextPreset === 'biweekly') Object.assign(next, { frequency: 'weekly', interval: 2, byWeekdays: [weekdayFor(start)] })
    if (nextPreset === 'monthly') Object.assign(next, { frequency: 'monthly', interval: 1, byMonthDay: start.getDate() })
    if (nextPreset === 'quarterly') Object.assign(next, { frequency: 'monthly', interval: 3, byMonthDay: start.getDate() })
    if (nextPreset === 'semiannual') Object.assign(next, { frequency: 'monthly', interval: 6, byMonthDay: start.getDate() })
    if (nextPreset === 'yearly') Object.assign(next, { frequency: 'yearly', interval: 1 })
    if (nextPreset === 'custom') {
      Object.assign(next, rule ?? {}, { anchorStart: startDate, durationMinutes: next.durationMinutes })
    }
    onChange(next)
    setOpen(true)
  }

  const updateRule = (patch: Partial<RecurrenceRule>) => {
    if (!rule) return
    onChange({ ...rule, ...patch })
  }

  const changeFrequency = (frequency: RecurrenceFrequency) => {
    const start = parseLocalDateTime(startDate)
    updateRule({
      frequency,
      ...(frequency === 'weekly' ? { byWeekdays: rule?.byWeekdays?.length ? rule.byWeekdays : start ? [weekdayFor(start)] : [1] } : { byWeekdays: undefined }),
      ...(frequency === 'monthly' ? { byMonthDay: rule?.byMonthDay ?? start?.getDate() ?? 1 } : { byMonthDay: undefined }),
    })
  }

  const toggleWeekday = (weekday: Weekday) => {
    if (!rule) return
    const selected = new Set(rule.byWeekdays ?? [])
    if (selected.has(weekday)) {
      if (selected.size === 1) return
      selected.delete(weekday)
    } else selected.add(weekday)
    updateRule({ byWeekdays: [...selected].sort() as Weekday[] })
  }

  return (
    <fieldset className={`field-group recurrence-field ${compact ? 'is-compact' : ''}`}>
      <legend><Repeat2 /> <span>重复设置 <small>可选</small></span></legend>
      <button
        type="button"
        className={`recurrence-trigger ${rule ? 'is-active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
      >
        <span className="recurrence-trigger-icon"><Repeat2 /></span>
        <span><strong>{rule ? describeRecurrence(rule).split(' · ')[0] : '不重复'}</strong><small>{rule ? describeRecurrence(rule).split(' · ')[1] : '完成后不会生成下一次'}</small></span>
        <ChevronDown />
      </button>

      {open && (
        <div className="recurrence-panel">
          <label className="recurrence-preset-row">
            <span>重复频率</span>
            <select value={preset} onChange={(event) => choosePreset(event.target.value)}>
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekdays">每个工作日</option>
              <option value="weekends">每个周末</option>
              <option value="weekly">每周</option>
              <option value="biweekly">每两周</option>
              <option value="monthly">每月</option>
              <option value="quarterly">每 3 个月</option>
              <option value="semiannual">每 6 个月</option>
              <option value="yearly">每年</option>
              <option value="custom">自定</option>
            </select>
          </label>

          {rule && (
            <>
              <div className="recurrence-custom-grid">
                <label>
                  <span>周期</span>
                  <select value={rule.frequency} onChange={(event) => changeFrequency(event.target.value as RecurrenceFrequency)}>
                    <option value="daily">天</option>
                    <option value="weekly">周</option>
                    <option value="monthly">月</option>
                    <option value="yearly">年</option>
                  </select>
                </label>
                <label>
                  <span>间隔</span>
                  <span className="interval-control"><em>每</em><input type="number" min="1" max="999" value={rule.interval} onChange={(event) => updateRule({ interval: Math.max(1, Math.min(999, Number(event.target.value) || 1)) })} /><em>{rule.frequency === 'daily' ? '天' : rule.frequency === 'weekly' ? '周' : rule.frequency === 'monthly' ? '个月' : '年'}</em></span>
                </label>
              </div>

              {rule.frequency === 'weekly' && (
                <div className="weekday-picker" aria-label="选择重复星期">
                  {weekdayOptions.map((day) => (
                    <button key={day.value} type="button" aria-pressed={rule.byWeekdays?.includes(day.value)} className={rule.byWeekdays?.includes(day.value) ? 'is-active' : ''} onClick={() => toggleWeekday(day.value)}>{day.label}</button>
                  ))}
                </div>
              )}

              {rule.frequency === 'monthly' && (
                <label className="recurrence-month-day">
                  <span>每次在当月</span>
                  <input type="number" min="1" max="31" value={rule.byMonthDay ?? 1} onChange={(event) => updateRule({ byMonthDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })} />
                  <span>日</span>
                  <small>没有这一天的月份会自动跳过。</small>
                </label>
              )}

              <div className="recurrence-end-row">
                <label>
                  <span>结束</span>
                  <select value={rule.end.kind} onChange={(event) => updateRule({ end: event.target.value === 'never' ? { kind: 'never' } : { kind: 'until', date: startDate.slice(0, 10) } })}>
                    <option value="never">永不结束</option>
                    <option value="until">截止日期</option>
                  </select>
                </label>
                {rule.end.kind === 'until' && <input aria-label="重复截止日期" type="date" min={startDate.slice(0, 10)} value={rule.end.date} onChange={(event) => updateRule({ end: { kind: 'until', date: event.target.value } })} />}
              </div>

              <div className="recurrence-preview" aria-live="polite">
                <div><CalendarClock /><strong>接下来三次</strong></div>
                {previews.length ? (
                  <ol>{previews.map((item) => <li key={item.startDate}>{formatDateRange(item.startDate, item.endDate)}</li>)}</ol>
                ) : <p>当前规则在截止日期前没有下一次。</p>}
              </div>
            </>
          )}
          {message && <p className="recurrence-message" role="alert">{message}</p>}
        </div>
      )}
    </fieldset>
  )
}
