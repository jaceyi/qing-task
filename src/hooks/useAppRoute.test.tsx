import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppRoute } from './useAppRoute'

describe('应用历史记录策略', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState({ appRoute: true, fromScope: 'all' }, '', '/tasks')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  it('切换看板和设置只替换当前顶层地址', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute)

    act(() => result.current.navigateTopLevel(
      { name: 'board', scope: 'today' },
      { fromScope: 'today' },
    ))
    expect(window.location.pathname).toBe('/tasks/today')
    expect(result.current.route).toEqual({ name: 'board', scope: 'today' })

    act(() => result.current.navigateTopLevel(
      { name: 'settings' },
      { fromScope: 'today' },
    ))
    expect(window.location.pathname).toBe('/settings')
    expect(replaceState).toHaveBeenCalledTimes(2)
    expect(pushState).not.toHaveBeenCalled()
  })

  it('进入任务详情和新建任务仍然压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useAppRoute)

    act(() => result.current.navigate(
      { name: 'task-detail', taskId: 'task-1' },
      { fromScope: 'all' },
    ))
    expect(window.location.pathname).toBe('/tasks/task-1')

    act(() => result.current.navigate(
      { name: 'task-new' },
      { fromScope: 'all' },
    ))
    expect(window.location.pathname).toBe('/tasks/new')
    expect(pushState).toHaveBeenCalledTimes(2)
    expect(replaceState).not.toHaveBeenCalled()
  })
})
