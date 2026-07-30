import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Layers3, X } from 'lucide-react'
import { normalizeDateTimeInput, validateTaskDateRange } from '../lib/date'
import type { Task, TaskDraft, TaskType } from '../types'

interface TaskFormPanelProps {
  sourceTask?: Task | null
  draftStorageKey: string
  onClose: () => void
  onSubmit: (draft: TaskDraft, copiedFrom?: string) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

function makeInitialDraft(sourceTask?: Task | null): TaskDraft {
  if (!sourceTask) {
    return {
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      type: 'single',
      targetCount: 5,
      count: 0,
      completed: false,
    }
  }
  return {
    title: `${sourceTask.title}（副本）`,
    description: sourceTask.description,
    startDate: normalizeDateTimeInput(sourceTask.startDate, 'start'),
    endDate: normalizeDateTimeInput(sourceTask.endDate, 'end'),
    type: sourceTask.type,
    targetCount: sourceTask.type === 'progress' ? sourceTask.targetCount : 5,
    count: 0,
    completed: false,
  }
}

function readStoredDraft(storageKey: string, fallback: TaskDraft) {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<TaskDraft>
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.startDate !== 'string' ||
      typeof parsed.endDate !== 'string' ||
      (parsed.type !== 'single' && parsed.type !== 'progress') ||
      typeof parsed.targetCount !== 'number'
    ) return fallback
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export function TaskFormPanel({
  sourceTask,
  draftStorageKey,
  onClose,
  onSubmit,
  onDirtyChange,
}: TaskFormPanelProps) {
  const initialDraft = useMemo(() => makeInitialDraft(sourceTask), [sourceTask])
  const initialSignature = useMemo(() => JSON.stringify(initialDraft), [initialDraft])
  const [draft, setDraft] = useState(() => readStoredDraft(draftStorageKey, initialDraft))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const discardDialogRef = useRef<HTMLDivElement>(null)
  const discardCancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null,
  )
  const dirty = JSON.stringify(draft) !== initialSignature

  useEffect(() => {
    setDraft(readStoredDraft(draftStorageKey, initialDraft))
    setError('')
    setSaving(false)
    setConfirmDiscard(false)
  }, [draftStorageKey, initialDraft])

  useEffect(() => {
    if (dirty) localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    else localStorage.removeItem(draftStorageKey)
  }, [dirty, draft, draftStorageKey])

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmDiscard) setConfirmDiscard(false)
        else requestClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusRoot = confirmDiscard ? discardDialogRef.current : panelRef.current
      const focusable = Array.from(
        focusRoot?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [confirmDiscard, requestClose])

  useEffect(() => {
    if (confirmDiscard) discardCancelRef.current?.focus()
  }, [confirmDiscard])

  useEffect(() => () => {
    if (openerRef.current?.isConnected) openerRef.current.focus()
  }, [])

  useEffect(() => {
    const backdrop = panelRef.current?.parentElement
    const appRoot = backdrop?.parentElement
    if (!backdrop || !appRoot) return
    const siblings = Array.from(appRoot.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop,
    )
    const previous = siblings.map((element) => ({ element, inert: element.inert }))
    siblings.forEach((element) => { element.inert = true })
    return () => previous.forEach(({ element, inert }) => { element.inert = inert })
  }, [])

  const setType = (type: TaskType) => {
    setDraft((current) => ({ ...current, type }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      setError('请输入任务名称')
      return
    }
    const dateError = validateTaskDateRange(draft.startDate, draft.endDate)
    if (dateError) {
      setError(dateError)
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
      localStorage.removeItem(draftStorageKey)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建任务失败')
      setSaving(false)
    }
  }

  return (
    <div className="panel-backdrop" role="presentation" onPointerDown={requestClose}>
      <section
        ref={panelRef}
        className="task-form-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="panel-header">
          <button type="button" className="icon-button mobile-only" onClick={requestClose} aria-label="返回">
            <ArrowLeft />
          </button>
          <div>
            <span className="eyebrow">{sourceTask ? '复制任务' : '创建任务'}</span>
            <h2 id="task-form-title">{sourceTask ? '复制为新任务' : '新建任务'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="关闭">
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

          <label className="field-group">
            <span>任务描述 <small>可选</small></span>
            <textarea
              value={draft.description}
              maxLength={2000}
              rows={4}
              placeholder="补充任务背景、要求或完成标准"
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
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
            <legend><CalendarDays /> <span>时间范围 <small>可选</small></span></legend>
            <div className="date-grid">
              <label>
                <span>开始时间</span>
                <input
                  type="datetime-local"
                  step="60"
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                />
              </label>
              <label>
                <span>结束时间</span>
                <input
                  type="datetime-local"
                  step="60"
                  value={draft.endDate}
                  onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                />
              </label>
            </div>
            <div className="date-fieldset-footer">
              <small>留空时作为无时间任务，仅显示在“全部”看板。</small>
              {(draft.startDate || draft.endDate) && (
                <button
                  type="button"
                  className="text-button clear-time-button"
                  onClick={() => setDraft({ ...draft, startDate: '', endDate: '' })}
                >
                  清除时间
                </button>
              )}
            </div>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}

          <footer className="panel-actions">
            <button type="button" className="secondary-button" onClick={requestClose}>取消</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? '正在创建…' : sourceTask ? '创建副本' : '创建任务'}
            </button>
          </footer>
        </form>

        {confirmDiscard && (
          <div className="discard-backdrop" onPointerDown={() => setConfirmDiscard(false)}>
            <div
              ref={discardDialogRef}
              className="discard-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="discard-title"
              aria-describedby="discard-description"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <h3 id="discard-title">退出新建任务？</h3>
              <p id="discard-description">草稿已经保存在本机，你可以保留后退出，也可以彻底放弃。</p>
              <div className="confirm-actions">
                <button ref={discardCancelRef} type="button" className="text-button" onClick={() => setConfirmDiscard(false)}>继续编辑</button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    onDirtyChange?.(false)
                    onClose()
                  }}
                >保留并退出</button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    localStorage.removeItem(draftStorageKey)
                    onDirtyChange?.(false)
                    onClose()
                  }}
                >放弃草稿</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
