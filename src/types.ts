export type TaskType = 'single' | 'progress'
export type BoardScope = 'today' | 'week' | 'all'
export type TaskLogType = 'update' | 'progress'

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
  createdAt: Date | null
  updatedAt: Date | null
}

export type TaskDraft = Pick<
  Task,
  'title' | 'description' | 'startDate' | 'endDate' | 'type' | 'targetCount' | 'count' | 'completed'
>

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
