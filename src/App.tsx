import { useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  CheckSquare2,
  ChevronDown,
  CircleAlert,
  Cloud,
  CloudOff,
  HardDrive,
  ListTodo,
  Layers3,
  LoaderCircle,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  SunMedium,
  X,
} from 'lucide-react'
import { auth } from './lib/firebase'
import { taskOverlapsScope } from './lib/date'
import { getSyncStatus } from './lib/syncStatus'
import { useAuth } from './hooks/useAuth'
import { useAppRoute } from './hooks/useAppRoute'
import { usePwaInstall } from './hooks/usePwaInstall'
import { useTaskData, useTaskLogs } from './hooks/useTaskData'
import { LoginScreen } from './components/LoginScreen'
import { PwaPrompt } from './components/PwaPrompt'
import { SettingsView } from './components/SettingsView'
import { TaskBoard } from './components/TaskBoard'
import { TaskDetail } from './components/TaskDetail'
import { TaskFormPanel } from './components/TaskFormPanel'
import type { BoardScope, CustomDateRange, TagMatchMode, Task, TaskDraft, TaskType, TimeFilterScope } from './types'
import './App.css'

const scopeLabels: Record<BoardScope, string> = {
  all: '全部',
  today: '今天',
  week: '本周',
}

const scopeIcons = {
  all: Layers3,
  today: SunMedium,
  week: CalendarRange,
} satisfies Record<BoardScope, typeof Layers3>

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <span className="brand-mark large"><Check /></span>
      <div className="loading-dots"><i /><i /><i /></div>
      <p>正在打开轻任务…</p>
    </main>
  )
}

function App() {
  const demoMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
  const { user, loading: authLoading, error: authError, setError: setAuthError } = useAuth()
  const { route, navigate, navigateTopLevel, goBackToBoard, fromScope } = useAppRoute()
  const pwaInstall = usePwaInstall()
  const userId = user?.uid ?? null
  const taskData = useTaskData(userId, demoMode)
  const [searchTerm, setSearchTerm] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [formDirty, setFormDirty] = useState(false)
  const [detailDirty, setDetailDirty] = useState(false)
  const [utilityExpanded, setUtilityExpanded] = useState(() => localStorage.getItem('qing-task:utility-panel') !== 'collapsed')
  const [showSwipeHint, setShowSwipeHint] = useState(() => localStorage.getItem('qing-task:swipe-hint') !== 'dismissed')
  const toastTimer = useRef<number | undefined>(undefined)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const selectedTaskId = route.name === 'task-detail' ? route.taskId : null
  const selectedTask = useMemo(
    () => taskData.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, taskData.tasks],
  )
  const { logs, error: logsError } = useTaskLogs(userId, selectedTask, demoMode)
  const timeScope: TimeFilterScope = route.name === 'board' || route.name === 'tag-board' ? route.scope : fromScope
  const boardScope: BoardScope = timeScope === 'custom' ? fromScope : timeScope
  const selectedTagIds = route.name === 'tag-board' || route.name === 'board' ? route.tagIds ?? [] : []
  const tagMatchMode: TagMatchMode = route.name === 'tag-board' || route.name === 'board' ? route.matchMode ?? 'all' : 'all'
  const customRange: CustomDateRange | undefined = route.name === 'tag-board' && route.scope === 'custom'
    ? { startDate: route.customStart ?? '', endDate: route.customEnd ?? '' }
    : undefined
  const settingsOpen = route.name === 'settings'
  const showingDetail = route.name === 'task-detail'
  const formSource: Task | null | undefined =
    route.name === 'task-new'
      ? route.copiedFrom
        ? taskData.tasks.find((task) => task.id === route.copiedFrom) ?? null
        : null
      : undefined
  const showingBottomNav = !showingDetail && formSource === undefined
  const syncStatus = getSyncStatus({
    online,
    syncState: taskData.syncState,
    error: taskData.error,
    demoMode,
  })
  const SyncIcon = syncStatus.kind === 'offline'
    ? CloudOff
    : syncStatus.kind === 'syncing'
      ? LoaderCircle
      : syncStatus.kind === 'error'
        ? CircleAlert
        : syncStatus.kind === 'local'
          ? HardDrive
          : Cloud

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
      navigate({ name: 'board', scope: boardScope }, { replace: true, fromScope: boardScope })
    }
  }, [boardScope, navigate, selectedTask, selectedTaskId, taskData.dataReady])

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main-content')
    main?.scrollTo({ top: 0 })
  }, [route])

  useEffect(() => {
    if (route.name !== 'board' && route.name !== 'tag-board') setMobileSearchOpen(false)
    else if (searchTerm.trim()) setMobileSearchOpen(true)
  }, [route.name, searchTerm])

  useEffect(() => {
    if (!mobileSearchOpen) return

    mobileSearchInputRef.current?.focus({ preventScroll: true })
    const focusTimer = window.setTimeout(() => {
      mobileSearchInputRef.current?.focus({ preventScroll: true })
    }, 80)

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !mobileSearchRef.current?.contains(target) &&
        !mobileSearchButtonRef.current?.contains(target)
      ) {
        setMobileSearchOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSearchOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileSearchOpen])

  useEffect(() => {
    if (!profileOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const notify = (message: string, options: { actionLabel?: string; onAction?: () => void; duration?: number } = {}) => {
    setToast({ message, actionLabel: options.actionLabel, onAction: options.onAction })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), options.duration ?? (options.actionLabel ? 10_000 : 2600))
  }

  const notifyRecurrenceAdvanced = (message: string) => {
    notify(message, {
      actionLabel: '撤销',
      duration: 10_000,
      onAction: () => {
        void taskData.undoLastAdvance().then((restored) => notify(restored ? '已恢复上一次任务' : '撤销时间已过'))
      },
    })
  }

  const navigateToBoard = (
    scope: BoardScope,
    tagIds: string[] = selectedTagIds,
    matchMode: TagMatchMode = tagMatchMode,
    options: { resetSearch?: boolean } = {},
  ) => {
    navigateTopLevel({
      name: 'board',
      scope,
      ...(tagIds.length ? { tagIds, matchMode } : {}),
    }, { fromScope: scope })
    setProfileOpen(false)
    if (scope === 'all' && options.resetSearch !== false) setSearchTerm('')
  }

  const changeBoardScope = (scope: TimeFilterScope, range?: CustomDateRange) => {
    if (route.name === 'tag-board') {
      navigateTopLevel({
        name: 'tag-board',
        tagIds: route.tagIds,
        matchMode: route.matchMode,
        scope,
        ...(scope === 'custom' && range
          ? { customStart: range.startDate, customEnd: range.endDate }
          : {}),
      }, { fromScope: scope === 'custom' ? fromScope : scope })
      return
    }
    if (scope !== 'custom') navigateToBoard(scope)
  }

  const navigateToTagBoard = (tagIds: string[], matchMode: TagMatchMode = tagMatchMode) => {
    if (tagIds.length === 0) {
      navigateToBoard(boardScope, [], 'all', { resetSearch: false })
      return
    }
    navigateTopLevel({
      name: 'tag-board',
      tagIds,
      matchMode,
      scope: timeScope,
      ...(timeScope === 'custom' && customRange
        ? { customStart: customRange.startDate, customEnd: customRange.endDate }
        : {}),
    }, { fromScope: boardScope })
  }

  const changeTagFilter = (tagIds: string[], matchMode: TagMatchMode) => {
    if (route.name === 'tag-board') {
      navigateToTagBoard(tagIds, matchMode)
      return
    }
    navigateToBoard(boardScope, tagIds, matchMode, { resetSearch: false })
  }

  const navigateToSettings = () => {
    navigateTopLevel({ name: 'settings' }, { fromScope: boardScope })
    setProfileOpen(false)
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

  const handleCreate = async (draft: TaskDraft, copiedFrom?: string) => {
    await taskData.createTask(draft, copiedFrom)
    goBackToBoard(boardScope)
    notify(copiedFrom ? '任务副本已创建' : '任务已创建')
  }

  const countForScope = (scope: BoardScope) =>
    taskData.tasks.filter((task) => taskOverlapsScope(task, scope)).length

  const countForTag = (tagId: string) => taskData.tasks.filter((task) => task.tagIds?.includes(tagId)).length
  const selectedTagNames = taskData.tags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.name)

  if (authLoading && !demoMode) return <LoadingScreen />
  if (!user && !demoMode) {
    return <LoginScreen error={authError} onError={setAuthError} />
  }

  const displayName = user?.displayName || (demoMode ? '体验用户' : '轻任务用户')
  const email = user?.email || (demoMode ? 'demo@local.preview' : '')
  const avatarText = displayName.slice(0, 1).toUpperCase()
  const draftStorageKey = `qing-task:draft:${userId ?? 'demo'}:${route.name === 'task-new' && route.copiedFrom ? `copy-${route.copiedFrom}` : 'new'}`
  const utilityVisible = !showingDetail && !settingsOpen
  return (
    <div className={`app-shell ${showingDetail || settingsOpen ? 'main-wide' : ''} ${showingBottomNav ? 'has-bottom-nav' : ''} ${utilityVisible && !utilityExpanded ? 'utility-collapsed' : ''}`}>
      <aside className="icon-rail" aria-label="主要导航">
        <button type="button" className="rail-brand" onClick={() => navigateToBoard(boardScope)} aria-label="轻任务首页">
          <Check />
        </button>
        <nav>
          <button type="button" className={!settingsOpen ? 'is-active' : ''} onClick={() => navigateToBoard(boardScope)} aria-label="任务"><ListTodo /></button>
        </nav>
        <button type="button" className={settingsOpen ? 'is-active' : ''} onClick={navigateToSettings} aria-label="设置"><Settings /></button>
      </aside>

      <aside className="board-sidebar">
        <div className="sidebar-brand">看板</div>
        <nav aria-label="时间看板">
          {(['all', 'today', 'week'] as BoardScope[]).map((scope) => {
            const ScopeIcon = scopeIcons[scope]
            return (
              <button
                key={scope}
                type="button"
                className={route.name === 'board' && boardScope === scope ? 'is-active' : ''}
                onClick={() => navigateToBoard(scope)}
              >
                <span><ScopeIcon />{scopeLabels[scope]}</span>
                <strong>{countForScope(scope)}</strong>
              </button>
            )
          })}
        </nav>
        {taskData.tags.length > 0 && (
          <div className="sidebar-tag-section">
            <div className="sidebar-section-title"><span>标签</span><button type="button" onClick={navigateToSettings}>管理</button></div>
            <nav aria-label="标签看板">
              {taskData.tags.slice(0, 8).map((tag) => (
                <button key={tag.id} type="button" className={route.name === 'tag-board' && selectedTagIds.length === 1 && selectedTagIds[0] === tag.id ? 'is-active' : ''} onClick={() => navigateToTagBoard([tag.id], 'all')}>
                  <span><i className={`tag-color is-${tag.color}`} />{tag.name}</span>
                  <strong>{countForTag(tag.id)}</strong>
                </button>
              ))}
            </nav>
          </div>
        )}
      </aside>

      <header className="topbar">
        <div className="breadcrumb desktop-only">
          {settingsOpen ? (
            <span>设置</span>
          ) : (
            <>
              {showingDetail && (
                <button
                  type="button"
                  className="breadcrumb-back"
                  onClick={() => goBackToBoard(boardScope)}
                  aria-label="返回任务列表"
                >
                  <ArrowLeft />
                </button>
              )}
              <span>任务</span><b>/</b><strong>{selectedTask ? '详情' : route.name === 'tag-board' ? '标签看板' : scopeLabels[boardScope]}</strong>
            </>
          )}
        </div>
        <div className={`mobile-top-title ${showingDetail ? 'is-detail' : ''}`}>
          {showingDetail ? (
            <button
              type="button"
              className="icon-button mobile-detail-back"
              onClick={() => goBackToBoard(boardScope)}
              aria-label="返回任务列表"
            >
              <ArrowLeft />
            </button>
          ) : (
            <>
              <span className="brand-mark"><Check /></span>
              <strong>{settingsOpen ? '设置' : route.name === 'tag-board' ? '标签任务' : `${scopeLabels[boardScope]}任务`}</strong>
            </>
          )}
        </div>
        {(route.name === 'board' || route.name === 'tag-board') && (
          <>
            <div ref={mobileSearchRef} className={`search-box ${mobileSearchOpen ? 'is-open' : ''}`}>
              <Search />
              <input
                ref={mobileSearchInputRef}
                aria-label="搜索任务"
                placeholder="搜索任务"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {searchTerm && <button type="button" aria-label="清空搜索" onClick={() => setSearchTerm('')}><X /></button>}
            </div>
            <button
              ref={mobileSearchButtonRef}
              type="button"
              className="icon-button mobile-search-button"
              aria-label="搜索"
              aria-expanded={mobileSearchOpen}
              onClick={() => setMobileSearchOpen((open) => !open)}
            ><Search /></button>
          </>
        )}
        <button type="button" className="primary-button top-create-button" onClick={() => navigate({ name: 'task-new' }, { fromScope: boardScope })}><Plus /> 新建任务</button>
        <div ref={profileMenuRef} className="profile-menu-wrap">
          <button type="button" className="profile-button" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <span className="profile-avatar-wrap">
              <span className="avatar">
                {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : avatarText}
              </span>
              <i className={`sync-presence is-${syncStatus.kind}`} title={syncStatus.title} />
            </span>
            <ChevronDown />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <div><strong>{displayName}</strong><small>{email}</small></div>
              <button type="button" onClick={() => {
                navigateToSettings()
              }}><Settings /> 设置</button>
              {!demoMode && <button type="button" onClick={() => {
                setProfileOpen(false)
                void signOut(auth)
              }}><LogOut /> 退出登录</button>}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {taskData.error && (
          <div className="error-banner" role="alert"><span>{taskData.error}</span><button type="button" onClick={() => taskData.setError('')}><X /></button></div>
        )}

        {selectedTask ? (
          <TaskDetail
            key={selectedTask.id}
            task={selectedTask}
            logs={logs}
            logsError={logsError}
            onCopy={() => navigate({ name: 'task-new', copiedFrom: selectedTask.id }, { fromScope: boardScope })}
            onSave={(fields) => taskData.updateTask(selectedTask.id, fields)}
            onChangeType={(nextType: TaskType, targetCount?: number) => taskData.changeType(selectedTask.id, nextType, targetCount)}
            onSetCompleted={(completed) => taskData.setCompleted(selectedTask.id, completed)}
            onAdjust={(delta) => taskData.adjustProgress(selectedTask.id, delta)}
            onDelete={async () => {
              await taskData.deleteTask(selectedTask.id)
              goBackToBoard(boardScope)
            }}
            onSkipOccurrence={() => taskData.skipOccurrence(selectedTask.id)}
            onNotify={notify}
            onRecurrenceAdvanced={notifyRecurrenceAdvanced}
            onDirtyChange={setDetailDirty}
            tags={taskData.tags}
            onCreateTag={taskData.createTag}
          />
        ) : settingsOpen ? (
          <SettingsView
            preferences={taskData.preferences}
            displayName={displayName}
            email={email}
            photoURL={user?.photoURL}
            installState={pwaInstall.state}
            syncStatus={syncStatus}
            onPreferencesChange={taskData.setPreferences}
            onSignOut={async () => {
              if (!demoMode) await signOut(auth)
            }}
            onInstall={pwaInstall.install}
            onNotify={notify}
            tags={taskData.tags}
            tasks={taskData.tasks}
            onCreateTag={taskData.createTag}
            onUpdateTag={taskData.updateTag}
            onDeleteTag={taskData.deleteTag}
            onMergeTags={taskData.mergeTags}
          />
        ) : (
          <TaskBoard
            tasks={taskData.tasks}
            scope={timeScope}
            customRange={customRange}
            boardKind={route.name === 'tag-board' ? 'tag' : 'time'}
            hideCompleted={taskData.preferences.hideCompleted}
            searchTerm={searchTerm}
            loading={taskData.loading}
            onScopeChange={changeBoardScope}
            onOpenTask={(task) => navigate({ name: 'task-detail', taskId: task.id }, { fromScope: boardScope })}
            onTaskAction={handleTaskAction}
            onCreate={() => navigate({ name: 'task-new' }, { fromScope: boardScope })}
            onNotify={notify}
            tags={taskData.tags}
            selectedTagIds={selectedTagIds}
            tagMatchMode={tagMatchMode}
            onTagFilterChange={changeTagFilter}
            onRecurrenceAdvanced={notifyRecurrenceAdvanced}
            title={route.name === 'tag-board' && selectedTagNames.length ? selectedTagNames.map((name) => `#${name}`).join(' + ') : undefined}
            showSwipeHint={showSwipeHint}
            onDismissSwipeHint={dismissSwipeHint}
          />
        )}
      </main>

      {utilityVisible && (
        <aside className={`utility-panel ${utilityExpanded ? '' : 'is-collapsed'}`}>
          <button type="button" className="utility-collapse-button" onClick={toggleUtilityPanel} aria-expanded={utilityExpanded}>
            {utilityExpanded ? <PanelRightClose /> : <PanelRightOpen />}
            <span>{utilityExpanded ? '收起辅助面板' : '操作指南'}</span>
          </button>
          {utilityExpanded && (
            <div className="utility-content">
              <section>
                <div className="utility-title"><SlidersHorizontal /><h2>操作方式</h2></div>
                <div className="gesture-guide positive"><span><ArrowRight /></span><p><strong>向右拖动</strong><small>完成任务或推进一次</small></p></div>
                <div className="gesture-guide negative"><span><ArrowLeft /></span><p><strong>向左拖动</strong><small>取消完成或回退一次</small></p></div>
              </section>
              <section>
                <label className="utility-toggle">
                  <span><strong>隐藏已完成任务</strong><small>只影响列表显示，不会删除任务</small></span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={taskData.preferences.hideCompleted}
                    onChange={(event) => void taskData.setPreferences({ hideCompleted: event.target.checked })}
                  />
                </label>
              </section>
              <section className="sync-section">
                <div className={`sync-icon is-${syncStatus.kind}`}><SyncIcon /></div>
                <div><strong>{syncStatus.title}</strong><small>{syncStatus.detail}</small></div>
              </section>
            </div>
          )}
        </aside>
      )}

      {showingBottomNav && (
        <div className="mobile-nav-dock">
          <nav className="bottom-nav" aria-label="移动端导航">
            <button type="button" className={!settingsOpen ? 'is-active' : ''} onClick={() => navigateToBoard(boardScope)}><ListTodo /><span>任务</span></button>
            <button type="button" className={settingsOpen ? 'is-active' : ''} onClick={navigateToSettings}><Settings /><span>设置</span></button>
          </nav>
          <button type="button" className="mobile-add-fab" aria-label="新建任务" onClick={() => navigate({ name: 'task-new' }, { fromScope: boardScope })}><Plus /></button>
        </div>
      )}

      {formSource !== undefined && (
        <TaskFormPanel
          sourceTask={formSource}
          draftStorageKey={draftStorageKey}
          onClose={() => goBackToBoard(boardScope)}
          onSubmit={handleCreate}
          onDirtyChange={setFormDirty}
          tags={taskData.tags}
          onCreateTag={taskData.createTag}
        />
      )}

      {toast && (
        <div className="app-toast" role="status"><span><CheckSquare2 /></span><p>{toast.message}</p>{toast.actionLabel && <button type="button" onClick={() => { toast.onAction?.(); setToast(null) }}>{toast.actionLabel}</button>}</div>
      )}
      <PwaPrompt deferUpdate={formDirty || detailDirty} />
    </div>
  )
}

export default App
