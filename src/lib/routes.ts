import { matchPath } from 'react-router'
import type { BoardScope, TagMatchMode, TimeFilterScope } from '../types'

export interface TimeBoardRoute {
  name: 'board'
  scope: BoardScope
  tagIds?: string[]
  matchMode?: TagMatchMode
}

export interface TagBoardRoute {
  name: 'tag-board'
  tagId: string
  scope: TimeFilterScope
  customStart?: string
  customEnd?: string
}

export type BoardRoute = TimeBoardRoute | TagBoardRoute

export type AppRoute =
  | BoardRoute
  | { name: 'task-new'; copyFrom?: string }
  | { name: 'task-detail'; taskId: string }
  | { name: 'settings' }
  | { name: 'analytics' }

export type AppRouteName = AppRoute['name']
export type RouteSurface = 'board' | 'detail' | 'settings' | 'form' | 'analytics'
export type RouteHistoryMode = 'push' | 'replace'

export const DEFAULT_BOARD_ROUTE: TimeBoardRoute = { name: 'board', scope: 'all' }

export const routeDefinitions = {
  root: '/',
  all: '/tasks',
  today: '/tasks/today',
  week: '/tasks/week',
  taskDetail: '/tasks/:taskId',
  taskNew: '/tasks/new',
  tagBoard: '/tasks/tags/:tagId',
  legacyTags: '/tasks/tags',
  analytics: '/analytics',
  settings: '/settings',
} as const

const routeHistoryMode: Record<AppRouteName, RouteHistoryMode> = {
  // 看板之间切换不产生历史堆栈，详情/新建/设置/分析压入历史支持返回
  board: 'replace',
  'tag-board': 'replace',
  'task-new': 'push',
  'task-detail': 'push',
  settings: 'push',
  analytics: 'push',
}

function appendQuery(path: string, params: URLSearchParams) {
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}`
}

export function parseIds(value: string | null) {
  return [...new Set((value ?? '').split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 10)
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

/** react-router 的 matchPath 不解码百分号编码，路由匹配前需按段解码（与官方 decodePath 行为一致）。 */
function decodePathname(pathname: string) {
  try {
    return pathname.split('/').map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F')).join('/')
  } catch {
    return pathname
  }
}

/** 按路由模式匹配已解码的 pathname，params 为解码后的值。 */
export function matchRoutePath(pattern: string, pathname: string) {
  return matchPath(pattern, decodePathname(pathname))
}

export function parseTimeBoard(scope: BoardScope, search: URLSearchParams): TimeBoardRoute {
  const tagIds = parseIds(search.get('tags'))
  return {
    name: 'board',
    scope,
    ...(tagIds.length
      ? { tagIds, matchMode: search.get('match') === 'any' ? 'any' as const : 'all' as const }
      : {}),
  }
}

export function parseTagTimeScope(search: URLSearchParams) {
  const scope = search.get('scope')
  const customStart = search.get('from')
  const customEnd = search.get('to')
  if (scope === 'custom' && validDate(customStart) && validDate(customEnd) && customStart <= customEnd) {
    return { scope: 'custom' as const, customStart, customEnd }
  }
  return { scope: scope === 'today' || scope === 'week' ? scope : 'all' } satisfies { scope: BoardScope }
}

function boardPath(scope: BoardScope) {
  return scope === 'today'
    ? routeDefinitions.today
    : scope === 'week'
      ? routeDefinitions.week
      : routeDefinitions.all
}

const routeBuilders: {
  [Name in AppRouteName]: (route: Extract<AppRoute, { name: Name }>) => string
} = {
  board: (route) => {
    const params = new URLSearchParams()
    if (route.tagIds?.length) params.set('tags', route.tagIds.join(','))
    if (route.tagIds?.length && route.matchMode === 'any') params.set('match', 'any')
    return appendQuery(boardPath(route.scope), params)
  },
  'tag-board': (route) => {
    const params = new URLSearchParams()
    if (route.scope !== 'all') params.set('scope', route.scope)
    if (route.scope === 'custom' && route.customStart && route.customEnd) {
      params.set('from', route.customStart)
      params.set('to', route.customEnd)
    }
    return appendQuery(`/tasks/tags/${encodeURIComponent(route.tagId)}`, params)
  },
  'task-new': (route) => {
    if (!route.copyFrom) return routeDefinitions.taskNew
    return appendQuery(routeDefinitions.taskNew, new URLSearchParams({ copy: route.copyFrom }))
  },
  'task-detail': (route) => `/tasks/${encodeURIComponent(route.taskId)}`,
  settings: () => routeDefinitions.settings,
  analytics: () => routeDefinitions.analytics,
}

export function pathForRoute<Route extends AppRoute>(route: Route) {
  const build = routeBuilders[route.name] as (value: Route) => string
  return build(route)
}

export function getRouteHistoryMode(route: AppRoute) {
  return routeHistoryMode[route.name]
}

export function isBoardRoute(route: AppRoute): route is BoardRoute {
  return route.name === 'board' || route.name === 'tag-board'
}

/** 从当前地址解析看板路由；非看板地址（详情/新建/设置等）返回 null。 */
export function boardRouteFromLocation(pathname: string, search = ''): BoardRoute | null {
  const params = new URLSearchParams(search)
  if (pathname === routeDefinitions.all) return parseTimeBoard('all', params)
  if (pathname === routeDefinitions.today) return parseTimeBoard('today', params)
  if (pathname === routeDefinitions.week) return parseTimeBoard('week', params)
  const tagMatch = matchRoutePath(routeDefinitions.tagBoard, pathname)
  if (tagMatch) {
    return { name: 'tag-board', tagId: tagMatch.params.tagId ?? '', ...parseTagTimeScope(params) }
  }
  return null
}

/** 由 pathname 判断当前渲染面，供布局层决定标题栏、底部导航、辅助面板的显隐。 */
export function surfaceFromPathname(pathname: string): RouteSurface {
  if (pathname === routeDefinitions.settings) return 'settings'
  if (pathname === routeDefinitions.analytics) return 'analytics'
  if (pathname === routeDefinitions.taskNew) return 'form'
  if (
    pathname === routeDefinitions.all
    || pathname === routeDefinitions.today
    || pathname === routeDefinitions.week
    || pathname === routeDefinitions.legacyTags
    || matchRoutePath(routeDefinitions.tagBoard, pathname)
  ) return 'board'
  if (matchRoutePath(routeDefinitions.taskDetail, pathname)) return 'detail'
  // 未知路径会被路由表重定向回任务看板
  return 'board'
}

/** 开发态 ?demo 体验参数需要在路由跳转后继续保留。 */
export function withDevelopmentFlags(path: string, currentSearch: string) {
  const next = new URL(path, window.location.origin)
  const current = new URLSearchParams(currentSearch)
  if (current.has('demo')) next.searchParams.set('demo', '1')
  return `${next.pathname}${next.search}`
}
