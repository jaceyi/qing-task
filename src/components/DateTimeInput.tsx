import { useRef, type MouseEvent } from 'react'
import { CalendarClock } from 'lucide-react'
import { formatDateTimeDisplay } from '../lib/date'

interface DateTimeInputProps {
  value: string
  ariaLabel: string
  onChange: (value: string) => void
}

export function DateTimeInput({ value, ariaLabel, onChange }: DateTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = (event: MouseEvent<HTMLSpanElement>) => {
    if (event.defaultPrevented) return
    const input = inputRef.current
    if (!input) return

    input.focus({ preventScroll: true })
    try {
      input.showPicker?.()
    } catch {
      // The native input click remains as the fallback when showPicker is unavailable.
    }
  }

  return (
    <span className={`date-time-control ${value ? 'has-value' : ''}`} onClick={openPicker}>
      <span className="date-time-value">{formatDateTimeDisplay(value)}</span>
      <CalendarClock aria-hidden="true" />
      <input
        ref={inputRef}
        type="datetime-local"
        step="60"
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  )
}
