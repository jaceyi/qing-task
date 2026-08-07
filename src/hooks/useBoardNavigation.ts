import { useCallback, useMemo } from 'react'
import {
  changeTimeBoardTags,
  changeTimeScope,
  createTagBoardRoute,
  getBoardViewState,
  selectTimeBoardScope,
} from '../lib/boardNavigation'
import type { BoardScope, CustomDateRange, TagMatchMode, TimeFilterScope } from '../types'
import type { AppRouter } from './useAppRoute'

export function useBoardNavigation(router: AppRouter) {
  const { backRoute, goBackToBoard, navigate, route } = router
  const view = useMemo(
    () => getBoardViewState(route, backRoute),
    [backRoute, route],
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
