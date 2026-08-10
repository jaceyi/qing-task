import { useEffect, useMemo } from 'react'
import { useMediaQuery } from '@mui/material'
import { useSearchParams } from 'react-router'
import { BoardContent } from '../components/BoardContent'
import { TaskFormPanel } from '../components/TaskFormPanel'
import { useSession } from '../context/SessionContext'
import { useTaskData } from '../context/TaskDataContext'
import { useUi } from '../context/UiContext'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import type { TaskDraft } from '../types'

/**
 * 新建任务路由页：/tasks/new，?copy= 携带复制来源。
 * 移动端作为下钻页面；桌面端直接访问该地址时，在来源看板之上打开抽屉，
 * 与桌面端本地抽屉（不占路由）共用同一套表单。
 */
export function NewTaskPage() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'))
  const [searchParams] = useSearchParams()
  const copyFrom = searchParams.get('copy') ?? undefined
  const { userId } = useSession()
  const taskData = useTaskData()
  const { registerFormClose, setFormDirty, notify } = useUi()
  const { boardContext, returnToBoard, replaceWithBoard } = useBoardNavigation()

  const sourceTask = useMemo(
    () => (copyFrom ? taskData.tasks.find((task) => task.id === copyFrom) ?? null : null),
    [copyFrom, taskData.tasks],
  )
  const draftStorageKey = `qing-task:draft:${userId ?? 'demo'}:${copyFrom ? `copy-${copyFrom}` : 'new'}`

  useEffect(() => {
    if (copyFrom && taskData.dataReady && !taskData.tasks.some((task) => task.id === copyFrom)) {
      replaceWithBoard()
    }
  }, [copyFrom, taskData.dataReady, taskData.tasks, replaceWithBoard])

  const handleSubmit = async (draft: TaskDraft, copiedFrom?: string) => {
    await taskData.createTask(draft, copiedFrom)
    returnToBoard()
    notify(copiedFrom ? '任务副本已创建' : '任务已创建')
  }

  const formPanel = (
    <TaskFormPanel
      variant={isMobile ? 'page' : 'drawer'}
      sourceTask={sourceTask}
      draftStorageKey={draftStorageKey}
      onClose={returnToBoard}
      onRegisterClose={registerFormClose}
      onSubmit={handleSubmit}
      onDirtyChange={setFormDirty}
      tags={taskData.tags}
      onCreateTag={taskData.createTag}
    />
  )

  if (isMobile) return formPanel

  return (
    <>
      <BoardContent boardRoute={boardContext} />
      {formPanel}
    </>
  )
}
