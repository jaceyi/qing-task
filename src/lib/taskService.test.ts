import { describe, expect, it, vi } from 'vitest'
import type { TaskLog } from '../types'

vi.mock('./firebase', () => ({ db: {} }))

// mock 之后才能安全导入（taskService 顶层引用 db）
import { sortLogsDesc } from './taskService'

describe('日志排序', () => {
  it('同一时间戳内按 seq 保持因果顺序', () => {
    const sameTime = new Date('2026-08-10T19:38:00')
    const logs: TaskLog[] = [
      { id: 'roll', type: 'recurrence', action: '完成本次重复任务', payload: {}, createdAt: sameTime, seq: 1002 },
      { id: 'final-increment', type: 'progress', action: '进度 +1', payload: {}, createdAt: sameTime, seq: 1001 },
      { id: 'earlier', type: 'progress', action: '进度 +1', payload: {}, createdAt: new Date('2026-08-10T19:30:00') },
    ]
    // 达标的 +1 必须先于收尾的完成记录
    expect(sortLogsDesc(logs).map((log) => log.id)).toEqual(['roll', 'final-increment', 'earlier'])
  })

  it('无 seq 的旧日志按时间戳排序', () => {
    const logs: TaskLog[] = [
      { id: 'b', type: 'progress', action: '进度 +1', payload: {}, createdAt: new Date('2026-08-10T10:00:00') },
      { id: 'a', type: 'progress', action: '进度 +1', payload: {}, createdAt: new Date('2026-08-11T10:00:00') },
    ]
    expect(sortLogsDesc(logs).map((log) => log.id)).toEqual(['a', 'b'])
  })
})
