import { CalendarRange, Eye, Inbox, Layers3, Plus, SunMedium } from 'lucide-react'
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
}: TaskBoardProps) {
  const visibleTasks = filterAndSortTasks(tasks, scope, hideCompleted, searchTerm)
  const active = visibleTasks.filter((task) => !isTaskComplete(task))
  const completed = visibleTasks.filter(isTaskComplete)

  return (
    <section className="board-view" aria-labelledby="page-title">
      <div className="mobile-board-header">
        <h1 id="page-title">{scopeTitles[scope]}</h1>
      </div>

      <div className="scope-tabs" role="tablist" aria-label="任务时间范围">
        {scopes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scope === id}
            className={scope === id ? 'is-active' : ''}
            onClick={() => onScopeChange(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>

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
                <Eye aria-hidden="true" />
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
    </section>
  )
}
