import { useMemo, useState } from 'react'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import RepeatOutlined from '@mui/icons-material/RepeatOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import { SectionHeader } from '../components/SectionHeader'
import { useTaskData } from '../context/TaskDataContext'
import { useOpenTaskForm } from '../context/UiContext'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import {
  buildSeriesHealth,
  buildTagDistribution,
  collectCompletionEvents,
  dailyCompletionCounts,
  getAnalyticsRange,
  getPreviousRange,
  matchesTagFilter,
  summarizeOverview,
  MAX_CUSTOM_RANGE_DAYS,
  type AnalyticsRange,
  type AnalyticsRangePreset,
  type CompletionEvent,
} from '../lib/analytics'
import { addDays, toDateInput } from '../lib/date'
import { describeRecurrence } from '../lib/recurrence'
import type { CustomDateRange, TagColor } from '../types'

const presetOptions: Array<{ preset: AnalyticsRangePreset; label: string }> = [
  { preset: '7d', label: '近 7 天' },
  { preset: '30d', label: '近 30 天' },
  { preset: 'month', label: '本月' },
  { preset: 'custom', label: '自定义' },
]

const weekdayChars = ['日', '一', '二', '三', '四', '五', '六']

/** 标签颜色到 CSS 变量的映射，与 App.css 的 .tag-color 着色保持一致。 */
const tagColorVar: Record<TagColor, string> = {
  lavender: 'var(--color-primary)',
  mint: 'var(--color-mint-strong)',
  apricot: 'var(--color-apricot-strong)',
  rose: 'var(--color-rose)',
  sky: 'var(--color-sky)',
  amber: 'var(--color-amber)',
  slate: 'var(--color-slate)',
  indigo: 'var(--color-indigo)',
}

function formatRangeLabel(range: AnalyticsRange) {
  const format = (day: Date) => `${day.getMonth() + 1}月${day.getDate()}日`
  return `${format(range.start)} – ${format(range.end)}`
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function formatDelta(delta: number | null, fallbackCaption: string) {
  if (delta === null) return { text: fallbackCaption, tone: 'text-muted' }
  if (delta > 0) return { text: `较上期 +${delta}`, tone: 'text-mint-strong' }
  if (delta < 0) return { text: `较上期 ${delta}`, tone: 'text-muted' }
  return { text: '与上期持平', tone: 'text-muted' }
}

/* ------------------------------------------------------------------ */
/* 小组件                                                              */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  icon: React.ReactNode
  iconClasses: string
  label: string
  value: string
  caption: string
  captionClasses?: string
}

function StatCard({ icon, iconClasses, label, value, caption, captionClasses = 'text-muted' }: StatCardProps) {
  return (
    <Paper variant="outlined" className="rounded-xl p-4">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconClasses}`}>{icon}</span>
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      <div className="mt-3.5 font-mono text-[26px] leading-none font-semibold tracking-tight text-ink">{value}</div>
      <div className={`mt-2 text-[11px] ${captionClasses}`}>{caption}</div>
    </Paper>
  )
}

/** 准时率小圆环：>=80% 绿、>=50% 琥珀、更低则杏橙提醒。 */
function OnTimeRing({ rate }: { rate: number | null }) {
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const stroke = rate === null ? 'transparent' : rate >= 0.8 ? 'var(--color-mint)' : rate >= 0.5 ? 'var(--color-amber)' : 'var(--color-apricot-strong)'
  return (
    <span className="relative grid size-11 shrink-0 place-items-center" aria-label={rate === null ? '暂无重复完成' : `准时率 ${Math.round(rate * 100)}%`}>
      <svg viewBox="0 0 36 36" className="size-11 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#ececf2" strokeWidth="4" />
        {rate !== null && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${circumference * rate} ${circumference}`}
          />
        )}
      </svg>
      <span className="absolute font-mono text-[10px] font-semibold text-ink-2">{rate === null ? '—' : `${Math.round(rate * 100)}%`}</span>
    </span>
  )
}

interface TrendChartProps {
  range: AnalyticsRange
  counts: number[]
  selectedDay: string | null
  onSelectDay: (day: string | null) => void
}

function TrendChart({ range, counts, selectedDay, onSelectDay }: TrendChartProps) {
  const maxCount = Math.max(...counts, 1)
  const compact = range.days.length > 14
  const gapClass = compact ? 'gap-[3px]' : 'gap-1.5'
  const barMaxWidth = compact ? 'max-w-[14px]' : 'max-w-[26px]'
  const todayKey = toDateInput(new Date())

  return (
    <div>
      <div className={`flex h-[140px] items-end border-b border-line ${gapClass}`}>
        {range.days.map((day, index) => {
          const count = counts[index] ?? 0
          const dayKey = toDateInput(day)
          const selected = selectedDay === dayKey
          return (
            <button
              key={dayKey}
              type="button"
              aria-pressed={selected}
              aria-label={`${day.getMonth() + 1}月${day.getDate()}日，完成 ${count} 项`}
              onClick={() => onSelectDay(selected ? null : dayKey)}
              className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-primary"
            >
              {count === 0 ? (
                <span className="h-[3px] w-full rounded-full bg-line" />
              ) : (
                <span
                  className={`relative w-full rounded-[5px] transition-colors duration-100 ${barMaxWidth} ${selected ? 'bg-primary-strong' : 'bg-mint group-hover:bg-mint-strong'}`}
                  style={{ height: `${Math.max(7, (count / maxCount) * 100)}%` }}
                >
                  <span
                    className={`pointer-events-none absolute -top-1 left-1/2 z-[1] -translate-x-1/2 -translate-y-full rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10px] leading-none font-semibold whitespace-nowrap text-white transition-opacity duration-100 ${
                      selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {count}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className={`mt-1.5 flex ${gapClass}`} aria-hidden="true">
        {range.days.map((day, index) => {
          const dayKey = toDateInput(day)
          const isToday = dayKey === todayKey
          const labelClasses = `block text-center font-mono leading-[1.3] ${isToday ? 'font-bold text-primary-strong' : 'text-muted'}`
          if (!compact) {
            return (
              <span key={dayKey} className="min-w-0 flex-1">
                <span className={`${labelClasses} text-[10px]`}>{weekdayChars[day.getDay()]}</span>
                <span className={`${labelClasses} text-[9px]`}>{day.getDate()}</span>
              </span>
            )
          }
          const showLabel = index === 0 || index === range.days.length - 1 || day.getDate() % 5 === 0
          return (
            <span key={dayKey} className="min-w-0 flex-1">
              <span className={`${labelClasses} text-[9px]`}>{showLabel ? `${day.getMonth() + 1}/${day.getDate()}` : '\u00A0'}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4" aria-label="分析数据加载中">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-[118px] animate-pulse rounded-xl bg-fill" />)}
      </div>
      <div className="h-[280px] animate-pulse rounded-xl bg-fill" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[240px] animate-pulse rounded-xl bg-fill" />
        <div className="h-[240px] animate-pulse rounded-xl bg-fill" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

/** 分析页：/analytics。基于完成事件、周期账本与任务快照的回顾视图。 */
export function AnalyticsPage() {
  const taskData = useTaskData()
  const { openTask, openTagBoard } = useBoardNavigation()
  const openTaskForm = useOpenTaskForm()

  const [preset, setPreset] = useState<AnalyticsRangePreset>('7d')
  const [customRange, setCustomRange] = useState<CustomDateRange>(() => ({
    startDate: toDateInput(addDays(new Date(), -13)),
    endDate: toDateInput(new Date()),
  }))
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const range = useMemo(() => getAnalyticsRange(preset, customRange), [preset, customRange])
  const previousWindow = useMemo(() => (range ? getPreviousRange(range) : null), [range])
  // 近 7/30 天提供环比：抓取窗口向前扩展一个等长区间
  const withPrevious = preset === '7d' || preset === '30d'
  const fetchSince = range ? (withPrevious && previousWindow ? previousWindow.start : range.start) : null
  const { occurrences, logs, loading, error } = useAnalyticsData(fetchSince, taskData.tasks, reloadToken)

  const events = useMemo(
    () => (range ? collectCompletionEvents(taskData.tasks, logs, occurrences, range) : []),
    [range, taskData.tasks, logs, occurrences],
  )
  const previousEvents = useMemo(
    () => (withPrevious && previousWindow ? collectCompletionEvents(taskData.tasks, logs, occurrences, previousWindow) : null),
    [withPrevious, previousWindow, taskData.tasks, logs, occurrences],
  )
  const filteredEvents = useMemo(
    () => events.filter((event) => matchesTagFilter(event.tagIds, selectedTagIds)),
    [events, selectedTagIds],
  )
  const filteredPreviousEvents = useMemo(
    () => (previousEvents ? previousEvents.filter((event) => matchesTagFilter(event.tagIds, selectedTagIds)) : null),
    [previousEvents, selectedTagIds],
  )
  const filteredTasks = useMemo(
    () => taskData.tasks.filter((task) => matchesTagFilter(task.tagIds, selectedTagIds)),
    [taskData.tasks, selectedTagIds],
  )
  const filteredOccurrences = useMemo(
    () => occurrences.filter((record) => matchesTagFilter(record.tagIds, selectedTagIds)),
    [occurrences, selectedTagIds],
  )

  const overview = useMemo(
    () => (range
      ? summarizeOverview(filteredEvents, filteredPreviousEvents, filteredTasks, range, withPrevious ? previousWindow : null)
      : null),
    [range, filteredEvents, filteredPreviousEvents, filteredTasks, withPrevious, previousWindow],
  )
  const daily = useMemo(() => (range ? dailyCompletionCounts(filteredEvents, range) : []), [range, filteredEvents])
  const seriesHealth = useMemo(() => (range ? buildSeriesHealth(filteredTasks, filteredOccurrences, range) : []), [range, filteredTasks, filteredOccurrences])
  const distribution = useMemo(() => buildTagDistribution(filteredEvents, taskData.tags), [filteredEvents, taskData.tags])

  const dayEvents = useMemo(() => {
    if (!selectedDay) return []
    return filteredEvents.filter((event) => toDateInput(event.completedAt) === selectedDay)
  }, [filteredEvents, selectedDay])

  const bootstrapping = taskData.loading || loading

  const changePreset = (next: AnalyticsRangePreset) => {
    setPreset(next)
    setSelectedDay(null)
  }
  const changeCustomRange = (next: CustomDateRange) => {
    setCustomRange(next)
    setSelectedDay(null)
  }
  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]))
    setSelectedDay(null)
  }

  const completedCaption = formatDelta(overview?.completedDelta ?? null, preset === 'month' ? '本月累计' : '所选区间累计')
  const createdCaption = formatDelta(overview?.createdDelta ?? null, preset === 'month' ? '本月新建' : '所选区间新建')

  return (
    <div className="mx-auto w-full max-w-[1060px] pb-4">
      <Box component="header" className="mb-6 max-md:sr-only">
        <Typography className="inline-flex items-center gap-1.5 font-bold tracking-[0.08em] text-primary-strong uppercase" variant="caption">
          <InsightsOutlined sx={{ fontSize: 13 }} />回顾与洞察
        </Typography>
        <Typography component="h1" className="text-[clamp(22px,2vw,26px)] leading-[1.18] tracking-[-0.035em] text-ink">分析</Typography>
      </Box>

      {/* 时间范围与标签筛选 */}
      <div className="mb-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-fill p-1" role="group" aria-label="时间范围">
            {presetOptions.map(({ preset: option, label }) => {
              const active = preset === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changePreset(option)}
                  className={`h-8 cursor-pointer rounded-full px-3.5 text-xs transition-colors ${
                    active ? 'bg-surface font-semibold text-primary-strong shadow-[0_1px_4px_rgba(54,52,80,0.1)]' : 'text-muted hover:text-ink-2'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <TextField
                type="date"
                label="开始"
                value={customRange.startDate}
                onChange={(event) => changeCustomRange({ ...customRange, startDate: event.target.value })}
                className="w-[150px]"
              />
              <span className="text-xs text-muted">至</span>
              <TextField
                type="date"
                label="结束"
                value={customRange.endDate}
                onChange={(event) => changeCustomRange({ ...customRange, endDate: event.target.value })}
                className="w-[150px]"
              />
            </div>
          )}
        </div>
        {taskData.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="标签筛选">
            <span className="mr-1 text-[11px] text-muted">标签筛选</span>
            {taskData.tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors ${
                    active
                      ? 'border-[#cdd3f3] bg-primary-soft font-semibold text-primary-strong'
                      : 'border-line bg-surface text-ink-2 hover:border-[#cdd3f3] hover:text-primary-strong'
                  }`}
                >
                  <i className={`tag-color is-${tag.color}`} />
                  {tag.name}
                </button>
              )
            })}
            {selectedTagIds.length > 0 && (
              <Button variant="text" className="min-h-7 min-w-0 px-2 text-[11px]" onClick={() => setSelectedTagIds([])}>清除</Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <Alert
          severity="error"
          className="mb-4"
          action={<Button color="inherit" size="small" onClick={() => setReloadToken((token) => token + 1)}>重试</Button>}
        >
          {error}
        </Alert>
      )}

      {bootstrapping ? <LoadingSkeleton /> : !range ? (
        <Paper variant="outlined" className="rounded-xl p-8 text-center">
          <p className="text-sm text-ink-2">自定义范围无效：请选择开始不晚于结束、且不超过 {MAX_CUSTOM_RANGE_DAYS} 天的区间。</p>
        </Paper>
      ) : overview && (
        <div className="grid gap-4">
          {/* 概览 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<CheckOutlined sx={{ fontSize: 18 }} />}
              iconClasses="bg-mint-soft text-mint-strong"
              label="已完成"
              value={String(overview.completed)}
              caption={completedCaption.text}
              captionClasses={completedCaption.tone}
            />
            <StatCard
              icon={<AddOutlined sx={{ fontSize: 18 }} />}
              iconClasses="bg-primary-soft text-primary-strong"
              label="新建任务"
              value={String(overview.created)}
              caption={createdCaption.text}
              captionClasses={createdCaption.tone}
            />
            <StatCard
              icon={<ScheduleOutlined sx={{ fontSize: 18 }} />}
              iconClasses="bg-[#e9ebfa] text-indigo"
              label="重复准时率"
              value={overview.onTimeRate === null ? '—' : `${Math.round(overview.onTimeRate * 100)}%`}
              caption={overview.occurrenceCompletions ? `${overview.occurrenceCompletions} 次重复完成` : '暂无重复完成'}
            />
            <StatCard
              icon={<RepeatOutlined sx={{ fontSize: 18 }} />}
              iconClasses={overview.overdueSeries > 0 ? 'bg-apricot-soft text-apricot-strong' : 'bg-fill text-muted'}
              label="进行中系列"
              value={String(overview.activeSeries)}
              caption={
                overview.overdueSeries > 0
                  ? `${overview.overdueSeries} 个逾期待处理`
                  : overview.activeSeries > 0 ? '全部按期进行' : '暂无重复任务'
              }
              captionClasses={overview.overdueSeries > 0 ? 'text-apricot-strong' : 'text-muted'}
            />
          </div>

          {/* 完成趋势 */}
          <Paper variant="outlined" className="rounded-xl p-5 max-md:p-4">
            <div className="flex items-start justify-between gap-3">
              <SectionHeader title="完成趋势" caption={`${formatRangeLabel(range)} · 共 ${filteredEvents.length} 次完成`} />
              {selectedDay && (
                <Button
                  variant="text"
                  size="small"
                  className="min-h-7 min-w-0 gap-0.5 px-2 text-[11px]"
                  startIcon={<CloseOutlined sx={{ fontSize: 13 }} />}
                  onClick={() => setSelectedDay(null)}
                >
                  清除选择
                </Button>
              )}
            </div>
            <div className="mt-5">
              {filteredEvents.length === 0 ? (
                <div className="grid place-items-center gap-2 py-10 text-center">
                  <p className="text-sm text-ink-2">这段时间还没有完成记录</p>
                  <p className="text-xs text-muted">完成任意任务后，这里会按天展示你的节奏。</p>
                  {taskData.tasks.length === 0 && (
                    <Button variant="contained" size="small" className="mt-2" startIcon={<AddOutlined />} onClick={() => openTaskForm()}>
                      创建第一个任务
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <TrendChart range={range} counts={daily} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                  {selectedDay && (
                    <div className="mt-4 rounded-lg border border-line bg-fill/60 p-2">
                      <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold text-ink-2">
                        {Number(selectedDay.slice(5, 7))}月{Number(selectedDay.slice(8, 10))}日 · {dayEvents.length} 次完成
                      </p>
                      {dayEvents.length === 0 ? (
                        <p className="px-2 pb-2 text-xs text-muted">这一天没有符合筛选条件的完成记录。</p>
                      ) : (
                        <ul className="m-0 grid list-none gap-0.5 p-0">
                          {dayEvents.map((event) => <DayEventRow key={event.key} event={event} onOpen={() => openTask(event.openTaskId)} />)}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Paper>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* 重复任务健康度 */}
            <Paper variant="outlined" className="rounded-xl p-5 max-md:p-4">
              <SectionHeader
                icon={<RepeatOutlined sx={{ fontSize: 17 }} />}
                title="重复任务健康度"
                caption="区间内各系列的执行与准时情况"
              />
              {seriesHealth.length === 0 ? (
                <div className="mt-4 grid gap-2 rounded-lg bg-fill/70 p-5 text-center">
                  <p className="text-sm text-ink-2">还没有重复任务</p>
                  <p className="text-xs text-muted">为任务开启重复后，这里会跟踪每一期的完成与跳过。</p>
                  <Button variant="outlined" size="small" className="mx-auto mt-1" startIcon={<AddOutlined />} onClick={() => openTaskForm()}>
                    创建重复任务
                  </Button>
                </div>
              ) : (
                <ul className="m-0 mt-3 grid list-none gap-0.5 p-0">
                  {seriesHealth.map(({ task, completed, skipped, onTimeRate, overduePending }) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-fill"
                      >
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <strong className="truncate text-[13px] font-semibold text-ink">{task.title}</strong>
                            <span className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[6px] bg-primary-soft px-2 text-[9px] leading-none text-primary-strong">
                              <RepeatOutlined sx={{ fontSize: 10 }} />{describeRecurrence(task.recurrence).split(' · ')[0]}
                            </span>
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex h-5 items-center rounded-md bg-mint-soft px-1.5 text-[10px] font-semibold text-mint-strong">完成 {completed}</span>
                            {skipped > 0 && (
                              <span className="inline-flex h-5 items-center rounded-md bg-fill px-1.5 text-[10px] font-semibold text-muted">跳过 {skipped}</span>
                            )}
                            {overduePending && (
                              <span className="inline-flex h-5 items-center rounded-md bg-apricot-soft px-1.5 text-[10px] font-semibold text-apricot-strong">本期逾期</span>
                            )}
                          </span>
                        </span>
                        <OnTimeRing rate={onTimeRate} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Paper>

            {/* 标签分布 */}
            <Paper variant="outlined" className="rounded-xl p-5 max-md:p-4">
              <SectionHeader title="标签分布" caption="完成事件按标签的占比" />
              {distribution.length === 0 ? (
                <div className="mt-4 grid gap-2 rounded-lg bg-fill/70 p-5 text-center">
                  <p className="text-sm text-ink-2">暂无可统计的完成记录</p>
                  <p className="text-xs text-muted">完成任务后，这里会按标签展示你的精力分布。</p>
                </div>
              ) : (
                <ul className="m-0 mt-3 grid list-none gap-0.5 p-0">
                  {distribution.map((item) => {
                    const maxCount = distribution[0]?.count ?? 1
                    const percent = Math.round(item.share * 100)
                    const content = (
                      <>
                        <span className="flex min-w-0 items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink">
                            {item.tag ? (
                              <>
                                <i className="tag-color large is-mint" style={{ background: tagColorVar[item.tag.color] }} />
                                <span className="truncate">{item.tag.name}</span>
                              </>
                            ) : (
                              <>
                                <i className="tag-color large" style={{ background: 'var(--color-faint)', boxShadow: 'none' }} />
                                <span className="text-muted">未关联标签</span>
                              </>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-muted">{item.count} · {percent}%</span>
                        </span>
                        <span className="mt-2 block h-[6px] overflow-hidden rounded-full bg-[#ececf2]">
                          <span
                            className="block h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${Math.max(4, (item.count / maxCount) * 100)}%`,
                              background: item.tag ? tagColorVar[item.tag.color] : 'var(--color-faint)',
                            }}
                          />
                        </span>
                      </>
                    )
                    return (
                      <li key={item.tag?.id ?? 'untagged'}>
                        {item.tag ? (
                          <button
                            type="button"
                            onClick={() => openTagBoard(item.tag!.id)}
                            aria-label={`查看标签看板：${item.tag.name}`}
                            className="w-full cursor-pointer rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-fill"
                          >
                            {content}
                          </button>
                        ) : (
                          <div className="rounded-lg px-2.5 py-2.5">{content}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Paper>
          </div>
        </div>
      )}
    </div>
  )
}

/** 完成明细行：下钻列表中展示单次完成事件。 */
function DayEventRow({ event, onOpen }: { event: CompletionEvent; onOpen: () => void }) {
  const sourceLabel = event.source === 'occurrence' ? '重复' : event.source === 'progress' ? '进度' : '普通'
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface"
      >
        <span className="font-mono text-[11px] text-muted">{formatTime(event.completedAt)}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-ink">{event.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className={`inline-flex h-[16px] items-center rounded px-1 text-[9px] font-semibold leading-none ${
              event.source === 'occurrence' ? 'bg-primary-soft text-primary-strong' : event.source === 'progress' ? 'bg-mint-soft text-mint-strong' : 'bg-fill text-muted'
            }`}
            >
              {sourceLabel}
            </span>
            {event.onTime === false && (
              <span className="inline-flex h-[16px] items-center rounded bg-apricot-soft px-1 text-[9px] font-semibold leading-none text-apricot-strong">晚于计划</span>
            )}
          </span>
        </span>
        <ChevronRightOutlined sx={{ fontSize: 14 }} className="text-faint" />
      </button>
    </li>
  )
}
