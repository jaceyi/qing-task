import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { demoTasks } from '../data/demo'
import { normalizeTaskDraft, switchedTaskValues, updatedTaskInfo } from '../lib/taskLogic'
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
  TaskInfoFields,
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
  const [remoteSyncState, setRemoteSyncState] = useState<SyncState>(initialSyncState)
  const [pendingOperations, setPendingOperations] = useState(0)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const tasksRef = useRef(tasks)

  const replaceTasks = useCallback((next: Task[] | ((current: Task[]) => Task[])) => {
    const resolved = typeof next === 'function' ? next(tasksRef.current) : next
    tasksRef.current = resolved
    setTasks(resolved)
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
      setLoadedUserId(null)
      setLoading(false)
      return
    }
    if (!userId) {
      replaceTasks([])
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
    return () => {
      unsubscribeTasks()
      unsubscribePreferences()
    }
  }, [demoMode, replaceTasks, userId])

  const createTask = useCallback(
    async (draft: TaskDraft, copiedFrom?: string) => {
      if (!demoMode && !userId) throw new Error('请先登录')
      const normalized = normalizeTaskDraft(draft)
      const mutation = demoMode ? null : createRemoteTask(userId!, normalized, copiedFrom)
      const id = mutation?.result ?? `demo-${crypto.randomUUID()}`
      const now = new Date()
      replaceTasks((current) => [
        { ...normalized, id, createdAt: now, updatedAt: now },
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
      const mutation = demoMode ? null : updateTaskInfo(userId!, current, fields)
      if (mutation && !mutation.result) return
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, ...next, updatedAt: new Date() } : task,
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
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, completed, updatedAt: new Date() } : task,
        ),
      )
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
      replaceTasks((tasks) =>
        tasks.map((task) =>
          task.id === taskId ? { ...task, count, updatedAt: new Date() } : task,
        ),
      )
      if (mutation) monitorCommit(mutation.committed, delta > 0 ? '推进任务' : '回退进度')
      return true
    },
    [demoMode, monitorCommit, replaceTasks, userId],
  )

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
      deleteTask,
      setPreferences: updatePreferences,
    }),
    [
      adjustProgress,
      changeType,
      createTask,
      deleteTask,
      dataReady,
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
