import { addDays, toDateTimeInput } from '../lib/date'
import { createRecurrenceRule, occurrenceKey } from '../lib/recurrence'
import type { AnalyticsLog } from '../lib/analytics'
import type { OccurrenceRecord, Tag, Task } from '../types'

const today = new Date()
const date = (offset: number, hour: number, minute = 0) => {
  const value = addDays(today, offset)
  value.setHours(hour, minute, 0, 0)
  return toDateTimeInput(value)
}
const timestamp = (offset: number, hour: number, minute = 0) => {
  const value = addDays(today, offset)
  value.setHours(hour, minute, 0, 0)
  return value
}

export const demoTags: Tag[] = [
  { id: 'tag-work', name: '工作', normalizedName: '工作', color: 'lavender', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tag-focus', name: '专注', normalizedName: '专注', color: 'indigo', sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tag-health', name: '健康', normalizedName: '健康', color: 'mint', sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
  { id: 'tag-life', name: '生活', normalizedName: '生活', color: 'apricot', sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
]

export const demoTasks: Task[] = [
  {
    id: 'demo-timeless',
    title: '整理灵感清单',
    description: '随时补充，不需要安排具体日期。',
    startDate: '',
    endDate: '',
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    tagIds: ['tag-life'],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'demo-1',
    title: '写完产品方案',
    description: '整理目标、核心流程与本周交付范围。',
    startDate: date(0, 9),
    endDate: date(0, 17, 30),
    type: 'progress',
    targetCount: 5,
    count: 3,
    completed: false,
    tagIds: ['tag-work', 'tag-focus'],
    recurrence: createRecurrenceRule(date(0, 9), date(0, 17, 30), 'weekly'),
    seriesState: 'active',
    currentOccurrenceKey: occurrenceKey(date(0, 9)),
    occurrenceSequence: 3,
    createdAt: new Date(Date.now() - 1000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-2',
    title: '晨间运动',
    description: '完成拉伸、核心训练和慢跑。',
    startDate: date(-2, 7),
    endDate: date(3, 8),
    type: 'progress',
    targetCount: 20,
    count: 12,
    completed: false,
    tagIds: ['tag-health'],
    createdAt: new Date(Date.now() - 2000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-3',
    title: '阅读 30 分钟',
    description: '',
    startDate: date(0, 19),
    endDate: date(0, 19, 30),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    tagIds: ['tag-focus', 'tag-health'],
    recurrence: createRecurrenceRule(date(0, 19), date(0, 19, 30), 'daily'),
    seriesState: 'active',
    currentOccurrenceKey: occurrenceKey(date(0, 19)),
    occurrenceSequence: 8,
    createdAt: new Date(Date.now() - 3000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-4',
    title: '整理会议纪要',
    description: '提炼结论、负责人和截止时间。',
    startDate: date(0, 14),
    endDate: date(1, 10),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    tagIds: ['tag-work'],
    createdAt: new Date(Date.now() - 4000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-10',
    title: '回复合作邮件',
    description: '确认合作意向与下次会议时间。',
    startDate: date(-1, 10),
    endDate: date(-1, 12),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: false,
    tagIds: ['tag-work'],
    createdAt: timestamp(-2, 9),
    updatedAt: timestamp(-2, 9),
  },
  {
    id: 'demo-5',
    title: '背单词',
    description: '',
    startDate: date(-4, 8),
    endDate: date(0, 22),
    type: 'progress',
    targetCount: 20,
    count: 20,
    completed: false,
    tagIds: ['tag-focus'],
    createdAt: new Date(Date.now() - 5000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-6',
    title: '整理桌面',
    description: '',
    startDate: date(0, 11),
    endDate: date(0, 11, 15),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: true,
    tagIds: ['tag-life'],
    createdAt: new Date(Date.now() - 6000),
    updatedAt: new Date(),
  },
  {
    id: 'demo-8',
    title: '提交周报',
    description: '汇总本周进展与下周计划。',
    startDate: date(-2, 17),
    endDate: date(-2, 18),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: true,
    tagIds: ['tag-work'],
    createdAt: timestamp(-3, 9),
    updatedAt: timestamp(-2, 17, 40),
  },
  {
    id: 'demo-7',
    title: '预约牙医',
    description: '',
    startDate: date(-2, 9),
    endDate: date(-2, 9, 30),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: true,
    tagIds: ['tag-life'],
    createdAt: timestamp(-6, 20),
    updatedAt: timestamp(-2, 10, 15),
  },
  {
    id: 'demo-9',
    title: '买生日礼物',
    description: '',
    startDate: date(-9, 12),
    endDate: date(-9, 13),
    type: 'single',
    targetCount: 0,
    count: 0,
    completed: true,
    tagIds: ['tag-life'],
    createdAt: timestamp(-10, 21),
    updatedAt: timestamp(-9, 12, 30),
  },
]

/** 体验模式下的周期账本：阅读（每天）与产品方案（每周）的历史执行情况。 */
const demoReadingPattern: Array<[number, 'completed' | 'skipped', number, number]> = [
  [-1, 'completed', 22, 10],
  [-2, 'completed', 19, 5],
  [-3, 'completed', 19, 20],
  [-4, 'skipped', 21, 0],
  [-5, 'completed', 20, 5],
  [-6, 'completed', 19, 40],
  [-7, 'completed', 19, 12],
  [-8, 'completed', 19, 25],
  [-9, 'skipped', 20, 30],
  [-10, 'completed', 19, 2],
  [-11, 'completed', 19, 28],
  [-12, 'completed', 21, 15],
  [-13, 'completed', 19, 18],
]

const demoPlanPattern: Array<[number, 'completed' | 'skipped', number, number]> = [
  [-7, 'completed', 16, 50],
  [-14, 'completed', 15, 30],
  [-21, 'skipped', 10, 0],
]

function demoOccurrences(
  taskId: string,
  pattern: Array<[number, 'completed' | 'skipped', number, number]>,
  scheduledHour: number,
  scheduledMinute: number,
  durationMinutes: number,
  targetCount: number,
): OccurrenceRecord[] {
  return pattern.map(([offset, result, hour, minute]) => {
    const scheduledStart = date(offset, scheduledHour, scheduledMinute)
    return {
      taskId,
      occurrenceKey: occurrenceKey(scheduledStart),
      result,
      scheduledStart,
      scheduledEnd: date(offset, scheduledHour, scheduledMinute + durationMinutes),
      count: result === 'completed' ? targetCount : 0,
      targetCount,
      title: taskId === 'demo-3' ? '阅读 30 分钟' : '写完产品方案',
      tagIds: taskId === 'demo-3' ? ['tag-focus', 'tag-health'] : ['tag-work', 'tag-focus'],
      completedAt: timestamp(offset, hour, minute),
    }
  })
}

/** 体验模式下的完成日志：覆盖非重复任务的完成时刻。 */
const demoCompletionLogs: AnalyticsLog[] = [
  {
    id: 'demo-log-desk-done',
    taskId: 'demo-6',
    type: 'status',
    action: '完成任务',
    payload: { before: false, after: true },
    createdAt: timestamp(0, 11, 20),
  },
  {
    id: 'demo-log-words-done',
    taskId: 'demo-5',
    type: 'progress',
    action: '进度 +1',
    payload: { before: 19, after: 20, delta: 1 },
    createdAt: timestamp(-1, 8, 40),
  },
  {
    id: 'demo-log-report-done',
    taskId: 'demo-8',
    type: 'status',
    action: '完成任务',
    payload: { before: false, after: true },
    createdAt: timestamp(-2, 17, 40),
  },
  {
    id: 'demo-log-dentist-done',
    taskId: 'demo-7',
    type: 'status',
    action: '完成任务',
    payload: { before: false, after: true },
    createdAt: timestamp(-2, 10, 15),
  },
  {
    id: 'demo-log-gift-done',
    taskId: 'demo-9',
    type: 'status',
    action: '完成任务',
    payload: { before: false, after: true },
    createdAt: timestamp(-9, 12, 30),
  },
]

/** 体验模式分析数据：周期账本 + 完成日志，让 /analytics 在 ?demo 下同样可看。 */
export function buildDemoAnalyticsHistory(): { occurrences: OccurrenceRecord[]; logs: AnalyticsLog[] } {
  return {
    occurrences: [
      ...demoOccurrences('demo-3', demoReadingPattern, 19, 0, 30, 0),
      ...demoOccurrences('demo-1', demoPlanPattern, 9, 0, 510, 5),
    ],
    logs: demoCompletionLogs,
  }
}
