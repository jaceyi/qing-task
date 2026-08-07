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

  it('详情与新建路由支持安全编码', () => {
    const detailPath = pathForRoute({ name: 'task-detail', taskId: '任务 / 1' })
    expect(parseAppRoute(detailPath)).toEqual({ name: 'task-detail', taskId: '任务 / 1' })
    // 新建任务路由：默认无参数，?copy= 携带复制来源
    expect(parseAppRoute(routeDefinitions.taskNew)).toEqual({ name: 'task-new' })
    expect(parseAppRoute(routeDefinitions.taskNew, '?copy=task-1')).toEqual({ name: 'task-new', copyFrom: 'task-1' })
    const copyPath = pathForRoute({ name: 'task-new', copyFrom: '任务 / 1' })
    const copyUrl = new URL(copyPath, 'https://example.com')
    expect(parseAppRoute(copyUrl.pathname, copyUrl.search)).toEqual({ name: 'task-new', copyFrom: '任务 / 1' })
  })

  it('标签看板使用动态标签参数并保留时间范围', () => {
    const route = { name: 'tag-board' as const, tagId: '工作 标签', scope: 'week' as const }
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
      tagId: '工作',
      scope: 'custom' as const,
      customStart: '2026-07-01',
      customEnd: '2026-07-31',
    }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(parseAppRoute(url.pathname, url.search)).toEqual(route)
  })

  it('旧标签看板地址会解析为单标签路由', () => {
    expect(parseAppRoute(routeDefinitions.legacyTags, '?ids=work,focus&scope=today')).toEqual({
      name: 'tag-board',
      tagId: 'work',
      scope: 'today',
    })
  })
})
