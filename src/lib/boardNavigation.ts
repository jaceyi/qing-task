import type { BoardScope, CustomDateRange, TagMatchMode, TimeFilterScope } from '../types'
import {
  DEFAULT_BOARD_ROUTE,
  isBoardRoute,
  type AppRoute,
  type BoardRoute,
  type TagBoardRoute,
  type TimeBoardRoute,
} from './routes'

export interface BoardViewState {
  route: BoardRoute
  kind: 'time' | 'tag'
  timeScope: TimeFilterScope
  calendarScope: BoardScope
  tagIds: string[]
  matchMode: TagMatchMode
  customRange?: CustomDateRange
}

export function getBoardViewState(
  route: AppRoute,
  backRoute: BoardRoute = DEFAULT_BOARD_ROUTE,
): BoardViewState {
  const boardRoute = isBoardRoute(route) ? route : backRoute
  const customRange = boardRoute.name === 'tag-board' && boardRoute.scope === 'custom'
    ? { startDate: boardRoute.customStart ?? '', endDate: boardRoute.customEnd ?? '' }
    : undefined
  return {
    route: boardRoute,
    kind: boardRoute.name === 'tag-board' ? 'tag' : 'time',
    timeScope: boardRoute.scope,
    calendarScope: boardRoute.scope === 'custom' ? 'all' : boardRoute.scope,
    tagIds: boardRoute.name === 'tag-board' ? [boardRoute.tagId] : boardRoute.tagIds ?? [],
    matchMode: boardRoute.name === 'board' ? boardRoute.matchMode ?? 'all' : 'all',
    customRange,
  }
}

export function createTimeBoardRoute(scope: BoardScope): TimeBoardRoute {
  return { name: 'board', scope }
}

export function selectTimeBoardScope(route: BoardRoute, scope: BoardScope): TimeBoardRoute {
  return route.name === 'board'
    ? { ...route, scope }
    : createTimeBoardRoute(scope)
}

export function changeTimeScope(
  route: BoardRoute,
  scope: TimeFilterScope,
  range?: CustomDateRange,
): BoardRoute {
  if (route.name === 'board') {
    return scope === 'custom' ? route : { ...route, scope }
  }
  return {
    name: 'tag-board',
    tagId: route.tagId,
    scope,
    ...(scope === 'custom' && range
      ? { customStart: range.startDate, customEnd: range.endDate }
      : {}),
  }
}

export function changeTimeBoardTags(
  route: TimeBoardRoute,
  tagIds: string[],
  matchMode: TagMatchMode,
): TimeBoardRoute {
  return {
    name: 'board',
    scope: route.scope,
    ...(tagIds.length ? { tagIds, matchMode } : {}),
  }
}

export function createTagBoardRoute(tagId: string, source: BoardRoute): TagBoardRoute {
  return {
    name: 'tag-board',
    tagId,
    scope: source.scope,
    ...(source.name === 'tag-board' && source.scope === 'custom'
      ? { customStart: source.customStart, customEnd: source.customEnd }
      : {}),
  }
}
