import { useSession } from '../context/SessionContext'
import { useTaskData } from '../context/TaskDataContext'
import { useUi } from '../context/UiContext'
import { getSyncStatus } from '../lib/syncStatus'

/** 汇总在线状态、远端同步状态与体验模式，得到统一的同步状态展示。 */
export function useSyncStatus() {
  const { online } = useUi()
  const { syncState, error } = useTaskData()
  const { demoMode } = useSession()
  return getSyncStatus({ online, syncState, error, demoMode })
}
