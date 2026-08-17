import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../context/SessionContext'
import { buildDemoAnalyticsHistory } from '../data/demo'
import type { AnalyticsLog } from '../lib/analytics'
import { readEnvelope, storageKeys, writeEnvelope } from '../lib/storage'
import { fetchAnalyticsHistory } from '../lib/taskService'
import type { OccurrenceRecord, Task } from '../types'

export interface AnalyticsDataState {
  occurrences: OccurrenceRecord[]
  logs: AnalyticsLog[]
  loading: boolean
  error: string
  /** 数据是否来自本轮成功拉取；false 表示正在展示本地缓存。 */
  refreshed: boolean
  /** 当前展示数据的写入时刻（用于“缓存数据”提示）。 */
  cachedAt: number | null
}

const idleState: AnalyticsDataState = { occurrences: [], logs: [], loading: false, error: '', refreshed: true, cachedAt: null }

interface SerializedOccurrence extends Omit<OccurrenceRecord, 'completedAt'> {
  completedAt: string | null
}

interface SerializedLog extends Omit<AnalyticsLog, 'createdAt'> {
  createdAt: string | null
}

interface SerializedCache {
  since: number
  occurrences: SerializedOccurrence[]
  logs: SerializedLog[]
}

const validateCache = (value: unknown): SerializedCache | null => {
  if (!value || typeof value !== 'object') return null
  const parsed = value as Partial<SerializedCache>
  if (typeof parsed.since !== 'number' || !Array.isArray(parsed.occurrences) || !Array.isArray(parsed.logs)) return null
  return { since: parsed.since, occurrences: parsed.occurrences, logs: parsed.logs }
}

function reviveCache(cache: SerializedCache): { occurrences: OccurrenceRecord[]; logs: AnalyticsLog[] } {
  return {
    occurrences: cache.occurrences.map((item) => ({
      ...item,
      completedAt: item.completedAt ? new Date(item.completedAt) : null,
    })),
    logs: cache.logs.map((item) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt) : null,
    })),
  }
}

function serializeCache(
  sinceTime: number,
  data: { occurrences: OccurrenceRecord[]; logs: AnalyticsLog[] },
): SerializedCache {
  return {
    since: sinceTime,
    occurrences: data.occurrences.map((item) => ({ ...item, completedAt: item.completedAt?.toISOString() ?? null })),
    logs: data.logs.map((item) => ({ ...item, createdAt: item.createdAt?.toISOString() ?? null })),
  }
}

/** 只有关键字段变化才值得重拉：任务身份、更新时间、是否重复、是否实例。 */
function taskSignature(tasks: Task[]) {
  return tasks
    .map((task) => `${task.id}|${task.updatedAt?.getTime() ?? 0}|${task.recurrence ? 1 : 0}|${task.parentTaskId ?? ''}`)
    .join(';')
}

/**
 * 分析页历史数据：缓存优先（stale-while-revalidate），进入页面即时渲染上次结果，
 * 后台静默刷新并写回缓存；无缓存时才显示骨架屏。
 * 体验模式直接使用演示数据；未登录时保持空态。reloadToken 变化时强制重拉（用于失败重试）。
 * 任务快照变化（完成、编辑、新增系列）时自动刷新，保证与看板数据一致。
 */
export function useAnalyticsData(since: Date | null, tasks: Task[], reloadToken = 0): AnalyticsDataState {
  const { userId, demoMode } = useSession()
  const sinceTime = since?.getTime() ?? null
  const signature = useMemo(() => taskSignature(tasks), [tasks])
  const [state, setState] = useState<AnalyticsDataState>(idleState)

  // 拉取时读取最新任务快照；依赖只用签名，避免快照元数据抖动触发重拉
  const tasksRef = useRef(tasks)
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (sinceTime === null) {
      setState(idleState)
      return
    }
    if (demoMode) {
      const demo = buildDemoAnalyticsHistory()
      setState({ occurrences: demo.occurrences, logs: demo.logs, loading: false, error: '', refreshed: true, cachedAt: null })
      return
    }
    if (!userId) {
      setState(idleState)
      return
    }

    let cancelled = false
    const cacheKey = storageKeys.analyticsCacheFor(userId)
    const enveloped = readEnvelope(cacheKey, validateCache)
    // 缓存的抓取起点不晚于请求起点时才覆盖当前窗口，可直接用于首屏
    if (enveloped && enveloped.value.since <= sinceTime) {
      setState({ ...reviveCache(enveloped.value), loading: false, error: '', refreshed: false, cachedAt: enveloped.savedAt })
    } else {
      setState((current) => ({ ...current, loading: true, error: '' }))
    }
    fetchAnalyticsHistory(userId, new Date(sinceTime), tasksRef.current)
      .then((data) => {
        if (cancelled) return
        writeEnvelope(cacheKey, serializeCache(sinceTime, data))
        setState({ occurrences: data.occurrences, logs: data.logs, loading: false, error: '', refreshed: true, cachedAt: Date.now() })
      })
      .catch((reason) => {
        if (cancelled) return
        const detail = reason instanceof Error ? reason.message : '分析数据加载失败'
        setState((current) => ({ ...current, loading: false, error: detail }))
      })
    return () => {
      cancelled = true
    }
  }, [demoMode, userId, sinceTime, reloadToken, signature])

  return state
}
