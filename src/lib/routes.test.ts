import { describe, expect, it } from 'vitest'
import {
  boardRouteFromLocation,
  matchRoutePath,
  parseIds,
  parseTagTimeScope,
  pathForRoute,
  routeDefinitions,
  surfaceFromPathname,
  withDevelopmentFlags,
} from './routes'

describe('应用路由', () => {
  it('解析任务看板地址', () => {
    expect(boardRouteFromLocation(routeDefinitions.all)).toEqual({ name: 'board', scope: 'all' })
    expect(boardRouteFromLocation(routeDefinitions.today)).toEqual({ name: 'board', scope: 'today' })
    expect(boardRouteFromLocation(routeDefinitions.week)).toEqual({ name: 'board', scope: 'week' })
    // 非看板地址返回 null，由调用方回退到来源看板
    expect(boardRouteFromLocation(routeDefinitions.settings)).toBeNull()
    expect(boardRouteFromLocation('/unknown')).toBeNull()
    expect(boardRouteFromLocation('/tasks/task-1')).toBeNull()
  })

  it('识别当前渲染面', () => {
    expect(surfaceFromPathname('/')).toBe('board')
    expect(surfaceFromPathname(routeDefinitions.all)).toBe('board')
    expect(surfaceFromPathname(routeDefinitions.today)).toBe('board')
    expect(surfaceFromPathname('/tasks/tags/work')).toBe('board')
    expect(surfaceFromPathname(routeDefinitions.taskNew)).toBe('form')
    expect(surfaceFromPathname('/tasks/task-1')).toBe('detail')
    expect(surfaceFromPathname(routeDefinitions.settings)).toBe('settings')
    expect(surfaceFromPathname('/unknown')).toBe('board')
  })

  it('详情与新建路由支持安全编码', () => {
    const detailPath = pathForRoute({ name: 'task-detail', taskId: '任务 / 1' })
    const detailMatch = matchRoutePath(routeDefinitions.taskDetail, detailPath)
    expect(detailMatch?.params.taskId).toBe('任务 / 1')
    // 新建任务路由：默认无参数，?copy= 携带复制来源
    expect(pathForRoute({ name: 'task-new' })).toBe(routeDefinitions.taskNew)
    const copyPath = pathForRoute({ name: 'task-new', copyFrom: '任务 / 1' })
    const copyUrl = new URL(copyPath, 'https://example.com')
    expect(copyUrl.pathname).toBe(routeDefinitions.taskNew)
    expect(copyUrl.searchParams.get('copy')).toBe('任务 / 1')
  })

  it('标签看板使用动态标签参数并保留时间范围', () => {
    const route = { name: 'tag-board' as const, tagId: '工作 标签', scope: 'week' as const }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(boardRouteFromLocation(url.pathname, url.search)).toEqual(route)
  })

  it('时间看板叠加标签筛选时保持时间看板路由', () => {
    const route = { name: 'board' as const, scope: 'today' as const, tagIds: ['工作', 'waiting'], matchMode: 'any' as const }
    const path = pathForRoute(route)
    const url = new URL(path, 'https://example.com')
    expect(url.pathname).toBe(routeDefinitions.today)
    expect(boardRouteFromLocation(url.pathname, url.search)).toEqual(route)
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
    expect(boardRouteFromLocation(url.pathname, url.search)).toEqual(route)
  })

  it('非法自定义时间范围回退为全部', () => {
    const search = new URLSearchParams('scope=custom&from=2026-07-31&to=2026-07-01')
    expect(parseTagTimeScope(search)).toEqual({ scope: 'all' })
  })

  it('旧标签看板参数解析出首个标签', () => {
    expect(parseIds('work,focus')).toEqual(['work', 'focus'])
    expect(parseIds(' work ,, focus ,work')).toEqual(['work', 'focus'])
    expect(parseIds(null)).toEqual([])
  })

  it('开发态跳转保留 ?demo 参数', () => {
    expect(withDevelopmentFlags('/tasks', '?demo=1')).toBe('/tasks?demo=1')
    expect(withDevelopmentFlags('/tasks?scope=today', '?demo')).toBe('/tasks?scope=today&demo=1')
    expect(withDevelopmentFlags('/tasks', '')).toBe('/tasks')
  })
})
