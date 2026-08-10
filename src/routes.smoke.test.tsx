import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { zhCN } from '@mui/x-date-pickers/locales'
import 'dayjs/locale/zh-cn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appTheme } from './theme'
import { AppProviders } from './context/AppProviders'
import { AppRoutes } from './routes'

// 体验模式下不会真正访问 Firebase/Service Worker，这里只做模块级隔离，避免 jsdom 初始化 Firestore
vi.mock('./lib/firebase', () => ({
  auth: {},
  db: {},
  prepareAuth: vi.fn().mockResolvedValue(undefined),
  signInWithGoogle: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, () => undefined],
    needRefresh: [false, () => undefined],
    updateServiceWorker: vi.fn().mockResolvedValue(undefined),
  }),
}))

function RoutesFixture({ initialEntry }: { initialEntry: string }) {
  return (
    <ThemeProvider theme={appTheme}>
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        adapterLocale="zh-cn"
        localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppProviders user={null} demoMode>
            <AppRoutes />
          </AppProviders>
        </MemoryRouter>
      </LocalizationProvider>
    </ThemeProvider>
  )
}

function renderAt(initialEntry: string) {
  return render(<RoutesFixture initialEntry={initialEntry} />)
}

describe('路由表', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    // jsdom 未实现元素级 scrollTo
    if (!window.HTMLElement.prototype.scrollTo) {
      window.HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo
    }
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia
  })

  it('根路径重定向到任务看板', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: '全部任务' })).toBeInTheDocument()
    expect(screen.getByText('写完产品方案')).toBeInTheDocument()
  })

  it('时间看板按路径切换范围', () => {
    renderAt('/tasks/today')
    expect(screen.getByRole('heading', { name: '今日任务' })).toBeInTheDocument()
  })

  it('标签看板以标签命名标题', () => {
    renderAt('/tasks/tags/tag-work')
    expect(screen.getByRole('heading', { name: '#工作' })).toBeInTheDocument()
  })

  it('任务详情渲染详情内容并支持返回', () => {
    renderAt('/tasks/demo-1')
    expect(screen.getByRole('heading', { name: '写完产品方案' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('返回任务列表').length).toBeGreaterThan(0)
  })

  it('不存在的任务回到看板', async () => {
    renderAt('/tasks/not-found-task')
    expect(await screen.findByRole('heading', { name: '全部任务' })).toBeInTheDocument()
  })

  it('新建任务在桌面端以抽屉打开', () => {
    renderAt('/tasks/new')
    expect(document.getElementById('task-form-title')).toHaveTextContent('新建任务')
  })

  it('设置页渲染账号与偏好信息', () => {
    renderAt('/settings')
    expect(screen.getByText('体验用户')).toBeInTheDocument()
    expect(screen.getByText('退出登录')).toBeInTheDocument()
  })

  it('未知路径重定向到任务看板', () => {
    renderAt('/unknown-path')
    expect(screen.getByRole('heading', { name: '全部任务' })).toBeInTheDocument()
  })
})
