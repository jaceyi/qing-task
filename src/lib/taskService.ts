import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { normalizeTaskDraft, switchedTaskValues } from './taskLogic'
import type {
  SyncState,
  Task,
  TaskDraft,
  TaskLog,
  TaskLogType,
  TaskType,
  UserPreferences,
} from '../types'

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : null
}

function mapTask(id: string, data: DocumentData): Task {
  return {
    id,
    title: String(data.title ?? ''),
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
        snapshot.docs.map((item) => mapTask(item.id, item.data())),
        {
          fromCache: snapshot.metadata.fromCache,
          pendingWrites: snapshot.metadata.hasPendingWrites,
        },
      )
    },
    (error) => onError(error),
  )
}

export async function createTask(
  userId: string,
  draft: TaskDraft,
  copiedFrom?: string,
) {
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
  await batch.commit()
  return reference.id
}

export async function updateTaskInfo(
  userId: string,
  taskId: string,
  fields: Pick<Task, 'title' | 'startDate' | 'endDate' | 'targetCount'>,
) {
  const reference = taskRef(userId, taskId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) throw new Error('任务不存在')
    const current = mapTask(snapshot.id, snapshot.data())
    const targetCount =
      current.type === 'progress'
        ? Math.min(99_999, Math.max(1, Math.round(fields.targetCount)))
        : 0
    const nextCount = current.type === 'progress' ? Math.min(current.count, targetCount) : 0
    const next = {
      title: fields.title.trim().slice(0, 120),
      startDate: fields.startDate,
      endDate: fields.endDate,
      targetCount,
      count: nextCount,
      updatedAt: serverTimestamp(),
    }

    const changes: Array<{
      action: string
      before: string | number
      after: string | number
    }> = []
    if (current.title !== next.title) {
      changes.push({ action: '修改任务名称', before: current.title, after: next.title })
    }
    if (current.startDate !== next.startDate) {
      changes.push({ action: '修改开始时间', before: current.startDate, after: next.startDate })
    }
    if (current.endDate !== next.endDate) {
      changes.push({ action: '修改结束时间', before: current.endDate, after: next.endDate })
    }
    if (current.type === 'progress' && current.targetCount !== next.targetCount) {
      changes.push({
        action: '修改目标次数',
        before: current.targetCount,
        after: next.targetCount,
      })
    }
    if (current.type === 'progress' && current.count !== next.count) {
      changes.push({
        action: '目标缩减，调整当前进度',
        before: current.count,
        after: next.count,
      })
    }

    if (changes.length === 0) return
    transaction.update(reference, next)
    changes.forEach((change) => {
      transaction.set(
        newLogRef(userId, taskId),
        logData('update', change.action, { before: change.before, after: change.after }),
      )
    })
  })
}

export async function changeTaskType(
  userId: string,
  taskId: string,
  nextType: TaskType,
  targetCount = 1,
) {
  const reference = taskRef(userId, taskId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) throw new Error('任务不存在')
    const current = mapTask(snapshot.id, snapshot.data())
    if (current.type === nextType) return
    const next = switchedTaskValues(current, nextType, targetCount)
    transaction.update(reference, { ...next, updatedAt: serverTimestamp() })
    transaction.set(
      newLogRef(userId, taskId),
      logData('update', '切换任务类型', {
        before: current.type,
        after: nextType,
        ...(nextType === 'progress' ? { targetCount: next.targetCount } : {}),
      }),
    )
  })
}

export async function setSingleCompletion(userId: string, taskId: string, completed: boolean) {
  const reference = taskRef(userId, taskId)
  let changed = false
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) throw new Error('任务不存在')
    const current = mapTask(snapshot.id, snapshot.data())
    if (current.type !== 'single' || current.completed === completed) return
    changed = true
    transaction.update(reference, { completed, updatedAt: serverTimestamp() })
    transaction.set(
      newLogRef(userId, taskId),
      logData('progress', completed ? '完成任务' : '取消完成', {
        before: current.completed,
        after: completed,
      }),
    )
  })
  return changed
}

export async function adjustTaskProgress(userId: string, taskId: string, delta: -1 | 1) {
  const reference = taskRef(userId, taskId)
  let changed = false
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (!snapshot.exists()) throw new Error('任务不存在')
    const current = mapTask(snapshot.id, snapshot.data())
    if (current.type !== 'progress') return
    const nextCount = Math.max(0, Math.min(current.targetCount, current.count + delta))
    if (nextCount === current.count) return
    changed = true
    transaction.update(reference, { count: nextCount, updatedAt: serverTimestamp() })
    transaction.set(
      newLogRef(userId, taskId),
      logData('progress', delta > 0 ? '进度 +1' : '进度 −1', {
        before: current.count,
        after: nextCount,
      }),
    )
  })
  return changed
}

export async function deleteTask(userId: string, taskId: string) {
  const reference = taskRef(userId, taskId)
  const logs = await getDocs(collection(reference, 'logs'))
  const batch = writeBatch(db)
  logs.docs.forEach((entry) => batch.delete(entry.ref))
  batch.delete(reference)
  await batch.commit()
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
        snapshot.docs.map((entry) => ({
          id: entry.id,
          type: entry.data().type === 'progress' ? 'progress' : 'update',
          action: String(entry.data().action ?? ''),
          payload: (entry.data().payload ?? {}) as Record<string, unknown>,
          createdAt: toDate(entry.data().createdAt),
        })),
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
