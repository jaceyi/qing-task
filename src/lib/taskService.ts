import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { normalizeTaskDraft, switchedTaskValues, updatedTaskInfo } from './taskLogic'
import type {
  SyncState,
  Task,
  TaskDraft,
  TaskInfoFields,
  TaskLog,
  TaskLogType,
  TaskType,
  UserPreferences,
} from '../types'

export interface QueuedMutation<T> {
  result: T
  committed: Promise<void>
}

function unchanged<T>(result: T): QueuedMutation<T> {
  return { result, committed: Promise.resolve() }
}

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : null
}

function mapTask(id: string, data: DocumentData): Task {
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    startDate: String(data.startDate ?? ''),
    endDate: String(data.endDate ?? ''),
    type: data.type === 'progress' ? 'progress' : 'single',
    targetCount: Number(data.targetCount ?? 0),
    count: Number(data.count ?? 0),
    completed: Boolean(data.completed),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function taskRef(userId: string, taskId: string) {
  return doc(db, 'users', userId, 'tasks', taskId)
}

function newLogRef(userId: string, taskId: string) {
  return doc(collection(db, 'users', userId, 'tasks', taskId, 'logs'))
}

function logData(type: TaskLogType, action: string, payload: Record<string, unknown>) {
  return { type, action, payload, createdAt: serverTimestamp() }
}

export function subscribeTasks(
  userId: string,
  onData: (tasks: Task[], sync: SyncState) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const tasksQuery = query(
    collection(db, 'users', userId, 'tasks'),
    orderBy('createdAt', 'desc'),
  )

  return onSnapshot(
    tasksQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      onData(
        snapshot.docs.map((item) =>
          mapTask(item.id, item.data({ serverTimestamps: 'estimate' })),
        ),
        {
          fromCache: snapshot.metadata.fromCache,
          pendingWrites: snapshot.metadata.hasPendingWrites,
        },
      )
    },
    (error) => onError(error),
  )
}

export function createTask(
  userId: string,
  draft: TaskDraft,
  copiedFrom?: string,
): QueuedMutation<string> {
  const normalized = normalizeTaskDraft(draft)
  const reference = doc(collection(db, 'users', userId, 'tasks'))
  const batch = writeBatch(db)
  batch.set(reference, {
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    newLogRef(userId, reference.id),
    logData('update', copiedFrom ? '复制任务' : '创建任务', {
      ...(copiedFrom ? { copiedFrom } : {}),
      title: normalized.title,
    }),
  )
  return { result: reference.id, committed: batch.commit() }
}

export function updateTaskInfo(
  userId: string,
  current: Task,
  fields: TaskInfoFields,
): QueuedMutation<boolean> {
  const next = updatedTaskInfo(current, fields)
  const patch: Record<string, unknown> = {}
  const changes: Array<{
    action: string
    before: string | number
    after: string | number
  }> = []
  if (current.title !== next.title) {
    patch.title = next.title
    changes.push({ action: '修改任务名称', before: current.title, after: next.title })
  }
  if (current.description !== next.description) {
    patch.description = next.description
    changes.push({ action: '修改任务描述', before: current.description, after: next.description })
  }
  if (current.startDate !== next.startDate || current.endDate !== next.endDate) {
    patch.startDate = next.startDate
    patch.endDate = next.endDate
    if (current.startDate !== next.startDate) {
      changes.push({ action: '修改开始时间', before: current.startDate, after: next.startDate })
    }
    if (current.endDate !== next.endDate) {
      changes.push({ action: '修改结束时间', before: current.endDate, after: next.endDate })
    }
  }
  if (current.type === 'progress' && current.targetCount !== next.targetCount) {
    patch.targetCount = next.targetCount
    changes.push({
      action: '修改目标次数',
      before: current.targetCount,
      after: next.targetCount,
    })
  }
  if (current.type === 'progress' && current.count !== next.count) {
    patch.count = next.count
    changes.push({
      action: '目标缩减，调整当前进度',
      before: current.count,
      after: next.count,
    })
  }

  if (changes.length === 0) return unchanged(false)

  const batch = writeBatch(db)
  batch.update(taskRef(userId, current.id), { ...patch, updatedAt: serverTimestamp() })
  changes.forEach((change) => {
    batch.set(
      newLogRef(userId, current.id),
      logData('update', change.action, { before: change.before, after: change.after }),
    )
  })
  return { result: true, committed: batch.commit() }
}

export function changeTaskType(
  userId: string,
  current: Task,
  nextType: TaskType,
  targetCount = 1,
): QueuedMutation<boolean> {
  if (current.type === nextType) return unchanged(false)
  const next = switchedTaskValues(current, nextType, targetCount)
  const batch = writeBatch(db)
  batch.update(taskRef(userId, current.id), { ...next, updatedAt: serverTimestamp() })
  batch.set(
    newLogRef(userId, current.id),
    logData('update', '切换任务类型', {
      before: current.type,
      after: nextType,
      ...(nextType === 'progress' ? { targetCount: next.targetCount } : {}),
    }),
  )
  return { result: true, committed: batch.commit() }
}

export function setSingleCompletion(
  userId: string,
  current: Task,
  completed: boolean,
): QueuedMutation<boolean> {
  if (current.type !== 'single' || current.completed === completed) return unchanged(false)
  const batch = writeBatch(db)
  batch.update(taskRef(userId, current.id), { completed, updatedAt: serverTimestamp() })
  batch.set(
    newLogRef(userId, current.id),
    logData('progress', completed ? '完成任务' : '取消完成', {
      before: current.completed,
      after: completed,
    }),
  )
  return { result: true, committed: batch.commit() }
}

export function adjustTaskProgress(
  userId: string,
  current: Task,
  delta: -1 | 1,
): QueuedMutation<boolean> {
  if (current.type !== 'progress') return unchanged(false)
  const nextCount = Math.max(0, Math.min(current.targetCount, current.count + delta))
  if (nextCount === current.count) return unchanged(false)

  const batch = writeBatch(db)
  batch.update(taskRef(userId, current.id), {
    count: increment(delta),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    newLogRef(userId, current.id),
    logData('progress', delta > 0 ? '进度 +1' : '进度 −1', {
      before: current.count,
      after: nextCount,
      delta,
    }),
  )
  return { result: true, committed: batch.commit() }
}

export function deleteTask(userId: string, taskId: string): QueuedMutation<boolean> {
  const reference = taskRef(userId, taskId)
  const committed = deleteDoc(reference).then(async () => {
    const logs = await getDocs(collection(reference, 'logs'))
    if (logs.empty) return
    const batch = writeBatch(db)
    logs.docs.forEach((entry) => batch.delete(entry.ref))
    await batch.commit()
  })
  return { result: true, committed }
}

export function subscribeTaskLogs(
  userId: string,
  taskId: string,
  onData: (logs: TaskLog[]) => void,
  onError: (error: Error) => void,
) {
  const logsQuery = query(collection(taskRef(userId, taskId), 'logs'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    logsQuery,
    (snapshot) =>
      onData(
        snapshot.docs.map((entry) => {
          const data = entry.data({ serverTimestamps: 'estimate' })
          return {
            id: entry.id,
            type: data.type === 'progress' ? 'progress' : 'update',
            action: String(data.action ?? ''),
            payload: (data.payload ?? {}) as Record<string, unknown>,
            createdAt: toDate(data.createdAt),
          }
        }),
      ),
    (error) => onError(error),
  )
}

export function subscribePreferences(
  userId: string,
  onData: (preferences: UserPreferences) => void,
) {
  return onSnapshot(doc(db, 'users', userId, 'settings', 'preferences'), (snapshot) => {
    onData({ hideCompleted: snapshot.exists() ? Boolean(snapshot.data().hideCompleted) : false })
  })
}

export async function savePreferences(userId: string, preferences: UserPreferences) {
  await setDoc(
    doc(db, 'users', userId, 'settings', 'preferences'),
    { ...preferences, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function removePreferences(userId: string) {
  await deleteDoc(doc(db, 'users', userId, 'settings', 'preferences'))
}
