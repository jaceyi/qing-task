import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { formatDateTimeDisplay } from '../lib/date'
import { DateTimeInput } from './DateTimeInput'

describe('日期时间输入组件', () => {
  it('使用稳定的展示文本，同时保留原生分钟级选择器', () => {
    const onChange = vi.fn()
    render(
      <DateTimeInput
        ariaLabel="开始时间"
        value="2026-07-31T15:15"
        onChange={onChange}
      />,
    )

    const input = screen.getByLabelText('开始时间')
    expect(input).toHaveAttribute('type', 'datetime-local')
    expect(input).toHaveAttribute('step', '60')
    expect(screen.getByText('2026/07/31 15:15')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '2026-08-01T09:30' } })
    expect(onChange).toHaveBeenCalledWith('2026-08-01T09:30')
  })

  it('空值显示明确的未设置状态', () => {
    expect(formatDateTimeDisplay('')).toBe('未设置')
  })

  it('点击日期框任意可视区域都会主动打开原生选择器', () => {
    render(
      <DateTimeInput
        ariaLabel="开始时间"
        value="2026-07-31T15:15"
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByLabelText<HTMLInputElement>('开始时间')
    const showPicker = vi.fn()
    Object.defineProperty(input, 'showPicker', { configurable: true, value: showPicker })

    fireEvent.click(screen.getByText('2026/07/31 15:15'))
    expect(showPicker).toHaveBeenCalledTimes(1)
    expect(input).toHaveFocus()
  })
})
