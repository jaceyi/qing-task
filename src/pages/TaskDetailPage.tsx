import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { BoardContent } from '../components/BoardContent'
import { TaskDetail } from '../components/TaskDetail'
import { useSession } from '../context/SessionContext'
import { useTaskData } from '../context/TaskDataContext'
import { useUi, useOpenTaskForm, useUndoableStatusNotify } from '../context/UiContext'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import { useTaskLogs } from '../hooks/useTaskData'
import type { TaskType } from '../types'

/** 任务详情页：/tasks/:taskId。任务不存在（或尚未加载）时先回落到来源看板。 */
export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const { userId, demoMode } = useSession()
  const taskData = useTaskData()
  const { setDetailDirty, notify } = useUi()
  const { boardContext, returnToBoard, replaceWithBoard, openTask } = useBoardNavigation()
  const openTaskForm = useOpenTaskForm()
  const notifyUndoableStatusChange = useUndoableStatusNotify()

  const task = useMemo(
    () => taskData.tasks.find((item) => item.id === taskId) ?? null,
    [taskId, taskData.tasks],
  )
  const { logs, error: logsError } = useTaskLogs(userId, task, demoMode)

  useEffect(() => {
    if (taskId && !task && taskData.dataReady) replaceWithBoard()
  }, [taskId, task, taskData.dataReady, replaceWithBoard])

  // 数据就绪前任务可能尚未到达，先展示来源看板，避免详情区域闪空
  if (!task) return <BoardContent boardRoute={boardContext} />

  return (
    <TaskDetail
      key={task.id}
      task={task}
      logs={logs}
      logsError={logsError}
      onCopy={() => openTaskForm(task.id)}
      onSave={(fields) => taskData.updateTask(task.id, fields)}
      onChangeType={(nextType: TaskType, targetCount?: number) => taskData.changeType(task.id, nextType, targetCount)}
      onSetCompleted={(completed) => taskData.setCompleted(task.id, completed)}
      onAdjust={(delta) => taskData.adjustProgress(task.id, delta)}
      onDelete={async () => {
        await taskData.deleteTask(task.id)
        returnToBoard()
      }}
      onSkipOccurrence={() => taskData.skipOccurrence(task.id)}
      onNotify={notify}
      onUndoableStatusChange={notifyUndoableStatusChange}
      onDirtyChange={setDetailDirty}
      onOpenTask={(nextTaskId) => openTask(nextTaskId)}
      tags={taskData.tags}
      onCreateTag={taskData.createTag}
    />
  )
}
