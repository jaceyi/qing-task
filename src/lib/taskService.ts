import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { nextOccurrence, occurrenceKey } from './recurrence'
import { cleanTagName, dedupeTagIds, normalizeTagName } from './tagLogic'
import { completedOccurrenceTaskId, normalizeTaskDraft, switchedTaskValues, updatedTaskInfo } from './taskLogic'
import type {
  RecurrenceRule,
  SyncState,
  Tag,
  TagColor,
  Task,
  TaskDraft,
  TaskInfoFields,
  TaskLog,
  TaskLogScope,
  TaskLogType,
  TaskType,
  UserPreferences,
} from '../types'

export interface QueuedMutation<T> {
  result: T
  committed: Promise<void>
  /** 本次写入的日志文档引用；撤销时按此精确擦除，避免事后搬运/模糊匹配。 */
  logRefs?: DocumentReference[]
}

function unchanged<T>(result: T): QueuedMutation<T> {
  return { result, committed: Promise.resolve() }
}

function toDate(value: unknown) {
  return value instanceof Timestamp ? value.toDate() : null
}

function mapTask(id: string, data: DocumentData): Task {
  const recurrence = mapRecurrence(data.recurrence)
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
    schemaVersion: Number(data.schemaVersion ?? 1),
    tagIds: Array.isArray(data.tagIds) ? dedupeTagIds(data.tagIds.map(String)) : [],
    recurrence,
    seriesState: recurrence ? (data.seriesState === 'ended' ? 'ended' : 'active') : null,
    currentOccurrenceKey: recurrence
      ? String(data.currentOccurrenceKey ?? occurrenceKey(String(data.startDate ?? '')))
      : null,
    occurrenceSequence: recurrence ? Math.max(1, Number(data.occurrenceSequence ?? 1)) : 0,
    lastAdvanceMutationId: typeof data.lastAdvanceMutationId === 'string' ? data.lastAdvanceMutationId : null,
    parentTaskId: typeof data.parentTaskId === 'string' ? data.parentTaskId : undefined,
    occurrenceKey: typeof data.occurrenceKey === 'string' ? data.occurrenceKey : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function mapRecurrence(value: unknown): RecurrenceRule | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (!['hourly', 'daily', 'weekly', 'monthly', 'yearly'].includes(String(data.frequency))) return null
  const endData = data.end && typeof data.end === 'object' ? data.end as Record<string, unknown> : null
  const end: RecurrenceRule['end'] = endData?.kind === 'until' && typeof endData.date === 'string'
    ? { kind: 'until', date: endData.date }
    : { kind: 'never' }
  return {
    frequency: data.frequency as RecurrenceRule['frequency'],
    interval: Math.max(1, Math.min(999, Number(data.interval ?? 1))),
    ...(Array.isArray(data.byWeekdays)
      ? { byWeekdays: data.byWeekdays.filter((day): day is 1 | 2 | 3 | 4 | 5 | 6 | 7 => Number.isInteger(day) && day >= 1 && day <= 7) }
      : {}),
    ...(Number.isInteger(data.byMonth) ? { byMonth: Number(data.byMonth) } : {}),
    ...(Number.isInteger(data.byMonthDay) ? { byMonthDay: Number(data.byMonthDay) } : {}),
    end,
    timeZone: String(data.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    anchorStart: String(data.anchorStart ?? ''),
    durationMinutes: Math.max(0, Number(data.durationMinutes ?? 0)),
  }
}

function mapTag(id: string, data: DocumentData): Tag {
  return {
    id,
    name: String(data.name ?? ''),
    normalizedName: String(data.normalizedName ?? ''),
    color: data.color as TagColor,
    sortOrder: Number(data.sortOrder ?? 0),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    deletedAt: toDate(data.deletedAt),
  }
}

function taskRef(userId: string, taskId: string) {
  return doc(db, 'users', userId, 'tasks', taskId)
}

function newLogRef(userId: string, taskId: string) {
  return doc(collection(db, 'users', userId, 'tasks', taskId, 'logs'))
}

function occurrenceRef(userId: string, taskId: string, key: string) {
  return doc(db, 'users', userId, 'tasks', taskId, 'occurrences', key)
}

function tagRef(userId: string, tagId: string) {
  return doc(db, 'users', userId, 'tags', tagId)
}

function tagClaimRef(userId: string, normalizedName: string) {
  return doc(db, 'users', userId, 'tagNameClaims', encodeURIComponent(normalizedName))
}

function logData(
  type: TaskLogType,
  action: string,
  payload: Record<string, unknown>,
  scope: TaskLogScope = 'series',
  occurrenceKey?: string,
) {
  return {
    type,
    action,
    payload,
    scope,
    ...(occurrenceKey ? { occurrenceKey } : {}),
    seq: nextLogSeq(),
    createdAt: serverTimestamp(),
  }
}

// 同一 batch 内的多条日志共享同一个 serverTimestamp，用客户端严格递增序号保证因果顺序
// （如“达标 +1”必须先于“完成本次重复任务”展示）
let lastLogSeq = 0
function nextLogSeq() {
  const now = Date.now()
  lastLogSeq = now > lastLogSeq ? now : lastLogSeq + 1
  return lastLogSeq
}

export function sortLogsDesc(logs: TaskLog[]) {
  return logs.sort((a, b) => {
    const timeDiff = (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    if (timeDiff !== 0) return timeDiff
    return (b.seq ?? 0) - (a.seq ?? 0)
  })
}

/** 重复任务进行中的事件归属当前周期，供完成实例回溯展示；非重复任务归系列。 */
function occurrenceScopeOf(task: Task): { scope: TaskLogScope; occurrenceKey?: string } {
  const key = task.recurrence ? task.currentOccurrenceKey ?? occurrenceKey(task.startDate) : null
  return key ? { scope: 'occurrence', occurrenceKey: key } : { scope: 'series' }
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

export function subscribeTags(
  userId: string,
  onData: (tags: Tag[]) => void,
  onError: (error: Error) => void,
) {
  const tagsQuery = query(collection(db, 'users', userId, 'tags'), orderBy('sortOrder', 'asc'))
  return onSnapshot(
    tagsQuery,
    (snapshot) => onData(snapshot.docs.map((item) => mapTag(item.id, item.data({ serverTimestamps: 'estimate' })))),
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
    schemaVersion: 2,
    tagIds: dedupeTagIds(normalized.tagIds),
    recurrence: normalized.recurrence ?? null,
    seriesState: normalized.recurrence ? 'active' : null,
    currentOccurrenceKey: normalized.recurrence ? occurrenceKey(normalized.startDate) : null,
    occurrenceSequence: normalized.recurrence ? 1 : 0,
    lastAdvanceMutationId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    newLogRef(userId, reference.id),
    logData('create', copiedFrom ? '复制任务' : '创建任务', {
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
    type: TaskLogType
    action: string
    before: string | number
    after: string | number
  }> = []
  if (current.title !== next.title) {
    patch.title = next.title
    changes.push({ type: 'update', action: '修改任务名称', before: current.title, after: next.title })
  }
  if (current.description !== next.description) {
    patch.description = next.description
    changes.push({ type: 'update', action: '修改任务描述', before: current.description, after: next.description })
  }
  if (current.startDate !== next.startDate || current.endDate !== next.endDate) {
    patch.startDate = next.startDate
    patch.endDate = next.endDate
    if (current.startDate !== next.startDate) {
      changes.push({ type: 'update', action: '修改开始时间', before: current.startDate, after: next.startDate })
    }
    if (current.endDate !== next.endDate) {
      changes.push({ type: 'update', action: '修改结束时间', before: current.endDate, after: next.endDate })
    }
  }
  if (JSON.stringify(current.recurrence ?? null) !== JSON.stringify(next.recurrence ?? null)) {
    patch.recurrence = next.recurrence ?? null
    patch.seriesState = next.recurrence ? 'active' : null
    patch.currentOccurrenceKey = next.recurrence ? occurrenceKey(next.startDate) : null
    patch.occurrenceSequence = next.recurrence ? Math.max(1, current.occurrenceSequence ?? 1) : 0
    changes.push({
      type: 'recurrence',
      action: next.recurrence ? (current.recurrence ? '修改重复计划' : '开启重复') : '关闭重复',
      before: current.recurrence ? '重复' : '不重复',
      after: next.recurrence ? '重复' : '不重复',
    })
  }
  const currentTagIds = dedupeTagIds(current.tagIds)
  const nextTagIds = dedupeTagIds(next.tagIds)
  if (JSON.stringify(currentTagIds) !== JSON.stringify(nextTagIds)) {
    patch.tagIds = nextTagIds
    changes.push({
      type: 'tag',
      action: '修改任务标签',
      before: currentTagIds.length,
      after: nextTagIds.length,
    })
  }
  if (current.type === 'progress' && current.targetCount !== next.targetCount) {
    patch.targetCount = next.targetCount
    changes.push({
      type: 'update',
      action: '修改目标次数',
      before: current.targetCount,
      after: next.targetCount,
    })
  }
  if (current.type === 'progress' && current.count !== next.count) {
    patch.count = next.count
    changes.push({
      type: 'progress',
      action: '目标缩减，调整当前进度',
      before: current.count,
      after: next.count,
    })
  }

  if (changes.length === 0) return unchanged(false)

  // 重复任务进行中的修改归属当前周期，完成实例可回溯；重复计划本身的变更是系列级事件
  const batch = writeBatch(db)
  const logRefs: DocumentReference[] = []
  batch.update(taskRef(userId, current.id), { ...patch, updatedAt: serverTimestamp() })
  changes.forEach((change) => {
    const ref = newLogRef(userId, current.id)
    const scoped = change.type === 'recurrence' ? { scope: 'series' as const } : occurrenceScopeOf(current)
    batch.set(ref, logData(change.type, change.action, { before: change.before, after: change.after }, scoped.scope, scoped.occurrenceKey))
    logRefs.push(ref)
  })
  return { result: true, committed: batch.commit(), logRefs }
}

export function changeTaskType(
  userId: string,
  current: Task,
  nextType: TaskType,
  targetCount = 1,
): QueuedMutation<boolean> {
  if (current.type === nextType) return unchanged(false)
  const next = switchedTaskValues(current, nextType, targetCount)
  const scoped = occurrenceScopeOf(current)
  const batch = writeBatch(db)
  const logRef = newLogRef(userId, current.id)
  batch.update(taskRef(userId, current.id), { ...next, updatedAt: serverTimestamp() })
  batch.set(
    logRef,
    logData('type', '切换任务类型', {
      before: current.type,
      after: nextType,
      ...(nextType === 'progress' ? { targetCount: next.targetCount } : {}),
    }, scoped.scope, scoped.occurrenceKey),
  )
  return { result: true, committed: batch.commit(), logRefs: [logRef] }
}

export function setSingleCompletion(
  userId: string,
  current: Task,
  completed: boolean,
): QueuedMutation<boolean> {
  if (current.type !== 'single' || current.completed === completed) return unchanged(false)
  if (completed && current.recurrence && current.seriesState !== 'ended') {
    return advanceRecurringTask(userId, current, 'completed')
  }
  const scoped = occurrenceScopeOf(current)
  const batch = writeBatch(db)
  const logRef = newLogRef(userId, current.id)
  batch.update(taskRef(userId, current.id), {
    completed,
    ...(current.recurrence && !completed ? { seriesState: 'active' } : {}),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    logRef,
    logData('status', completed ? '完成任务' : '取消完成', {
      before: current.completed,
      after: completed,
    }, scoped.scope, scoped.occurrenceKey),
  )
  return { result: true, committed: batch.commit(), logRefs: [logRef] }
}

/** 已完成（或进行过）的进度任务一键归零；不可叠加撤销，与本机的“重置进度”日志对应。 */
export function resetTaskProgress(
  userId: string,
  current: Task,
): QueuedMutation<boolean> {
  if (current.type !== 'progress' || current.count <= 0) return unchanged(false)
  const scoped = occurrenceScopeOf(current)
  const batch = writeBatch(db)
  const logRef = newLogRef(userId, current.id)
  batch.update(taskRef(userId, current.id), { count: 0, updatedAt: serverTimestamp() })
  batch.set(
    logRef,
    logData('progress', '重置进度', { before: current.count, after: 0 }, scoped.scope, scoped.occurrenceKey),
  )
  return { result: true, committed: batch.commit(), logRefs: [logRef] }
}

export function adjustTaskProgress(
  userId: string,
  current: Task,
  delta: -1 | 1,
): QueuedMutation<boolean> {
  if (current.type !== 'progress') return unchanged(false)
  const nextCount = Math.max(0, Math.min(current.targetCount, current.count + delta))
  if (nextCount === current.count) return unchanged(false)
  if (delta > 0 && nextCount === current.targetCount && current.recurrence && current.seriesState !== 'ended') {
    // 达标的那次推进也要留下记录：由 advance 一并写入本期的最后一条“进度 +1”
    return advanceRecurringTask(userId, current, 'completed', new Date(), current.count)
  }

  const scoped = occurrenceScopeOf(current)
  const batch = writeBatch(db)
  const logRef = newLogRef(userId, current.id)
  batch.update(taskRef(userId, current.id), {
    count: increment(delta),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    logRef,
    logData('progress', delta > 0 ? '进度 +1' : '进度 −1', {
      before: current.count,
      after: nextCount,
      delta,
    }, scoped.scope, scoped.occurrenceKey),
  )
  return { result: true, committed: batch.commit(), logRefs: [logRef] }
}

export function advanceRecurringTask(
  userId: string,
  current: Task,
  result: 'completed' | 'skipped',
  completedAt = new Date(),
  incrementFrom?: number,
): QueuedMutation<boolean> {
  if (!current.recurrence || current.seriesState === 'ended') return unchanged(false)
  const next = nextOccurrence(current, completedAt)
  const mutationId = crypto.randomUUID()
  const key = current.currentOccurrenceKey || occurrenceKey(current.startDate)
  const batch = writeBatch(db)
  const logRefs: DocumentReference[] = []
  batch.set(
    occurrenceRef(userId, current.id, key),
    {
      occurrenceKey: key,
      result,
      scheduledStart: current.startDate,
      scheduledEnd: current.endDate,
      count: result === 'completed' && current.type === 'progress' ? current.targetCount : current.count,
      targetCount: current.targetCount,
      title: current.title,
      tagIds: dedupeTagIds(current.tagIds),
      completedAt: completedAt.toISOString(),
      mutationId,
      createdAt: serverTimestamp(),
    },
  )
  // 达标的那次推进照常入账：它属于本期的真实操作，不再被“完成”事件吞掉
  if (result === 'completed' && current.type === 'progress' && incrementFrom !== undefined) {
    const incrementRef = newLogRef(userId, current.id)
    batch.set(
      incrementRef,
      logData('progress', '进度 +1', {
        before: incrementFrom,
        after: current.targetCount,
        delta: 1,
      }, 'occurrence', key),
    )
    logRefs.push(incrementRef)
  }
  const instanceTaskId = result === 'completed' && next ? completedOccurrenceTaskId(current.id, key) : null
  const rollRef = newLogRef(userId, current.id)
  batch.set(
    rollRef,
    logData('recurrence', result === 'completed' ? '完成本次重复任务' : '跳过本次重复任务', {
      occurrenceKey: key,
      result,
      occurrenceSequence: current.occurrenceSequence ?? 1,
      scheduledStart: current.startDate,
      scheduledEnd: current.endDate,
      count: result === 'completed' && current.type === 'progress' ? current.targetCount : current.count,
      targetCount: current.targetCount,
      completedAt: completedAt.toISOString(),
      ...(next ? { nextStartDate: next.startDate } : { seriesEnded: true }),
      ...(instanceTaskId ? { instanceTaskId } : {}),
    }, 'series', key),
  )
  logRefs.push(rollRef)
  if (next) {
    if (result === 'completed' && instanceTaskId) {
      // 实例任务是看板上的完成卡片：不建自己的日志，历史通过 parentTaskId + occurrenceKey 回溯系列日志流
      batch.set(taskRef(userId, instanceTaskId), {
        title: current.title,
        description: current.description,
        startDate: current.startDate,
        endDate: current.endDate,
        type: current.type,
        targetCount: current.targetCount,
        count: current.type === 'progress' ? current.targetCount : 0,
        completed: current.type === 'single',
        schemaVersion: 3,
        tagIds: dedupeTagIds(current.tagIds),
        recurrence: null,
        seriesState: null,
        currentOccurrenceKey: null,
        occurrenceSequence: 0,
        lastAdvanceMutationId: null,
        parentTaskId: current.id,
        occurrenceKey: key,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    batch.update(taskRef(userId, current.id), {
      startDate: next.startDate,
      endDate: next.endDate,
      count: 0,
      completed: false,
      seriesState: 'active',
      currentOccurrenceKey: occurrenceKey(next.startDate),
      occurrenceSequence: (current.occurrenceSequence ?? 1) + 1,
      lastAdvanceMutationId: mutationId,
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.update(taskRef(userId, current.id), {
      count: current.type === 'progress' && result === 'completed' ? current.targetCount : current.count,
      completed: current.type === 'single' && result === 'completed',
      ...(result === 'completed'
        ? {
            recurrence: null,
            seriesState: null,
            currentOccurrenceKey: null,
            occurrenceSequence: 0,
          }
        : { seriesState: 'ended' }),
      lastAdvanceMutationId: mutationId,
      updatedAt: serverTimestamp(),
    })
  }
  return { result: true, committed: batch.commit(), logRefs }
}

/**
 * 撤销 = 擦除：恢复任务字段，并删掉被撤销操作写入的日志与派生数据（occurrence 记录、实例任务）。
 * 不写任何“撤销”日志：误操作不应该在历史中留下痕迹。
 */
export function eraseTaskAction(
  userId: string,
  taskId: string,
  fields: Record<string, unknown>,
  logRefs: DocumentReference[],
  extra: { occurrenceKeys?: string[]; taskIds?: string[] } = {},
): QueuedMutation<boolean> {
  const batch = writeBatch(db)
  batch.update(taskRef(userId, taskId), { ...fields, updatedAt: serverTimestamp() })
  logRefs.forEach((ref) => batch.delete(ref))
  extra.occurrenceKeys?.forEach((key) => batch.delete(occurrenceRef(userId, taskId, key)))
  extra.taskIds?.forEach((id) => batch.delete(taskRef(userId, id)))
  return { result: true, committed: batch.commit() }
}

export function skipRecurringOccurrence(userId: string, current: Task) {
  return advanceRecurringTask(userId, current, 'skipped')
}

/** 清掉任务的日志子集合（删除任务时级联清理，含旧版实例任务自带的日志）。 */
export async function deleteTaskLogs(userId: string, taskId: string): Promise<void> {
  const snapshot = await getDocs(collection(db, 'users', userId, 'tasks', taskId, 'logs'))
  if (snapshot.empty) return
  const batch = writeBatch(db)
  for (const entry of snapshot.docs) batch.delete(entry.ref)
  await batch.commit()
}

export async function createTag(
  userId: string,
  name: string,
  color: TagColor = 'lavender',
): Promise<Tag> {
  const cleanName = cleanTagName(name)
  const normalizedName = normalizeTagName(cleanName)
  if (!normalizedName) throw new Error('请输入标签名称')
  const reference = doc(collection(db, 'users', userId, 'tags'))
  const claim = tagClaimRef(userId, normalizedName)
  const now = new Date()
  const existingId = await runTransaction(db, async (transaction) => {
    const existingClaim = await transaction.get(claim)
    if (existingClaim.exists()) return String(existingClaim.data().tagId)
    transaction.set(reference, {
      name: cleanName,
      normalizedName,
      color,
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    transaction.set(claim, { tagId: reference.id, normalizedName, createdAt: serverTimestamp() })
    return reference.id
  })
  if (existingId !== reference.id) {
    const existing = await runTransaction(db, async (transaction) => transaction.get(tagRef(userId, existingId)))
    if (existing.exists()) return mapTag(existing.id, existing.data())
  }
  return {
    id: reference.id,
    name: cleanName,
    normalizedName,
    color,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateTag(
  userId: string,
  current: Tag,
  changes: { name?: string; color?: TagColor; sortOrder?: number },
) {
  const name = changes.name === undefined ? current.name : cleanTagName(changes.name)
  const normalizedName = normalizeTagName(name)
  if (!normalizedName) throw new Error('请输入标签名称')
  await runTransaction(db, async (transaction) => {
    if (normalizedName !== current.normalizedName) {
      const nextClaim = tagClaimRef(userId, normalizedName)
      const existing = await transaction.get(nextClaim)
      if (existing.exists() && existing.data().tagId !== current.id) throw new Error('已有同名标签，请选择合并')
      transaction.delete(tagClaimRef(userId, current.normalizedName))
      transaction.set(nextClaim, { tagId: current.id, normalizedName, createdAt: serverTimestamp() })
    }
    transaction.update(tagRef(userId, current.id), {
      name,
      normalizedName,
      color: changes.color ?? current.color,
      sortOrder: changes.sortOrder ?? current.sortOrder,
      updatedAt: serverTimestamp(),
    })
  })
}

async function updateTasksForTag(
  userId: string,
  sourceTagId: string,
  replacementTagId?: string,
) {
  const snapshot = await getDocs(collection(db, 'users', userId, 'tasks'))
  const affected = snapshot.docs.filter((task) => Array.isArray(task.data().tagIds) && task.data().tagIds.includes(sourceTagId))
  for (let offset = 0; offset < affected.length; offset += 400) {
    const batch = writeBatch(db)
    affected.slice(offset, offset + 400).forEach((task) => {
      const next = dedupeTagIds([
        ...task.data().tagIds.filter((tagId: string) => tagId !== sourceTagId),
        ...(replacementTagId ? [replacementTagId] : []),
      ])
      batch.update(task.ref, { tagIds: next, updatedAt: serverTimestamp() })
    })
    await batch.commit()
  }
  return affected.length
}

export async function mergeTags(userId: string, source: Tag, target: Tag) {
  if (source.id === target.id) return 0
  const affected = await updateTasksForTag(userId, source.id, target.id)
  const batch = writeBatch(db)
  batch.delete(tagRef(userId, source.id))
  batch.delete(tagClaimRef(userId, source.normalizedName))
  await batch.commit()
  return affected
}

export async function deleteTag(userId: string, tag: Tag) {
  const affected = await updateTasksForTag(userId, tag.id)
  const batch = writeBatch(db)
  batch.delete(tagRef(userId, tag.id))
  batch.delete(tagClaimRef(userId, tag.normalizedName))
  await batch.commit()
  return affected
}

export function deleteTask(userId: string, taskId: string): QueuedMutation<boolean> {
  const reference = taskRef(userId, taskId)
  const committed = deleteDoc(reference).then(async () => {
    const [logs, occurrences, linkedInstances, legacyInstances] = await Promise.all([
      getDocs(collection(reference, 'logs')),
      getDocs(collection(reference, 'occurrences')),
      // 新版实例任务带 parentTaskId；旧版实例无该字段，按命名前缀兼容查找
      getDocs(query(collection(db, 'users', userId, 'tasks'), where('parentTaskId', '==', taskId))),
      getDocs(query(
        collection(db, 'users', userId, 'tasks'),
        where('__name__', '>=', `completed-${taskId}-`),
        where('__name__', '<=', `completed-${taskId}-\uf8ff`),
      )),
    ])
    const instances = new Map([...linkedInstances.docs, ...legacyInstances.docs].map((entry) => [entry.id, entry]))
    const instanceSubCollections = await Promise.all(
      [...instances.keys()].flatMap((instanceId) => [
        getDocs(collection(db, 'users', userId, 'tasks', instanceId, 'logs')),
        getDocs(collection(db, 'users', userId, 'tasks', instanceId, 'occurrences')),
      ]),
    )
    const deletions = [
      ...logs.docs,
      ...occurrences.docs,
      ...instances.values(),
      ...instanceSubCollections.flatMap((snapshot) => snapshot.docs),
    ]
    if (deletions.length === 0) return
    // 单个 batch 上限 500 次操作，分批提交
    for (let index = 0; index < deletions.length; index += 400) {
      const batch = writeBatch(db)
      deletions.slice(index, index + 400).forEach((entry) => batch.delete(entry.ref))
      await batch.commit()
    }
  })
  return { result: true, committed }
}

const TASK_LOG_TYPES: TaskLogType[] = ['create', 'update', 'progress', 'recurrence', 'tag', 'type', 'status', 'roll']

function mapTaskLog(entry: { id: string; data: (options?: { serverTimestamps: 'estimate' }) => DocumentData }): TaskLog {
  const data = entry.data({ serverTimestamps: 'estimate' })
  return {
    id: entry.id,
    type: TASK_LOG_TYPES.includes(data.type) ? data.type : 'update',
    action: String(data.action ?? ''),
    payload: (data.payload ?? {}) as Record<string, unknown>,
    createdAt: toDate(data.createdAt),
    scope: data.scope === 'occurrence' ? 'occurrence' : 'series',
    occurrenceKey: typeof data.occurrenceKey === 'string' ? data.occurrenceKey : undefined,
    seq: typeof data.seq === 'number' ? data.seq : undefined,
  }
}

export function subscribeTaskLogs(
  userId: string,
  taskId: string,
  onData: (logs: TaskLog[]) => void,
  onError: (error: Error) => void,
) {
  const logsQuery = query(collection(taskRef(userId, taskId), 'logs'))
  return onSnapshot(
    logsQuery,
    (snapshot) => onData(sortLogsDesc(snapshot.docs.map(mapTaskLog))),
    (error) => onError(error),
  )
}

/** 完成实例的历史：回系列日志流按 occurrenceKey 查询（含本期内的进度/修改与收尾事件）。 */
export function subscribeOccurrenceLogs(
  userId: string,
  parentTaskId: string,
  occurrenceKey: string,
  onData: (logs: TaskLog[]) => void,
  onError: (error: Error) => void,
) {
  const logsQuery = query(
    collection(taskRef(userId, parentTaskId), 'logs'),
    where('occurrenceKey', '==', occurrenceKey),
  )
  return onSnapshot(
    logsQuery,
    (snapshot) => onData(sortLogsDesc(snapshot.docs.map(mapTaskLog))),
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
