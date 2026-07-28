import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Layers3, X } from 'lucide-react'
import { toDateInput } from '../lib/date'
import type { Task, TaskDraft, TaskType } from '../types'

interface TaskFormPanelProps {
  sourceTask?: Task | null
  onClose: () => void
  onSubmit: (draft: TaskDraft, copiedFrom?: string) => Promise<void>
}

function makeInitialDraft(sourceTask?: Task | null): TaskDraft {
  const today = toDateInput()
  if (!sourceTask) {
    return {
      title: '',
      startDate: today,
      endDate: today,
      type: 'single',
      targetCount: 5,
      count: 0,
      completed: false,
    }
  }
  return {
    title: `${sourceTask.title}（副本）`,
    startDate: sourceTask.startDate,
    endDate: sourceTask.endDate,
    type: sourceTask.type,
    targetCount: sourceTask.type === 'progress' ? sourceTask.targetCount : 5,
    count: 0,
    completed: false,
  }
}

export function TaskFormPanel({ sourceTask, onClose, onSubmit }: TaskFormPanelProps) {
  const [draft, setDraft] = useState(() => makeInitialDraft(sourceTask))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(makeInitialDraft(sourceTask)), [sourceTask])

  const setType = (type: TaskType) => {
    setDraft((current) => ({ ...current, type }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      setError('请输入任务名称')
      return
    }
    if (draft.startDate > draft.endDate) {
      setError('结束日期不能早于开始日期')
      return
    }
    if (draft.type === 'progress' && draft.targetCount < 1) {
      setError('目标次数至少为 1')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit(draft, sourceTask?.title)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建任务失败')
      setSaving(false)
    }
  }

  return (
    <div className="panel-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="task-form-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="panel-header">
          <button type="button" className="icon-button mobile-only" onClick={onClose} aria-label="返回">
            <ArrowLeft />
          </button>
          <div>
            <span className="eyebrow">{sourceTask ? '复制任务' : '创建任务'}</span>
            <h2 id="task-form-title">{sourceTask ? '复制为新任务' : '新建任务'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="task-form">
          <label className="field-group">
            <span>任务名称</span>
            <input
              autoFocus
              value={draft.title}
              maxLength={120}
              placeholder="例如：完成项目方案"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <fieldset className="field-group">
            <legend>任务类型</legend>
            <div className="type-selector">
              <button
                type="button"
                className={draft.type === 'single' ? 'is-active' : ''}
                onClick={() => setType('single')}
              >
                <Check />
                <span><strong>普通任务</strong><small>一次完成</small></span>
              </button>
              <button
                type="button"
                className={draft.type === 'progress' ? 'is-active' : ''}
                onClick={() => setType('progress')}
              >
                <Layers3 />
                <span><strong>进度任务</strong><small>多次累积</small></span>
              </button>
            </div>
          </fieldset>

          {draft.type === 'progress' && (
            <label className="field-group compact-number-field">
              <span>目标次数</span>
              <input
                type="number"
                min="1"
                max="99999"
                inputMode="numeric"
                value={draft.targetCount}
                onChange={(event) => setDraft({ ...draft, targetCount: Number(event.target.value) })}
              />
              <small>新任务的进度从 0 开始。</small>
            </label>
          )}

          <fieldset className="field-group date-fieldset">
            <legend><CalendarDays /> 时间范围</legend>
            <div className="date-grid">
              <label>
                <span>开始日期</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                />
              </label>
              <label>
                <span>结束日期</span>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                />
              </label>
            </div>
            <small>时间只影响任务出现在哪个看板，不限制操作。</small>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}

          <footer className="panel-actions">
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? '正在创建…' : sourceTask ? '创建副本' : '创建任务'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
