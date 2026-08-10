import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import type { User } from 'firebase/auth'

export interface SessionValue {
  user: User | null
  userId: string | null
  demoMode: boolean
  displayName: string
  email: string
}

const SessionContext = createContext<SessionValue | null>(null)

interface SessionProviderProps extends PropsWithChildren {
  user: User | null
  demoMode: boolean
}

export function SessionProvider({ user, demoMode, children }: SessionProviderProps) {
  const value = useMemo<SessionValue>(() => ({
    user,
    userId: user?.uid ?? null,
    demoMode,
    displayName: user?.displayName || (demoMode ? '体验用户' : '轻任务用户'),
    email: user?.email || (demoMode ? 'demo@local.preview' : ''),
  }), [demoMode, user])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession 必须在 SessionProvider 内使用')
  return session
}
