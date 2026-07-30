import { useCallback, useEffect, useState } from 'react'
import { parseAppRoute, pathForRoute, type AppRoute } from '../lib/routes'
import type { BoardScope } from '../types'

type TopLevelRoute = Extract<AppRoute, { name: 'board' | 'settings' }>

interface RouteState {
  appRoute?: boolean
  fromScope?: BoardScope
}

function currentRoute() {
  return parseAppRoute(window.location.pathname, window.location.search)
}

function urlWithDevelopmentFlags(path: string) {
  const next = new URL(path, window.location.origin)
  const current = new URL(window.location.href)
  if (current.searchParams.has('demo')) next.searchParams.set('demo', '1')
  return `${next.pathname}${next.search}`
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(currentRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname !== '/') return
    const canonical = urlWithDevelopmentFlags(pathForRoute({ name: 'board', scope: 'all' }))
    window.history.replaceState({ appRoute: true, fromScope: 'all' }, '', canonical)
  }, [])

  const navigate = useCallback(
    (next: AppRoute, options: { replace?: boolean; fromScope?: BoardScope } = {}) => {
      const url = urlWithDevelopmentFlags(pathForRoute(next))
      const state: RouteState = { appRoute: true, fromScope: options.fromScope }
      if (options.replace) window.history.replaceState(state, '', url)
      else window.history.pushState(state, '', url)
      setRoute(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [],
  )

  const navigateTopLevel = useCallback(
    (next: TopLevelRoute, options: { fromScope?: BoardScope } = {}) => {
      navigate(next, { ...options, replace: true })
    },
    [navigate],
  )

  const goBackToBoard = useCallback(
    (fallbackScope: BoardScope) => {
      const state = window.history.state as RouteState | null
      if (state?.appRoute && window.history.length > 1) {
        window.history.back()
        return
      }
      navigate({ name: 'board', scope: state?.fromScope ?? fallbackScope }, { replace: true })
    },
    [navigate],
  )

  const state = window.history.state as RouteState | null
  return {
    route,
    navigate,
    navigateTopLevel,
    goBackToBoard,
    fromScope: state?.fromScope ?? 'all',
  }
}
