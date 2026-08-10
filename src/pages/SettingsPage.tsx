import { SettingsView } from '../components/SettingsView'
import { useSession } from '../context/SessionContext'
import { useTaskData } from '../context/TaskDataContext'
import { useUi } from '../context/UiContext'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useSyncStatus } from '../hooks/useSyncStatus'

/** 设置页：/settings。账号信息、偏好、标签管理、PWA 安装与同步状态。 */
export function SettingsPage() {
  const { user, displayName, email } = useSession()
  const taskData = useTaskData()
  const { notify, setConfirmSignOut } = useUi()
  const pwaInstall = usePwaInstall()
  const syncStatus = useSyncStatus()

  return (
    <SettingsView
      preferences={taskData.preferences}
      displayName={displayName}
      email={email}
      photoURL={user?.photoURL}
      installState={pwaInstall.state}
      syncStatus={syncStatus}
      onPreferencesChange={taskData.setPreferences}
      onSignOut={async () => setConfirmSignOut(true)}
      onInstall={pwaInstall.install}
      onNotify={notify}
      tags={taskData.tags}
      tasks={taskData.tasks}
      onCreateTag={taskData.createTag}
      onUpdateTag={taskData.updateTag}
      onDeleteTag={taskData.deleteTag}
      onMergeTags={taskData.mergeTags}
    />
  )
}
