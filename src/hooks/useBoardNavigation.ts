import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  changeTimeBoardTags,
  changeTimeScope,
  createTagBoardRoute,
  getBoardViewState,
  selectTimeBoardScope,
  type BoardViewState,
} from '../lib/boardNavigation'
import {
  boardRouteFromLocation,
  DEFAULT_BOARD_ROUTE,
  getRouteHistoryMode,
  pathForRoute,
  withDevelopmentFlags,
  type AppRoute,
  type BoardRoute,
  type RouteHistoryMode,
} from '../lib/routes'
import type { BoardScope, CustomDateRange, TagMatchMode, TimeFilterScope } from '../types'

interface RouteState {
  appRoute?: boolean
  backRoute?: BoardRoute
}

interface NavigateOptions {
  mode?: RouteHistoryMode
  backRoute?: BoardRoute
}

export function useBoardNavigation() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const routeState = (location.state ?? {}) as RouteState

  // 当前看板上下文：看板路由下就是地址本身，详情/新建/设置等路由下退回来源看板
  const boardContext = useMemo<BoardRoute>(
    () => boardRouteFromLocation(location.pathname, location.search)
      ?? routeState.backRoute
      ?? DEFAULT_BOARD_ROUTE,
    [location.pathname, location.search, routeState.backRoute],
  )
  const view = useMemo<BoardViewState>(() => getBoardViewState(boardContext), [boardContext])

  const navigate = useCallback(
    (next: AppRoute, options: NavigateOptions = {}) => {
      const url = withDevelopmentFlags(pathForRoute(next), location.search)
      const state: RouteState = { appRoute: true, backRoute: options.backRoute }
      routerNavigate(url, {
        replace: (options.mode ?? getRouteHistoryMode(next)) === 'replace',
        state,
      })
      // 新建任务以抽屉/下钻页覆盖当前内容，即时定位即可，避免平滑回顶动画；其余路由切换保持平滑回顶
      window.scrollTo({ top: 0, behavior: next.name === 'task-new' ? 'auto' : 'smooth' })
    },
    [location.search, routerNavigate],
  )

  const goBackToBoard = useCallback(
    (fallback: BoardRoute = boardContext) => {
      if (routeState.appRoute && routeState.backRoute) {
        routerNavigate(-1)
        return
      }
      navigate(routeState.backRoute ?? fallback, { mode: 'replace' })
    },
    [boardContext, navigate, routeState.appRoute, routeState.backRoute, routerNavigate],
  )

  const openTimeBoard = useCallback((scope: BoardScope) => {
    navigate(selectTimeBoardScope(view.route, scope))
  }, [navigate, view.route])

  const updateTimeScope = useCallback((scope: TimeFilterScope, range?: CustomDateRange) => {
    navigate(changeTimeScope(view.route, scope, range))
  }, [navigate, view.route])

  const updateTagFilter = useCallback((tagIds: string[], matchMode: TagMatchMode) => {
    if (view.route.name !== 'board') return
    navigate(changeTimeBoardTags(view.route, tagIds, matchMode))
  }, [navigate, view.route])

  const openTagBoard = useCallback((tagId: string) => {
    navigate(createTagBoardRoute(tagId, view.route))
  }, [navigate, view.route])

  const openSettings = useCallback(() => {
    navigate({ name: 'settings' }, { backRoute: view.route })
  }, [navigate, view.route])

  const openTask = useCallback((taskId: string) => {
    navigate({ name: 'task-detail', taskId }, { backRoute: view.route })
  }, [navigate, view.route])

  const openTaskForm = useCallback((copiedFrom?: string) => {
    navigate(
      copiedFrom ? { name: 'task-new', copyFrom: copiedFrom } : { name: 'task-new' },
      { backRoute: view.route },
    )
  }, [navigate, view.route])

  const returnToBoard = useCallback(() => {
    goBackToBoard(view.route)
  }, [goBackToBoard, view.route])

  const replaceWithBoard = useCallback(() => {
    navigate(view.route, { mode: 'replace' })
  }, [navigate, view.route])

  return {
    boardContext,
    view,
    openTimeBoard,
    updateTimeScope,
    updateTagFilter,
    openTagBoard,
    openSettings,
    openTask,
    openTaskForm,
    returnToBoard,
    replaceWithBoard,
  }
}
