import type { BoardScope, TagMatchMode, TimeFilterScope } from '../types'

export type AppRoute =
  | { name: 'board'; scope: BoardScope; tagIds?: string[]; matchMode?: TagMatchMode }
  | {
      name: 'tag-board'
      tagIds: string[]
      matchMode: TagMatchMode
      scope: TimeFilterScope
      customStart?: string
      customEnd?: string
    }
  | { name: 'task-detail'; taskId: string }
  | { name: 'task-new'; copiedFrom?: string }
  | { name: 'settings' }

export const routeDefinitions = {
  today: '/tasks/today',
  week: '/tasks/week',
  all: '/tasks',
  taskDetail: '/tasks/:taskId',
  taskNew: '/tasks/new',
  tags: '/tasks/tags',
  settings: '/settings',
} as const

function parseIds(value: string | null) {
  return [...new Set((value ?? '').split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 10)
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function boardRoute(scope: BoardScope, search: string): AppRoute {
  const params = new URLSearchParams(search)
  const tagIds = parseIds(params.get('tags'))
  if (!tagIds.length) return { name: 'board', scope }
  return {
    name: 'board',
    scope,
    tagIds,
    matchMode: params.get('match') === 'any' ? 'any' : 'all',
  }
}

export function parseAppRoute(pathname: string, search = ''): AppRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/' || path === routeDefinitions.all) return boardRoute('all', search)
  if (path === routeDefinitions.today) return boardRoute('today', search)
  if (path === routeDefinitions.week) return boardRoute('week', search)
  if (path === routeDefinitions.settings) return { name: 'settings' }
  if (path === routeDefinitions.taskNew) {
    const copiedFrom = new URLSearchParams(search).get('copy') || undefined
    return { name: 'task-new', copiedFrom }
  }
  if (path === routeDefinitions.tags) {
    const params = new URLSearchParams(search)
    const tagIds = parseIds(params.get('ids'))
    const matchMode = params.get('match') === 'any' ? 'any' : 'all'
    const scopeParam = params.get('scope')
    const customStart = params.get('from')
    const customEnd = params.get('to')
    if (scopeParam === 'custom' && validDate(customStart) && validDate(customEnd) && customStart <= customEnd) {
      return { name: 'tag-board', tagIds, matchMode, scope: 'custom', customStart, customEnd }
    }
    const scope = scopeParam === 'today' || scopeParam === 'week' ? scopeParam as BoardScope : 'all'
    return { name: 'tag-board', tagIds, matchMode, scope }
  }

  const taskMatch = path.match(/^\/tasks\/([^/]+)$/)
  if (taskMatch) return { name: 'task-detail', taskId: decodeURIComponent(taskMatch[1]) }
  return { name: 'board', scope: 'all' }
}

export function pathForRoute(route: AppRoute) {
  if (route.name === 'settings') return routeDefinitions.settings
  if (route.name === 'task-detail') return `/tasks/${encodeURIComponent(route.taskId)}`
  if (route.name === 'task-new') {
    return route.copiedFrom
      ? `${routeDefinitions.taskNew}?copy=${encodeURIComponent(route.copiedFrom)}`
      : routeDefinitions.taskNew
  }
  if (route.name === 'tag-board') {
    const params = new URLSearchParams()
    if (route.tagIds.length) params.set('ids', route.tagIds.join(','))
    if (route.matchMode === 'any') params.set('match', 'any')
    if (route.scope !== 'all') params.set('scope', route.scope)
    if (route.scope === 'custom' && route.customStart && route.customEnd) {
      params.set('from', route.customStart)
      params.set('to', route.customEnd)
    }
    const search = params.toString()
    return `${routeDefinitions.tags}${search ? `?${search}` : ''}`
  }
  const path = route.scope === 'week'
    ? routeDefinitions.week
    : route.scope === 'all'
      ? routeDefinitions.all
      : routeDefinitions.today
  const params = new URLSearchParams()
  if (route.tagIds?.length) params.set('tags', route.tagIds.join(','))
  if (route.tagIds?.length && route.matchMode === 'any') params.set('match', 'any')
  const search = params.toString()
  return `${path}${search ? `?${search}` : ''}`
}
