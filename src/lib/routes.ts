import type { BoardScope } from '../types'

export type AppRoute =
  | { name: 'board'; scope: BoardScope }
  | { name: 'task-detail'; taskId: string }
  | { name: 'task-new'; copiedFrom?: string }
  | { name: 'settings' }

export const routeDefinitions = {
  today: '/tasks/today',
  week: '/tasks/week',
  all: '/tasks',
  taskDetail: '/tasks/:taskId',
  taskNew: '/tasks/new',
  settings: '/settings',
} as const

export function parseAppRoute(pathname: string, search = ''): AppRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/' || path === routeDefinitions.all) return { name: 'board', scope: 'all' }
  if (path === routeDefinitions.today) return { name: 'board', scope: 'today' }
  if (path === routeDefinitions.week) return { name: 'board', scope: 'week' }
  if (path === routeDefinitions.settings) return { name: 'settings' }
  if (path === routeDefinitions.taskNew) {
    const copiedFrom = new URLSearchParams(search).get('copy') || undefined
    return { name: 'task-new', copiedFrom }
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
  if (route.scope === 'week') return routeDefinitions.week
  if (route.scope === 'all') return routeDefinitions.all
  return routeDefinitions.today
}
