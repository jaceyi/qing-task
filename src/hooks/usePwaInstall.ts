import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __lightTaskInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

export type PwaInstallState = 'available' | 'installed' | 'manual'

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    () => window.__lightTaskInstallPrompt ?? null,
  )
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault()
      const installPrompt = event as BeforeInstallPromptEvent
      window.__lightTaskInstallPrompt = installPrompt
      setPromptEvent(installPrompt)
    }
    const handleCapturedPrompt = () => {
      setPromptEvent(window.__lightTaskInstallPrompt ?? null)
    }
    const handleInstalled = () => {
      setInstalled(true)
      window.__lightTaskInstallPrompt = null
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('light-task-install-available', handleCapturedPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('light-task-install-available', handleCapturedPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    window.__lightTaskInstallPrompt = null
    setPromptEvent(null)
    return choice.outcome === 'accepted'
  }, [promptEvent])

  const state: PwaInstallState = installed ? 'installed' : promptEvent ? 'available' : 'manual'
  return { state, install }
}
