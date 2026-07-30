import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskFormPanel } from './TaskFormPanel'

const draftKey = 'test:new-task-draft'

describe('新建任务草稿保护', () => {
  beforeEach(() => localStorage.clear())

  it('编辑后退出时允许保留草稿，并在再次打开时恢复', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { unmount } = render(
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
    render(
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
    render(
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
})
