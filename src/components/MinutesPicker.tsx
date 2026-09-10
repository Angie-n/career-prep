import { clampMinutes } from '../lib/types'

/** Compact minutes control — number only, no preset chips. */
export function MinutesPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
  /** @deprecated Preset chips removed; ignored if passed. */
  options?: number[]
}) {
  return (
    <label className={`minutes-input${disabled ? ' is-disabled' : ''}`}>
      <input
        type="number"
        min={1}
        max={180}
        aria-label="Minutes"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clampMinutes(Number(e.target.value), value))}
      />
      <span>min</span>
    </label>
  )
}
