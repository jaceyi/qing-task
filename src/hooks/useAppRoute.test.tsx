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

  it('切换看板和设置只替换当前顶层地址', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()

    act(() => result.current.navigate({ name: 'board', scope: 'today' }))
    expect(window.location.pathname).toBe('/tasks/today')
    expect(result.current.route).toEqual({ name: 'board', scope: 'today' })

    act(() => result.current.navigate(
      { name: 'settings' },
      { backRoute: { name: 'board', scope: 'today' } },
    ))
    expect(window.location.pathname).toBe('/settings')
    expect(replaceState).toHaveBeenCalledTimes(2)
    expect(pushState).not.toHaveBeenCalled()
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
