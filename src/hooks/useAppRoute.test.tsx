import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppRoute } from './useAppRoute'

function RouterWrapper({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>
}

describe('应用历史记录策略', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/tasks')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  it('看板切换替换当前地址，设置页压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()

    act(() => result.current.navigate({ name: 'board', scope: 'today' }))
    expect(window.location.pathname).toBe('/tasks/today')
    expect(result.current.route).toEqual({ name: 'board', scope: 'today' })
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(pushState).not.toHaveBeenCalled()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })

    act(() => result.current.navigate(
      { name: 'settings' },
      { backRoute: { name: 'board', scope: 'today' } },
    ))
    expect(window.location.pathname).toBe('/settings')
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledTimes(1)
  })

  it('新建任务作为下钻页面压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()
    const backRoute = { name: 'board' as const, scope: 'all' as const }

    act(() => result.current.navigate({ name: 'task-new' }, { backRoute }))
    expect(window.location.pathname).toBe('/tasks/new')
    expect(result.current.backRoute).toEqual(backRoute)
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(replaceState).not.toHaveBeenCalled()
    // 新建任务即时定位，不做平滑回顶动画，避免打开抽屉/下钻页时列表可见滚动
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })

    act(() => result.current.navigate({ name: 'task-new', copyFrom: 'task-1' }, { backRoute }))
    expect(window.location.pathname).toBe('/tasks/new')
    expect(window.location.search).toBe('?copy=task-1')
    expect(pushState).toHaveBeenCalledTimes(2)
  })

  it('进入任务详情仍然压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()
    const backRoute = { name: 'board' as const, scope: 'all' as const }

    act(() => result.current.navigate(
      { name: 'task-detail', taskId: 'task-1' },
      { backRoute },
    ))
    expect(window.location.pathname).toBe('/tasks/task-1')
    expect(result.current.backRoute).toEqual(backRoute)
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(replaceState).not.toHaveBeenCalled()
  })
})
