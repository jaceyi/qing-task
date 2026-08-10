import { taskOverlapsScope } from './date'
import { syncRecurrenceTiming } from './recurrence'
import { dedupeTagIds, taskMatchesTags } from './tagLogic'
import type { CustomDateRange, Tag, TagMatchMode, Task, TaskDraft, TaskInfoFields, TaskType, TimeFilterScope } from '../types'

export function isTaskComplete(task: Pick<Task, 'type' | 'completed' | 'count' | 'targetCount'>) {
  return task.type === 'single' ? task.completed : task.count === task.targetCount
}

export function completedOccurrenceTaskId(taskId: string, key: string) {
  return `completed-${taskId}-${key}`
}

export function completedOccurrenceSnapshot(task: Task, completedAt = new Date()): Task {
  const occurrenceKey = task.currentOccurrenceKey ?? task.startDate.replace(/[^0-9]/g, '')
  return {
    ...task,
    id: completedOccurrenceTaskId(task.id, occurrenceKey),
    count: task.type === 'progress' ? task.targetCount : 0,
    completed: task.type === 'single',
    recurrence: null,
    seriesState: null,
    currentOccurrenceKey: null,
    occurrenceSequence: 0,
    lastAdvanceMutationId: null,
    // 实例任务是纯展示产物：自身不存日志，历史通过 parentTaskId + occurrenceKey 回系列日志流查询
    parentTaskId: task.id,
    occurrenceKey,
    createdAt: completedAt,
    updatedAt: completedAt,
  }
}

export function filterAndSortTasks(
  tasks: Task[],
  scope: TimeFilterScope,
  hideCompleted: boolean,
  searchTerm = '',
  reference = new Date(),
  options: {
    tags?: Tag[]
    selectedTagIds?: string[]
    matchMode?: TagMatchMode
    customRange?: CustomDateRange
  } = {},
) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('zh-CN')
  const tagNames = new Map((options.tags ?? []).map((tag) => [tag.id, tag.name.toLocaleLowerCase('zh-CN')]))
  return tasks
    .filter((task) => taskOverlapsScope(task, scope, reference, options.customRange))
    .filter((task) => taskMatchesTags(task.tagIds, options.selectedTagIds ?? [], options.matchMode ?? 'all'))
    .filter(
      (task) =>
        !normalizedSearch ||
        task.title.toLocaleLowerCase('zh-CN').includes(normalizedSearch) ||
        task.description.toLocaleLowerCase('zh-CN').includes(normalizedSearch) ||
        (task.tagIds ?? []).some((tagId) => tagNames.get(tagId)?.includes(normalizedSearch)),
    )
    .filter((task) => !hideCompleted || !isTaskComplete(task))
    .sort((a, b) => {
      const completionDifference = Number(isTaskComplete(a)) - Number(isTaskComplete(b))
      if (completionDifference !== 0) return completionDifference
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    })
}

export function normalizeTaskDraft(draft: TaskDraft): TaskDraft {
  const title = draft.title.trim().slice(0, 120)
  const description = draft.description.trim().slice(0, 2000)
  const tagIds = dedupeTagIds(draft.tagIds)
  const recurrence = syncRecurrenceTiming(draft.recurrence, draft.startDate, draft.endDate)
  if (draft.type === 'single') {
    return {
      ...draft,
      title,
      description,
      tagIds,
      recurrence,
      count: 0,
      targetCount: 0,
    }
  }

  const targetCount = Math.min(99_999, Math.max(1, Math.round(draft.targetCount || 1)))
  return {
    ...draft,
    title,
    description,
    tagIds,
    recurrence,
    targetCount,
    count: Math.min(targetCount, Math.max(0, Math.round(draft.count || 0))),
    completed: false,
  }
}

export function updatedTaskInfo(task: Task, fields: TaskInfoFields) {
  const targetCount =
    task.type === 'progress'
      ? Math.min(99_999, Math.max(1, Math.round(fields.targetCount || 1)))
      : 0

  const next = {
    title: fields.title.trim().slice(0, 120),
    description: fields.description.trim().slice(0, 2000),
    startDate: fields.startDate,
    endDate: fields.endDate,
    targetCount,
    count: task.type === 'progress' ? Math.min(task.count, targetCount) : 0,
  }
  return {
    ...next,
    ...(fields.tagIds !== undefined || task.tagIds !== undefined
      ? { tagIds: dedupeTagIds(fields.tagIds ?? task.tagIds) }
      : {}),
    ...(fields.recurrence !== undefined || task.recurrence !== undefined
      ? {
          recurrence:
            task.startDate !== fields.startDate
            || task.endDate !== fields.endDate
            || JSON.stringify(task.recurrence ?? null) !== JSON.stringify(fields.recurrence ?? null)
              ? fields.recurrenceTimingScope === 'current'
                && JSON.stringify(task.recurrence ?? null) === JSON.stringify(fields.recurrence ?? null)
                  ? task.recurrence ?? null
                  : syncRecurrenceTiming(fields.recurrence, fields.startDate, fields.endDate)
              : task.recurrence ?? null,
        }
      : {}),
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
