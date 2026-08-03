export type TaskType = 'single' | 'progress'
export type BoardScope = 'today' | 'week' | 'all'
export type TimeFilterScope = BoardScope | 'custom'
export interface CustomDateRange {
  startDate: string
  endDate: string
}
export type TaskLogType = 'update' | 'progress' | 'recurrence' | 'tag'
export type RecurrenceFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type TagMatchMode = 'all' | 'any'
export type TagColor = 'lavender' | 'mint' | 'apricot' | 'rose' | 'sky' | 'amber' | 'slate' | 'indigo'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  byWeekdays?: Weekday[]
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
}

export interface UserPreferences {
  hideCompleted: boolean
}

export interface SyncState {
  fromCache: boolean
  pendingWrites: boolean
}
