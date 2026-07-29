import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePwaInstall } from './usePwaInstall'

function createInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  }
  event.prompt = vi.fn(async () => undefined)
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

describe('PWA 安装入口', () => {
  beforeEach(() => {
    window.__lightTaskInstallPrompt = null
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    })
  })

  it('不会漏掉 React 启动前已经触发的安装事件', () => {
    window.__lightTaskInstallPrompt = createInstallPrompt()

    const { result } = renderHook(() => usePwaInstall())

    expect(result.current.state).toBe('available')
  })

  it('安装事件就绪后可以发起安装并清理一次性事件', async () => {
    const prompt = createInstallPrompt()
    const { result } = renderHook(() => usePwaInstall())

    act(() => {
      window.__lightTaskInstallPrompt = prompt
      window.dispatchEvent(new Event('light-task-install-available'))
    })
    expect(result.current.state).toBe('available')

    await act(async () => {
      await expect(result.current.install()).resolves.toBe(true)
    })
    expect(prompt.prompt).toHaveBeenCalledTimes(1)
    expect(window.__lightTaskInstallPrompt).toBeNull()
    expect(result.current.state).toBe('manual')

    act(() => window.dispatchEvent(new Event('appinstalled')))
    expect(result.current.state).toBe('installed')
  })
})
