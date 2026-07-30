import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncState, Task } from '../types'
import { useTaskData } from './useTaskData'

const serviceState = vi.hoisted(() => ({
  onTasks: null as null | ((tasks: Task[], sync: SyncState) => void),
  commit: Promise.resolve() as Promise<void>,
  resolveCommit: null as null | (() => void),
  rejectCommit: null as null | ((reason: Error) => void),
  completionCalls: [] as Array<{ current: Task; completed: boolean }>,
  progressCalls: [] as Array<{ current: Task; delta: -1 | 1 }>,
}))

vi.mock('../lib/taskService', () => ({
  subscribeTasks: vi.fn(
    (
      _userId: string,
      onData: (tasks: Task[], sync: SyncState) => void,
    ) => {
      serviceState.onTasks = onData
      return vi.fn()
    },
  ),
  subscribePreferences: vi.fn(
    (_userId: string, onData: (preferences: { hideCompleted: boolean }) => void) => {
      onData({ hideCompleted: false })
      return vi.fn()
    },
  ),
  subscribeTaskLogs: vi.fn(() => vi.fn()),
  createTask: vi.fn(() => ({ result: 'created-task', committed: serviceState.commit })),
  updateTaskInfo: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  changeTaskType: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  setSingleCompletion: vi.fn(
    (_userId: string, current: Task, completed: boolean) => {
      serviceState.completionCalls.push({ current, completed })
      return { result: true, committed: serviceState.commit }
    },
  ),
  adjustTaskProgress: vi.fn(
    (_userId: string, current: Task, delta: -1 | 1) => {
      serviceState.progressCalls.push({ current, delta })
      return { result: true, committed: serviceState.commit }
    },
  ),
  deleteTask: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  savePreferences: vi.fn(() => serviceState.commit),
}))

const singleTask: Task = {
  id: 'single-1',
  title: '即时完成',
  description: '',
  startDate: '',
  endDate: '',
  type: 'single',
  targetCount: 0,
  count: 0,
  completed: false,
  createdAt: new Date(1),
  updatedAt: new Date(1),
}

const progressTask: Task = {
  ...singleTask,
  id: 'progress-1',
  title: '即时推进',
  type: 'progress',
  targetCount: 5,
  count: 2,
}

function resetCommit() {
  serviceState.commit = new Promise<void>((resolve, reject) => {
    serviceState.resolveCommit = resolve
    serviceState.rejectCommit = reject
  })
}

describe('本地优先任务状态', () => {
  beforeEach(() => {
    serviceState.onTasks = null
    serviceState.completionCalls = []
    serviceState.progressCalls = []
    resetCommit()
  })

  it('不等待云端确认就更新完成状态，并持续显示同步中', async () => {
    const { result } = renderHook(() => useTaskData('user-1', false))
    expect(result.current.dataReady).toBe(false)
    act(() => serviceState.onTasks?.([singleTask], { fromCache: true, pendingWrites: false }))
    expect(result.current.dataReady).toBe(true)

    await act(async () => {
      expect(await result.current.setCompleted(singleTask.id, true)).toBe(true)
    })

    expect(result.current.tasks[0].completed).toBe(true)
    expect(result.current.syncState).toEqual({ fromCache: true, pendingWrites: true })
    expect(serviceState.completionCalls).toEqual([{ current: singleTask, completed: true }])

    await act(async () => {
      serviceState.resolveCommit?.()
      await serviceState.commit
    })
    await waitFor(() => expect(result.current.syncState.pendingWrites).toBe(false))
  })

  it('切换账号后等待新账号首轮任务快照，避免把详情误判为不存在', () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useTaskData(userId, false),
      { initialProps: { userId: null as string | null } },
    )
    expect(result.current.dataReady).toBe(false)

    rerender({ userId: 'user-1' })
    expect(result.current.dataReady).toBe(false)

    act(() => serviceState.onTasks?.([singleTask], { fromCache: true, pendingWrites: false }))
    expect(result.current.dataReady).toBe(true)

    rerender({ userId: 'user-2' })
    expect(result.current.dataReady).toBe(false)
  })

  it('连续推进使用上一笔本地结果，并在云端拒绝后接受监听回滚', async () => {
    const { result } = renderHook(() => useTaskData('user-1', false))
    act(() => serviceState.onTasks?.([progressTask], { fromCache: false, pendingWrites: false }))

    await act(async () => {
      expect(await result.current.adjustProgress(progressTask.id, 1)).toBe(true)
      expect(await result.current.adjustProgress(progressTask.id, 1)).toBe(true)
    })

    expect(result.current.tasks[0].count).toBe(4)
    expect(serviceState.progressCalls.map(({ current }) => current.count)).toEqual([2, 3])

    await act(async () => {
      serviceState.rejectCommit?.(new Error('permission-denied'))
      await serviceState.commit.catch(() => undefined)
    })
    act(() => serviceState.onTasks?.([progressTask], { fromCache: false, pendingWrites: false }))

    await waitFor(() => expect(result.current.tasks[0].count).toBe(2))
    expect(result.current.error).toContain('未能同步')
    expect(result.current.syncState.pendingWrites).toBe(false)
  })
})
