import { taskOverlapsScope } from './date'
import type { BoardScope, Task, TaskDraft, TaskType } from '../types'

export function isTaskComplete(task: Pick<Task, 'type' | 'completed' | 'count' | 'targetCount'>) {
  return task.type === 'single' ? task.completed : task.count === task.targetCount
}

export function filterAndSortTasks(
  tasks: Task[],
  scope: BoardScope,
  hideCompleted: boolean,
  searchTerm = '',
  reference = new Date(),
) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('zh-CN')
  return tasks
    .filter((task) => taskOverlapsScope(task, scope, reference))
    .filter((task) => !normalizedSearch || task.title.toLocaleLowerCase('zh-CN').includes(normalizedSearch))
    .filter((task) => !hideCompleted || !isTaskComplete(task))
    .sort((a, b) => {
      const completionDifference = Number(isTaskComplete(a)) - Number(isTaskComplete(b))
      if (completionDifference !== 0) return completionDifference
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    })
}

export function normalizeTaskDraft(draft: TaskDraft): TaskDraft {
  const title = draft.title.trim().slice(0, 120)
  if (draft.type === 'single') {
    return {
      ...draft,
      title,
      count: 0,
      targetCount: 0,
    }
  }

  const targetCount = Math.min(99_999, Math.max(1, Math.round(draft.targetCount || 1)))
  return {
    ...draft,
    title,
    targetCount,
    count: Math.min(targetCount, Math.max(0, Math.round(draft.count || 0))),
    completed: false,
  }
}

export function switchedTaskValues(task: Task, nextType: TaskType, targetCount = 1) {
  if (nextType === 'progress') {
    return {
      type: nextType,
      count: 0,
      targetCount: Math.min(99_999, Math.max(1, Math.round(targetCount))),
      completed: false,
    }
  }

  return {
    type: nextType,
    count: 0,
    targetCount: 0,
    completed: task.count === task.targetCount,
  }
}
