import { matchRoutes, type NonIndexRouteObject, type Params } from 'react-router'
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
  | { name: 'task-detail'; taskId: string }
  | { name: 'settings' }

export type AppRouteName = AppRoute['name']
export type RouteSurface = 'board' | 'detail' | 'settings'
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
  settings: '/settings',
} as const

interface RouteMetadata {
  surface: RouteSurface
  historyMode: RouteHistoryMode
}

const routeMetadata: Record<AppRouteName, RouteMetadata> = {
  board: { surface: 'board', historyMode: 'replace' },
  'tag-board': { surface: 'board', historyMode: 'replace' },
  'task-detail': { surface: 'detail', historyMode: 'push' },
  settings: { surface: 'settings', historyMode: 'replace' },
}

export interface AppRouteHandle extends RouteMetadata {
  id: string
  routeName: AppRouteName
  parse: (params: Params<string>, search: URLSearchParams) => AppRoute
}

export type ConfiguredRoute = Omit<NonIndexRouteObject, 'handle' | 'path'> & {
  path: string
  handle: AppRouteHandle
}

function route(
  id: string,
  path: string,
  routeName: AppRouteName,
  parse: AppRouteHandle['parse'],
): ConfiguredRoute {
  return { path, handle: { id, routeName, parse, ...routeMetadata[routeName] } }
}

function appendQuery(path: string, params: URLSearchParams) {
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}`
}

function parseIds(value: string | null) {
  return [...new Set((value ?? '').split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 10)
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function parseTimeBoard(scope: BoardScope, search: URLSearchParams): TimeBoardRoute {
  const tagIds = parseIds(search.get('tags'))
  return {
    name: 'board',
    scope,
    ...(tagIds.length
      ? { tagIds, matchMode: search.get('match') === 'any' ? 'any' as const : 'all' as const }
      : {}),
  }
}

function parseTagTimeScope(search: URLSearchParams) {
  const scope = search.get('scope')
  const customStart = search.get('from')
  const customEnd = search.get('to')
  if (scope === 'custom' && validDate(customStart) && validDate(customEnd) && customStart <= customEnd) {
    return { scope: 'custom' as const, customStart, customEnd }
  }
  return { scope: scope === 'today' || scope === 'week' ? scope : 'all' } satisfies { scope: BoardScope }
}

export const appRouteConfig: ConfiguredRoute[] = [
  route('root', routeDefinitions.root, 'board', () => DEFAULT_BOARD_ROUTE),
  route('all-tasks', routeDefinitions.all, 'board', (_, search) => parseTimeBoard('all', search)),
  route('today-tasks', routeDefinitions.today, 'board', (_, search) => parseTimeBoard('today', search)),
  route('week-tasks', routeDefinitions.week, 'board', (_, search) => parseTimeBoard('week', search)),
  // 新建任务已不占用路由：/tasks/new 重定向回列表（兼容旧链接）。
  route('new-task', routeDefinitions.taskNew, 'board', () => DEFAULT_BOARD_ROUTE),
  route('tag-board', routeDefinitions.tagBoard, 'tag-board', (params, search) => ({
    name: 'tag-board',
    tagId: params.tagId ?? '',
    ...parseTagTimeScope(search),
  })),
  route('legacy-tag-board', routeDefinitions.legacyTags, 'tag-board', (_, search) => {
    const tagId = search.get('id') || parseIds(search.get('ids'))[0]
    return tagId
      ? { name: 'tag-board', tagId, ...parseTagTimeScope(search) }
      : DEFAULT_BOARD_ROUTE
  }),
  route('task-detail', routeDefinitions.taskDetail, 'task-detail', (params) => ({
    name: 'task-detail',
    taskId: params.taskId ?? '',
  })),
  route('settings', routeDefinitions.settings, 'settings', () => ({ name: 'settings' })),
  route('not-found', '*', 'board', () => DEFAULT_BOARD_ROUTE),
]

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
  'task-detail': (route) => `/tasks/${encodeURIComponent(route.taskId)}`,
  settings: () => routeDefinitions.settings,
}

export function parseAppRoute(pathname: string, search = ''): AppRoute {
  const match = matchRoutes(appRouteConfig, { pathname })?.at(-1)
  const handle = match?.route.handle as AppRouteHandle | undefined
  return handle?.parse(match?.params ?? {}, new URLSearchParams(search)) ?? DEFAULT_BOARD_ROUTE
}

export function pathForRoute<Route extends AppRoute>(route: Route) {
  const build = routeBuilders[route.name] as (value: Route) => string
  return build(route)
}

export function getRouteSurface(route: AppRoute) {
  return routeMetadata[route.name].surface
}

export function getRouteHistoryMode(route: AppRoute) {
  return routeMetadata[route.name].historyMode
}

export function isBoardRoute(route: AppRoute): route is BoardRoute {
  return route.name === 'board' || route.name === 'tag-board'
}
