import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { zhCN } from '@mui/x-date-pickers/locales'
import { ThemeProvider } from '@mui/material'
import type { ReactElement } from 'react'
import { appTheme } from '../theme'
import type { Task, TaskDraft } from '../types'
import { TaskFormPanel } from './TaskFormPanel'

const draftKey = 'test:new-task-draft'

function renderWithPickers(ui: ReactElement) {
  return render(
    <ThemeProvider theme={appTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
        {ui}
      </LocalizationProvider>
    </ThemeProvider>,
  )
}

describe('新建任务草稿保护', () => {
  beforeEach(() => localStorage.clear())

  it('抽屉模式在头部显示关闭按钮，页面模式的返回交给应用顶栏', () => {
    const { unmount } = renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
    unmount()

    renderWithPickers(
      <TaskFormPanel
        variant="page"
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新建任务' })).toBeInTheDocument()
  })

  it('页面模式向外层顶栏注册带脏检查的关闭入口', async () => {
    const user = userEvent.setup()
    let registered: (() => void) | null = null
    renderWithPickers(
      <TaskFormPanel
        variant="page"
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onRegisterClose={(close) => { registered = close }}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: '任务名称' }), '草稿内容')
    expect(registered).toBeTypeOf('function')
    act(() => registered?.())
    expect(screen.getByRole('alertdialog', { name: '退出新建任务？' })).toBeInTheDocument()
  })

  it('编辑后退出时允许保留草稿，并在再次打开时恢复', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={onClose}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: '任务名称' }), '本地草稿')
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByRole('alertdialog', { name: '退出新建任务？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '保留并退出' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(draftKey)).toContain('本地草稿')

    unmount()
    renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.getByRole('textbox', { name: '任务名称' })).toHaveValue('本地草稿')
  })

  it('放弃草稿会清除本地内容', async () => {
    const user = userEvent.setup()
    renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: '任务名称' }), '不要保留')
    await user.click(screen.getByRole('button', { name: '取消' }))
    await user.click(screen.getByRole('button', { name: '放弃草稿' }))
    expect(localStorage.getItem(draftKey)).toBeNull()
  })

  it('不重复任务允许只设置开始时间', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (_draft: TaskDraft, _copiedFrom?: string) => undefined)
    localStorage.setItem(draftKey, JSON.stringify({
      title: '只有开始时间',
      description: '',
      startDate: '2026-08-06T09:00',
      endDate: '',
      type: 'single',
      targetCount: 0,
      count: 0,
      completed: false,
      tagIds: [],
      recurrence: null,
    } satisfies TaskDraft))
    renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('group', { name: '开始时间' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '创建任务' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-08-06T09:00', endDate: '', recurrence: null }),
      undefined,
    ))
  })

  it('复制任务时保留重复规则，并把锚点对齐到副本时间', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (_draft: TaskDraft, _copiedFrom?: string) => undefined)
    const sourceTask: Task = {
      id: 'source-1',
      title: '双周锻炼',
      description: '保持节奏',
      startDate: '2026-08-01T09:00',
      endDate: '2026-08-01T10:00',
      type: 'progress',
      targetCount: 8,
      count: 3,
      completed: false,
      tagIds: [],
      recurrence: {
        frequency: 'weekly',
        interval: 2,
        byWeekdays: [1, 3],
        end: { kind: 'never' },
        timeZone: 'Asia/Shanghai',
        anchorStart: '2026-07-06T09:00',
        durationMinutes: 60,
      },
      createdAt: null,
      updatedAt: null,
    }
    renderWithPickers(
      <TaskFormPanel
        sourceTask={sourceTask}
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('textbox', { name: '任务名称' })).toHaveValue('双周锻炼（副本）')
    expect(screen.getByRole('button', { name: /^重复/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '创建副本' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress',
        targetCount: 8,
        count: 0,
        startDate: '2026-08-01T09:00',
        endDate: '2026-08-01T10:00',
        recurrence: expect.objectContaining({
          frequency: 'weekly',
          interval: 2,
          byWeekdays: [1, 3],
          anchorStart: '2026-08-01T09:00',
          durationMinutes: 60,
        }),
      }),
      'source-1',
    ))
  })

  it('先选择重复属性，再按年设置间隔、月日和执行时间', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (_draft: TaskDraft, _copiedFrom?: string) => undefined)
    renderWithPickers(
      <TaskFormPanel
        draftStorageKey={draftKey}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('button', { name: /不重复/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /^重复/ }))
    expect(screen.queryByRole('group', { name: '开始时间' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: '执行时间' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '年' }))
    await user.click(screen.getByRole('combobox', { name: '每年月份' }))
    await user.click(screen.getByRole('option', { name: '12 月' }))
    fireEvent.change(screen.getByLabelText('每年日期'), { target: { value: '18' } })
    fireEvent.change(screen.getByLabelText('重复间隔'), { target: { value: '2' } })
    await user.type(screen.getByRole('textbox', { name: '任务名称' }), '年度复盘')
    await user.click(screen.getByRole('button', { name: '创建任务' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const submitted = onSubmit.mock.calls[0][0]
    expect(submitted.startDate).toMatch(/T\d{2}:\d{2}$/)
    expect(submitted.endDate).toBe(submitted.startDate)
    expect(submitted.recurrence).toMatchObject({
      frequency: 'yearly',
      interval: 2,
      byMonth: 12,
      byMonthDay: 18,
      durationMinutes: 0,
    })
  })
})
