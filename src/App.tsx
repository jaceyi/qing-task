import { useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronDown,
  Cloud,
  CloudOff,
  ListTodo,
  LogOut,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { auth } from './lib/firebase'
import { taskOverlapsScope } from './lib/date'
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
import type { BoardScope, Task, TaskDraft, TaskType } from './types'
import './App.css'

const scopeLabels: Record<BoardScope, string> = {
  today: '今天',
  week: '本周',
  all: '全部',
}

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
  const { route, navigate, goBackToBoard, fromScope } = useAppRoute()
  const pwaInstall = usePwaInstall()
  const userId = user?.uid ?? null
  const taskData = useTaskData(userId, demoMode)
  const [searchTerm, setSearchTerm] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
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
  const boardScope: BoardScope = route.name === 'board' ? route.scope : fromScope
  const settingsOpen = route.name === 'settings'
  const showingDetail = route.name === 'task-detail'
  const formSource: Task | null | undefined =
    route.name === 'task-new'
      ? route.copiedFrom
        ? taskData.tasks.find((task) => task.id === route.copiedFrom) ?? null
        : null
      : undefined

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
    if (selectedTaskId && !selectedTask && !taskData.loading) {
      navigate({ name: 'board', scope: boardScope }, { replace: true, fromScope: boardScope })
    }
  }, [boardScope, navigate, selectedTask, selectedTaskId, taskData.loading])

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main-content')
    main?.scrollTo({ top: 0 })
  }, [route])

  useEffect(() => {
    if (route.name !== 'board') setMobileSearchOpen(false)
  }, [route.name])

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

  const notify = (message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  const navigateToBoard = (scope: BoardScope) => {
    navigate({ name: 'board', scope }, { fromScope: scope })
    setProfileOpen(false)
    if (scope === 'all') setSearchTerm('')
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

  if (authLoading && !demoMode) return <LoadingScreen />
  if (!user && !demoMode) {
    return <LoginScreen error={authError} onError={setAuthError} />
  }

  const displayName = user?.displayName || (demoMode ? '体验用户' : '轻任务用户')
  const email = user?.email || (demoMode ? 'demo@local.preview' : '')
  const avatarText = displayName.slice(0, 1).toUpperCase()
  return (
    <div className={`app-shell ${showingDetail || settingsOpen ? 'main-wide' : ''}`}>
      <aside className="icon-rail" aria-label="主要导航">
        <button type="button" className="rail-brand" onClick={() => navigateToBoard(boardScope)} aria-label="轻任务首页">
          <Check />
        </button>
        <nav>
          <button type="button" className={!settingsOpen ? 'is-active' : ''} onClick={() => navigateToBoard(boardScope)} aria-label="任务"><ListTodo /></button>
        </nav>
        <button type="button" className={settingsOpen ? 'is-active' : ''} onClick={() => navigate({ name: 'settings' }, { fromScope: boardScope })} aria-label="设置"><Settings /></button>
      </aside>

      <aside className="board-sidebar">
        <div className="sidebar-brand">看板</div>
        <nav aria-label="时间看板">
          {(['today', 'week', 'all'] as BoardScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              className={route.name === 'board' && boardScope === scope ? 'is-active' : ''}
              onClick={() => navigateToBoard(scope)}
            >
              <span><CalendarDays />{scopeLabels[scope]}</span>
              <strong>{countForScope(scope)}</strong>
            </button>
          ))}
        </nav>
      </aside>

      <header className="topbar">
        <div className="breadcrumb desktop-only">
          <span>任务</span><b>/</b><strong>{selectedTask ? '详情' : settingsOpen ? '设置' : scopeLabels[boardScope]}</strong>
        </div>
        <div className="mobile-top-title">
          <span className="brand-mark"><Check /></span>
          <strong>{selectedTask ? '任务详情' : settingsOpen ? '设置' : `${scopeLabels[boardScope]}任务`}</strong>
        </div>
        {route.name === 'board' && (
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
            <span className="avatar">
              {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : avatarText}
            </span>
            <ChevronDown />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <div><strong>{displayName}</strong><small>{email}</small></div>
              <button type="button" onClick={() => {
                setProfileOpen(false)
                navigate({ name: 'settings' }, { fromScope: boardScope })
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
            task={selectedTask}
            logs={logs}
            logsError={logsError}
            onBack={() => goBackToBoard(boardScope)}
            onCopy={() => navigate({ name: 'task-new', copiedFrom: selectedTask.id }, { fromScope: boardScope })}
            onSave={(fields) => taskData.updateTask(selectedTask.id, fields)}
            onChangeType={(nextType: TaskType, targetCount?: number) => taskData.changeType(selectedTask.id, nextType, targetCount)}
            onSetCompleted={(completed) => taskData.setCompleted(selectedTask.id, completed)}
            onAdjust={(delta) => taskData.adjustProgress(selectedTask.id, delta)}
            onDelete={async () => {
              await taskData.deleteTask(selectedTask.id)
              goBackToBoard(boardScope)
            }}
            onNotify={notify}
          />
        ) : settingsOpen ? (
          <SettingsView
            preferences={taskData.preferences}
            displayName={displayName}
            email={email}
            photoURL={user?.photoURL}
            installState={pwaInstall.state}
            onPreferencesChange={taskData.setPreferences}
            onSignOut={async () => {
              if (!demoMode) await signOut(auth)
            }}
            onInstall={pwaInstall.install}
            onNotify={notify}
          />
        ) : (
          <TaskBoard
            tasks={taskData.tasks}
            scope={boardScope}
            hideCompleted={taskData.preferences.hideCompleted}
            searchTerm={searchTerm}
            loading={taskData.loading}
            onScopeChange={navigateToBoard}
            onOpenTask={(task) => navigate({ name: 'task-detail', taskId: task.id }, { fromScope: boardScope })}
            onTaskAction={handleTaskAction}
            onCreate={() => navigate({ name: 'task-new' }, { fromScope: boardScope })}
            onNotify={notify}
          />
        )}
      </main>

      {!showingDetail && !settingsOpen && (
        <aside className="utility-panel">
          <section>
            <div className="utility-title"><SlidersHorizontal /><h2>操作方式</h2></div>
            <div className="gesture-guide positive"><span><ArrowRight /></span><p><strong>向右拖动</strong><small>完成任务或推进一次</small></p></div>
            <div className="gesture-guide negative"><span><ArrowLeft /></span><p><strong>向左拖动</strong><small>取消完成或回退一次</small></p></div>
          </section>
          <section>
            <label className="utility-toggle">
              <span><strong>显示已完成</strong><small>完成任务置于列表底部</small></span>
              <input
                type="checkbox"
                role="switch"
                checked={!taskData.preferences.hideCompleted}
                onChange={(event) => void taskData.setPreferences({ hideCompleted: !event.target.checked })}
              />
            </label>
          </section>
          <section className="sync-section">
            <div className={`sync-icon ${online ? '' : 'offline'}`}>{online ? <Cloud /> : <CloudOff />}</div>
            <div>
              <strong>{online ? taskData.syncState.pendingWrites ? '正在同步…' : '已同步到云端' : '当前处于离线状态'}</strong>
              <small>{taskData.syncState.fromCache ? '正在显示本地缓存' : '个人任务仅你可见'}</small>
            </div>
          </section>
          {demoMode && <span className="demo-badge">本地预览模式</span>}
        </aside>
      )}

      <nav className="bottom-nav" aria-label="移动端导航">
        <button type="button" className={!settingsOpen ? 'is-active' : ''} onClick={() => navigateToBoard(boardScope)}><ListTodo /><span>任务</span></button>
        <button type="button" className="mobile-add-button" aria-label="新建任务" onClick={() => navigate({ name: 'task-new' }, { fromScope: boardScope })}><Plus /><span>新建</span></button>
        <button type="button" className={settingsOpen ? 'is-active' : ''} onClick={() => navigate({ name: 'settings' }, { fromScope: boardScope })}><Settings /><span>设置</span></button>
      </nav>

      {formSource !== undefined && (
        <TaskFormPanel sourceTask={formSource} onClose={() => goBackToBoard(boardScope)} onSubmit={handleCreate} />
      )}

      {toast && (
        <div className="app-toast" role="status"><span><CheckSquare2 /></span>{toast}</div>
      )}
      <PwaPrompt />
    </div>
  )
}

export default App
