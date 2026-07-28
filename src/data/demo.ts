import { addDays, toDateTimeInput } from '../lib/date'
import type { Task } from '../types'

const today = new Date()
const date = (offset: number, hour: number, minute = 0) => {
  const value = addDays(today, offset)
  value.setHours(hour, minute, 0, 0)
  return toDateTimeInput(value)
}

export const demoTasks: Task[] = [
  {
    id: 'demo-1',
    title: '写完产品方案',
    startDate: date(0, 9),
    endDate: date(0, 17, 30),
    type: 'progress',
    targetCount: 5,
    count: 3,
    completed: false,
    createdAt: new Date(Date.now() - 1000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-2',
    title: '晨间运动',
    startDate: date(-2, 7),
    endDate: date(3, 8),
    type: 'progress',
    targetCount: 20,
    count: 12,
    completed: false,
    createdAt: new Date(Date.now() - 2000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-3',
    title: '阅读 30 分钟',
    startDate: date(0, 19),
    endDate: date(0, 19, 30),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    createdAt: new Date(Date.now() - 3000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-4',
    title: '整理会议纪要',
    startDate: date(0, 14),
    endDate: date(1, 10),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    createdAt: new Date(Date.now() - 4000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-5',
    title: '背单词',
    startDate: date(-4, 8),
    endDate: date(0, 22),
    type: 'progress',
    targetCount: 20,
    count: 20,
    completed: false,
    createdAt: new Date(Date.now() - 5000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-6',
    title: '整理桌面',
    startDate: date(0, 11),
    endDate: date(0, 11, 15),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: true,
    createdAt: new Date(Date.now() - 6000),
    updatedAt: new Date(),
  },
]
