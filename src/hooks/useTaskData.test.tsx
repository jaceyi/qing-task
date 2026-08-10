import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncState, Task } from '../types'
import { createRecurrenceRule, occurrenceKey } from '../lib/recurrence'
import { useTaskDataStore } from './useTaskData'

const serviceState = vi.hoisted(() => ({
  onTasks: null as null | ((tasks: Task[], sync: SyncState) => void),
  commit: Promise.resolve() as Promise<void>,
  resolveCommit: null as null | (() => void),
  rejectCommit: null as null | ((reason: Error) => void),
  completionCalls: [] as Array<{ current: Task; completed: boolean }>,
  progressCalls: [] as Array<{ current: Task; delta: -1 | 1 }>,
  eraseCalls: [] as Array<{
    taskId: string
    fields: Record<string, unknown>
    logRefs: unknown[]
    extra: { occurrenceKeys?: string[]; taskIds?: string[] }
  }>,
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
  subscribeTags: vi.fn((_userId: string, onData: (tags: []) => void) => {
    onData([])
    return vi.fn()
  }),
  subscribeTaskLogs: vi.fn(() => vi.fn()),
  subscribeOccurrenceLogs: vi.fn(() => vi.fn()),
  createTask: vi.fn(() => ({ result: 'created-task', committed: serviceState.commit })),
  updateTaskInfo: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  changeTaskType: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  setSingleCompletion: vi.fn(
    (_userId: string, current: Task, completed: boolean) => {
      serviceState.completionCalls.push({ current, completed })
      return { result: true, committed: serviceState.commit, logRefs: ['completion-log-ref'] }
    },
  ),
  adjustTaskProgress: vi.fn(
    (_userId: string, current: Task, delta: -1 | 1) => {
      serviceState.progressCalls.push({ current, delta })
      return { result: true, committed: serviceState.commit, logRefs: ['progress-log-ref'] }
    },
  ),
  resetTaskProgress: vi.fn(() => ({ result: true, committed: serviceState.commit, logRefs: ['reset-log-ref'] })),
  deleteTask: vi.fn(() => ({ result: true, committed: serviceState.commit })),
  eraseTaskAction: vi.fn(
    (
      _userId: string,
      taskId: string,
      fields: Record<string, unknown>,
      logRefs: unknown[],
      extra: { occurrenceKeys?: string[]; taskIds?: string[] } = {},
    ) => {
      serviceState.eraseCalls.push({ taskId, fields, logRefs, extra })
      return { result: true, committed: serviceState.commit }
    },
  ),
  skipRecurringOccurrence: vi.fn(() => ({ result: true, committed: serviceState.commit, logRefs: ['skip-log-ref'] })),
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
    serviceState.eraseCalls = []
    resetCommit()
  })

  it('不等待云端确认就更新完成状态，并持续显示同步中', async () => {
    const { result } = renderHook(() => useTaskDataStore('user-1', false))
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

  it('普通任务的完成和取消完成都可以恢复到操作前状态', async () => {
    const { result } = renderHook(() => useTaskDataStore('user-1', false))
    act(() => serviceState.onTasks?.([singleTask], { fromCache: false, pendingWrites: false }))

    await act(async () => {
      expect(await result.current.setCompleted(singleTask.id, true)).toBe(true)
      expect(await result.current.undoLastTaskAction()).toBe(true)
    })
    expect(result.current.tasks[0].completed).toBe(false)

    const completedTask = { ...singleTask, completed: true }
    act(() => serviceState.onTasks?.([completedTask], { fromCache: false, pendingWrites: false }))
    await act(async () => {
      expect(await result.current.setCompleted(singleTask.id, false)).toBe(true)
      expect(await result.current.undoLastTaskAction()).toBe(true)
    })
    expect(result.current.tasks[0].completed).toBe(true)
    // 撤销不再写反向操作，而是擦除原操作：真实操作只有两笔（完成、取消完成），撤销走 erase
    expect(serviceState.completionCalls.map(({ completed }) => completed)).toEqual([true, false])
    expect(serviceState.eraseCalls.map((call) => call.fields.completed)).toEqual([false, true])
  })

  it('进度任务到达目标和取消完成都可以撤销', async () => {
    const { result } = renderHook(() => useTaskDataStore('user-1', false))
    const nearlyComplete = { ...progressTask, count: 4 }
    act(() => serviceState.onTasks?.([nearlyComplete], { fromCache: false, pendingWrites: false }))

    await act(async () => {
      expect(await result.current.adjustProgress(progressTask.id, 1)).toBe(true)
      expect(await result.current.undoLastTaskAction()).toBe(true)
    })
    expect(result.current.tasks[0].count).toBe(4)

    const completedTask = { ...progressTask, count: 5 }
    act(() => serviceState.onTasks?.([completedTask], { fromCache: false, pendingWrites: false }))
    await act(async () => {
      expect(await result.current.adjustProgress(progressTask.id, -1)).toBe(true)
      expect(await result.current.undoLastTaskAction()).toBe(true)
    })
    expect(result.current.tasks[0].count).toBe(5)
    expect(serviceState.progressCalls.map(({ delta }) => delta)).toEqual([1, -1])
    expect(serviceState.eraseCalls.map((call) => call.fields.count)).toEqual([4, 5])
  })

  it('切换账号后等待新账号首轮任务快照，避免把详情误判为不存在', () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useTaskDataStore(userId, false),
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
    const { result } = renderHook(() => useTaskDataStore('user-1', false))
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

  it('完成重复任务后保留无重复的完成副本、滚动原系列，并可在短时间内撤销', async () => {
    const recurringTask: Task = {
      ...singleTask,
      id: 'recurring-1',
      startDate: '2026-08-03T09:00',
      endDate: '2026-08-03T09:30',
      recurrence: createRecurrenceRule('2026-08-03T09:00', '2026-08-03T09:30', 'daily'),
      seriesState: 'active',
      currentOccurrenceKey: occurrenceKey('2026-08-03T09:00'),
      occurrenceSequence: 1,
    }
    const { result } = renderHook(() => useTaskDataStore('user-1', false))
    act(() => serviceState.onTasks?.([recurringTask], { fromCache: false, pendingWrites: false }))

    await act(async () => {
      expect(await result.current.setCompleted(recurringTask.id, true)).toBe(true)
    })
    expect(result.current.tasks[0].completed).toBe(false)
    expect(result.current.tasks[0].startDate).not.toBe(recurringTask.startDate)
    expect(result.current.tasks[0].occurrenceSequence).toBe(2)
    expect(result.current.tasks).toHaveLength(2)
    expect(result.current.tasks[1]).toMatchObject({
      title: recurringTask.title,
      description: recurringTask.description,
      startDate: recurringTask.startDate,
      endDate: recurringTask.endDate,
      completed: true,
      recurrence: null,
      seriesState: null,
      // 完成实例带回系列指针，历史从系列日志流按周期回溯
      parentTaskId: recurringTask.id,
      occurrenceKey: occurrenceKey(recurringTask.startDate),
    })

    await act(async () => {
      expect(await result.current.undoLastAdvance()).toBe(true)
    })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.tasks[0].startDate).toBe(recurringTask.startDate)
    expect(result.current.tasks[0].occurrenceSequence).toBe(1)
    // 撤销 = 擦除：删掉完成事件写入的日志、occurrence 记录与实例任务，不写任何撤销日志
    expect(serviceState.eraseCalls).toHaveLength(1)
    expect(serviceState.eraseCalls[0]).toMatchObject({
      taskId: recurringTask.id,
      logRefs: ['completion-log-ref'],
      extra: {
        occurrenceKeys: [occurrenceKey(recurringTask.startDate)],
        taskIds: [`completed-${recurringTask.id}-${occurrenceKey(recurringTask.startDate)}`],
      },
    })
    expect(serviceState.eraseCalls[0].fields).toMatchObject({
      startDate: recurringTask.startDate,
      count: recurringTask.count,
      seriesState: 'active',
    })
  })
})
