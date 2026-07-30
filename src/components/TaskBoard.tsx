import { CalendarRange, Inbox, Layers3, MoveHorizontal, Plus, SunMedium, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { filterAndSortTasks, isTaskComplete } from '../lib/taskLogic'
import type { BoardScope, Task } from '../types'
import { TaskRow } from './TaskRow'

interface TaskBoardProps {
  tasks: Task[]
  scope: BoardScope
  hideCompleted: boolean
  searchTerm: string
  loading: boolean
  onScopeChange: (scope: BoardScope) => void
  onOpenTask: (task: Task) => void
  onTaskAction: (task: Task, direction: 'positive' | 'negative') => Promise<boolean>
  onCreate: () => void
  onNotify: (message: string) => void
  showSwipeHint?: boolean
  onDismissSwipeHint?: () => void
}

const scopes: Array<{ id: BoardScope; label: string; icon: typeof Layers3 }> = [
  { id: 'all', label: '全部', icon: Layers3 },
  { id: 'today', label: '今天', icon: SunMedium },
  { id: 'week', label: '本周', icon: CalendarRange },
]

const scopeTitles: Record<BoardScope, string> = {
  today: '今日任务',
  week: '本周任务',
  all: '全部任务',
}

export function TaskBoard({
  tasks,
  scope,
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
}: TaskBoardProps) {
  const visibleTasks = filterAndSortTasks(tasks, scope, hideCompleted, searchTerm)
  const active = visibleTasks.filter((task) => !isTaskComplete(task))
  const completed = visibleTasks.filter(isTaskComplete)

  const handleScopeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentScope: BoardScope) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = scopes.findIndex(({ id }) => id === currentScope)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? scopes.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + scopes.length) % scopes.length
    const nextScope = scopes[nextIndex].id
    onScopeChange(nextScope)
    document.getElementById(`scope-tab-${nextScope}`)?.focus()
  }

  return (
    <section className="board-view" aria-labelledby="page-title">
      <div className="mobile-board-header">
        <h1 id="page-title">{scopeTitles[scope]}</h1>
      </div>

      <div className="scope-tabs" role="tablist" aria-label="任务时间范围">
        {scopes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`scope-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={scope === id}
            aria-controls="task-scope-panel"
            tabIndex={scope === id ? 0 : -1}
            className={scope === id ? 'is-active' : ''}
            onClick={() => onScopeChange(id)}
            onKeyDown={(event) => handleScopeKeyDown(event, id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

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
