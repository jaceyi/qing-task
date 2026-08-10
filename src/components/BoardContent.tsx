import { useCallback, useState } from 'react'
import { useTaskData } from '../context/TaskDataContext'
import { useUi, useOpenTaskForm, useUndoableStatusNotify } from '../context/UiContext'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import { getBoardViewState } from '../lib/boardNavigation'
import type { BoardRoute } from '../lib/routes'
import type { Task } from '../types'
import { TaskBoard } from './TaskBoard'

const SWIPE_HINT_STORAGE_KEY = 'qing-task:swipe-hint'

interface BoardContentProps {
  boardRoute: BoardRoute
}

/**
 * 看板内容：时间看板页、标签看板页与新建任务页的桌面背景板共用。
 * 任务数据、搜索词、提示与导航全部来自 Context，页面只负责解析路由参数。
 */
export function BoardContent({ boardRoute }: BoardContentProps) {
  const taskData = useTaskData()
  const { searchTerm, notify } = useUi()
  const { updateTimeScope, updateTagFilter, openTask } = useBoardNavigation()
  const openTaskForm = useOpenTaskForm()
  const notifyUndoableStatusChange = useUndoableStatusNotify()
  const [showSwipeHint, setShowSwipeHint] = useState(
    () => localStorage.getItem(SWIPE_HINT_STORAGE_KEY) !== 'dismissed',
  )
  const view = getBoardViewState(boardRoute)
  const selectedTagNames = taskData.tags
    .filter((tag) => view.tagIds.includes(tag.id))
    .map((tag) => tag.name)

  const dismissSwipeHint = () => {
    localStorage.setItem(SWIPE_HINT_STORAGE_KEY, 'dismissed')
    setShowSwipeHint(false)
  }

  const handleTaskAction = useCallback(async (task: Task, direction: 'positive' | 'negative') => {
    try {
      if (task.type === 'single') {
        return taskData.setCompleted(task.id, direction === 'positive')
      }
      return taskData.adjustProgress(task.id, direction === 'positive' ? 1 : -1)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '操作失败'
      taskData.setError(message)
      notify(message)
      return false
    }
  }, [notify, taskData])

  const handleTaskReset = useCallback(async (task: Task) => {
    try {
      return await taskData.resetProgress(task.id)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '操作失败'
      taskData.setError(message)
      notify(message)
      return false
    }
  }, [notify, taskData])

  return (
    <TaskBoard
      tasks={taskData.tasks}
      scope={view.timeScope}
      customRange={view.customRange}
      boardKind={view.kind}
      hideCompleted={taskData.preferences.hideCompleted}
      searchTerm={searchTerm}
      loading={taskData.loading}
      onScopeChange={updateTimeScope}
      onOpenTask={(task) => openTask(task.id)}
      onTaskAction={handleTaskAction}
      onResetProgress={handleTaskReset}
      onCreate={() => openTaskForm()}
      onNotify={notify}
      tags={taskData.tags}
      selectedTagIds={view.tagIds}
      tagMatchMode={view.matchMode}
      onTagFilterChange={updateTagFilter}
      onUndoableStatusChange={notifyUndoableStatusChange}
      title={view.kind === 'tag' && selectedTagNames.length ? `#${selectedTagNames[0]}` : undefined}
      showSwipeHint={showSwipeHint}
      onDismissSwipeHint={dismissSwipeHint}
    />
  )
}
