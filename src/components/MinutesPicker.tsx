import { clampMinutes } from '../lib/types'

/** Compact minutes control — number only, no preset chips. */
export function MinutesPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (minutes: number) => void
  /** @deprecated Preset chips removed; ignored if passed. */
  options?: number[]
}) {
  return (
    <label className="minutes-input">
      <input
        type="number"
        min={1}
        max={180}
        aria-label="Minutes"
        value={value}
        onChange={(e) => onChange(clampMinutes(Number(e.target.value), value))}
      />
      <span>min</span>
    </label>
  )
}
