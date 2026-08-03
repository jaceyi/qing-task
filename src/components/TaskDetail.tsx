import { useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Check,
  Clock3,
  Copy,
  History,
  Layers3,
  LoaderCircle,
  Minus,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react'
import { formatLogDate, normalizeDateTimeInput, validateTaskDateRange } from '../lib/date'
import { nextOccurrence, parseLocalDateTime } from '../lib/recurrence'
import { isTaskComplete } from '../lib/taskLogic'
import type { RecurrenceRule, Tag, Task, TaskInfoFields, TaskLog, TaskType } from '../types'
import { DateTimeInput } from './DateTimeInput'
import { RecurrenceEditor } from './RecurrenceEditor'
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
  onRecurrenceAdvanced?: (message: string) => void
  onDirtyChange?: (dirty: boolean) => void
  tags?: Tag[]
  onCreateTag?: (name: string) => Promise<Tag>
}

type AutoSaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error' | 'invalid'

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
  if ((typeof before === 'number' || typeof before === 'boolean') && typeof after === typeof before) {
    const value = (item: unknown) =>
      typeof item === 'boolean' ? (item ? '完成' : '未完成') : String(item)
    return `${value(before)} → ${value(after)}`
  }
  if (typeof log.payload.title === 'string') return log.payload.title
  if (typeof before === 'string' && typeof after === 'string') {
    const value = (item: string) => item || '无时间'
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
  onRecurrenceAdvanced,
  onDirtyChange,
  tags = [],
  onCreateTag = async () => { throw new Error('暂时无法创建标签') },
}: TaskDetailProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [startDate, setStartDate] = useState(() => normalizeDateTimeInput(task.startDate, 'start'))
  const [endDate, setEndDate] = useState(() => normalizeDateTimeInput(task.endDate, 'end'))
  const [targetCount, setTargetCount] = useState(task.targetCount || 5)
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(task.recurrence ?? null)
  const [tagIds, setTagIds] = useState(task.tagIds ?? [])
  const [recurrenceTimingScope, setRecurrenceTimingScope] = useState<'current' | 'future'>('current')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [infoError, setInfoError] = useState('')
  const [infoDirty, setInfoDirty] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle')
  const [autoSaveRevision, setAutoSaveRevision] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmTypeChange, setConfirmTypeChange] = useState<TaskType | null>(null)
  const onSaveRef = useRef(onSave)
  const latestInfoRef = useRef({ title, description, startDate, endDate, targetCount, recurrence, tagIds, recurrenceTimingScope })
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

  latestInfoRef.current = { title, description, startDate, endDate, targetCount, recurrence, tagIds, recurrenceTimingScope }
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
    const fields = { title, description, startDate, endDate, targetCount, recurrence, tagIds, recurrenceTimingScope }
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
  }, [autoSaveRevision, description, endDate, infoDirty, recurrence, recurrenceTimingScope, startDate, tagIds, targetCount, task.type, title])

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
      if (advancesRecurrence) {
        onRecurrenceAdvanced?.(task.type === 'progress' ? `本次 ${task.targetCount}/${task.targetCount} 已完成，下一次已从 0/${task.targetCount} 开始` : '已完成本次，下一次已安排')
        return
      }
      onNotify(
        task.type === 'single'
          ? direction > 0
            ? '任务已完成'
            : '已取消完成'
          : direction > 0
            ? `进度已更新  ${task.count} → ${task.count + 1}`
            : `进度已更新  ${task.count} → ${task.count - 1}`,
      )
    }
  }

  return (
    <section className="detail-view" aria-labelledby="detail-title">
      <header className="detail-header">
        <div>
          <span className="eyebrow">任务详情</span>
          <h1 id="detail-title">{task.title}</h1>
        </div>
        <button type="button" className="secondary-button compact" onClick={onCopy}>
          <Copy /> 复制
        </button>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <div className="section-title-row">
              <div><h2>基本信息</h2></div>
              <span className={`autosave-status is-${autoSaveState}`} role="status">
                {autoSaveState === 'saving' ? <LoaderCircle /> : autoSaveState === 'error' || autoSaveState === 'invalid' ? <CircleAlert /> : <CircleCheck />}
                {autoSaveState === 'idle'
                  ? '修改后自动保存'
                  : autoSaveState === 'waiting'
                    ? '等待自动保存'
                    : autoSaveState === 'saving'
                      ? '正在保存'
                      : autoSaveState === 'saved'
                        ? '已保存到本机'
                        : autoSaveState === 'invalid'
                          ? '需要修正'
                          : '保存失败'}
                {autoSaveState === 'error' && <button type="button" onClick={() => setAutoSaveRevision((value) => value + 1)}>重试</button>}
              </span>
            </div>
            <div className="detail-fields">
              <label className="field-group full-width">
                <span>任务名称</span>
                <input value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setInfoDirty(true) }} />
              </label>
              <label className="field-group full-width">
                <span>任务描述 <small>可选</small></span>
                <textarea
                  value={description}
                  maxLength={2000}
                  rows={4}
                  placeholder="补充任务背景、要求或完成标准"
                  onChange={(event) => { setDescription(event.target.value); setInfoDirty(true) }}
                />
              </label>
              <label className="field-group">
                <span>开始时间 <small>可选</small></span>
                <DateTimeInput
                  ariaLabel="开始时间"
                  value={startDate}
                  onChange={(value) => { setStartDate(value); setInfoDirty(true) }}
                />
              </label>
              <label className="field-group">
                <span>结束时间 <small>可选</small></span>
                <DateTimeInput
                  ariaLabel="结束时间"
                  value={endDate}
                  onChange={(value) => { setEndDate(value); setInfoDirty(true) }}
                />
              </label>
              <div className="date-fieldset-footer detail-date-footer full-width">
                <small>开始和结束时间都留空时，任务仅显示在“全部”看板。</small>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    className="text-button clear-time-button"
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                      setInfoDirty(true)
                    }}
                  >
                    清除时间
                  </button>
                )}
              </div>
              {task.recurrence && (startDate !== normalizeDateTimeInput(task.startDate, 'start') || endDate !== normalizeDateTimeInput(task.endDate, 'end')) && (
                <div className="recurrence-scope-control full-width" role="group" aria-label="时间修改范围">
                  <span>时间修改范围</span>
                  <div>
                    <button type="button" className={recurrenceTimingScope === 'current' ? 'is-active' : ''} onClick={() => setRecurrenceTimingScope('current')}>仅本次</button>
                    <button type="button" className={recurrenceTimingScope === 'future' ? 'is-active' : ''} onClick={() => setRecurrenceTimingScope('future')}>本次及以后</button>
                  </div>
                </div>
              )}
              {task.type === 'progress' && (
                <label className="field-group">
                  <span>目标次数</span>
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    value={targetCount}
                    onChange={(event) => { setTargetCount(Number(event.target.value)); setInfoDirty(true) }}
                  />
                </label>
              )}
            </div>
            {infoError && <p className="form-error info-error" role="alert">{infoError}</p>}
          </section>

          <section className="detail-section plan-section">
            <div className="section-title-row">
              <div><Repeat2 /><h2>计划与标签</h2></div>
            </div>
            <RecurrenceEditor
              compact
              value={recurrence}
              startDate={startDate}
              endDate={endDate}
              onChange={(next) => { setRecurrence(next); setInfoDirty(true) }}
            />
            <TagPicker
              compact
              tags={tags}
              selectedTagIds={tagIds}
              onChange={(next) => { setTagIds(next); setInfoDirty(true) }}
              onCreateTag={onCreateTag}
            />
            {task.recurrence && task.seriesState !== 'ended' && onSkipOccurrence && (
              <button
                type="button"
                className="secondary-button compact skip-occurrence-button"
                onClick={async () => {
                  if (await onSkipOccurrence()) onRecurrenceAdvanced?.('已跳过本次，下一次已安排')
                }}
              >跳过本次</button>
            )}
          </section>

          <section className="detail-section">
            <div className="section-title-row">
              <div><h2>任务类型</h2></div>
            </div>
            <div className="type-selector detail-type-selector">
              <button
                type="button"
                className={displayedType === 'single' ? 'is-active' : ''}
                onClick={() => setConfirmTypeChange(task.type === 'single' ? null : 'single')}
              >
                <Check />
                <span><strong>普通任务</strong><small>一次完成</small></span>
              </button>
              <button
                type="button"
                className={displayedType === 'progress' ? 'is-active' : ''}
                onClick={() => setConfirmTypeChange(task.type === 'progress' ? null : 'progress')}
              >
                <Layers3 />
                <span><strong>进度任务</strong><small>多次累积</small></span>
              </button>
            </div>

            {confirmTypeChange && (
              <div className={`inline-confirm ${confirmTypeChange === 'progress' ? 'has-target' : ''}`} role="alert">
                <div>
                  <strong>{confirmTypeChange === 'progress' ? '切换为进度任务？' : '切换为普通任务？'}</strong>
                  <p>
                    {confirmTypeChange === 'progress'
                      ? '当前完成状态会清除，新进度从 0 开始。'
                      : '当前进度将被丢弃；只有已到达目标时才会转为完成。'}
                  </p>
                </div>
                {confirmTypeChange === 'progress' && (
                  <label>
                    目标次数
                    <input
                      type="number"
                      min="1"
                      max="99999"
                      value={targetCount}
                      onChange={(event) => setTargetCount(Number(event.target.value))}
                    />
                  </label>
                )}
                <div className="confirm-actions">
                  <button type="button" className="text-button" onClick={() => setConfirmTypeChange(null)}>取消</button>
                  <button type="button" className="primary-button compact" onClick={() => void applyTypeChange()} disabled={saving}>确认切换</button>
                </div>
              </div>
            )}
          </section>

          <section className="detail-section">
            <div className="section-title-row">
              <div><h2>当前状态</h2></div>
            </div>
            {task.type === 'single' ? (
              <div className={`status-control single-status-control ${complete ? 'is-complete' : ''}`}>
                <span className="status-symbol">{complete ? <Check /> : <Clock3 />}</span>
                <div><strong>{complete ? '已完成' : '待完成'}</strong><p>状态随时可以回退。</p></div>
                <button type="button" className={complete ? 'secondary-button' : 'primary-button'} onClick={() => void updateStatus(complete ? -1 : 1)}>
                  {complete ? '取消完成' : '完成任务'}
                </button>
              </div>
            ) : (
              <div className="status-control progress-status-control">
                <button type="button" aria-label="进度减一" disabled={task.count <= 0} onClick={() => void updateStatus(-1)}><Minus /></button>
                <div className="progress-readout">
                  <span><strong>{task.count}</strong> / {task.targetCount}</span>
                  <div className="large-progress-track"><span style={{ width: `${(task.count / task.targetCount) * 100}%` }} /></div>
                  <small>{complete ? '已达成目标，可使用 −1 回退' : `还差 ${task.targetCount - task.count} 次`}</small>
                </div>
                <button type="button" aria-label="进度加一" disabled={task.count >= task.targetCount} onClick={() => void updateStatus(1)}><Plus /></button>
              </div>
            )}
          </section>

          {error && <p className="form-error" role="alert">{error}</p>}

          <section className="detail-section danger-section">
            <div>
              <h2>删除任务</h2>
              <p>任务及其全部变更记录将被永久删除。</p>
            </div>
            {confirmDelete ? (
              <div className="confirm-actions">
                <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>取消</button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={async () => {
                    await onDelete()
                    onNotify('任务已删除')
                  }}
                >确认删除</button>
              </div>
            ) : (
              <button type="button" className="danger-button subtle" onClick={() => setConfirmDelete(true)}><Trash2 /> 删除</button>
            )}
          </section>
        </div>

        <aside className="log-panel" aria-labelledby="log-title">
          <div className="section-title-row">
            <div><History /><h2 id="log-title">变更记录</h2></div>
          </div>
          {logsError ? (
            <p className="form-error">{logsError}</p>
          ) : logs.length === 0 ? (
            <p className="muted-copy">还没有变更记录。</p>
          ) : (
            <ol className="log-list">
              {logs.map((log) => (
                <li key={log.id}>
                  <span className={`log-dot ${log.type}`} />
                  <div><strong>{log.action}</strong><p>{describeLog(log)}</p><time>{formatLogDate(log.createdAt)}</time></div>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  )
}
