import type { SyncState } from '../types'

export type SyncStatusKind = 'synced' | 'syncing' | 'offline' | 'error' | 'local'

export interface SyncStatusPresentation {
  kind: SyncStatusKind
  title: string
  detail: string
}

interface SyncStatusOptions {
  online: boolean
  syncState: SyncState
  error?: string
  demoMode?: boolean
}

export function getSyncStatus({
  online,
  syncState,
  error = '',
  demoMode = false,
}: SyncStatusOptions): SyncStatusPresentation {
  if (demoMode) {
    return {
      kind: 'local',
      title: '本地预览模式',
      detail: '体验数据只保存在当前页面中',
    }
  }
  if (error) {
    return {
      kind: 'error',
      title: '部分更改同步失败',
      detail: '本机内容仍然保留，请联网后重试',
    }
  }
  if (!online) {
    return {
      kind: 'offline',
      title: syncState.pendingWrites ? '更改已保存在本机' : '当前处于离线状态',
      detail: syncState.pendingWrites ? '联网后将自动同步' : '可以继续查看和编辑任务',
    }
  }
  if (syncState.pendingWrites) {
    return {
      kind: 'syncing',
      title: '已在本机保存，正在同步',
      detail: '无需停留在当前页面等待',
    }
  }
  if (syncState.fromCache) {
    return {
      kind: 'syncing',
      title: '正在连接云端',
      detail: '当前显示本地缓存内容',
    }
  }
  return {
    kind: 'synced',
    title: '已同步到云端',
    detail: '个人任务仅你可见',
  }
}
