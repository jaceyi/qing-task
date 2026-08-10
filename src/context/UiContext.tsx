import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react'
import { useMediaQuery } from '@mui/material'
import { useBoardNavigation } from '../hooks/useBoardNavigation'
import { useTaskData } from './TaskDataContext'

export interface ToastState {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  duration: number
}

export interface NotifyOptions {
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

interface UiState {
  toast: ToastState | null
  online: boolean
  searchTerm: string
  /** 桌面端新建任务抽屉：纯本地状态不占路由；移动端新建走 /tasks/new 路由下钻。 */
  taskForm: { copiedFrom?: string } | null
  /** 由新建表单注册的带脏检查关闭入口，供顶栏返回按钮使用。 */
  formCloseRequest: (() => void) | null
  detailDirty: boolean
  formDirty: boolean
  confirmSignOut: boolean
}

type UiAction =
  | { type: 'notify'; toast: ToastState }
  | { type: 'dismissToast' }
  | { type: 'setOnline'; online: boolean }
  | { type: 'setSearchTerm'; value: string }
  | { type: 'openTaskForm'; copiedFrom?: string }
  | { type: 'closeTaskForm' }
  | { type: 'registerFormClose'; requestClose: (() => void) | null }
  | { type: 'setDetailDirty'; dirty: boolean }
  | { type: 'setFormDirty'; dirty: boolean }
  | { type: 'setConfirmSignOut'; open: boolean }

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'notify':
      return { ...state, toast: action.toast }
    case 'dismissToast':
      return state.toast ? { ...state, toast: null } : state
    case 'setOnline':
      return state.online === action.online ? state : { ...state, online: action.online }
    case 'setSearchTerm':
      return state.searchTerm === action.value ? state : { ...state, searchTerm: action.value }
    case 'openTaskForm':
      return { ...state, taskForm: action.copiedFrom ? { copiedFrom: action.copiedFrom } : {} }
    case 'closeTaskForm':
      return state.taskForm === null ? state : { ...state, taskForm: null, formCloseRequest: null }
    case 'registerFormClose':
      return state.formCloseRequest === action.requestClose
        ? state
        : { ...state, formCloseRequest: action.requestClose }
    case 'setDetailDirty':
      return state.detailDirty === action.dirty ? state : { ...state, detailDirty: action.dirty }
    case 'setFormDirty':
      return state.formDirty === action.dirty ? state : { ...state, formDirty: action.dirty }
    case 'setConfirmSignOut':
      return state.confirmSignOut === action.open ? state : { ...state, confirmSignOut: action.open }
    default:
      return state
  }
}

interface UiValue extends UiState {
  notify: (message: string, options?: NotifyOptions) => void
  dismissToast: () => void
  setSearchTerm: (value: string) => void
  openTaskFormDrawer: (copiedFrom?: string) => void
  closeTaskFormDrawer: () => void
  registerFormClose: (requestClose: (() => void) | null) => void
  setDetailDirty: (dirty: boolean) => void
  setFormDirty: (dirty: boolean) => void
  setConfirmSignOut: (open: boolean) => void
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(uiReducer, undefined, (): UiState => ({
    toast: null,
    online: navigator.onLine,
    searchTerm: '',
    taskForm: null,
    formCloseRequest: null,
    detailDirty: false,
    formDirty: false,
    confirmSignOut: false,
  }))

  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'setOnline', online: true })
    const handleOffline = () => dispatch({ type: 'setOnline', online: false })
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const notify = useCallback((message: string, options: NotifyOptions = {}) => {
    dispatch({
      type: 'notify',
      toast: {
        id: Date.now(),
        message,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
        duration: options.duration ?? (options.actionLabel ? 10_000 : 2600),
      },
    })
  }, [])

  // 动作函数保持引用稳定：组件会把它们放进 effect 依赖（如 onDirtyChange），引用变化会触发无限循环
  const dismissToast = useCallback(() => dispatch({ type: 'dismissToast' }), [])
  const setSearchTerm = useCallback((value: string) => dispatch({ type: 'setSearchTerm', value }), [])
  const openTaskFormDrawer = useCallback((copiedFrom?: string) => dispatch({ type: 'openTaskForm', copiedFrom }), [])
  const closeTaskFormDrawer = useCallback(() => dispatch({ type: 'closeTaskForm' }), [])
  const registerFormClose = useCallback((requestClose: (() => void) | null) => dispatch({ type: 'registerFormClose', requestClose }), [])
  const setDetailDirty = useCallback((dirty: boolean) => dispatch({ type: 'setDetailDirty', dirty }), [])
  const setFormDirty = useCallback((dirty: boolean) => dispatch({ type: 'setFormDirty', dirty }), [])
  const setConfirmSignOut = useCallback((open: boolean) => dispatch({ type: 'setConfirmSignOut', open }), [])

  const value = useMemo<UiValue>(() => ({
    ...state,
    notify,
    dismissToast,
    setSearchTerm,
    openTaskFormDrawer,
    closeTaskFormDrawer,
    registerFormClose,
    setDetailDirty,
    setFormDirty,
    setConfirmSignOut,
  }), [
    state,
    notify,
    dismissToast,
    setSearchTerm,
    openTaskFormDrawer,
    closeTaskFormDrawer,
    registerFormClose,
    setDetailDirty,
    setFormDirty,
    setConfirmSignOut,
  ])

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const ui = useContext(UiContext)
  if (!ui) throw new Error('useUi 必须在 UiProvider 内使用')
  return ui
}

/**
 * 打开新建任务：移动端下钻到 /tasks/new 路由，桌面端打开本地抽屉不改变路由。
 * 依赖 useBoardNavigation，因此必须在 Router 内使用。
 */
export function useOpenTaskForm() {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'))
  const { openTaskFormDrawer } = useUi()
  const { openTaskForm } = useBoardNavigation()
  return useCallback((copiedFrom?: string) => {
    if (isMobile) openTaskForm(copiedFrom)
    else openTaskFormDrawer(copiedFrom)
  }, [isMobile, openTaskForm, openTaskFormDrawer])
}

/** 状态变更类操作统一附带“撤销”入口的提示。 */
export function useUndoableStatusNotify() {
  const { notify } = useUi()
  const { undoLastTaskAction } = useTaskData()
  return useCallback((message: string) => {
    notify(message, {
      actionLabel: '撤销',
      duration: 10_000,
      onAction: () => {
        void undoLastTaskAction().then((restored) => notify(restored ? '已撤销上一次操作' : '撤销时间已过'))
      },
    })
  }, [notify, undoLastTaskAction])
}
