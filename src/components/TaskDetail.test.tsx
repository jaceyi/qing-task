import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
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

function renderDetail(onSave = vi.fn(async () => undefined)) {
  return {
    onSave,
    ...render(
      <TaskDetail
        task={task}
        logs={[]}
        logsError=""
        onCopy={vi.fn()}
        onSave={onSave}
        onChangeType={vi.fn(async () => undefined)}
        onSetCompleted={vi.fn(async () => true)}
        onAdjust={vi.fn(async () => true)}
        onDelete={vi.fn(async () => undefined)}
        onNotify={vi.fn()}
      />,
    ),
  }
}

describe('任务详情自动保存', () => {
  afterEach(() => vi.useRealTimers())

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
})
