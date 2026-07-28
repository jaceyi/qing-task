import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { TaskRow } from './TaskRow'

const singleTask: Task = {
  id: 'single-1',
  title: '测试普通任务',
  startDate: '2026-07-28T09:00',
  endDate: '2026-07-28T10:00',
  type: 'single',
  targetCount: 0,
  count: 0,
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('任务行手势', () => {
  it('未完成普通任务向左滑动无效，并自动回到原位', async () => {
    const onAction = vi.fn(async () => false)
    render(
      <TaskRow
        task={singleTask}
        onOpen={vi.fn()}
        onAction={onAction}
        onNotify={vi.fn()}
      />,
    )

    const row = screen.getByRole('button', { name: '打开任务：测试普通任务' })
    fireEvent.pointerDown(row, { clientX: 220, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: 120, clientY: 102, pointerId: 1 })
    fireEvent.pointerUp(row, { clientX: 120, clientY: 102, pointerId: 1 })

    await waitFor(() => expect(row).toHaveStyle({ transform: 'translateX(0px)' }))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('普通任务不渲染右侧加减按钮', () => {
    render(
      <TaskRow
        task={singleTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => false)}
        onNotify={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: '进度减一' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '进度加一' })).not.toBeInTheDocument()
  })
})
