import { CalendarDays, CalendarRange, Inbox, Layers3, MoveHorizontal, Plus, SunMedium, Tags, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { toDateInput } from '../lib/date'
import { filterAndSortTasks, isTaskComplete } from '../lib/taskLogic'
import type { BoardScope, CustomDateRange, Tag, TagMatchMode, Task, TimeFilterScope } from '../types'
import { TaskRow } from './TaskRow'

interface TaskBoardProps {
  tasks: Task[]
  scope: TimeFilterScope
  customRange?: CustomDateRange
  boardKind?: 'time' | 'tag'
  hideCompleted: boolean
  searchTerm: string
  loading: boolean
  onScopeChange: (scope: TimeFilterScope, customRange?: CustomDateRange) => void
  onOpenTask: (task: Task) => void
  onTaskAction: (task: Task, direction: 'positive' | 'negative') => Promise<boolean>
  onCreate: () => void
  onNotify: (message: string) => void
  showSwipeHint?: boolean
  onDismissSwipeHint?: () => void
  tags?: Tag[]
  selectedTagIds?: string[]
  tagMatchMode?: TagMatchMode
  onTagFilterChange?: (tagIds: string[], matchMode: TagMatchMode) => void
  onRecurrenceAdvanced?: (message: string) => void
  title?: string
}

const scopes: Array<{ id: BoardScope; label: string; icon: typeof Layers3 }> = [
  { id: 'all', label: '全部', icon: Layers3 },
  { id: 'today', label: '今天', icon: SunMedium },
  { id: 'week', label: '本周', icon: CalendarRange },
]

const customScope = { id: 'custom' as const, label: '自定义', icon: CalendarDays }

const scopeTitles: Record<TimeFilterScope, string> = {
  today: '今日任务',
  week: '本周任务',
  all: '全部任务',
  custom: '自定义时间任务',
}

export function TaskBoard({
  tasks,
  scope,
  customRange,
  boardKind = 'time',
  hideCompleted,
  searchTerm,
  loading,
  onScopeChange,
  onOpenTask,
  onTaskAction,
  onCreate,
  onNotify,
  showSwipeHint = false,
  onDismissSwipeHint,
  tags = [],
  selectedTagIds = [],
  tagMatchMode = 'all',
  onTagFilterChange,
  onRecurrenceAdvanced,
  title,
}: TaskBoardProps) {
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState<CustomDateRange>(() => customRange ?? {
    startDate: toDateInput(),
    endDate: toDateInput(),
  })
  const availableScopes = useMemo(
    () => boardKind === 'tag' ? [...scopes, customScope] : scopes,
    [boardKind],
  )
  const visibleTasks = filterAndSortTasks(tasks, scope, hideCompleted, searchTerm, new Date(), {
    tags,
    selectedTagIds,
    matchMode: tagMatchMode,
    customRange,
  })
  const active = visibleTasks.filter((task) => !isTaskComplete(task))
  const completed = visibleTasks.filter(isTaskComplete)
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))
  const customRangeError = customDraft.startDate && customDraft.endDate && customDraft.startDate > customDraft.endDate
    ? '结束日期不能早于开始日期'
    : ''

  useEffect(() => {
    if (customRange) setCustomDraft(customRange)
  }, [customRange])

  const selectScope = (nextScope: TimeFilterScope) => {
    if (nextScope === 'custom') {
      const nextRange = customRange ?? customDraft
      setCustomDraft(nextRange)
      onScopeChange(nextScope, nextRange)
      return
    }
    onScopeChange(nextScope)
  }

  const applyCustomRange = (event: FormEvent) => {
    event.preventDefault()
    if (!customDraft.startDate || !customDraft.endDate || customRangeError) return
    onScopeChange('custom', customDraft)
  }

  const handleScopeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentScope: TimeFilterScope) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = availableScopes.findIndex(({ id }) => id === currentScope)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? availableScopes.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + availableScopes.length) % availableScopes.length
    const nextScope = availableScopes[nextIndex].id
    selectScope(nextScope)
    document.getElementById(`scope-tab-${nextScope}`)?.focus()
  }

  return (
    <section className="board-view" aria-labelledby="page-title">
      <div className="mobile-board-header">
        <h1 id="page-title">{title ?? scopeTitles[scope]}</h1>
      </div>

      <div className={`scope-tabs ${boardKind === 'tag' ? 'is-tag-time-filter' : ''}`} role="tablist" aria-label="任务时间范围">
        {availableScopes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`scope-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={scope === id}
            aria-controls="task-scope-panel"
            tabIndex={scope === id ? 0 : -1}
            className={scope === id ? 'is-active' : ''}
            onClick={() => selectScope(id)}
            onKeyDown={(event) => handleScopeKeyDown(event, id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

      {boardKind === 'tag' && scope === 'custom' && (
        <form className="custom-time-filter" onSubmit={applyCustomRange}>
          <span>时间范围</span>
          <label>
            <span>开始</span>
            <input type="date" value={customDraft.startDate} onChange={(event) => setCustomDraft((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <i>至</i>
          <label>
            <span>结束</span>
            <input type="date" value={customDraft.endDate} onChange={(event) => setCustomDraft((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
          <button type="submit" disabled={!customDraft.startDate || !customDraft.endDate || Boolean(customRangeError)}>应用</button>
          {customRangeError && <small role="alert">{customRangeError}</small>}
        </form>
      )}

      {boardKind === 'time' && tags.length > 0 && (
        <div className={`board-tag-filter ${tagFilterOpen ? 'is-open' : ''}`}>
          <button type="button" className="tag-filter-trigger" aria-expanded={tagFilterOpen} onClick={() => setTagFilterOpen((open) => !open)}>
            <Tags />
            <span>{selectedTags.length ? selectedTags.map((tag) => tag.name).join(' + ') : '按标签筛选'}</span>
            {selectedTagIds.length > 0 && <strong>{selectedTagIds.length}</strong>}
          </button>
          {selectedTagIds.length > 1 && (
            <div className="tag-match-toggle" aria-label="标签匹配方式">
              <button type="button" className={tagMatchMode === 'all' ? 'is-active' : ''} onClick={() => onTagFilterChange?.(selectedTagIds, 'all')}>匹配全部</button>
              <button type="button" className={tagMatchMode === 'any' ? 'is-active' : ''} onClick={() => onTagFilterChange?.(selectedTagIds, 'any')}>匹配任一</button>
            </div>
          )}
          {selectedTagIds.length > 0 && <button type="button" className="clear-tag-filter" onClick={() => onTagFilterChange?.([], 'all')}><X />清除</button>}
          {tagFilterOpen && (
            <div className="tag-filter-panel">
              {tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id)
                return <button key={tag.id} type="button" aria-pressed={selected} className={selected ? 'is-active' : ''} onClick={() => onTagFilterChange?.(selected ? selectedTagIds.filter((id) => id !== tag.id) : [...selectedTagIds, tag.id], tagMatchMode)}><i className={`tag-color is-${tag.color}`} />{tag.name}</button>
              })}
            </div>
          )}
        </div>
      )}

      {showSwipeHint && (
        <div className="mobile-swipe-hint" role="note">
          <MoveHorizontal />
          <span><strong>左右滑动任务</strong><small>快速完成、推进或回退</small></span>
          <button type="button" aria-label="知道了" onClick={onDismissSwipeHint}><X /></button>
        </div>
      )}

      <div
        id="task-scope-panel"
        role="tabpanel"
        aria-labelledby={`scope-tab-${scope}`}
        tabIndex={0}
      >
        {loading ? (
          <div className="task-skeleton" aria-label="正在加载任务">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><Inbox /></span>
            <h2>{searchTerm ? '没有匹配的任务' : '这里还没有任务'}</h2>
            <p>
              {searchTerm
                ? '换个关键词再试试。'
                : scope === 'all'
                  ? '创建一个任务，时间可以稍后再安排。'
                  : '暂时没有落在这个时间范围内的任务。'}
            </p>
            {!searchTerm && (
              <button type="button" className="primary-button" onClick={onCreate}>
                <Plus />
                新建任务
              </button>
            )}
          </div>
        ) : (
          <div className="task-list" data-testid="task-list">
          {active.length > 0 && (
            <div className="task-group">
              <div className="task-group-heading">
                <span>进行中</span>
                <strong>{active.length}</strong>
              </div>
              {active.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task)}
                  onAction={(direction) => onTaskAction(task, direction)}
                  onNotify={onNotify}
                  onRecurrenceAdvanced={onRecurrenceAdvanced}
                  tags={tags}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="task-group completed-group">
              <div className="task-group-heading">
                <span>已完成</span>
                <strong>{completed.length}</strong>
              </div>
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task)}
                  onAction={(direction) => onTaskAction(task, direction)}
                  onNotify={onNotify}
                  onRecurrenceAdvanced={onRecurrenceAdvanced}
                  tags={tags}
                />
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </section>
  )
}
