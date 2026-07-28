import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  History,
  Layers3,
  Minus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { formatLogDate } from '../lib/date'
import { isTaskComplete } from '../lib/taskLogic'
import type { Task, TaskLog, TaskType } from '../types'

interface TaskDetailProps {
  task: Task
  logs: TaskLog[]
  logsError: string
  onBack: () => void
  onCopy: () => void
  onSave: (
    fields: Pick<Task, 'title' | 'startDate' | 'endDate' | 'targetCount'>,
  ) => Promise<void>
  onChangeType: (nextType: TaskType, targetCount?: number) => Promise<void>
  onSetCompleted: (completed: boolean) => Promise<boolean>
  onAdjust: (delta: -1 | 1) => Promise<boolean>
  onDelete: () => Promise<void>
  onNotify: (message: string) => void
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
  if (typeof before === 'string' && typeof after === 'string') return `${before} → ${after}`
  return ''
}

export function TaskDetail({
  task,
  logs,
  logsError,
  onBack,
  onCopy,
  onSave,
  onChangeType,
  onSetCompleted,
  onAdjust,
  onDelete,
  onNotify,
}: TaskDetailProps) {
  const [title, setTitle] = useState(task.title)
  const [startDate, setStartDate] = useState(task.startDate)
  const [endDate, setEndDate] = useState(task.endDate)
  const [targetCount, setTargetCount] = useState(task.targetCount || 5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmTypeChange, setConfirmTypeChange] = useState<TaskType | null>(null)
  const complete = isTaskComplete(task)

  useEffect(() => {
    setTitle(task.title)
    setStartDate(task.startDate)
    setEndDate(task.endDate)
    setTargetCount(task.targetCount || 5)
  }, [task])

  const saveInfo = async () => {
    if (!title.trim()) return setError('任务名称不能为空')
    if (startDate > endDate) return setError('结束日期不能早于开始日期')
    if (task.type === 'progress' && targetCount < 1) return setError('目标次数至少为 1')
    setSaving(true)
    setError('')
    try {
      await onSave({ title, startDate, endDate, targetCount })
      onNotify('任务信息已保存')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

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
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft /> 返回
        </button>
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
              <div><span>01</span><h2>基本信息</h2></div>
              <button type="button" className="text-button" onClick={() => void saveInfo()} disabled={saving}>
                <Save /> {saving ? '保存中…' : '保存更改'}
              </button>
            </div>
            <div className="detail-fields">
              <label className="field-group full-width">
                <span>任务名称</span>
                <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="field-group">
                <span>开始日期</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="field-group">
                <span>结束日期</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              {task.type === 'progress' && (
                <label className="field-group">
                  <span>目标次数</span>
                  <input
                    type="number"
                    min="1"
                    max="99999"
                    value={targetCount}
                    onChange={(event) => setTargetCount(Number(event.target.value))}
                  />
                </label>
              )}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-title-row">
              <div><span>02</span><h2>任务类型</h2></div>
            </div>
            <div className="type-selector detail-type-selector">
              <button
                type="button"
                className={task.type === 'single' ? 'is-active' : ''}
                onClick={() => task.type !== 'single' && setConfirmTypeChange('single')}
              >
                <Check />
                <span><strong>普通任务</strong><small>一次完成</small></span>
              </button>
              <button
                type="button"
                className={task.type === 'progress' ? 'is-active' : ''}
                onClick={() => task.type !== 'progress' && setConfirmTypeChange('progress')}
              >
                <Layers3 />
                <span><strong>进度任务</strong><small>多次累积</small></span>
              </button>
            </div>

            {confirmTypeChange && (
              <div className="inline-confirm" role="alert">
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
              <div><span>03</span><h2>当前状态</h2></div>
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
