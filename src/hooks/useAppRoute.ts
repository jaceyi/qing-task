import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  DEFAULT_BOARD_ROUTE,
  getRouteHistoryMode,
  parseAppRoute,
  pathForRoute,
  type AppRoute,
  type BoardRoute,
  type RouteHistoryMode,
} from '../lib/routes'

interface RouteState {
  appRoute?: boolean
  backRoute?: BoardRoute
}

interface AppNavigateOptions {
  mode?: RouteHistoryMode
  backRoute?: BoardRoute
}

function urlWithDevelopmentFlags(path: string, currentSearch: string) {
  const next = new URL(path, window.location.origin)
  const current = new URLSearchParams(currentSearch)
  if (current.has('demo')) next.searchParams.set('demo', '1')
  return `${next.pathname}${next.search}`
}

export function useAppRoute() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const route = useMemo(
    () => parseAppRoute(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const routeState = (location.state ?? {}) as RouteState

  useEffect(() => {
    const canonical = urlWithDevelopmentFlags(pathForRoute(route), location.search)
    if (`${location.pathname}${location.search}` === canonical) return
    routerNavigate(canonical, { replace: true, state: location.state })
  }, [location.pathname, location.search, location.state, route, routerNavigate])

  const navigate = useCallback(
    (next: AppRoute, options: AppNavigateOptions = {}) => {
      const url = urlWithDevelopmentFlags(pathForRoute(next), location.search)
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
    (fallback: BoardRoute = DEFAULT_BOARD_ROUTE) => {
      if (routeState.appRoute && routeState.backRoute) {
        routerNavigate(-1)
        return
      }
      navigate(routeState.backRoute ?? fallback, { mode: 'replace' })
    },
    [navigate, routeState.appRoute, routeState.backRoute, routerNavigate],
  )

  return {
    route,
    navigate,
    goBackToBoard,
    backRoute: routeState.backRoute ?? DEFAULT_BOARD_ROUTE,
  }
}

export type AppRouter = ReturnType<typeof useAppRoute>
