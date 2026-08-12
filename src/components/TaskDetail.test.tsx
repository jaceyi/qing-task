import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { zhCN } from '@mui/x-date-pickers/locales'
import { ThemeProvider } from '@mui/material'
import { addDays, toDateTimeInput } from '../lib/date'
import { appTheme } from '../theme'
import type { Task, TaskLog } from '../types'
import { TaskDetail } from './TaskDetail'

const task: Task = {
  id: 'task-1',
  title: '原任务',
  description: '',
  startDate: '',
  endDate: '',
  type: 'single',
  targetCount: 0,
  count: 0,
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function renderDetail(onSave = vi.fn(async () => undefined), logs: TaskLog[] = []) {
  return {
    onSave,
    ...render(
      <ThemeProvider theme={appTheme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
          <TaskDetail
            task={task}
            logs={logs}
            logsError=""
            onCopy={vi.fn()}
            onSave={onSave}
            onChangeType={vi.fn(async () => undefined)}
            onSetCompleted={vi.fn(async () => true)}
            onAdjust={vi.fn(async () => true)}
            onDelete={vi.fn(async () => undefined)}
            onNotify={vi.fn()}
          />
        </LocalizationProvider>
      </ThemeProvider>,
    ),
  }
}

function renderDetailWithTask(detailTask: Task) {
  return render(
    <ThemeProvider theme={appTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
        <TaskDetail
          task={detailTask}
          logs={[]}
          logsError=""
          onCopy={vi.fn()}
          onSave={vi.fn(async () => undefined)}
          onChangeType={vi.fn(async () => undefined)}
          onSetCompleted={vi.fn(async () => true)}
          onAdjust={vi.fn(async () => true)}
          onDelete={vi.fn(async () => undefined)}
          onNotify={vi.fn()}
        />
      </LocalizationProvider>
    </ThemeProvider>,
  )
}

describe('任务详情自动保存', () => {
  afterEach(() => vi.useRealTimers())

  it('逾期未完成任务在当前状态卡片中显示逾期提示', () => {
    const overdueTask: Task = {
      ...task,
      startDate: toDateTimeInput(addDays(new Date(), -2)),
      endDate: toDateTimeInput(addDays(new Date(), -1)),
    }
    renderDetailWithTask(overdueTask)
    expect(screen.getByText('已过计划时间')).toBeInTheDocument()
  })

  it('已完成任务不显示逾期提示', () => {
    const completedOverdueTask: Task = {
      ...task,
      startDate: toDateTimeInput(addDays(new Date(), -2)),
      endDate: toDateTimeInput(addDays(new Date(), -1)),
      completed: true,
    }
    renderDetailWithTask(completedOverdueTask)
    expect(screen.queryByText('已过计划时间')).not.toBeInTheDocument()
  })

  it('输入停止后自动保存基本信息', async () => {
    vi.useFakeTimers()
    const { onSave } = renderDetail()
    fireEvent.change(screen.getByRole('textbox', { name: '任务名称' }), {
      target: { value: '自动保存后的名称' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650)
    })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: '自动保存后的名称',
    }))
    expect(screen.getByRole('status')).toHaveTextContent('已保存到本机')
  })

  it('无效名称不会提交并提示修正', async () => {
    const { onSave } = renderDetail()
    fireEvent.change(screen.getByRole('textbox', { name: '任务名称' }), {
      target: { value: '' },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('任务名称不能为空')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('描述从空值修改时在变更记录中显示为未填写', () => {
    renderDetail(vi.fn(async () => undefined), [{
      id: 'log-description',
      type: 'update',
      action: '修改任务描述',
      payload: { before: '', after: '补充后的任务说明' },
      createdAt: new Date('2026-08-04T10:00:00'),
    }])

    expect(screen.getByText('未填写 → 补充后的任务说明')).toBeInTheDocument()
    expect(screen.queryByText('无时间 → 补充后的任务说明')).not.toBeInTheDocument()
  })
})
