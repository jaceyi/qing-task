import { useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  CircularProgress,
  Fab,
  FormControlLabel,
  IconButton,
  Snackbar,
  Switch,
} from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ChecklistOutlined from '@mui/icons-material/ChecklistOutlined'
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined'
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import StorageOutlined from '@mui/icons-material/StorageOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { auth } from './lib/firebase'
import { taskOverlapsScope } from './lib/date'
import { getRouteSurface } from './lib/routes'
import { getSyncStatus } from './lib/syncStatus'
import { useAuth } from './hooks/useAuth'
import { useAppRoute } from './hooks/useAppRoute'
import { useBoardNavigation } from './hooks/useBoardNavigation'
import { usePwaInstall } from './hooks/usePwaInstall'
import { useTaskData, useTaskLogs } from './hooks/useTaskData'
import { AppHeader } from './components/AppHeader'
import { ConfirmDialog } from './components/ConfirmDialog'
import { LoginScreen } from './components/LoginScreen'
import { PwaPrompt } from './components/PwaPrompt'
import { SettingsView } from './components/SettingsView'
import { TaskBoard } from './components/TaskBoard'
import { TaskDetail } from './components/TaskDetail'
import { TaskFormPanel } from './components/TaskFormPanel'
import type { BoardScope, Task, TaskDraft, TaskType } from './types'
import './App.css'

const scopeLabels: Record<BoardScope, string> = {
  all: '全部',
  today: '今天',
  week: '本周',
}

const scopeIcons = {
  all: LayersOutlined,
  today: LightModeOutlined,
  week: CalendarMonthOutlined,
} satisfies Record<BoardScope, typeof LayersOutlined>

function LoadingScreen() {
  return (
    <Box component="main" className="grid min-h-svh place-content-center justify-items-center gap-4 bg-base">
      <span className="grid size-[52px] place-items-center rounded-[15px] bg-primary text-white shadow-[0_6px_14px_rgba(99,117,215,0.2)]">
        <CheckOutlined />
      </span>
      <CircularProgress size={22} thickness={3} />
      <p className="text-xs text-muted">正在打开轻任务…</p>
    </Box>
  )
}

function App() {
  const demoMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
  const { user, loading: authLoading, error: authError, setError: setAuthError } = useAuth()
  const router = useAppRoute()
  const { route } = router
  const boardNavigation = useBoardNavigation(router)
  const { replaceWithBoard } = boardNavigation
  const board = boardNavigation.view
  const routeSurface = getRouteSurface(route)
  const pwaInstall = usePwaInstall()
  const userId = user?.uid ?? null
  const taskData = useTaskData(userId, demoMode)
  const mainRef = useRef<HTMLElement | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState<{ id: number; message: string; actionLabel?: string; onAction?: () => void; duration: number } | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [detailDirty, setDetailDirty] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [utilityExpanded, setUtilityExpanded] = useState(() => localStorage.getItem('qing-task:utility-panel') !== 'collapsed')
  const [showSwipeHint, setShowSwipeHint] = useState(() => localStorage.getItem('qing-task:swipe-hint') !== 'dismissed')
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [formState, setFormState] = useState<{ copiedFrom?: string } | null>(null)
  const selectedTaskId = route.name === 'task-detail' ? route.taskId : null
  const selectedTask = useMemo(
    () => taskData.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, taskData.tasks],
  )
  const { logs, error: logsError } = useTaskLogs(userId, selectedTask, demoMode)
  const settingsOpen = routeSurface === 'settings'
  const showingDetail = routeSurface === 'detail'
  const showingBottomNav = routeSurface === 'board'
  const syncStatus = getSyncStatus({
    online,
    syncState: taskData.syncState,
    error: taskData.error,
    demoMode,
  })
  const SyncIcon = syncStatus.kind === 'offline'
    ? CloudOffOutlined
    : syncStatus.kind === 'syncing'
      ? CloudDoneOutlined
      : syncStatus.kind === 'error'
        ? ErrorOutlineOutlined
        : syncStatus.kind === 'local'
          ? StorageOutlined
          : CloudDoneOutlined

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (selectedTaskId && !selectedTask && taskData.dataReady) {
      replaceWithBoard()
    }
  }, [replaceWithBoard, selectedTask, selectedTaskId, taskData.dataReady])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [route])

  const notify = (message: string, options: { actionLabel?: string; onAction?: () => void; duration?: number } = {}) => {
    setToast({ id: Date.now(), message, actionLabel: options.actionLabel, onAction: options.onAction, duration: options.duration ?? (options.actionLabel ? 10_000 : 2600) })
  }

  const notifyUndoableStatusChange = (message: string) => {
    notify(message, {
      actionLabel: '撤销',
      duration: 10_000,
      onAction: () => {
        void taskData.undoLastTaskAction().then((restored) => notify(restored ? '已撤销上一次操作' : '撤销时间已过'))
      },
    })
  }

  const toggleUtilityPanel = () => {
    setUtilityExpanded((expanded) => {
      const next = !expanded
      localStorage.setItem('qing-task:utility-panel', next ? 'expanded' : 'collapsed')
      return next
    })
  }

  const dismissSwipeHint = () => {
    localStorage.setItem('qing-task:swipe-hint', 'dismissed')
    setShowSwipeHint(false)
  }

  const handleTaskAction = async (task: Task, direction: 'positive' | 'negative') => {
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
  }

  const handleTaskReset = async (task: Task) => {
    try {
      return await taskData.resetProgress(task.id)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '操作失败'
      taskData.setError(message)
      notify(message)
      return false
    }
  }

  const openTaskForm = (copiedFrom?: string) => setFormState(copiedFrom ? { copiedFrom } : {})

  const handleCreate = async (draft: TaskDraft, copiedFrom?: string) => {
    await taskData.createTask(draft, copiedFrom)
    setFormState(null)
    notify(copiedFrom ? '任务副本已创建' : '任务已创建')
  }

  const countForScope = (scope: BoardScope) =>
    taskData.tasks.filter((task) => taskOverlapsScope(task, scope)).length

  const countForTag = (tagId: string) => taskData.tasks.filter((task) => task.tagIds?.includes(tagId)).length
  const selectedTagNames = taskData.tags.filter((tag) => board.tagIds.includes(tag.id)).map((tag) => tag.name)

  if (authLoading && !demoMode) return <LoadingScreen />
  if (!user && !demoMode) {
    return <LoginScreen error={authError} onError={setAuthError} />
  }

  const displayName = user?.displayName || (demoMode ? '体验用户' : '轻任务用户')
  const email = user?.email || (demoMode ? 'demo@local.preview' : '')
  const formSource = formState?.copiedFrom
    ? taskData.tasks.find((task) => task.id === formState.copiedFrom) ?? null
    : null
  const draftStorageKey = `qing-task:draft:${userId ?? 'demo'}:${formState?.copiedFrom ? `copy-${formState.copiedFrom}` : 'new'}`
  const utilityVisible = !showingDetail && !settingsOpen
  const utilityCollapsed = utilityVisible && !utilityExpanded
  const mainWide = showingDetail || settingsOpen

  const boardView = (
    <TaskBoard
      tasks={taskData.tasks}
      scope={board.timeScope}
      customRange={board.customRange}
      boardKind={board.kind}
      hideCompleted={taskData.preferences.hideCompleted}
      searchTerm={searchTerm}
      loading={taskData.loading}
      onScopeChange={boardNavigation.updateTimeScope}
      onOpenTask={(task) => boardNavigation.openTask(task.id)}
      onTaskAction={handleTaskAction}
      onResetProgress={handleTaskReset}
      onCreate={() => openTaskForm()}
      onNotify={notify}
      tags={taskData.tags}
      selectedTagIds={board.tagIds}
      tagMatchMode={board.matchMode}
      onTagFilterChange={boardNavigation.updateTagFilter}
      onUndoableStatusChange={notifyUndoableStatusChange}
      title={board.kind === 'tag' && selectedTagNames.length ? `#${selectedTagNames[0]}` : undefined}
      showSwipeHint={showSwipeHint}
      onDismissSwipeHint={dismissSwipeHint}
    />
  )
  const detailView = selectedTask ? (
    <TaskDetail
      key={selectedTask.id}
      task={selectedTask}
      logs={logs}
      logsError={logsError}
      onCopy={() => openTaskForm(selectedTask.id)}
      onSave={(fields) => taskData.updateTask(selectedTask.id, fields)}
      onChangeType={(nextType: TaskType, targetCount?: number) => taskData.changeType(selectedTask.id, nextType, targetCount)}
      onSetCompleted={(completed) => taskData.setCompleted(selectedTask.id, completed)}
      onAdjust={(delta) => taskData.adjustProgress(selectedTask.id, delta)}
      onDelete={async () => {
        await taskData.deleteTask(selectedTask.id)
        boardNavigation.returnToBoard()
      }}
      onSkipOccurrence={() => taskData.skipOccurrence(selectedTask.id)}
      onNotify={notify}
      onUndoableStatusChange={notifyUndoableStatusChange}
      onDirtyChange={setDetailDirty}
      onOpenTask={(taskId) => boardNavigation.openTask(taskId)}
      tags={taskData.tags}
      onCreateTag={taskData.createTag}
    />
  ) : (
    boardView
  )
  const settingsView = (
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

  return (
    <Box className={`grid min-h-svh bg-base md:grid-rows-[72px_minmax(0,1fr)] max-md:block max-md:bg-surface ${
      utilityCollapsed
        ? 'lg:grid-cols-[64px_224px_minmax(560px,1fr)_56px] max-lg:grid-cols-[60px_192px_minmax(520px,1fr)_52px]'
        : 'lg:grid-cols-[64px_224px_minmax(560px,1fr)_248px] max-lg:grid-cols-[60px_192px_minmax(520px,1fr)_224px]'
    } ${showingBottomNav ? 'max-md:pb-[calc(90px+env(safe-area-inset-bottom))]' : ''}`}>
      {/* 左侧图标栏 */}
      <Box component="aside" aria-label="主要导航" className="sticky top-0 z-[8] hidden h-svh flex-col items-center gap-6 border-r border-line bg-fill px-3 py-6 md:col-start-1 md:row-span-2 md:flex">
        <IconButton className="rail-brand size-10 rounded-md bg-gradient-to-br from-[#8997eb] to-[#697ada] text-white shadow-[0_7px_16px_rgba(99,117,215,0.25)] hover:from-[#8291e8] hover:to-[#6172d4] hover:text-white" onClick={() => boardNavigation.openTimeBoard('all')} aria-label="轻任务首页">
          <CheckOutlined sx={{ fontSize: 20 }} />
        </IconButton>
        <nav className="flex flex-col gap-2">
          <IconButton className={`size-10 rounded-md ${!settingsOpen ? 'bg-primary-soft text-primary-strong' : 'text-ink-2 hover:bg-primary-soft hover:text-primary-strong'}`} onClick={() => boardNavigation.openTimeBoard('all')} aria-label="任务">
            <ChecklistOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </nav>
        <IconButton className={`mt-auto size-10 rounded-md ${settingsOpen ? 'bg-primary-soft text-primary-strong' : 'text-ink-2 hover:bg-primary-soft hover:text-primary-strong'}`} onClick={boardNavigation.openSettings} aria-label="设置">
          <SettingsOutlined sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* 看板侧栏 */}
      <aside className="sticky top-0 z-[7] hidden h-svh border-r border-line bg-fill px-4 py-6 md:col-start-2 md:row-span-2 md:block">
        <div className="px-3 pb-5 text-lg font-bold tracking-tight">看板</div>
        <nav aria-label="时间看板" className="grid gap-1">
          {(['all', 'today', 'week'] as BoardScope[]).map((scope) => {
            const ScopeIcon = scopeIcons[scope]
            const active = board.kind === 'time' && board.calendarScope === scope
            return (
              <Button
                key={scope}
                type="button"
                className={`min-h-11 w-full justify-between gap-3 px-3 font-normal ${active ? 'bg-[#eae9fa] text-primary-strong' : 'text-ink-2 hover:bg-[#eae9fa]'}`}
                onClick={() => boardNavigation.openTimeBoard(scope)}
              >
                <span className="flex items-center gap-3 text-sm font-medium"><ScopeIcon sx={{ fontSize: 18 }} />{scopeLabels[scope]}</span>
                <strong className={`font-mono text-xs font-semibold ${active ? 'text-primary-strong' : 'text-muted'}`}>{countForScope(scope)}</strong>
              </Button>
            )
          })}
        </nav>
        {taskData.tags.length > 0 && (
          <div className="mt-6 border-t border-line pt-5">
            <div className="mx-3 mb-2 flex items-center justify-between text-[10px] font-bold tracking-[0.1em] text-muted">
              <span>标签</span>
              <Button variant="text" className="min-h-0 min-w-0 p-0.5 text-[11px] leading-none" onClick={boardNavigation.openSettings}>管理</Button>
            </div>
            <nav aria-label="标签看板" className="grid gap-1">
              {taskData.tags.slice(0, 8).map((tag) => {
                const active = board.kind === 'tag' && board.tagIds[0] === tag.id
                return (
                  <Button
                    key={tag.id}
                    className={`min-h-11 w-full justify-between gap-3 px-3 font-normal ${active ? 'bg-[#eae9fa] text-primary-strong' : 'text-ink-2 hover:bg-[#eae9fa]'}`}
                    onClick={() => boardNavigation.openTagBoard(tag.id)}
                  >
                    <span className="flex items-center gap-3 text-sm font-medium"><i className={`tag-color is-${tag.color}`} />{tag.name}</span>
                    <strong className={`font-mono text-xs font-semibold ${active ? 'text-primary-strong' : 'text-muted'}`}>{countForTag(tag.id)}</strong>
                  </Button>
                )
              })}
            </nav>
          </div>
        )}
      </aside>

      <AppHeader
        routeSurface={routeSurface}
        boardKind={board.kind}
        calendarScope={board.calendarScope}
        selectedTask={Boolean(selectedTask)}
        searchTerm={searchTerm}
        displayName={displayName}
        email={email}
        photoURL={user?.photoURL}
        demoMode={demoMode}
        syncStatus={syncStatus}
        onSearchChange={setSearchTerm}
        onBack={boardNavigation.returnToBoard}
        onCreate={() => openTaskForm()}
        onOpenSettings={boardNavigation.openSettings}
        onSignOut={() => setConfirmSignOut(true)}
      />

      {/* 主内容 */}
      <main ref={(node) => { mainRef.current = node }} className={`min-w-0 overflow-auto bg-surface px-8 pt-8 pb-24 max-lg:px-6 max-md:overflow-visible max-md:bg-surface max-md:pt-5 max-md:pb-8 max-md:pr-[max(16px,env(safe-area-inset-right))] max-md:pl-[max(16px,env(safe-area-inset-left))] lg:col-start-3 lg:row-start-2 ${mainWide ? 'lg:col-span-2' : ''}`}>
        {taskData.error && (
          <Alert severity="error" className="mb-2" action={<IconButton aria-label="关闭错误" onClick={() => taskData.setError('')}><CloseOutlined /></IconButton>}>
            {taskData.error}
          </Alert>
        )}
        {settingsOpen ? settingsView : showingDetail ? detailView : boardView}
      </main>

      {/* 右侧辅助面板 */}
      {utilityVisible && (
        <aside className={`border-l border-line bg-fill py-6 max-md:hidden lg:col-start-4 lg:row-start-2 ${utilityExpanded ? 'px-5' : 'px-2'}`}>
          <Button
            className={`mb-5 min-w-0 border border-line bg-surface text-ink-2 ${utilityExpanded ? 'min-h-10 w-full justify-start px-3' : 'mx-auto size-10 justify-center p-0'}`}
            onClick={toggleUtilityPanel}
            aria-expanded={utilityExpanded}
          >
            {utilityExpanded ? <ChevronRightOutlined /> : <ChevronLeftOutlined />}
            <span className={utilityExpanded ? 'truncate text-[11px]' : 'sr-only'}>{utilityExpanded ? '收起辅助面板' : '操作指南'}</span>
          </Button>
          {utilityExpanded && (
            <div>
              <section className="mb-6 border-b border-line pb-6">
                <div className="mb-4 flex items-center gap-2">
                  <TuneOutlined className="text-primary" />
                  <h2 className="text-[13px]">操作方式</h2>
                </div>
                <div className="my-2 flex items-center gap-2.5">
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-md bg-mint-soft text-mint-strong"><ArrowForwardOutlined /></span>
                  <p className="grid min-w-0 gap-[3px]"><strong className="text-[11px]">向右拖动</strong><small className="text-[9px] leading-[1.45] text-muted">完成任务或推进一次</small></p>
                </div>
                <div className="my-2 flex items-center gap-2.5">
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-md bg-apricot-soft text-apricot-strong"><ArrowBackOutlined /></span>
                  <p className="grid min-w-0 gap-[3px]"><strong className="text-[11px]">向左拖动</strong><small className="text-[9px] leading-[1.45] text-muted">取消完成或回退一次</small></p>
                </div>
              </section>
              <section className="mb-6 border-b border-line pb-6">
                <FormControlLabel
                  className="m-0 w-full justify-between gap-2.5"
                  labelPlacement="start"
                  label={<span className="grid min-w-0 flex-1 gap-[3px]"><strong className="text-[11px]">隐藏已完成任务</strong><small className="text-[9px] leading-[1.45] text-muted">只影响列表显示，不会删除任务</small></span>}
                  control={(
                    <Switch
                      checked={taskData.preferences.hideCompleted}
                      onChange={(event) => void taskData.setPreferences({ hideCompleted: event.target.checked })}
                    />
                  )}
                />
              </section>
              <section className="mb-6 border-b border-line pb-6 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <span className={`grid size-[34px] shrink-0 place-items-center rounded-md ${
                    syncStatus.kind === 'syncing' ? 'bg-primary-soft text-primary-strong'
                    : syncStatus.kind === 'offline' ? 'bg-apricot-soft text-apricot-strong'
                    : syncStatus.kind === 'error' ? 'bg-danger-soft text-danger'
                    : syncStatus.kind === 'local' ? 'bg-[#efeff4] text-muted'
                    : 'bg-mint-soft text-mint-strong'
                  }`}><SyncIcon /></span>
                  <div className="grid min-w-0 gap-[3px]"><strong className="text-[11px]">{syncStatus.title}</strong><small className="text-[9px] leading-[1.45] text-muted">{syncStatus.detail}</small></div>
                </div>
              </section>
            </div>
          )}
        </aside>
      )}

      {/* 移动端底部导航 */}
      {showingBottomNav && (
        <div className="fixed inset-x-[max(14px,calc(env(safe-area-inset-left)+8px))] bottom-[max(12px,calc(env(safe-area-inset-bottom)+8px))] z-20 mx-auto hidden max-w-[430px] grid-cols-[minmax(0,1fr)_56px] items-center gap-2.5 max-md:grid">
          <BottomNavigation
            component="nav"
            aria-label="移动端导航"
            showLabels
            value={settingsOpen ? 'settings' : 'tasks'}
            className="grid min-h-16 grid-cols-2 place-items-stretch overflow-hidden rounded-full border border-line bg-white/95 px-1.5 py-1 shadow-[0_12px_32px_rgba(54,52,80,0.13)] backdrop-blur-xl"
          >
            <BottomNavigationAction value="tasks" label="任务" icon={<ChecklistOutlined />} onClick={() => boardNavigation.openTimeBoard('all')} />
            <BottomNavigationAction value="settings" label="设置" icon={<SettingsOutlined />} onClick={boardNavigation.openSettings} />
          </BottomNavigation>
          <Fab color="primary" aria-label="新建任务" onClick={() => openTaskForm()}><AddOutlined /></Fab>
        </div>
      )}

      {formState && (
        <TaskFormPanel
          sourceTask={formSource}
          draftStorageKey={draftStorageKey}
          onClose={() => setFormState(null)}
          onSubmit={handleCreate}
          onDirtyChange={setFormDirty}
          tags={taskData.tags}
          onCreateTag={taskData.createTag}
        />
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="退出登录？"
        description="退出后需要重新登录，任务数据仍然保留在云端。"
        onClose={() => setConfirmSignOut(false)}
        onConfirm={async () => { if (!demoMode) await signOut(auth); setConfirmSignOut(false) }}
        confirmLabel="退出登录"
        confirmColor="error"
      />

      <Snackbar
        key={toast?.id}
        open={Boolean(toast)}
        autoHideDuration={toast?.duration}
        onClose={(_, reason) => { if (reason !== 'clickaway') setToast(null) }}
        message={toast?.message}
        action={toast?.actionLabel ? <Button color="primary" onClick={() => { toast.onAction?.(); setToast(null) }}>{toast.actionLabel}</Button> : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      <PwaPrompt deferUpdate={formDirty || detailDirty} />
    </Box>
  )
}

export default App
