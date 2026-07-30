import { useRef, useState, type PointerEvent } from 'react'
import { CalendarOff, Check, Minus, Plus, X } from 'lucide-react'
import { formatDateRange } from '../lib/date'
import { isTaskComplete } from '../lib/taskLogic'
import type { Task } from '../types'

type SwipeDirection = 'positive' | 'negative'

interface TaskRowProps {
  task: Task
  onOpen: () => void
  onAction: (direction: SwipeDirection) => Promise<boolean>
  onNotify: (message: string) => void
}

export function TaskRow({ task, onOpen, onAction, onNotify }: TaskRowProps) {
  const [offset, setOffset] = useState(0)
  const [acting, setActing] = useState(false)
  const gesture = useRef({
    startX: 0,
    startY: 0,
    dragged: false,
    horizontal: false,
    active: false,
    lastOffset: 0,
  })
  const complete = isTaskComplete(task)
  const positiveDisabled = task.type === 'single' ? task.completed : task.count >= task.targetCount
  const negativeDisabled = task.type === 'single' ? !task.completed : task.count <= 0
  const progress = task.type === 'progress' ? Math.round((task.count / task.targetCount) * 100) : 0

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
      active: true,
      lastOffset: 0,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.active) return
    const deltaX = event.clientX - gesture.current.startX
    const deltaY = event.clientY - gesture.current.startY
    if (!gesture.current.horizontal && Math.abs(deltaY) > Math.abs(deltaX) + 8) return
    if (Math.abs(deltaX) > 6) {
      gesture.current.dragged = true
      gesture.current.horizontal = true
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
    if (releasedOffset > 54) void performAction('positive')
    else if (releasedOffset < -54) void performAction('negative')
    else setOffset(0)
  }

  const handleOpen = () => {
    if (gesture.current.dragged) {
      gesture.current.dragged = false
      return
    }
    onOpen()
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
        className={`task-row is-${task.type}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          gesture.current.active = false
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
          <span
            className={`task-progress-indicator ${complete ? 'is-complete' : ''}`}
            role="img"
            aria-label={`当前进度 ${task.count}/${task.targetCount}`}
          >
            <svg viewBox="0 0 26 26" aria-hidden="true">
              <circle className="task-progress-ring-track" cx="13" cy="13" r="10" pathLength="100" />
              <circle
                className="task-progress-ring-value"
                cx="13"
                cy="13"
                r="10"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - progress}
              />
            </svg>
            <span className="task-progress-center">{complete && <Check />}</span>
          </span>
        )}

        <span className="task-copy-cell">
          <button
            type="button"
            className="task-copy task-detail-trigger"
            aria-label={`打开任务：${task.title}`}
            onClick={handleOpen}
          >
            <span className="task-title">{task.title}</span>
            <span className={`task-date ${!task.startDate && !task.endDate ? 'is-timeless' : ''}`}>
              {!task.startDate && !task.endDate && <CalendarOff />}
              {formatDateRange(task.startDate, task.endDate)}
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
