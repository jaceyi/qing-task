import type { PropsWithChildren } from 'react'
import type { User } from 'firebase/auth'
import { SessionProvider } from './SessionContext'
import { TaskDataProvider } from './TaskDataContext'
import { UiProvider } from './UiContext'

interface AppProvidersProps extends PropsWithChildren {
  user: User | null
  demoMode: boolean
}

/** 全局 Provider 组合：会话 → 任务数据 → 界面状态（Context + useReducer）。 */
export function AppProviders({ user, demoMode, children }: AppProvidersProps) {
  return (
    <SessionProvider user={user} demoMode={demoMode}>
      <TaskDataProvider>
        <UiProvider>{children}</UiProvider>
      </TaskDataProvider>
    </SessionProvider>
  )
}
