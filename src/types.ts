export type TaskType = 'single' | 'progress'
export type BoardScope = 'today' | 'week' | 'all'
export type TimeFilterScope = BoardScope | 'custom'
export interface CustomDateRange {
  startDate: string
  endDate: string
}
export type TaskLogType =
  | 'create'
  | 'update'
  | 'progress'
  | 'recurrence'
  | 'tag'
  | 'type'
  | 'status'
  | 'roll'

/** 日志归属：系列级事件记在主任务时间线；周期级事件额外归属某一期，供完成实例回溯展示。 */
export type TaskLogScope = 'series' | 'occurrence'
export type RecurrenceFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type TagMatchMode = 'all' | 'any'
export type TagColor = 'lavender' | 'mint' | 'apricot' | 'rose' | 'sky' | 'amber' | 'slate' | 'indigo'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  byWeekdays?: Weekday[]
  byMonth?: number
  byMonthDay?: number
  end: { kind: 'never' } | { kind: 'until'; date: string }
  timeZone: string
  anchorStart: string
  durationMinutes: number
}

export interface Tag {
  id: string
  name: string
  normalizedName: string
  color: TagColor
  sortOrder: number
  createdAt: Date | null
  updatedAt: Date | null
  deletedAt?: Date | null
}

export interface Task {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  type: TaskType
  targetCount: number
  count: number
  completed: boolean
  schemaVersion?: number
  tagIds?: string[]
  recurrence?: RecurrenceRule | null
  seriesState?: 'active' | 'ended' | null
  currentOccurrenceKey?: string | null
  occurrenceSequence?: number
  lastAdvanceMutationId?: string | null
  /** 完成实例任务：所属系列任务与对应的周期 key，用于回溯该期的日志。 */
  parentTaskId?: string
  occurrenceKey?: string
  createdAt: Date | null
  updatedAt: Date | null
}

export type TaskDraft = Pick<
  Task,
  | 'title'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'type'
  | 'targetCount'
  | 'count'
  | 'completed'
  | 'tagIds'
  | 'recurrence'
>

export interface TaskInfoFields extends Pick<
  Task,
  'title' | 'description' | 'startDate' | 'endDate' | 'targetCount' | 'tagIds' | 'recurrence'
> {
  recurrenceTimingScope?: 'current' | 'future'
}

export interface TaskLog {
  id: string
  type: TaskLogType
  action: string
  payload: Record<string, unknown>
  createdAt: Date | null
  scope?: TaskLogScope
  occurrenceKey?: string
  /** 同一时刻（同一 batch 的相同 serverTimestamp）内的排序依据：严格递增。 */
  seq?: number
}

/** 重复任务周期账本：每完成/跳过一期写入一条，供分析页回溯完成率与准时率。 */
export interface OccurrenceRecord {
  taskId: string
  occurrenceKey: string
  result: 'completed' | 'skipped'
  scheduledStart: string
  scheduledEnd: string
  count: number
  targetCount: number
  title: string
  tagIds: string[]
  completedAt: Date | null
}

export interface UserPreferences {
  hideCompleted: boolean
}

export interface SyncState {
  fromCache: boolean
  pendingWrites: boolean
}
