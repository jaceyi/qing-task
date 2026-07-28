import { useCallback, useEffect, useMemo, useState } from 'react'
import { demoTasks } from '../data/demo'
import { switchedTaskValues } from '../lib/taskLogic'
import {
  adjustTaskProgress,
  changeTaskType,
  createTask as createRemoteTask,
  deleteTask as deleteRemoteTask,
  savePreferences,
  setSingleCompletion,
  subscribePreferences,
  subscribeTaskLogs,
  subscribeTasks,
  updateTaskInfo,
} from '../lib/taskService'
import type {
  SyncState,
  Task,
  TaskDraft,
  TaskLog,
  TaskType,
  UserPreferences,
} from '../types'

const initialSyncState: SyncState = { fromCache: false, pendingWrites: false }

export function useTaskData(userId: string | null, demoMode: boolean) {
  const [tasks, setTasks] = useState<Task[]>(demoMode ? demoTasks : [])
  const [preferences, setPreferencesState] = useState<UserPreferences>({ hideCompleted: false })
  const [loading, setLoading] = useState(!demoMode)
  const [error, setError] = useState('')
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState)

  useEffect(() => {
    if (demoMode) {
      setTasks(demoTasks)
      setLoading(false)
      return
    }
    if (!userId) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribeTasks = subscribeTasks(
      userId,
      (nextTasks, nextSyncState) => {
        setTasks(nextTasks)
        setSyncState(nextSyncState)
        setLoading(false)
        setError('')
      },
      (reason) => {
        setError(reason.message)
        setLoading(false)
      },
    )
    const unsubscribePreferences = subscribePreferences(userId, setPreferencesState)
    return () => {
      unsubscribeTasks()
      unsubscribePreferences()
    }
  }, [demoMode, userId])

  const createTask = useCallback(
    async (draft: TaskDraft, copiedFrom?: string) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        return createRemoteTask(userId, draft, copiedFrom)
      }

      const id = `demo-${crypto.randomUUID()}`
      const now = new Date()
      setTasks((current) => [{ ...draft, id, createdAt: now, updatedAt: now }, ...current])
      return id
    },
    [demoMode, userId],
  )

  const updateTask = useCallback(
    async (
      taskId: string,
      fields: Pick<Task, 'title' | 'startDate' | 'endDate' | 'targetCount'>,
    ) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        await updateTaskInfo(userId, taskId, fields)
        return
      }
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...fields,
                count: task.type === 'progress' ? Math.min(task.count, fields.targetCount) : 0,
                updatedAt: new Date(),
              }
            : task,
        ),
      )
    },
    [demoMode, userId],
  )

  const changeType = useCallback(
    async (taskId: string, nextType: TaskType, targetCount = 1) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        await changeTaskType(userId, taskId, nextType, targetCount)
        return
      }
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? { ...task, ...switchedTaskValues(task, nextType, targetCount), updatedAt: new Date() }
            : task,
        ),
      )
    },
    [demoMode, userId],
  )

  const setCompleted = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        return setSingleCompletion(userId, taskId, completed)
      }
      let changed = false
      setTasks((current) =>
        current.map((task) => {
          if (task.id !== taskId || task.type !== 'single' || task.completed === completed) return task
          changed = true
          return { ...task, completed, updatedAt: new Date() }
        }),
      )
      return changed
    },
    [demoMode, userId],
  )

  const adjustProgress = useCallback(
    async (taskId: string, delta: -1 | 1) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        return adjustTaskProgress(userId, taskId, delta)
      }
      let changed = false
      setTasks((current) =>
        current.map((task) => {
          if (task.id !== taskId || task.type !== 'progress') return task
          const count = Math.max(0, Math.min(task.targetCount, task.count + delta))
          if (count === task.count) return task
          changed = true
          return { ...task, count, updatedAt: new Date() }
        }),
      )
      return changed
    },
    [demoMode, userId],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        await deleteRemoteTask(userId, taskId)
        return
      }
      setTasks((current) => current.filter((task) => task.id !== taskId))
    },
    [demoMode, userId],
  )

  const updatePreferences = useCallback(
    async (next: UserPreferences) => {
      setPreferencesState(next)
      if (!demoMode) {
        if (!userId) throw new Error('请先登录')
        await savePreferences(userId, next)
      }
    },
    [demoMode, userId],
  )

  return useMemo(
    () => ({
      tasks,
      preferences,
      loading,
      error,
      syncState,
      setError,
      createTask,
      updateTask,
      changeType,
      setCompleted,
      adjustProgress,
      deleteTask,
      setPreferences: updatePreferences,
    }),
    [
      adjustProgress,
      changeType,
      createTask,
      deleteTask,
      error,
      loading,
      preferences,
      setCompleted,
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
    return subscribeTaskLogs(userId, task.id, setLogs, (reason) => setError(reason.message))
  }, [demoMode, task, userId])

  return { logs, error }
}
