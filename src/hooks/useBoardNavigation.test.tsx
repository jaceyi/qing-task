import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardNavigation } from './useBoardNavigation'

function RouterWrapper({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>
}

describe('看板导航历史策略', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/tasks')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  it('看板切换替换当前地址，设置页压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useBoardNavigation, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()

    act(() => result.current.openTimeBoard('today'))
    expect(window.location.pathname).toBe('/tasks/today')
    expect(result.current.boardContext).toEqual({ name: 'board', scope: 'today' })
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(pushState).not.toHaveBeenCalled()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })

    act(() => result.current.openSettings())
    expect(window.location.pathname).toBe('/settings')
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledTimes(1)
    // 设置页下看板上下文回退为来源看板
    expect(result.current.boardContext).toEqual({ name: 'board', scope: 'today' })
  })

  it('新建任务作为下钻页面压入返回历史', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(useBoardNavigation, { wrapper: RouterWrapper })
    replaceState.mockClear()
    pushState.mockClear()

    act(() => result.current.openTaskForm())
    expect(window.location.pathname).toBe('/tasks/new')
    expect(pushState).toHaveBeenCalledTimes(1)
    expect(replaceState).not.toHaveBeenCalled()
    // 新建任务即时定位，不做平滑回顶动画，避免打开抽屉/下钻页时列表可见滚动
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })

    act(() => result.current.openTaskForm('task-1'))
    expect(window.location.pathname).toBe('/tasks/new')
    expect(window.location.search).toBe('?copy=task-1')
    expect(pushState).toHaveBeenCalledTimes(2)
  })

  it('进入任务详情压入返回历史，返回时优先回退历史记录', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    const go = vi.spyOn(window.history, 'go')
    const { result } = renderHook(useBoardNavigation, { wrapper: RouterWrapper })
    pushState.mockClear()

    act(() => result.current.openTask('task-1'))
    expect(window.location.pathname).toBe('/tasks/task-1')
    expect(pushState).toHaveBeenCalledTimes(1)
    // 应用内跳转携带来源看板，返回直接走浏览器历史
    expect(result.current.view.route).toEqual({ name: 'board', scope: 'all' })
    act(() => result.current.returnToBoard())
    expect(go).toHaveBeenCalledWith(-1)
  })

  it('直接访问详情地址时返回替换为默认看板', () => {
    window.history.replaceState(null, '', '/tasks/task-1')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const go = vi.spyOn(window.history, 'go')
    const { result } = renderHook(useBoardNavigation, { wrapper: RouterWrapper })
    replaceState.mockClear()

    act(() => result.current.returnToBoard())
    expect(go).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/tasks')
    expect(replaceState).toHaveBeenCalledTimes(1)
  })

  it('开发态跳转保留 ?demo 参数', () => {
    window.history.replaceState(null, '', '/tasks?demo=1')
    const { result } = renderHook(useBoardNavigation, { wrapper: RouterWrapper })

    act(() => result.current.openTimeBoard('week'))
    expect(window.location.pathname).toBe('/tasks/week')
    expect(window.location.search).toBe('?demo=1')
  })
})
