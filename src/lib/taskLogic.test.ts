import { describe, expect, it } from 'vitest'
import { filterAndSortTasks, isTaskComplete, normalizeTaskDraft, switchedTaskValues } from './taskLogic'
import type { Task } from '../types'

const baseTask: Task = {
  id: 'task-1',
  title: '测试任务',
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

  it('将完成任务排在未完成任务之后', () => {
    const tasks = [
      { ...baseTask, id: 'done', count: 5 },
      { ...baseTask, id: 'active', createdAt: new Date(5) },
    ]
    const result = filterAndSortTasks(tasks, 'today', false, '', new Date(2026, 6, 28))
    expect(result.map((task) => task.id)).toEqual(['active', 'done'])
  })

  it('标准化进度边界并清除无关完成字段', () => {
    expect(
      normalizeTaskDraft({
        ...baseTask,
        title: '  新任务  ',
        targetCount: 3,
        count: 10,
        completed: true,
      }),
    ).toMatchObject({ title: '新任务', targetCount: 3, count: 3, completed: false })
  })

  it('从进度任务切换到普通任务时，仅在到达目标后标记完成', () => {
    expect(switchedTaskValues(baseTask, 'single').completed).toBe(false)
    expect(switchedTaskValues({ ...baseTask, count: 5 }, 'single').completed).toBe(true)
  })
})
