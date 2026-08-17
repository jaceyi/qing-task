import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { signOut } from 'firebase/auth'
import { Outlet, useLocation } from 'react-router'
import {
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Fab,
  FormControlLabel,
  IconButton,
  Snackbar,
  Switch,
  useMediaQuery,
} from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined'
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
import { AppHeader } from '../AppHeader'
import { ConfirmDialog } from '../ConfirmDialog'
import { PwaPrompt } from '../PwaPrompt'
import { TaskFormPanel } from '../TaskFormPanel'
import { useSession } from '../../context/SessionContext'
import { useTaskData } from '../../context/TaskDataContext'
import { useUi, useOpenTaskForm } from '../../context/UiContext'
import { useBoardNavigation } from '../../hooks/useBoardNavigation'
import { useSyncStatus } from '../../hooks/useSyncStatus'
import { auth } from '../../lib/firebase'
import { taskOverlapsScope } from '../../lib/date'
import { isTaskComplete } from '../../lib/taskLogic'
import { readRaw, storageKeys, writeRaw } from '../../lib/storage'
import { matchRoutePath, routeDefinitions, surfaceFromPathname } from '../../lib/routes'
import type { BoardScope, TaskDraft } from '../../types'
import '../../App.css'

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

/**
 * 应用外壳：左侧导航栏、看板侧栏、顶栏、主内容（路由页面经 Outlet 渲染）、
 * 辅助面板与移动端底部导航。路由与页面无关的共享状态全部来自 Context。
 */
export function AppLayout() {
  const location = useLocation()
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'))
  const { user, demoMode, displayName, email } = useSession()
  const taskData = useTaskData()
  const ui = useUi()
  const { view, openTimeBoard, openTagBoard, openSettings, openAnalytics, returnToBoard } = useBoardNavigation()
  const openTaskForm = useOpenTaskForm()
  const syncStatus = useSyncStatus()
  const mainRef = useRef<HTMLElement | null>(null)
  const [utilityExpanded, setUtilityExpanded] = useState(
    () => readRaw(storageKeys.utilityPanel) !== 'collapsed',
  )
  // 网格宽度过渡只在用户点击折叠/展开时启用；
  // 路由切换导致的模板变化瞬时应用，避免进看板时列表变宽的动画
  const [utilityAnimating, setUtilityAnimating] = useState(false)
  const utilityAnimateTimer = useRef<number | undefined>(undefined)

  const surface = surfaceFromPathname(location.pathname)
  const settingsOpen = surface === 'settings'
  const analyticsOpen = surface === 'analytics'
  const showingDetail = surface === 'detail'
  const showingForm = surface === 'form'
  const showingBottomNav = surface === 'board' || surface === 'analytics'
  // 分析面隐藏右侧辅助面板，主内容跨两列占满其轨道，避免留出空白
  const mainWide = showingDetail || settingsOpen || analyticsOpen

  const SyncIcon = syncStatus.kind === 'offline'
    ? CloudOffOutlined
    : syncStatus.kind === 'syncing'
      ? CloudDoneOutlined
      : syncStatus.kind === 'error'
        ? ErrorOutlineOutlined
        : syncStatus.kind === 'local'
          ? StorageOutlined
          : CloudDoneOutlined

  // 顶栏面包屑需要知道详情任务是否真实存在（未加载完成时详情区回退显示看板）
  const hasSelectedTask = useMemo(() => {
    if (surface !== 'detail') return false
    const match = matchRoutePath(routeDefinitions.taskDetail, location.pathname)
    return Boolean(match && taskData.tasks.some((task) => task.id === match.params.taskId))
  }, [surface, location.pathname, taskData.tasks])

  // 打开/关闭新建任务不打断看板滚动位置：桌面抽屉只是覆盖在列表上，移动端返回时由浏览器恢复原位
  const prevSurfaceRef = useRef(surface)
  useEffect(() => {
    const previousSurface = prevSurfaceRef.current
    prevSurfaceRef.current = surface
    if (surface === 'form' || previousSurface === 'form') return
    mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname, location.search, surface])

  const toggleUtilityPanel = () => {
    window.clearTimeout(utilityAnimateTimer.current)
    setUtilityAnimating(true)
    utilityAnimateTimer.current = window.setTimeout(() => setUtilityAnimating(false), 260)
    setUtilityExpanded((expanded) => {
      const next = !expanded
      writeRaw(storageKeys.utilityPanel, next ? 'expanded' : 'collapsed')
      return next
    })
  }

  // 开启“隐藏已完成任务”时，侧栏看板计数同步排除已完成任务
  const countForScope = (scope: BoardScope) =>
    taskData.tasks.filter((task) => taskOverlapsScope(task, scope) && (!taskData.preferences.hideCompleted || !isTaskComplete(task))).length

  const countForTag = (tagId: string) =>
    taskData.tasks.filter((task) => task.tagIds?.includes(tagId) && (!taskData.preferences.hideCompleted || !isTaskComplete(task))).length

  // 桌面端新建任务抽屉：本地状态不占路由（直接访问 /tasks/new 时由 NewTaskPage 自行渲染抽屉）
  const drawerCopiedFrom = ui.taskForm?.copiedFrom
  const drawerSourceTask = useMemo(
    () => (drawerCopiedFrom ? taskData.tasks.find((task) => task.id === drawerCopiedFrom) ?? null : null),
    [drawerCopiedFrom, taskData.tasks],
  )
  const drawerDraftStorageKey = storageKeys.draftFor(user?.uid ?? 'demo', drawerCopiedFrom ? `copy-${drawerCopiedFrom}` : 'new')

  const handleDrawerCreate = useCallback(async (draft: TaskDraft, copiedFrom?: string) => {
    await taskData.createTask(draft, copiedFrom)
    ui.closeTaskFormDrawer()
    ui.notify(copiedFrom ? '任务副本已创建' : '任务已创建')
  }, [taskData, ui])

  const utilityVisible = !showingDetail && !settingsOpen && !analyticsOpen
  const utilityCollapsed = utilityVisible && !utilityExpanded

  return (
    <Box className={`grid min-h-svh bg-base ${utilityAnimating ? 'transition-[grid-template-columns] duration-200 ease-out' : ''} md:grid-rows-[72px_minmax(0,1fr)] max-md:block max-md:bg-surface ${
      utilityCollapsed
        ? 'lg:grid-cols-[64px_224px_minmax(560px,1fr)_56px] max-lg:grid-cols-[60px_192px_minmax(520px,1fr)_52px]'
        : 'lg:grid-cols-[64px_224px_minmax(560px,1fr)_248px] max-lg:grid-cols-[60px_192px_minmax(520px,1fr)_224px]'
    } ${showingBottomNav ? 'max-md:pb-[calc(80px+env(safe-area-inset-bottom))]' : ''}`}>
      {/* 左侧图标栏 */}
      <Box component="aside" aria-label="主要导航" className="sticky top-0 z-[8] hidden h-svh flex-col items-center gap-6 border-r border-line bg-fill px-3 py-6 md:col-start-1 md:row-span-2 md:flex">
        <IconButton className="rail-brand size-10 rounded-md bg-gradient-to-br from-[#8997eb] to-[#697ada] text-white shadow-[0_7px_16px_rgba(99,117,215,0.25)] hover:from-[#8291e8] hover:to-[#6172d4] hover:text-white" onClick={() => openTimeBoard('all')} aria-label="轻任务首页">
          <CheckOutlined sx={{ fontSize: 20 }} />
        </IconButton>
        <nav className="flex flex-col gap-2">
          <IconButton className={`size-10 rounded-md ${!settingsOpen && !analyticsOpen ? 'bg-primary-soft text-primary-strong' : 'text-ink-2 hover:bg-primary-soft hover:text-primary-strong'}`} onClick={() => openTimeBoard('all')} aria-label="任务">
            <ChecklistOutlined sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton className={`size-10 rounded-md ${analyticsOpen ? 'bg-primary-soft text-primary-strong' : 'text-ink-2 hover:bg-primary-soft hover:text-primary-strong'}`} onClick={openAnalytics} aria-label="分析">
            <AnalyticsOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </nav>
        <IconButton className={`mt-auto size-10 rounded-md ${settingsOpen ? 'bg-primary-soft text-primary-strong' : 'text-ink-2 hover:bg-primary-soft hover:text-primary-strong'}`} onClick={openSettings} aria-label="设置">
          <SettingsOutlined sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* 看板侧栏 */}
      <aside className="sticky top-0 z-[7] hidden h-svh border-r border-line bg-fill px-4 py-6 md:col-start-2 md:row-span-2 md:block">
        <div className="px-3 pb-5 text-lg font-bold tracking-tight">看板</div>
        <nav aria-label="时间看板" className="grid gap-1">
          {(['all', 'today', 'week'] as BoardScope[]).map((scope) => {
            const ScopeIcon = scopeIcons[scope]
            // 高亮只由当前路由决定：设置/详情等非看板路由下，看板侧栏不聚焦任何一项
            const active = surface === 'board' && view.kind === 'time' && view.calendarScope === scope
            return (
              <Button
                key={scope}
                type="button"
                className={`min-h-11 w-full justify-between gap-3 px-3 font-normal ${active ? 'bg-[#eae9fa] text-primary-strong' : 'text-ink-2 hover:bg-[#eae9fa]'}`}
                onClick={() => openTimeBoard(scope)}
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
              <Button variant="text" className="min-h-0 min-w-0 p-0.5 text-[11px] leading-none" onClick={openSettings}>管理</Button>
            </div>
            <nav aria-label="标签看板" className="grid gap-1">
              {taskData.tags.slice(0, 8).map((tag) => {
                const active = surface === 'board' && view.kind === 'tag' && view.tagIds[0] === tag.id
                return (
                  <Button
                    key={tag.id}
                    className={`min-h-11 w-full justify-between gap-3 px-3 font-normal ${active ? 'bg-[#eae9fa] text-primary-strong' : 'text-ink-2 hover:bg-[#eae9fa]'}`}
                    onClick={() => openTagBoard(tag.id)}
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
        routeSurface={surface}
        boardKind={view.kind}
        calendarScope={view.calendarScope}
        selectedTask={hasSelectedTask}
        searchTerm={ui.searchTerm}
        displayName={displayName}
        email={email}
        photoURL={user?.photoURL}
        demoMode={demoMode}
        syncStatus={syncStatus}
        onSearchChange={ui.setSearchTerm}
        onBack={showingForm && ui.formCloseRequest ? ui.formCloseRequest : returnToBoard}
        onCreate={() => openTaskForm()}
        onOpenSettings={openSettings}
        onSignOut={() => ui.setConfirmSignOut(true)}
      />

      {/* 主内容：移动端看板贴边展示，详情/新建/设置统一保留上下间距；横向间距由 main 统一提供，内容不再叠加自身 padding */}
      <main ref={(node) => { mainRef.current = node }} className={`min-w-0 overflow-auto bg-surface px-8 pt-8 pb-24 max-lg:px-6 max-md:overflow-visible max-md:bg-surface max-md:pr-[max(16px,env(safe-area-inset-right))] max-md:pl-[max(16px,env(safe-area-inset-left))] lg:col-start-3 lg:row-start-2 ${surface === 'board' ? 'max-md:pt-0 max-md:pb-0' : 'max-md:pt-5 max-md:pb-8'} ${mainWide ? 'lg:col-span-2' : ''}`}>
        {taskData.error && (
          <Alert severity="error" className="mb-2" action={<IconButton aria-label="关闭错误" onClick={() => taskData.setError('')}><CloseOutlined /></IconButton>}>
            {taskData.error}
          </Alert>
        )}
        <Outlet />
      </main>

      {/* 右侧辅助面板：宽度由网格轨道过渡驱动，内容随折叠淡出；收起时 inert 移出焦点与无障碍树 */}
      {utilityVisible && (
        <aside className={`overflow-hidden border-l border-line bg-fill py-6 max-md:hidden lg:col-start-4 lg:row-start-2 ${utilityExpanded ? 'px-5' : 'px-1.5'}`}>
          <Button
            className={`mb-5 min-w-0 border border-line bg-surface text-ink-2 ${utilityExpanded ? 'min-h-10 w-full justify-start px-3' : 'mx-auto size-10 justify-center p-0'}`}
            onClick={toggleUtilityPanel}
            aria-expanded={utilityExpanded}
          >
            {utilityExpanded ? <ChevronRightOutlined /> : <ChevronLeftOutlined />}
            <span className={utilityExpanded ? 'truncate text-[11px]' : 'sr-only'}>{utilityExpanded ? '收起辅助面板' : '操作指南'}</span>
          </Button>
          <div
            className={`transition-opacity duration-150 ${utilityExpanded ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0'}`}
            inert={!utilityExpanded}
            aria-hidden={!utilityExpanded}
          >
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
        </aside>
      )}

      {/* 移动端底部导航：统一 56px 高度；任务与分析两个入口，选中态由当前路由决定 */}
      {showingBottomNav && (
        <div className="fixed inset-x-[max(14px,calc(env(safe-area-inset-left)+8px))] bottom-[max(12px,calc(env(safe-area-inset-bottom)+8px))] z-20 mx-auto hidden max-w-[430px] grid-cols-[minmax(0,1fr)_56px] items-center gap-2.5 max-md:grid">
          <BottomNavigation
            component="nav"
            aria-label="移动端导航"
            showLabels
            value={analyticsOpen ? 'analytics' : 'tasks'}
            className="grid h-14 min-h-14 grid-cols-2 place-items-stretch overflow-hidden rounded-full border border-line bg-white/95 px-1.5 shadow-[0_12px_32px_rgba(54,52,80,0.13)] backdrop-blur-xl"
          >
            <BottomNavigationAction value="tasks" label="任务" icon={<ChecklistOutlined />} onClick={() => openTimeBoard('all')} />
            <BottomNavigationAction value="analytics" label="分析" icon={<AnalyticsOutlined />} onClick={openAnalytics} />
          </BottomNavigation>
          <Fab color="primary" className="size-14" aria-label="新建任务" onClick={() => openTaskForm()}><AddOutlined /></Fab>
        </div>
      )}

      {/* 桌面端新建任务：本地抽屉直接覆盖在当前页面上，不改变路由；/tasks/new 的直接访问由 NewTaskPage 渲染 */}
      {!isMobile && ui.taskForm !== null && location.pathname !== routeDefinitions.taskNew && (
        <TaskFormPanel
          variant="drawer"
          sourceTask={drawerSourceTask}
          draftStorageKey={drawerDraftStorageKey}
          onClose={ui.closeTaskFormDrawer}
          onRegisterClose={ui.registerFormClose}
          onSubmit={handleDrawerCreate}
          onDirtyChange={ui.setFormDirty}
          tags={taskData.tags}
          onCreateTag={taskData.createTag}
        />
      )}

      <ConfirmDialog
        open={ui.confirmSignOut}
        title="退出登录？"
        description="退出后需要重新登录，任务数据仍然保留在云端。"
        onClose={() => ui.setConfirmSignOut(false)}
        onConfirm={async () => { if (!demoMode) await signOut(auth); ui.setConfirmSignOut(false) }}
        confirmLabel="退出登录"
        confirmColor="error"
      />

      <Snackbar
        key={ui.toast?.id}
        open={Boolean(ui.toast)}
        autoHideDuration={ui.toast?.duration}
        onClose={(_, reason) => { if (reason !== 'clickaway') ui.dismissToast() }}
        message={ui.toast?.message}
        action={ui.toast?.actionLabel ? <Button color="primary" onClick={() => { ui.toast?.onAction?.(); ui.dismissToast() }}>{ui.toast.actionLabel}</Button> : undefined}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      <PwaPrompt deferUpdate={ui.formDirty || ui.detailDirty} />
    </Box>
  )
}
