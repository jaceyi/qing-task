import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
} from 'lucide-react'
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
    if ((event.target as HTMLElement).closest('button')) return
    gesture.current = {
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
      horizontal: false,
      active: true,
      lastOffset: 0,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.active) return
    const deltaX = event.clientX - gesture.current.startX
    const deltaY = event.clientY - gesture.current.startY
    if (!gesture.current.horizontal && Math.abs(deltaY) > Math.abs(deltaX) + 8) return
    if (Math.abs(deltaX) > 6) {
      gesture.current.dragged = true
      gesture.current.horizontal = true
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div className={`task-row-wrap ${complete ? 'is-complete' : ''}`}>
      <div className="swipe-underlay swipe-underlay-positive" aria-hidden="true">
        {task.type === 'single' ? <Check /> : <Plus />}
        <span>{task.type === 'single' ? '完成' : '+1'}</span>
        <ArrowRight />
      </div>
      <div className="swipe-underlay swipe-underlay-negative" aria-hidden="true">
        <ArrowLeft />
        <span>{task.type === 'single' ? '撤销' : '−1'}</span>
        {task.type === 'single' ? <Check /> : <Minus />}
      </div>
      <div
        className={`task-row is-${task.type}`}
        role="button"
        tabIndex={0}
        aria-label={`打开任务：${task.title}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          gesture.current.active = false
          gesture.current.lastOffset = 0
          setOffset(0)
        }}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
      >
        <button
          className={`task-check ${complete ? 'is-checked' : ''}`}
          type="button"
          aria-label={complete ? `撤销完成：${task.title}` : `推进任务：${task.title}`}
          onClick={(event) => {
            event.stopPropagation()
            void performAction(complete ? 'negative' : 'positive')
          }}
        >
          {complete && <Check />}
        </button>

        <span className="task-copy">
          <span className="task-title">{task.title}</span>
          <span className="task-date">{formatDateRange(task.startDate, task.endDate)}</span>
        </span>

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
      </div>
    </div>
  )
}
