import { describe, expect, it } from 'vitest'
import { parseAppRoute, pathForRoute, routeDefinitions } from './routes'

describe('应用路由', () => {
  it('解析任务看板与设置页', () => {
    expect(parseAppRoute(routeDefinitions.today)).toEqual({ name: 'board', scope: 'today' })
    expect(parseAppRoute(routeDefinitions.week)).toEqual({ name: 'board', scope: 'week' })
    expect(parseAppRoute(routeDefinitions.all)).toEqual({ name: 'board', scope: 'all' })
    expect(parseAppRoute(routeDefinitions.settings)).toEqual({ name: 'settings' })
  })

  it('详情与复制路由支持安全编码', () => {
    const detailPath = pathForRoute({ name: 'task-detail', taskId: '任务 / 1' })
    expect(parseAppRoute(detailPath)).toEqual({ name: 'task-detail', taskId: '任务 / 1' })
    expect(parseAppRoute('/tasks/new', '?copy=task-1')).toEqual({
      name: 'task-new',
      copiedFrom: 'task-1',
    })
  })
})
