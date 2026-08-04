import { describe, expect, it } from 'vitest'
import {
  completedOccurrenceSnapshot,
  filterAndSortTasks,
  isTaskComplete,
  normalizeTaskDraft,
  switchedTaskValues,
  updatedTaskInfo,
} from './taskLogic'
import type { Task } from '../types'

const baseTask: Task = {
  id: 'task-1',
  title: '测试任务',
  description: '任务描述',
  startDate: '2026-07-28',
  endDate: '2026-07-28',
  type: 'progress',
  targetCount: 5,
  count: 3,
  completed: false,
  createdAt: new Date(10),
  updatedAt: new Date(10),
}

describe('任务状态逻辑', () => {
  it('分别判断普通任务和进度任务的完成态', () => {
    expect(isTaskComplete({ ...baseTask, count: 5 })).toBe(true)
    expect(isTaskComplete({ ...baseTask, type: 'single', completed: true })).toBe(true)
    expect(isTaskComplete({ ...baseTask, type: 'single', completed: false })).toBe(false)
  })

  it('把完成的一期复制成无重复属性的历史任务', () => {
    const recurrence = {
      frequency: 'daily' as const,
      interval: 1,
      end: { kind: 'never' as const },
      timeZone: 'Asia/Shanghai',
      anchorStart: '2026-07-28T09:00',
      durationMinutes: 0,
    }
    const completedAt = new Date('2026-07-28T09:30:00')
    expect(completedOccurrenceSnapshot({
      ...baseTask,
      recurrence,
      seriesState: 'active',
      currentOccurrenceKey: '20260728T0900',
      occurrenceSequence: 3,
    }, completedAt)).toMatchObject({
      title: baseTask.title,
      count: baseTask.targetCount,
      recurrence: null,
      seriesState: null,
      currentOccurrenceKey: null,
      occurrenceSequence: 0,
      createdAt: completedAt,
    })
  })

  it('将完成任务排在未完成任务之后', () => {
    const tasks = [
      { ...baseTask, id: 'done', count: 5 },
      { ...baseTask, id: 'active', createdAt: new Date(5) },
    ]
    const result = filterAndSortTasks(tasks, 'today', false, '', new Date(2026, 6, 28))
    expect(result.map((task) => task.id)).toEqual(['active', 'done'])
  })

  it('全部看板包含无时间任务，今天看板不包含', () => {
    const timeless = { ...baseTask, id: 'timeless', startDate: '', endDate: '' }
    expect(filterAndSortTasks([timeless], 'all', false, '', new Date(2026, 6, 28))).toHaveLength(1)
    expect(filterAndSortTasks([timeless], 'today', false, '', new Date(2026, 6, 28))).toHaveLength(0)
  })

  it('标准化进度边界并清除无关完成字段', () => {
    expect(
      normalizeTaskDraft({
        ...baseTask,
        title: '  新任务  ',
        description: '  补充说明  ',
        targetCount: 3,
        count: 10,
        completed: true,
      }),
    ).toMatchObject({
      title: '新任务',
      description: '补充说明',
      targetCount: 3,
      count: 3,
      completed: false,
    })
  })

  it('从进度任务切换到普通任务时，仅在到达目标后标记完成', () => {
    expect(switchedTaskValues(baseTask, 'single').completed).toBe(false)
    expect(switchedTaskValues({ ...baseTask, count: 5 }, 'single').completed).toBe(true)
  })

  it('编辑任务时保留无时间状态并限制缩小后的进度', () => {
    expect(
      updatedTaskInfo(baseTask, {
        title: '  新名称  ',
        description: '  新描述  ',
        startDate: '',
        endDate: '',
        targetCount: 2,
      }),
    ).toEqual({
      title: '新名称',
      description: '新描述',
      startDate: '',
      endDate: '',
      targetCount: 2,
      count: 2,
    })
  })

  it('按多个标签匹配全部或任一，并允许搜索标签名', () => {
    const tasks = [
      { ...baseTask, id: 'both', tagIds: ['a', 'b'] },
      { ...baseTask, id: 'one', tagIds: ['a'] },
    ]
    const tags = [
      { id: 'a', name: '工作', normalizedName: '工作', color: 'lavender' as const, sortOrder: 1, createdAt: null, updatedAt: null },
      { id: 'b', name: '等待', normalizedName: '等待', color: 'mint' as const, sortOrder: 2, createdAt: null, updatedAt: null },
    ]
    const reference = new Date(2026, 6, 28)
    expect(filterAndSortTasks(tasks, 'all', false, '', reference, { tags, selectedTagIds: ['a', 'b'], matchMode: 'all' }).map((task) => task.id)).toEqual(['both'])
    expect(filterAndSortTasks(tasks, 'all', false, '', reference, { tags, selectedTagIds: ['a', 'b'], matchMode: 'any' })).toHaveLength(2)
    expect(filterAndSortTasks(tasks, 'all', false, '等待', reference, { tags }).map((task) => task.id)).toEqual(['both'])
  })

  it('标签看板可叠加自定义时间范围', () => {
    const tasks = [
      { ...baseTask, id: 'inside', tagIds: ['a'] },
      { ...baseTask, id: 'outside', tagIds: ['a'], startDate: '2026-08-02', endDate: '2026-08-02' },
      { ...baseTask, id: 'other-tag', tagIds: ['b'] },
    ]
    const result = filterAndSortTasks(tasks, 'custom', false, '', new Date(2026, 6, 28), {
      selectedTagIds: ['a'],
      customRange: { startDate: '2026-07-20', endDate: '2026-07-31' },
    })
    expect(result.map((task) => task.id)).toEqual(['inside'])
  })
})
