import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Box, ButtonBase, IconButton } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import RepeatOutlined from '@mui/icons-material/RepeatOutlined'
import { formatDateRange } from '../lib/date'
import { describeRecurrence } from '../lib/recurrence'
import { isTaskComplete } from '../lib/taskLogic'
import type { Tag, Task } from '../types'

type SwipeDirection = 'positive' | 'negative'

interface TaskRowProps {
  task: Task
  onOpen: () => void
  onAction: (direction: SwipeDirection) => Promise<boolean>
  onResetProgress?: () => Promise<boolean>
  onNotify: (message: string) => void
  onUndoableStatusChange?: (message: string) => void
  tags?: Tag[]
}

export function TaskRow({ task, onOpen, onAction, onResetProgress, onNotify, onUndoableStatusChange, tags = [] }: TaskRowProps) {
  const [offset, setOffset] = useState(0)
  const [acting, setActing] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const dragClickResetTimer = useRef<number | undefined>(undefined)
  const gesture = useRef({
    startX: 0,
    startY: 0,
    dragged: false,
    horizontal: false,
    vertical: false,
    active: false,
    lastOffset: 0,
  })
  const complete = isTaskComplete(task)
  const positiveDisabled = task.type === 'single' ? task.completed : task.count >= task.targetCount
  const negativeDisabled = task.type === 'single' ? !task.completed : task.count <= 0
  const progress = task.type === 'progress' ? Math.round((task.count / task.targetCount) * 100) : 0
  const rowTags = tags.filter((tag) => task.tagIds?.includes(tag.id))

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const keepHorizontalGesture = (event: TouchEvent) => {
      if (!gesture.current.active || event.touches.length !== 1) return

      if (gesture.current.vertical) return
      if (gesture.current.horizontal) {
        if (event.cancelable) event.preventDefault()
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - gesture.current.startX
      const deltaY = touch.clientY - gesture.current.startY

      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return

      if (Math.abs(deltaX) >= Math.abs(deltaY) * 0.8) {
        gesture.current.horizontal = true
        if (event.cancelable) event.preventDefault()
      } else if (Math.abs(deltaY) > 8) {
        gesture.current.vertical = true
        gesture.current.active = false
      }
    }
    row.addEventListener('touchmove', keepHorizontalGesture, { passive: false })
    return () => {
      row.removeEventListener('touchmove', keepHorizontalGesture)
      window.clearTimeout(dragClickResetTimer.current)
    }
  }, [])

  /** 已完成进度任务的图标点击：一键归零。 */
  const performReset = async () => {
    if (acting || !onResetProgress) return
    setActing(true)
    try {
      const changed = await onResetProgress()
      if (changed) (onUndoableStatusChange ?? onNotify)('进度已重置为 0')
    } finally {
      setActing(false)
      setOffset(0)
    }
  }

  const performAction = async (direction: SwipeDirection) => {
    if (acting) return
    if (direction === 'positive' ? positiveDisabled : negativeDisabled) {
      setOffset(0)
      return
    }
    setActing(true)
    try {
      const changed = await onAction(direction)
      if (changed) {
        const advancesRecurrence = Boolean(
          task.recurrence
          && task.seriesState !== 'ended'
          && direction === 'positive'
          && (task.type === 'single' || task.count + 1 === task.targetCount),
        )
        const completionChanged = task.type === 'single'
          || (direction === 'positive' ? task.count + 1 === task.targetCount : task.count === task.targetCount)
        if (completionChanged) {
          onUndoableStatusChange?.(
            advancesRecurrence
              ? task.type === 'progress'
                ? `本次已保留为完成任务，下一次已从 0/${task.targetCount} 开始`
                : '本次已保留为完成任务，下一次已安排'
              : direction === 'positive'
                ? '任务已完成'
                : '已取消完成',
          )
          return
        }
        const message =
          task.type === 'single'
            ? direction === 'positive'
              ? '任务已完成'
              : '已取消完成'
            : direction === 'positive'
              ? `进度已更新  ${task.count} → ${task.count + 1}`
              : '已回退进度'
        onNotify(message)
      }
    } finally {
      setActing(false)
      setOffset(0)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && event.clientX <= 24) return
    const button = (event.target as HTMLElement).closest('button')
    if (button && !button.classList.contains('task-detail-trigger')) return
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
      horizontal: false,
      vertical: false,
      active: true,
      lastOffset: 0,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.active) return
    const deltaX = event.clientX - gesture.current.startX
    const deltaY = event.clientY - gesture.current.startY
    if (!gesture.current.horizontal && !gesture.current.vertical) {
      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return
      if (Math.abs(deltaX) >= Math.abs(deltaY) * 0.8) {
        gesture.current.horizontal = true
      } else if (Math.abs(deltaY) > 8) {
        gesture.current.vertical = true
        gesture.current.active = false
        return
      }
    }
    if (gesture.current.horizontal) {
      event.preventDefault()
      gesture.current.dragged = true
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      const nextOffset = Math.max(-88, Math.min(88, deltaX))
      gesture.current.lastOffset = nextOffset
      setOffset(nextOffset)
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.active) return
    gesture.current.active = false
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const releasedOffset = gesture.current.lastOffset
    gesture.current.lastOffset = 0
    if (gesture.current.dragged) {
      window.clearTimeout(dragClickResetTimer.current)
      dragClickResetTimer.current = window.setTimeout(() => {
        gesture.current.dragged = false
      }, 250)
    }
    if (releasedOffset > 54) void performAction('positive')
    else if (releasedOffset < -54) void performAction('negative')
    else setOffset(0)
  }

  const handleOpen = () => {
    if (gesture.current.dragged) {
      window.clearTimeout(dragClickResetTimer.current)
      gesture.current.dragged = false
      return
    }
    onOpen()
  }

  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.task-check, .task-inline-actions button')) return
    handleOpen()
  }

  return (
    <Box
      className={`task-row-wrap relative min-h-[60px] touch-pan-y overflow-hidden overscroll-x-contain border-b border-line bg-surface max-md:min-h-[72px] ${complete ? 'is-complete' : ''} ${offset > 0 ? 'is-swiping-positive' : offset < 0 ? 'is-swiping-negative' : ''}`}
    >
      <Box
        className={`swipe-underlay swipe-underlay-positive absolute inset-0 flex items-center justify-start gap-1.5 bg-mint-soft px-5 text-[13px] font-bold text-mint-strong transition-opacity duration-100 ${offset > 0 ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      >
        <CheckOutlined />
        <span>{task.type === 'single' ? '完成' : '推进'}</span>
      </Box>
      <Box
        className={`swipe-underlay swipe-underlay-negative absolute inset-0 flex items-center justify-end gap-1.5 bg-danger-soft px-5 text-[13px] font-bold text-danger transition-opacity duration-100 ${offset < 0 ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      >
        <CloseOutlined />
        <span>{task.type === 'single' ? '取消' : '回退'}</span>
      </Box>
      <Box
        ref={rowRef}
        className={`task-row group relative z-[1] grid min-h-[60px] cursor-pointer items-center gap-2 bg-surface px-2 select-none transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0.78,0.32,1)] max-lg:grid-cols-[28px_minmax(150px,1fr)_100px] max-md:min-h-[72px] max-md:grid-cols-[30px_minmax(0,1fr)_86px] max-md:gap-[9px] max-md:px-0.5 ${task.type === 'single' ? 'grid-cols-[30px_minmax(160px,1fr)_76px]' : 'grid-cols-[30px_minmax(160px,1fr)_68px_76px]'} is-${task.type}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleRowClick}
        onPointerCancel={() => {
          gesture.current.active = false
          gesture.current.dragged = false
          gesture.current.horizontal = false
          gesture.current.vertical = false
          gesture.current.lastOffset = 0
          setOffset(0)
        }}
      >
        {task.type === 'single' ? (
          <IconButton
            className={`task-check relative size-[26px] shrink-0 rounded-sm border-2 p-0 text-white max-md:before:absolute max-md:before:-inset-[9px] max-md:before:content-[''] ${complete ? 'border-mint bg-mint' : 'border-[#dcebe6] bg-[#fbfffd] hover:border-mint hover:bg-[#f2fbf7]'}`}
            aria-label={complete ? `撤销完成：${task.title}` : `完成任务：${task.title}`}
            onClick={(event) => {
              event.stopPropagation()
              void performAction(complete ? 'negative' : 'positive')
            }}
          >
            {complete && <CheckOutlined sx={{ fontSize: 18 }} />}
          </IconButton>
        ) : (
          <IconButton
            className="task-progress-indicator relative size-[26px] shrink-0 rounded-full bg-[#fbfffd] max-md:before:absolute max-md:before:-inset-[9px] max-md:before:content-['']"
            aria-label={positiveDisabled ? `重置进度：${task.title}` : `推进一次：${task.title}，当前进度 ${task.count}/${task.targetCount}`}
            disabled={acting}
            onClick={(event) => {
              event.stopPropagation()
              if (positiveDisabled) void performReset()
              else void performAction('positive')
            }}
          >
            <svg viewBox="0 0 26 26" className="size-[26px] -rotate-90 overflow-visible" aria-hidden="true">
              <circle className="task-progress-ring-track" cx="13" cy="13" r="12" pathLength="100" fill="none" stroke="#dcebe6" strokeWidth={2} />
              <circle
                className="task-progress-ring-value"
                cx="13"
                cy="13"
                r="12"
                pathLength="100"
                fill="none"
                stroke="#83d4b6"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="100"
                strokeDashoffset={100 - progress}
                style={{ transition: 'stroke-dashoffset 340ms cubic-bezier(0.22, 0.75, 0.25, 1)' }}
              />
            </svg>
            <span className={`absolute inset-1 grid place-items-center rounded-full text-white ${complete ? 'bg-mint' : ''}`}>{complete && <CheckOutlined sx={{ fontSize: 10 }} />}</span>
          </IconButton>
        )}

        <span className="task-copy-cell flex min-w-0 items-center">
          <ButtonBase
            className="task-copy task-detail-trigger group/copy grid w-fit min-w-0 max-w-full gap-1 rounded-md py-1 text-left"
            aria-label={`打开任务：${task.title}`}
            onClick={(event) => {
              event.stopPropagation()
              handleOpen()
            }}
          >
            <span className={`task-title max-w-full truncate text-sm font-semibold ${complete ? 'text-[#9a9aaa] line-through decoration-[#c5c5d0]' : 'text-ink group-hover/copy:text-primary-strong'}`}>{task.title}</span>
            <span className="task-meta-line flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
              <span className={`task-date text-[11px] ${!task.startDate && !task.endDate ? 'inline-flex items-center gap-1 text-mint-strong' : 'text-muted'}`}>
                {!task.startDate && !task.endDate && <CalendarTodayOutlined sx={{ fontSize: 11 }} />}
                {formatDateRange(task.startDate, task.endDate)}
              </span>
              {task.recurrence && (
                <span
                  className="recurrence-badge inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[6px] bg-primary-soft px-2 text-[9px] leading-none text-primary-strong max-md:h-5 max-md:text-[10px]"
                  title={describeRecurrence(task.recurrence)}
                >
                  <RepeatOutlined sx={{ fontSize: 11 }} />{describeRecurrence(task.recurrence).split(' · ')[0]}
                </span>
              )}
              {rowTags.slice(0, 3).map((tag) => (
                <span key={tag.id} className={`task-tag-dot is-${tag.color} inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[6px] bg-fill px-2 text-[9px] leading-none max-md:h-5 max-md:text-[10px]`} title={tag.name}><i />{tag.name}</span>
              ))}
              {rowTags.length > 3 && <span className="task-tag-more inline-flex h-[18px] shrink-0 items-center rounded-[6px] bg-fill px-2 text-[9px] leading-none text-muted max-md:h-5 max-md:text-[10px]">+{rowTags.length - 3}</span>}
            </span>
          </ButtonBase>
        </span>

        {task.type === 'progress' && (
          <span className="task-inline-actions flex justify-end gap-1.5 max-lg:hidden">
            {/* 禁用按钮 pointer-events: none，包一层拦截点击，防止落到行上打开详情 */}
            <span onClickCapture={(event) => { if (negativeDisabled || acting) event.stopPropagation() }}>
              <IconButton
                aria-label="进度减一"
                className="size-[30px] translate-x-[5px] border border-[#f0c9ba] bg-surface p-0 text-apricot-strong opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                disabled={negativeDisabled || acting}
                onClick={(event) => {
                  event.stopPropagation()
                  void performAction('negative')
                }}
              >
                <RemoveOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
            <span onClickCapture={(event) => { if (positiveDisabled || acting) event.stopPropagation() }}>
              <IconButton
                aria-label="进度加一"
                className="size-[30px] translate-x-[5px] border border-[#b9e7d6] bg-surface p-0 text-mint-strong opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
                disabled={positiveDisabled || acting}
                onClick={(event) => {
                  event.stopPropagation()
                  void performAction('positive')
                }}
              >
                <AddOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </span>
        )}

        <span className={`task-status grid justify-items-end gap-[5px] ${complete ? 'opacity-60' : ''}`}>
          {task.type === 'progress' ? (
            <>
              <span className="task-count font-mono text-xs font-semibold text-ink-2 max-md:text-[13px]">
                {task.count} / {task.targetCount}
              </span>
              <span className="progress-track block h-[5px] w-[72px] overflow-hidden rounded-full bg-[#ececf2] max-md:w-[68px]" aria-label={`进度 ${progress}%`}>
                <span className="block h-full rounded-[inherit] bg-mint" style={{ width: `${progress}%` }} />
              </span>
            </>
          ) : (
            <span className={`single-state text-[11px] text-muted ${complete ? 'opacity-60' : ''}`}>{task.completed ? '已完成' : '待完成'}</span>
          )}
        </span>
      </Box>
    </Box>
  )
}
