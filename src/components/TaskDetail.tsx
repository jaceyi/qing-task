import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import { formatLogDate, normalizeDateTimeInput, validateTaskDateRange } from '../lib/date'
import { nextOccurrence, parseLocalDateTime } from '../lib/recurrence'
import { isTaskComplete } from '../lib/taskLogic'
import type { Tag, Task, TaskInfoFields, TaskLog, TaskType } from '../types'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { ConfirmDialog } from './ConfirmDialog'
import { RecurrenceEditor } from './RecurrenceEditor'
import { SectionHeader } from './SectionHeader'
import { TagPicker } from './TagPicker'

interface TaskDetailProps {
  task: Task
  logs: TaskLog[]
  logsError: string
  onCopy: () => void
  onSave: (fields: TaskInfoFields) => Promise<void>
  onChangeType: (nextType: TaskType, targetCount?: number) => Promise<void>
  onSetCompleted: (completed: boolean) => Promise<boolean>
  onAdjust: (delta: -1 | 1) => Promise<boolean>
  onDelete: () => Promise<void>
  onSkipOccurrence?: () => Promise<boolean>
  onNotify: (message: string) => void
  onUndoableStatusChange?: (message: string) => void
  onDirtyChange?: (dirty: boolean) => void
  /** 跳转到其他任务的详情（用于重复任务实例之间的跳转）。 */
  onOpenTask?: (taskId: string) => void
  tags?: Tag[]
  onCreateTag?: (name: string) => Promise<Tag>
}

type AutoSaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error' | 'invalid'

const autoSaveTones: Partial<Record<AutoSaveState, keyof typeof toneClasses>> = {
  saving: 'primary',
  saved: 'success',
  error: 'error',
  invalid: 'error',
}

const toneClasses = {
  neutral: 'bg-fill text-muted',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-mint-soft text-mint-strong',
  warning: 'bg-apricot-soft text-apricot-strong',
  error: 'bg-danger-soft text-danger',
} as const

function infoSignature(fields: TaskInfoFields) {
  return JSON.stringify(fields)
}

function validateInfoFields(fields: TaskInfoFields, taskType: TaskType) {
  if (!fields.title.trim()) return '任务名称不能为空'
  const dateError = validateTaskDateRange(fields.startDate, fields.endDate)
  if (dateError) return dateError
  if (taskType === 'progress' && fields.targetCount < 1) return '目标次数至少为 1'
  if (!fields.recurrence) return ''
  if (!fields.startDate || !fields.endDate) return '重复任务必须设置完整时间'
  if (fields.recurrence.end.kind === 'until' && fields.recurrence.end.date < fields.startDate.slice(0, 10)) return '重复截止日期不能早于任务开始日期'
  const currentStart = parseLocalDateTime(fields.startDate)
  const currentEnd = parseLocalDateTime(fields.endDate)
  const next = currentStart ? nextOccurrence(fields, currentStart) : null
  const nextStart = next ? parseLocalDateTime(next.startDate) : null
  if (currentEnd && nextStart && currentEnd >= nextStart) return '当前时间范围与下一次重复时间重叠'
  return ''
}

function describeLog(log: TaskLog) {
  const before = log.payload.before
  const after = log.payload.after
  if (typeof before === 'boolean' || typeof before === 'number') {
    const value = (item: typeof before) => (typeof item === 'boolean' ? (item ? '完成' : '未完成') : String(item))
    return `${value(before)} → ${value(after as typeof before)}`
  }
  if (typeof log.payload.title === 'string') return log.payload.title
  if (typeof before === 'string' && typeof after === 'string') {
    const emptyValue = log.action.includes('时间') ? '无时间' : '未填写'
    const value = (item: string) => item || emptyValue
    return `${value(before)} → ${value(after)}`
  }
  return ''
}

export function TaskDetail({
  task,
  logs,
  logsError,
  onCopy,
  onSave,
  onChangeType,
  onSetCompleted,
  onAdjust,
  onDelete,
  onSkipOccurrence,
  onNotify,
  onUndoableStatusChange,
  onDirtyChange,
  onOpenTask,
  tags = [],
  onCreateTag = async () => { throw new Error('暂时无法创建标签') },
}: TaskDetailProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [startDate, setStartDate] = useState(normalizeDateTimeInput(task.startDate, 'start'))
  const [endDate, setEndDate] = useState(normalizeDateTimeInput(task.endDate, 'end'))
  const [targetCount, setTargetCount] = useState(task.targetCount || 5)
  const [recurrence, setRecurrence] = useState(task.recurrence ?? null)
  const [tagIds, setTagIds] = useState<string[]>(task.tagIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [infoError, setInfoError] = useState('')
  const [infoDirty, setInfoDirty] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle')
  const [autoSaveRevision, setAutoSaveRevision] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmTypeChange, setConfirmTypeChange] = useState<TaskType | null>(null)
  const onSaveRef = useRef(onSave)
  const latestInfoRef = useRef<TaskInfoFields>({ title, description, startDate, endDate, targetCount, recurrence, tagIds })
  const infoDirtyRef = useRef(infoDirty)
  const autoSaveStateRef = useRef(autoSaveState)
  const taskTypeRef = useRef(task.type)
  const complete = isTaskComplete(task)
  const displayedType = confirmTypeChange ?? task.type

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    if (infoDirty) return
    setTitle(task.title)
    setDescription(task.description)
    setStartDate(normalizeDateTimeInput(task.startDate, 'start'))
    setEndDate(normalizeDateTimeInput(task.endDate, 'end'))
    setTargetCount(task.targetCount || 5)
    setRecurrence(task.recurrence ?? null)
    setTagIds(task.tagIds ?? [])
  }, [infoDirty, task])

  latestInfoRef.current = { title, description, startDate, endDate, targetCount, recurrence, tagIds }
  infoDirtyRef.current = infoDirty
  autoSaveStateRef.current = autoSaveState
  taskTypeRef.current = task.type

  useEffect(() => () => {
    if (!infoDirtyRef.current || autoSaveStateRef.current === 'saving') return
    const fields = latestInfoRef.current
    if (!validateInfoFields(fields, taskTypeRef.current)) void onSaveRef.current(fields)
  }, [])

  useEffect(() => {
    onDirtyChange?.(infoDirty)
    return () => onDirtyChange?.(false)
  }, [infoDirty, onDirtyChange])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!infoDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [infoDirty])

  useEffect(() => {
    if (!infoDirty) return
    const fields = { title, description, startDate, endDate, targetCount, recurrence, tagIds }
    const signature = infoSignature(fields)
    const validationError = validateInfoFields(fields, task.type)
    if (validationError) {
      setInfoError(validationError)
      setAutoSaveState('invalid')
      return
    }

    setInfoError('')
    setAutoSaveState('waiting')
    const timer = window.setTimeout(() => {
      setAutoSaveState('saving')
      void onSaveRef.current(fields)
        .then(() => {
          if (infoSignature(latestInfoRef.current) === signature) {
            setInfoDirty(false)
            setAutoSaveState('saved')
          }
        })
        .catch((reason) => {
          setInfoError(reason instanceof Error ? reason.message : '保存失败，请重试')
          setAutoSaveState('error')
        })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [autoSaveRevision, description, endDate, infoDirty, recurrence, startDate, tagIds, targetCount, task.type, title])

  const applyTypeChange = async () => {
    if (!confirmTypeChange) return
    setSaving(true)
    setError('')
    try {
      await onChangeType(confirmTypeChange, targetCount)
      onNotify(confirmTypeChange === 'progress' ? '已切换为进度任务' : '已切换为普通任务')
      setConfirmTypeChange(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '切换失败')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (direction: -1 | 1) => {
    const changed =
      task.type === 'single'
        ? await onSetCompleted(direction > 0)
        : await onAdjust(direction)
    if (changed) {
      const advancesRecurrence = Boolean(
        task.recurrence
        && task.seriesState !== 'ended'
        && direction > 0
        && (task.type === 'single' || task.count + 1 === task.targetCount),
      )
      const completionChanged = task.type === 'single'
        || (direction > 0 ? task.count + 1 === task.targetCount : task.count === task.targetCount)
      if (completionChanged) {
        onUndoableStatusChange?.(
          advancesRecurrence
            ? task.type === 'progress'
              ? `本次已保留为完成任务，下一次已从 0/${task.targetCount} 开始`
              : '本次已保留为完成任务，下一次已安排'
            : direction > 0
              ? '任务已完成'
              : '已取消完成',
        )
        return
      }
      onNotify(
        task.type === 'single'
          ? direction > 0
            ? '任务已完成'
            : '已取消完成'
          : direction > 0
            ? `进度已更新  ${task.count} → ${task.count + 1}`
            : '已回退进度',
      )
    }
  }

  const autoSaveLabel = autoSaveState === 'idle'
    ? '修改后自动保存'
    : autoSaveState === 'waiting'
      ? '等待自动保存'
      : autoSaveState === 'saving'
        ? '正在保存'
        : autoSaveState === 'saved'
          ? '已保存到本机'
          : autoSaveState === 'invalid'
            ? '需要修正'
            : '保存失败'

  return (
    <Box component="section" className="mx-auto w-full max-w-[1120px]" aria-labelledby="detail-title">
      <Box component="header" className="mb-6 grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 max-md:mb-4 max-md:min-h-11 max-md:gap-2">
        <Box>
          <Typography className="inline-flex items-center gap-1.5 font-bold tracking-[0.08em] text-primary-strong uppercase max-md:hidden" variant="caption">任务详情</Typography>
          <Typography id="detail-title" component="h1" className="truncate text-[clamp(22px,2vw,26px)] leading-[1.18] tracking-[-0.035em] text-ink max-md:text-xl">{task.title}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<ContentCopyOutlined />} onClick={onCopy}>复制</Button>
      </Box>

      <Box className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-md:block">
        <Stack spacing={2.5}>
          {/* 当前状态 */}
          <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
            <SectionHeader title="当前状态" />
            <Box className="mt-4">
              {task.type === 'single' ? (
                <Paper variant="outlined" className={`flex items-center gap-3 p-3 ${complete ? 'bg-mint-soft' : 'bg-fill'}`}>
                  <Box className={`grid size-10 place-items-center rounded-[10px] bg-surface ${complete ? 'text-mint-strong' : 'text-primary'}`}>
                    {complete ? <CheckOutlined /> : <ScheduleOutlined />}
                  </Box>
                  <Box className="flex-1"><Typography variant="body2" sx={{ fontWeight: 750 }}>{complete ? '已完成' : '待完成'}</Typography><Typography variant="caption">状态随时可以撤销。</Typography></Box>
                  <Button variant={complete ? 'outlined' : 'contained'} onClick={() => void updateStatus(complete ? -1 : 1)}>{complete ? '取消完成' : '完成任务'}</Button>
                </Paper>
              ) : (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <IconButton
                    aria-label="进度减一"
                    className="size-[34px] rounded-full border border-[#f0c9ba] bg-apricot-soft p-0 text-apricot-strong hover:border-[#eeb59f] hover:bg-[#ffe2d6] disabled:opacity-45"
                    disabled={task.count <= 0}
                    onClick={() => void updateStatus(-1)}
                  >
                    <RemoveOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                  <Box className="flex-1">
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}><Typography variant="body2"><strong>{task.count}</strong> / {task.targetCount}</Typography><Typography variant="caption">{complete ? '已达成目标' : `还差 ${task.targetCount - task.count} 次`}</Typography></Stack>
                    <LinearProgress variant="determinate" value={(task.count / task.targetCount) * 100} />
                  </Box>
                  <IconButton
                    aria-label="进度加一"
                    className="size-[34px] rounded-full border border-[#b9e7d6] bg-mint-soft p-0 text-mint-strong hover:border-[#a0dcc8] hover:bg-[#d3f0e5] disabled:opacity-45"
                    disabled={task.count >= task.targetCount}
                    onClick={() => void updateStatus(1)}
                  >
                    <AddOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              )}
            </Box>
          </Paper>

          {/* 基本信息 */}
          <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
              <SectionHeader title="基本信息" />
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <span
                  className={`inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap ${toneClasses[autoSaveTones[autoSaveState] ?? 'neutral']}`}
                  role="status"
                >
                  {autoSaveLabel}
                </span>
                {autoSaveState === 'error' && <Button variant="text" onClick={() => setAutoSaveRevision((value) => value + 1)}>重试</Button>}
              </Stack>
            </Stack>

            <Box className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                required
                label="任务名称"
                value={title}
                className="col-span-full"
                slotProps={{ htmlInput: { maxLength: 120 } }}
                onChange={(event) => { setTitle(event.target.value); setInfoDirty(true) }}
              />
              <TextField
                label="任务描述"
                value={description}
                className="col-span-full"
                multiline
                minRows={4}
                placeholder="补充任务背景、要求或完成标准"
                slotProps={{ htmlInput: { maxLength: 2000 } }}
                onChange={(event) => { setDescription(event.target.value); setInfoDirty(true) }}
              />

              <Box className="col-span-full">
                <RecurrenceEditor
                  value={recurrence}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(next) => { setRecurrence(next); setInfoDirty(true) }}
                  onTimingChange={(nextStart, nextEnd) => {
                    setStartDate(nextStart)
                    setEndDate(nextEnd)
                    setInfoDirty(true)
                  }}
                />
                {task.recurrence && task.seriesState !== 'ended' && onSkipOccurrence && (
                  <Paper variant="outlined" className="mt-3 flex items-center justify-between gap-3 p-3">
                    <Box><Typography variant="body2" sx={{ fontWeight: 700 }}>本次不执行？</Typography><Typography variant="caption">跳过后会直接安排下一次，重复计划保持不变。</Typography></Box>
                    <Button variant="outlined" onClick={async () => {
                      if (await onSkipOccurrence()) onUndoableStatusChange?.('已跳过本次，下一次已安排')
                    }}>跳过本次</Button>
                  </Paper>
                )}
              </Box>

            </Box>
            {infoError && <Alert severity="error" className="mt-3">{infoError}</Alert>}
          </Paper>

          {/* 标签 */}
          <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
            <SectionHeader title="标签" />
            <Box className="mt-4">
              <TagPicker compact tags={tags} selectedTagIds={tagIds} onChange={(next) => { setTagIds(next); setInfoDirty(true) }} onCreateTag={onCreateTag} />
            </Box>
          </Paper>

          {/* 任务类型 */}
          <Paper component="section" variant="outlined" className="p-6 max-md:p-5">
            <SectionHeader title="任务类型" />
            <Box className="mt-4">
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={displayedType}
                onChange={(_, nextType: TaskType | null) => nextType && setConfirmTypeChange(nextType === task.type ? null : nextType)}
                sx={{ '& .MuiToggleButton-root': { flex: 1, justifyContent: 'flex-start', gap: 1, px: 1.5, py: 1 } }}
              >
                <ToggleButton value="single"><CheckOutlined /><Box sx={{ display: 'grid', textAlign: 'left' }}><strong>普通任务</strong><Typography variant="caption">一次完成</Typography></Box></ToggleButton>
                <ToggleButton value="progress"><LayersOutlined /><Box sx={{ display: 'grid', textAlign: 'left' }}><strong>进度任务</strong><Typography variant="caption">多次累积</Typography></Box></ToggleButton>
              </ToggleButtonGroup>
              {task.type === 'progress' && (
                <TextField
                  className="mt-3"
                  fullWidth
                  label="目标次数"
                  type="number"
                  value={targetCount}
                  onChange={(event) => { setTargetCount(Number(event.target.value)); setInfoDirty(true) }}
                  slotProps={{ htmlInput: { min: 1, max: 99999 } }}
                />
              )}
            </Box>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          <Paper component="section" variant="outlined" className="flex items-center justify-between gap-4 border-danger-line p-6 max-md:flex-col max-md:items-stretch max-md:p-5">
            <SectionHeader title="删除任务" caption="任务及其全部变更记录将被永久删除。" />
            <Button className="shrink-0" color="error" variant="outlined" startIcon={<DeleteOutlineOutlined />} onClick={() => setConfirmDelete(true)}>删除</Button>
          </Paper>
        </Stack>

        {/* 变更记录 */}
        <Paper component="aside" variant="outlined" className="p-6 max-md:mt-4 max-md:p-5 lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-122px)] lg:overflow-auto">
          <SectionHeader title="变更记录" />
          <Box className="mt-4">
            {logsError ? <Alert severity="error">{logsError}</Alert> : logs.length === 0 ? <Typography variant="body2" color="text.secondary">还没有变更记录。</Typography> : (
              <Box component="ol" className="m-0 list-none p-0">
                {logs.map((log) => {
                  const instanceTaskId = typeof log.payload.instanceTaskId === 'string' ? log.payload.instanceTaskId : null
                  return (
                    <li key={log.id} className="relative grid grid-cols-[18px_1fr] gap-2 pb-5 not-last:after:absolute not-last:after:top-[13px] not-last:after:bottom-[3px] not-last:after:left-[5px] not-last:after:w-px not-last:after:bg-line not-last:after:content-['']">
                      <span className={`z-[1] mt-0.5 size-[11px] rounded-full border-[3px] ${log.type === 'progress' ? 'border-mint-soft bg-mint' : 'border-primary-soft bg-primary'}`} />
                      <div>
                        <strong className="block text-xs">{log.action}</strong>
                        <p className="mt-1 font-mono text-[10px] leading-[1.4] text-ink-2">{describeLog(log)}</p>
                        <time className="mt-[5px] block text-[9px] text-faint">{formatLogDate(log.createdAt)}</time>
                        {instanceTaskId && onOpenTask && (
                          <button
                            type="button"
                            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary-strong transition-colors hover:bg-[#e0dff7]"
                            onClick={() => onOpenTask(instanceTaskId)}
                          >
                            查看本次完成记录<ArrowForwardOutlined sx={{ fontSize: 11 }} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      <ConfirmDialog
        open={Boolean(confirmTypeChange)}
        title={confirmTypeChange === 'progress' ? '切换为进度任务？' : '切换为普通任务？'}
        description={confirmTypeChange === 'progress' ? '当前完成状态会清除，新进度从 0 开始。' : '当前进度将被丢弃；只有已到达目标时才会转为完成。'}
        onClose={() => setConfirmTypeChange(null)}
        onConfirm={() => void applyTypeChange()}
        confirmLabel="确认切换"
        confirmDisabled={saving}
      >
        {confirmTypeChange === 'progress' && <TextField fullWidth sx={{ mt: 2 }} label="目标次数" type="number" value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: 99999 } }} />}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="确认删除任务？"
        description={`“${task.title}”及其全部变更记录将被永久删除。`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await onDelete(); onNotify('任务已删除') }}
        confirmLabel="确认删除"
        confirmColor="error"
      />
    </Box>
  )
}
