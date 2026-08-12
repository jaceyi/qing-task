import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../context/SessionContext'
import { buildDemoAnalyticsHistory } from '../data/demo'
import type { AnalyticsLog } from '../lib/analytics'
import { fetchAnalyticsHistory } from '../lib/taskService'
import type { OccurrenceRecord, Task } from '../types'

export interface AnalyticsDataState {
  occurrences: OccurrenceRecord[]
  logs: AnalyticsLog[]
  loading: boolean
  error: string
}

const idleState: AnalyticsDataState = { occurrences: [], logs: [], loading: false, error: '' }

/** 只有关键字段变化才值得重拉：任务身份、更新时间、是否重复、是否实例。 */
function taskSignature(tasks: Task[]) {
  return tasks
    .map((task) => `${task.id}|${task.updatedAt?.getTime() ?? 0}|${task.recurrence ? 1 : 0}|${task.parentTaskId ?? ''}`)
    .join(';')
}

/**
 * 分析页历史数据：按抓取起点拉取周期账本与完成日志。
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
      setState({ occurrences: demo.occurrences, logs: demo.logs, loading: false, error: '' })
      return
    }
    if (!userId) {
      setState(idleState)
      return
    }

    let cancelled = false
    setState((current) => ({ ...current, loading: true, error: '' }))
    fetchAnalyticsHistory(userId, new Date(sinceTime), tasksRef.current)
      .then((data) => {
        if (!cancelled) setState({ occurrences: data.occurrences, logs: data.logs, loading: false, error: '' })
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
