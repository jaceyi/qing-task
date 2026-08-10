import { createContext, useContext, type PropsWithChildren } from 'react'
import { useTaskDataStore } from '../hooks/useTaskData'
import { useSession } from './SessionContext'

export type TaskDataValue = ReturnType<typeof useTaskDataStore>

const TaskDataContext = createContext<TaskDataValue | null>(null)

/** 任务数据全局只加载一份：所有路由页面与布局组件共享同一份任务、标签与偏好状态。 */
export function TaskDataProvider({ children }: PropsWithChildren) {
  const { userId, demoMode } = useSession()
  const taskData = useTaskDataStore(userId, demoMode)
  return <TaskDataContext.Provider value={taskData}>{children}</TaskDataContext.Provider>
}

export function useTaskData() {
  const taskData = useContext(TaskDataContext)
  if (!taskData) throw new Error('useTaskData 必须在 TaskDataProvider 内使用')
  return taskData
}
