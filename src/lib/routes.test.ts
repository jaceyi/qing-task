import { describe, expect, it } from 'vitest'
import { parseAppRoute, pathForRoute, routeDefinitions } from './routes'

describe('应用路由', () => {
  it('解析任务看板与设置页', () => {
    expect(parseAppRoute('/')).toEqual({ name: 'board', scope: 'all' })
    expect(parseAppRoute(routeDefinitions.today)).toEqual({ name: 'board', scope: 'today' })
    expect(parseAppRoute(routeDefinitions.week)).toEqual({ name: 'board', scope: 'week' })
    expect(parseAppRoute(routeDefinitions.all)).toEqual({ name: 'board', scope: 'all' })
    expect(parseAppRoute(routeDefinitions.settings)).toEqual({ name: 'settings' })
    expect(parseAppRoute('/unknown')).toEqual({ name: 'board', scope: 'all' })
  })

  it('详情与复制路由支持安全编码', () => {
    const detailPath = pathForRoute({ name: 'task-detail', taskId: '任务 / 1' })
    expect(parseAppRoute(detailPath)).toEqual({ name: 'task-detail', taskId: '任务 / 1' })
    expect(parseAppRoute('/tasks/new', '?copy=task-1')).toEqual({
      name: 'task-new',
      copiedFrom: 'task-1',
    })
  })

  it('标签看板保留多标签、匹配方式和时间范围', () => {
    const route = { name: 'tag-board' as const, tagIds: ['工作', 'waiting'], matchMode: 'any' as const, scope: 'week' as const }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(parseAppRoute(url.pathname, url.search)).toEqual(route)
  })

  it('时间看板叠加标签筛选时保持时间看板路由', () => {
    const route = { name: 'board' as const, scope: 'today' as const, tagIds: ['工作', 'waiting'], matchMode: 'any' as const }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(url.pathname).toBe(routeDefinitions.today)
    expect(parseAppRoute(url.pathname, url.search)).toEqual(route)
  })

  it('标签看板支持可分享的自定义时间范围', () => {
    const route = {
      name: 'tag-board' as const,
      tagIds: ['工作'],
      matchMode: 'all' as const,
      scope: 'custom' as const,
      customStart: '2026-07-01',
      customEnd: '2026-07-31',
    }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(parseAppRoute(url.pathname, url.search)).toEqual(route)
  })
})
