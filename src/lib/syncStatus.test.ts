import { describe, expect, it } from 'vitest'
import { getSyncStatus } from './syncStatus'

describe('同步状态文案', () => {
  it('有本地待同步写入时明确告诉用户无需等待', () => {
    expect(getSyncStatus({
      online: true,
      syncState: { fromCache: false, pendingWrites: true },
    })).toEqual({
      kind: 'syncing',
      title: '已在本机保存，正在同步',
      detail: '无需停留在当前页面等待',
    })
  })

  it('离线时区分是否存在待同步内容', () => {
    expect(getSyncStatus({
      online: false,
      syncState: { fromCache: true, pendingWrites: true },
    })).toMatchObject({ kind: 'offline', title: '更改已保存在本机' })
    expect(getSyncStatus({
      online: false,
      syncState: { fromCache: true, pendingWrites: false },
    })).toMatchObject({ kind: 'offline', title: '当前处于离线状态' })
  })

  it('失败状态优先于在线状态展示', () => {
    expect(getSyncStatus({
      online: true,
      syncState: { fromCache: false, pendingWrites: false },
      error: 'permission-denied',
    })).toMatchObject({ kind: 'error', title: '部分更改同步失败' })
  })
})
