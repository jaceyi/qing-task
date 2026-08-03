import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { CalendarOff, Check, Minus, Plus, Repeat2, X } from 'lucide-react'
import { formatDateRange } from '../lib/date'
import { describeRecurrence } from '../lib/recurrence'
import { isTaskComplete } from '../lib/taskLogic'
import type { Tag, Task } from '../types'

type SwipeDirection = 'positive' | 'negative'

interface TaskRowProps {
  task: Task
  onOpen: () => void
  onAction: (direction: SwipeDirection) => Promise<boolean>
  onNotify: (message: string) => void
  onRecurrenceAdvanced?: (message: string) => void
  tags?: Tag[]
}

export function TaskRow({ task, onOpen, onAction, onNotify, onRecurrenceAdvanced, tags = [] }: TaskRowProps) {
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
        if (advancesRecurrence) {
          onRecurrenceAdvanced?.(
            task.type === 'progress'
              ? `本次 ${task.targetCount}/${task.targetCount} 已完成，下一次已从 0/${task.targetCount} 开始`
              : '已完成本次，下一次已安排',
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
              : `已撤销一次进度  ${task.count} → ${task.count - 1}`
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
    <div
      className={`task-row-wrap ${complete ? 'is-complete' : ''} ${
        offset > 0 ? 'is-swiping-positive' : offset < 0 ? 'is-swiping-negative' : ''
      }`}
    >
      <div className="swipe-underlay swipe-underlay-positive" aria-hidden="true">
        <Check />
        <span>{task.type === 'single' ? '完成' : '推进'}</span>
      </div>
      <div className="swipe-underlay swipe-underlay-negative" aria-hidden="true">
        <X />
        <span>{task.type === 'single' ? '取消' : '回退'}</span>
      </div>
      <div
        ref={rowRef}
        className={`task-row is-${task.type}`}
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
          <button
            className={`task-check ${complete ? 'is-checked' : ''}`}
            type="button"
            aria-label={complete ? `撤销完成：${task.title}` : `完成任务：${task.title}`}
            onClick={(event) => {
              event.stopPropagation()
              void performAction(complete ? 'negative' : 'positive')
            }}
          >
            {complete && <Check />}
          </button>
        ) : (
          <button
            type="button"
            className={`task-progress-indicator ${complete ? 'is-complete' : ''}`}
            aria-label={
              positiveDisabled
                ? `进度已完成：${task.title}`
                : `推进一次：${task.title}，当前进度 ${task.count}/${task.targetCount}`
            }
            disabled={positiveDisabled || acting}
            onClick={(event) => {
              event.stopPropagation()
              void performAction('positive')
            }}
          >
            <svg viewBox="0 0 26 26" aria-hidden="true">
              <circle className="task-progress-ring-track" cx="13" cy="13" r="12" pathLength="100" />
              <circle
                className="task-progress-ring-value"
                cx="13"
                cy="13"
                r="12"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - progress}
              />
            </svg>
            <span className="task-progress-center">{complete && <Check />}</span>
          </button>
        )}

        <span className="task-copy-cell">
          <button
            type="button"
            className="task-copy task-detail-trigger"
            aria-label={`打开任务：${task.title}`}
            onClick={(event) => {
              event.stopPropagation()
              handleOpen()
            }}
          >
            <span className="task-title">{task.title}</span>
            <span className="task-meta-line">
              <span className={`task-date ${!task.startDate && !task.endDate ? 'is-timeless' : ''}`}>
                {!task.startDate && !task.endDate && <CalendarOff />}
                {formatDateRange(task.startDate, task.endDate)}
              </span>
              {task.recurrence && (
                <span className="recurrence-badge" title={describeRecurrence(task.recurrence)}><Repeat2 />{describeRecurrence(task.recurrence).split(' · ')[0]}</span>
              )}
              {rowTags.slice(0, 3).map((tag) => <span key={tag.id} className={`task-tag-dot is-${tag.color}`} title={tag.name}><i />{tag.name}</span>)}
              {rowTags.length > 3 && <span className="task-tag-more">+{rowTags.length - 3}</span>}
            </span>
          </button>
        </span>

        {task.type === 'progress' && (
          <span className="task-inline-actions">
            <button
              type="button"
              aria-label="进度减一"
              disabled={negativeDisabled || acting}
              onClick={(event) => {
                event.stopPropagation()
                void performAction('negative')
              }}
            >
              <Minus />
            </button>
            <button
              type="button"
              aria-label="进度加一"
              disabled={positiveDisabled || acting}
              onClick={(event) => {
                event.stopPropagation()
                void performAction('positive')
              }}
            >
              <Plus />
            </button>
          </span>
        )}

        <span className="task-status">
          {task.type === 'progress' ? (
            <>
              <span className="task-count">
                {task.count} / {task.targetCount}
              </span>
              <span className="progress-track" aria-label={`进度 ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </span>
            </>
          ) : (
            <span className="single-state">{task.completed ? '已完成' : '待完成'}</span>
          )}
        </span>
      </div>
    </div>
  )
}
