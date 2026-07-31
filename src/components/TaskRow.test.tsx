import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { TaskRow } from './TaskRow'

const singleTask: Task = {
  id: 'single-1',
  title: '测试普通任务',
  description: '',
  startDate: '2026-07-28T09:00',
  endDate: '2026-07-28T10:00',
  type: 'single',
  targetCount: 0,
  count: 0,
  completed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const progressTask: Task = {
  ...singleTask,
  id: 'progress-1',
  title: '测试进度任务',
  type: 'progress',
  targetCount: 5,
  count: 2,
}

describe('任务行手势', () => {
  it('未完成普通任务向左滑动无效，并自动回到原位', async () => {
    const onAction = vi.fn(async () => false)
    const { container } = render(
      <TaskRow
        task={singleTask}
        onOpen={vi.fn()}
        onAction={onAction}
        onNotify={vi.fn()}
      />,
    )

    const row = container.querySelector<HTMLElement>('.task-row')
    expect(row).not.toBeNull()
    fireEvent.pointerDown(row!, { clientX: 220, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(row!, { clientX: 120, clientY: 102, pointerId: 1 })
    fireEvent.pointerUp(row!, { clientX: 120, clientY: 102, pointerId: 1 })

    await waitFor(() => expect(row).toHaveStyle({ transform: 'translateX(0px)' }))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('普通任务不渲染右侧加减按钮', () => {
    const { container } = render(
      <TaskRow
        task={singleTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => false)}
        onNotify={vi.fn()}
      />,
    )

    expect(within(container).queryByRole('button', { name: '进度减一' })).not.toBeInTheDocument()
    expect(within(container).queryByRole('button', { name: '进度加一' })).not.toBeInTheDocument()
    expect(within(container).getByRole('button', { name: '完成任务：测试普通任务' })).toBeInTheDocument()
  })

  it('无时间任务使用清晰的无时间标识', () => {
    const { container } = render(
      <TaskRow
        task={{ ...singleTask, startDate: '', endDate: '' }}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => false)}
        onNotify={vi.fn()}
      />,
    )

    expect(container.querySelector('.task-date')).toHaveTextContent('无时间')
    expect(container.querySelector('.task-date .lucide-calendar-off')).toBeInTheDocument()
  })

  it('向右拖动时只显示浅绿色完成底层', () => {
    const { container } = render(
      <TaskRow
        task={singleTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    const row = within(container).getByRole('button', { name: '打开任务：测试普通任务' })
    fireEvent.pointerDown(row, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: 140, clientY: 102, pointerId: 1 })

    expect(container.querySelector('.task-row-wrap')).toHaveClass('is-swiping-positive')
    expect(container.querySelector('.task-row-wrap')).not.toHaveClass('is-swiping-negative')
    expect(container.querySelector('.lucide-arrow-right')).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-arrow-left')).not.toBeInTheDocument()
  })

  it('使用统一的双字拖拽动作和正负图标', () => {
    const { container, rerender } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    expect(container.querySelector('.swipe-underlay-positive')).toHaveTextContent('推进')
    expect(container.querySelector('.swipe-underlay-positive .lucide-check')).toBeInTheDocument()
    expect(container.querySelector('.swipe-underlay-negative')).toHaveTextContent('回退')
    expect(container.querySelector('.swipe-underlay-negative .lucide-x')).toBeInTheDocument()

    rerender(
      <TaskRow
        task={{ ...singleTask, completed: true }}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )
    expect(container.querySelector('.swipe-underlay-positive')).toHaveTextContent('完成')
    expect(container.querySelector('.swipe-underlay-positive .lucide-check')).toBeInTheDocument()
    expect(container.querySelector('.swipe-underlay-negative')).toHaveTextContent('取消')
    expect(container.querySelector('.swipe-underlay-negative .lucide-x')).toBeInTheDocument()
    expect(container.querySelector('.swipe-underlay-negative .lucide-check')).not.toBeInTheDocument()
  })

  it('进度环本身不执行进度操作，但可通过整行热区打开详情', () => {
    const onOpen = vi.fn()
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={onOpen}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    const progressIndicator = within(container).getByRole('img', { name: '当前进度 2/5' })
    expect(progressIndicator.tagName).toBe('SPAN')
    expect(within(container).queryByRole('button', { name: '完成任务：测试进度任务' })).not.toBeInTheDocument()

    fireEvent.click(progressIndicator)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('将进度操作放在进度展示之前，让状态列固定在最右侧', () => {
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    const actions = container.querySelector('.task-inline-actions')
    const status = container.querySelector('.task-status')
    expect(actions).not.toBeNull()
    expect(status).not.toBeNull()
    expect(actions!.compareDocumentPosition(status!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('整行非操作区域都可以打开详情', async () => {
    const onOpen = vi.fn()
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={onOpen}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    const row = container.querySelector('.task-row')
    const copyCell = container.querySelector('.task-copy-cell')
    const status = container.querySelector('.task-status')
    expect(row).not.toBeNull()
    expect(copyCell).not.toBeNull()
    expect(status).not.toBeNull()
    fireEvent.click(row!)
    fireEvent.click(copyCell!)
    fireEvent.click(status!)
    expect(onOpen).toHaveBeenCalledTimes(3)

    fireEvent.click(within(container).getByRole('button', { name: '进度加一' }))
    expect(onOpen).toHaveBeenCalledTimes(3)

    await userEvent.click(within(container).getByRole('button', { name: '打开任务：测试进度任务' }))
    expect(onOpen).toHaveBeenCalledTimes(4)
  })

  it('带有少量纵向偏移的快速横滑仍然锁定为横向手势', async () => {
    const onAction = vi.fn(async () => true)
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={onAction}
        onNotify={vi.fn()}
      />,
    )

    const row = container.querySelector<HTMLElement>('.task-row')
    fireEvent.pointerDown(row!, { clientX: 100, clientY: 100, pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerMove(row!, { clientX: 175, clientY: 126, pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerUp(row!, { clientX: 175, clientY: 126, pointerId: 2, pointerType: 'touch' })

    await waitFor(() => expect(onAction).toHaveBeenCalledWith('positive'))
  })

  it('横向意图明确后阻止原生纵向橡皮筋接管触摸', () => {
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )
    const row = container.querySelector<HTMLElement>('.task-row')!
    fireEvent.pointerDown(row, { clientX: 100, clientY: 100, pointerId: 3, pointerType: 'touch' })
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(touchMove, 'touches', {
      value: [{ clientX: 155, clientY: 116 }],
    })
    row.dispatchEvent(touchMove)
    expect(touchMove.defaultPrevented).toBe(true)

    const laterDiagonalMove = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(laterDiagonalMove, 'touches', {
      value: [{ clientX: 160, clientY: 190 }],
    })
    row.dispatchEvent(laterDiagonalMove)
    expect(laterDiagonalMove.defaultPrevented).toBe(true)
  })

  it('纵向意图明确时保留页面原生滚动和边缘回弹', () => {
    const { container } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )
    const row = container.querySelector<HTMLElement>('.task-row')!
    fireEvent.pointerDown(row, { clientX: 100, clientY: 100, pointerId: 4, pointerType: 'touch' })
    const verticalMove = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(verticalMove, 'touches', {
      value: [{ clientX: 105, clientY: 145 }],
    })
    row.dispatchEvent(verticalMove)
    expect(verticalMove.defaultPrevented).toBe(false)
  })

  it('用可动画的 SVG 环表达进度', () => {
    const { container, rerender } = render(
      <TaskRow
        task={progressTask}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )

    const ring = container.querySelector('.task-progress-ring-value')
    const bar = container.querySelector<HTMLElement>('.progress-track > span')
    expect(ring).toHaveAttribute('stroke-dashoffset', '60')
    expect(bar).toHaveStyle({ width: '40%' })

    rerender(
      <TaskRow
        task={{ ...progressTask, count: 3 }}
        onOpen={vi.fn()}
        onAction={vi.fn(async () => true)}
        onNotify={vi.fn()}
      />,
    )
    expect(ring).toHaveAttribute('stroke-dashoffset', '40')
    expect(bar).toHaveStyle({ width: '60%' })
  })
})
