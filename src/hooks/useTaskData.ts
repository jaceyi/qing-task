import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentReference } from 'firebase/firestore'
import { demoTags, demoTasks } from '../data/demo'
import { nextOccurrence, occurrenceKey } from '../lib/recurrence'
import { cleanTagName, normalizeTagName, sortTags } from '../lib/tagLogic'
import {
  completedOccurrenceSnapshot,
  completedOccurrenceTaskId,
  normalizeTaskDraft,
  switchedTaskValues,
  updatedTaskInfo,
} from '../lib/taskLogic'
import {
  adjustTaskProgress,
  changeTaskType,
  createTag as createRemoteTag,
  createTask as createRemoteTask,
  deleteTag as deleteRemoteTag,
  deleteTask as deleteRemoteTask,
  eraseTaskAction,
  mergeTags as mergeRemoteTags,
  resetTaskProgress,
  savePreferences,
  setSingleCompletion,
  skipRecurringOccurrence,
  subscribeOccurrenceLogs,
  subscribePreferences,
  subscribeTags,
  subscribeTaskLogs,
  subscribeTasks,
  updateTag as updateRemoteTag,
  updateTaskInfo,
} from '../lib/taskService'
import type {
  SyncState,
  Tag,
  TagColor,
  Task,
  TaskDraft,
  TaskInfoFields,
  TaskLog,
  TaskType,
  UserPreferences,
} from '../types'

const initialSyncState: SyncState = { fromCache: false, pendingWrites: false }

export function useTaskDataStore(userId: string | null, demoMode: boolean) {
  const [tasks, setTasks] = useState<Task[]>(demoMode ? demoTasks : [])
  const [tags, setTags] = useState<Tag[]>(demoMode ? demoTags : [])
  const [preferences, setPreferencesState] = useState<UserPreferences>({ hideCompleted: false })
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [remoteSyncState, setRemoteSyncState] = useState<SyncState>(initialSyncState)
  const [pendingOperations, setPendingOperations] = useState(0)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const tasksRef = useRef(tasks)
  const tagsRef = useRef(tags)
  const lastStatusActionRef = useRef<{
    previous: Task
    kind: 'single' | 'progress' | 'recurrence-completed' | 'recurrence-skipped'
    expiresAt: number
    /** 被撤销操作写入的日志引用；撤销时精确擦除，不另写“撤销”日志。 */
    logRefs?: DocumentReference[]
  } | null>(null)

  const replaceTasks = useCallback((next: Task[] | ((current: Task[]) => Task[])) => {
    const resolved = typeof next === 'function' ? next(tasksRef.current) : next
    tasksRef.current = resolved
    setTasks(resolved)
  }, [])

  const replaceTags = useCallback((next: Tag[] | ((current: Tag[]) => Tag[])) => {
    const resolved = typeof next === 'function' ? next(tagsRef.current) : next
    tagsRef.current = sortTags(resolved)
    setTags(tagsRef.current)
  }, [])

  const monitorCommit = useCallback((committed: Promise<void>, action: string) => {
    setError('')
    setPendingOperations((count) => count + 1)
    void committed
      .catch((reason) => {
        const detail = reason instanceof Error ? `：${reason.message}` : ''
        setError(`${action}未能同步，已恢复为云端状态${detail}`)
      })
      .finally(() => setPendingOperations((count) => Math.max(0, count - 1)))
  }, [])

  useEffect(() => {
    if (demoMode) {
      replaceTasks(demoTasks)
      replaceTags(demoTags)
      setLoadedUserId(null)
      setLoading(false)
      return
    }
    if (!userId) {
      replaceTasks([])
      replaceTags([])
      setLoadedUserId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadedUserId(null)
    const unsubscribeTasks = subscribeTasks(
      userId,
      (nextTasks, nextSyncState) => {
        replaceTasks(nextTasks)
        setRemoteSyncState(nextSyncState)
        setLoadedUserId(userId)
        setLoading(false)
      },
      (reason) => {
        setError(reason.message)
        setLoading(false)
      },
    )
    const unsubscribePreferences = subscribePreferences(userId, setPreferencesState)
    const unsubscribeTags = subscribeTags(userId, replaceTags, (reason) => setError(reason.message))
    return () => {
      unsubscribeTasks()
      unsubscribePreferences()
      unsubscribeTags()
    }
  }, [demoMode, replaceTags, replaceTasks, userId])

  const createTask = useCallback(
    async (draft: TaskDraft, copiedFrom?: string) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const normalized = normalizeTaskDraft(draft)
      const mutation = demoMode ? null : createRemoteTask(userId!, normalized, copiedFrom)
      const id = mutation?.result ?? `demo-${crypto.randomUUID()}`
      const now = new Date()
      replaceTasks((current) => [
        {
          ...normalized,
          id,
          schemaVersion: 2,
          tagIds: normalized.tagIds ?? [],
          recurrence: normalized.recurrence ?? null,
          seriesState: normalized.recurrence ? 'active' : null,
          currentOccurrenceKey: normalized.recurrence ? occurrenceKey(normalized.startDate) : null,
          occurrenceSequence: normalized.recurrence ? 1 : 0,
          lastAdvanceMutationId: null,
          createdAt: now,
          updatedAt: now,
        },
        ...current.filter((task) => task.id !== id),
      ])
      if (mutation) monitorCommit(mutation.committed, '创建任务')
      return id
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const updateTask = useCallback(
    async (taskId: string, fields: TaskInfoFields) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const current = tasksRef.current.find((task) => task.id === taskId)
      if (!current) throw new Error('任务不存在')
      const next = updatedTaskInfo(current, fields)
      const recurrenceChanged = JSON.stringify(current.recurrence ?? null) !== JSON.stringify(next.recurrence ?? null)
      const mutation = demoMode ? null : updateTaskInfo(userId!, current, fields)
      if (mutation && !mutation.result) return
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...next,
                ...(recurrenceChanged
                  ? {
                      seriesState: next.recurrence ? 'active' as const : null,
                      currentOccurrenceKey: next.recurrence ? occurrenceKey(next.startDate) : null,
                      occurrenceSequence: next.recurrence ? Math.max(1, task.occurrenceSequence ?? 1) : 0,
                    }
                  : {}),
                updatedAt: new Date(),
              }
            : task,
        ),
      )
      if (mutation) monitorCommit(mutation.committed, '保存任务')
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const changeType = useCallback(
    async (taskId: string, nextType: TaskType, targetCount = 1) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const current = tasksRef.current.find((task) => task.id === taskId)
      if (!current) throw new Error('任务不存在')
      const mutation = demoMode ? null : changeTaskType(userId!, current, nextType, targetCount)
      if (mutation && !mutation.result) return
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, ...switchedTaskValues(task, nextType, targetCount), updatedAt: new Date() }
            : task,
        ),
      )
      if (mutation) monitorCommit(mutation.committed, '切换任务类型')
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const setCompleted = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const current = tasksRef.current.find((task) => task.id === taskId)
      if (!current || current.type !== 'single' || current.completed === completed) return false
      const mutation = demoMode ? null : setSingleCompletion(userId!, current, completed)
      if (completed && current.recurrence && current.seriesState !== 'ended') {
        const completedAt = new Date()
        const next = nextOccurrence(current, completedAt)
        lastStatusActionRef.current = { previous: { ...current }, kind: 'recurrence-completed', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
        replaceTasks((tasks) => tasks.flatMap((task) => {
          if (task.id !== taskId) return task
          const completedSnapshot = completedOccurrenceSnapshot(task, completedAt)
          if (!next) return { ...completedSnapshot, id: task.id }
          return [
            {
              ...task,
              ...next,
              count: 0,
              completed: false,
              seriesState: 'active',
              currentOccurrenceKey: occurrenceKey(next.startDate),
              occurrenceSequence: (task.occurrenceSequence ?? 1) + 1,
              updatedAt: completedAt,
            },
            completedSnapshot,
          ]
        }))
      } else {
        lastStatusActionRef.current = { previous: { ...current }, kind: 'single', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
        replaceTasks((tasks) =>
          tasks.map((task) =>
            task.id === taskId ? { ...task, completed, ...(task.recurrence && !completed ? { seriesState: 'active' as const } : {}), updatedAt: new Date() } : task,
          ),
        )
      }
      if (mutation) monitorCommit(mutation.committed, completed ? '完成任务' : '取消完成')
      return true
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const adjustProgress = useCallback(
    async (taskId: string, delta: -1 | 1) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const current = tasksRef.current.find((task) => task.id === taskId)
      if (!current || current.type !== 'progress') return false
      const count = Math.max(0, Math.min(current.targetCount, current.count + delta))
      if (count === current.count) return false
      const mutation = demoMode ? null : adjustTaskProgress(userId!, current, delta)
      if (delta > 0 && count === current.targetCount && current.recurrence && current.seriesState !== 'ended') {
        const completedAt = new Date()
        const next = nextOccurrence(current, completedAt)
        lastStatusActionRef.current = { previous: { ...current }, kind: 'recurrence-completed', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
        replaceTasks((tasks) => tasks.flatMap((task) => {
          if (task.id !== taskId) return task
          const completedSnapshot = completedOccurrenceSnapshot(task, completedAt)
          if (!next) return { ...completedSnapshot, id: task.id }
          return [
            {
              ...task,
              ...next,
              count: 0,
              completed: false,
              seriesState: 'active',
              currentOccurrenceKey: occurrenceKey(next.startDate),
              occurrenceSequence: (task.occurrenceSequence ?? 1) + 1,
              updatedAt: completedAt,
            },
            completedSnapshot,
          ]
        }))
      } else {
        lastStatusActionRef.current = { previous: { ...current }, kind: 'progress', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
        replaceTasks((tasks) =>
          tasks.map((task) =>
            task.id === taskId ? { ...task, count, updatedAt: new Date() } : task,
          ),
        )
      }
      if (mutation) monitorCommit(mutation.committed, delta > 0 ? '推进任务' : '回退进度')
      return true
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  /** 一键将进度清零；会写入可撤销的状态动作，防误触。 */
  const resetProgress = useCallback(
    async (taskId: string) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const current = tasksRef.current.find((task) => task.id === taskId)
      if (!current || current.type !== 'progress' || current.count <= 0) return false
      const mutation = demoMode ? null : resetTaskProgress(userId!, current)
      lastStatusActionRef.current = { previous: { ...current }, kind: 'progress', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, count: 0, updatedAt: new Date() } : task,
        ),
      )
      if (mutation) monitorCommit(mutation.committed, '重置进度')
      return true
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const skipOccurrence = useCallback(async (taskId: string) => {
    if (!demoMode && !userId) throw new Error('请先登录')
    const current = tasksRef.current.find((task) => task.id === taskId)
    if (!current?.recurrence || current.seriesState === 'ended') return false
    const mutation = demoMode ? null : skipRecurringOccurrence(userId!, current)
    const next = nextOccurrence(current, new Date())
    lastStatusActionRef.current = { previous: { ...current }, kind: 'recurrence-skipped', expiresAt: Date.now() + 10_000, logRefs: mutation?.logRefs }
    replaceTasks((tasks) => tasks.map((task) => task.id === taskId
      ? next
        ? {
            ...task,
            ...next,
            count: 0,
            completed: false,
            currentOccurrenceKey: occurrenceKey(next.startDate),
            occurrenceSequence: (task.occurrenceSequence ?? 1) + 1,
            updatedAt: new Date(),
          }
        : { ...task, seriesState: 'ended', updatedAt: new Date() }
      : task))
    if (mutation) monitorCommit(mutation.committed, '跳过本次任务')
    return true
  }, [demoMode, monitorCommit, replaceTasks, userId])

  const undoLastTaskAction = useCallback(async () => {
    const action = lastStatusActionRef.current
    if (!action || action.expiresAt < Date.now()) return false
    const current = tasksRef.current.find((task) => task.id === action.previous.id)
    if (!current) return false
    const sameStaticFields = current.title === action.previous.title
      && current.description === action.previous.description
      && current.type === action.previous.type
      && current.targetCount === action.previous.targetCount
      && JSON.stringify(current.tagIds ?? []) === JSON.stringify(action.previous.tagIds ?? [])

    if (action.kind === 'single' || action.kind === 'progress') {
      const sameSchedule = current.startDate === action.previous.startDate
        && current.endDate === action.previous.endDate
        && JSON.stringify(current.recurrence ?? null) === JSON.stringify(action.previous.recurrence ?? null)
      const statusChanged = action.kind === 'single'
        ? current.completed !== action.previous.completed
        : current.count !== action.previous.count
      if (!sameStaticFields || !sameSchedule || !statusChanged) return false
      // 撤销 = 擦除：恢复字段并删掉被撤销操作写入的日志，不另写“撤销”记录
      const fields = action.kind === 'single'
        ? { completed: action.previous.completed, ...(action.previous.recurrence && !action.previous.completed ? { seriesState: 'active' as const } : {}) }
        : { count: action.previous.count }
      const mutation = demoMode ? null : eraseTaskAction(userId!, current.id, fields, action.logRefs ?? [])
      replaceTasks((tasks) => tasks.map((task) => task.id === action.previous.id
        ? { ...action.previous, updatedAt: new Date() }
        : task))
      lastStatusActionRef.current = null
      if (mutation) monitorCommit(mutation.committed, '撤销任务状态变更')
      return true
    }

    const activeSeriesAdvanced = JSON.stringify(current.recurrence ?? null) === JSON.stringify(action.previous.recurrence ?? null)
      && (current.seriesState === 'ended' || current.currentOccurrenceKey !== action.previous.currentOccurrenceKey)
      && (current.seriesState === 'ended' || (current.type === 'single' ? !current.completed : current.count === 0))
    const terminalCompletion = action.kind === 'recurrence-completed'
      && !current.recurrence
      && (current.type === 'single' ? current.completed : current.count === current.targetCount)
    const untouched = sameStaticFields && (activeSeriesAdvanced || terminalCompletion)
    if (!untouched) return false
    const previousKey = action.previous.currentOccurrenceKey ?? occurrenceKey(action.previous.startDate)
    const completedTaskId = completedOccurrenceTaskId(action.previous.id, previousKey)
    // 擦除收尾事件及其派生数据（occurrence 记录、完成实例），本期内的进度/修改日志保留——周期被恢复后它们仍是真实历史
    const mutation = demoMode
      ? null
      : eraseTaskAction(
          userId!,
          current.id,
          {
            startDate: action.previous.startDate,
            endDate: action.previous.endDate,
            count: action.previous.count,
            completed: action.previous.completed,
            recurrence: action.previous.recurrence,
            seriesState: 'active',
            currentOccurrenceKey: previousKey,
            occurrenceSequence: action.previous.occurrenceSequence ?? 1,
            lastAdvanceMutationId: action.previous.lastAdvanceMutationId ?? null,
          },
          action.logRefs ?? [],
          {
            occurrenceKeys: [previousKey],
            taskIds: action.kind === 'recurrence-completed' ? [completedTaskId] : [],
          },
        )
    replaceTasks((tasks) => tasks
      .filter((task) => action.kind !== 'recurrence-completed' || task.id !== completedTaskId)
      .map((task) => task.id === action.previous.id
        ? { ...action.previous, updatedAt: new Date() }
        : task))
    lastStatusActionRef.current = null
    if (mutation) monitorCommit(mutation.committed, '撤销完成本次')
    return true
  }, [demoMode, monitorCommit, replaceTasks, userId])

  const createTag = useCallback(async (name: string, color: TagColor = 'lavender') => {
    if (!demoMode && !userId) throw new Error('请先登录')
    const normalizedName = normalizeTagName(name)
    const existing = tagsRef.current.find((tag) => tag.normalizedName === normalizedName)
    if (existing) return existing
    const tag = demoMode
      ? {
          id: `demo-tag-${crypto.randomUUID()}`,
          name: cleanTagName(name),
          normalizedName,
          color,
          sortOrder: Date.now(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : await createRemoteTag(userId!, name, color)
    replaceTags((current) => [...current.filter((item) => item.id !== tag.id), tag])
    return tag
  }, [demoMode, replaceTags, userId])

  const updateTag = useCallback(async (tagId: string, changes: { name?: string; color?: TagColor; sortOrder?: number }) => {
    if (!demoMode && !userId) throw new Error('请先登录')
    const current = tagsRef.current.find((tag) => tag.id === tagId)
    if (!current) throw new Error('标签不存在')
    const next = {
      ...current,
      ...changes,
      ...(changes.name === undefined ? {} : { name: cleanTagName(changes.name), normalizedName: normalizeTagName(changes.name) }),
      updatedAt: new Date(),
    }
    if (!demoMode) await updateRemoteTag(userId!, current, changes)
    replaceTags((tags) => tags.map((tag) => tag.id === tagId ? next : tag))
    return next
  }, [demoMode, replaceTags, userId])

  const deleteTag = useCallback(async (tagId: string) => {
    if (!demoMode && !userId) throw new Error('请先登录')
    const tag = tagsRef.current.find((item) => item.id === tagId)
    if (!tag) return 0
    const affected = demoMode
      ? tasksRef.current.filter((task) => task.tagIds?.includes(tagId)).length
      : await deleteRemoteTag(userId!, tag)
    replaceTags((tags) => tags.filter((item) => item.id !== tagId))
    replaceTasks((tasks) => tasks.map((task) => ({ ...task, tagIds: task.tagIds?.filter((id) => id !== tagId) ?? [] })))
    return affected
  }, [demoMode, replaceTags, replaceTasks, userId])

  const mergeTags = useCallback(async (sourceId: string, targetId: string) => {
    if (!demoMode && !userId) throw new Error('请先登录')
    const source = tagsRef.current.find((tag) => tag.id === sourceId)
    const target = tagsRef.current.find((tag) => tag.id === targetId)
    if (!source || !target || source.id === target.id) return 0
    const affected = demoMode
      ? tasksRef.current.filter((task) => task.tagIds?.includes(sourceId)).length
      : await mergeRemoteTags(userId!, source, target)
    replaceTags((tags) => tags.filter((tag) => tag.id !== sourceId))
    replaceTasks((tasks) => tasks.map((task) => ({
      ...task,
      tagIds: [...new Set((task.tagIds ?? []).map((id) => id === sourceId ? targetId : id))],
    })))
    return affected
  }, [demoMode, replaceTags, replaceTasks, userId])

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const exists = tasksRef.current.some((task) => task.id === taskId)
      if (!exists) return
      const mutation = demoMode ? null : deleteRemoteTask(userId!, taskId)
      replaceTasks((current) => current.filter((task) => task.id !== taskId))
      if (mutation) monitorCommit(mutation.committed, '删除任务')
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

  const updatePreferences = useCallback(
    async (next: UserPreferences) => {
      setPreferencesState(next)
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        monitorCommit(savePreferences(userId, next), '保存设置')
      }
    },
    [demoMode, monitorCommit, userId],
  )

  const syncState = useMemo(
    () => ({
      ...remoteSyncState,
      pendingWrites: remoteSyncState.pendingWrites || pendingOperations > 0,
    }),
    [pendingOperations, remoteSyncState],
  )
  const dataReady = demoMode || Boolean(userId && loadedUserId === userId)

  return useMemo(
    () => ({
      tasks,
      tags,
      preferences,
      loading,
      dataReady,
      error,
      syncState,
      setError,
      createTask,
      updateTask,
      changeType,
      setCompleted,
      adjustProgress,
      resetProgress,
      skipOccurrence,
      undoLastAdvance: undoLastTaskAction,
      undoLastTaskAction,
      deleteTask,
      createTag,
      updateTag,
      deleteTag,
      mergeTags,
      setPreferences: updatePreferences,
    }),
    [
      adjustProgress,
      changeType,
      createTag,
      createTask,
      deleteTag,
      deleteTask,
      dataReady,
      error,
      loading,
      mergeTags,
      preferences,
      resetProgress,
      setCompleted,
      skipOccurrence,
      tags,
      undoLastTaskAction,
      updateTag,
      updatePreferences,
      syncState,
      tasks,
      updateTask,
    ],
  )
}

export function useTaskLogs(userId: string | null, task: Task | null, demoMode: boolean) {
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!task) {
      setLogs([])
      return
    }
    if (demoMode) {
      setLogs([
        {
          id: 'demo-log-1',
          type: 'progress',
          action: task.type === 'progress' ? '进度 +1' : '完成任务',
          payload:
            task.type === 'progress'
              ? { before: Math.max(0, task.count - 1), after: task.count }
              : { before: false, after: true },
          createdAt: new Date(),
        },
        {
          id: 'demo-log-2',
          type: 'update',
          action: '创建任务',
          payload: { title: task.title },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ])
      return
    }
    if (!userId) return
    // 完成实例不存自己的日志：回所属系列的日志流按周期回溯；旧数据无指针时回退读自身
    if (task.parentTaskId && task.occurrenceKey) {
      return subscribeOccurrenceLogs(userId, task.parentTaskId, task.occurrenceKey, setLogs, (reason) => setError(reason.message))
    }
    return subscribeTaskLogs(userId, task.id, setLogs, (reason) => setError(reason.message))
  }, [demoMode, task, userId])

  return { logs, error }
}
