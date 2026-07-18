interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

/** Dumb presentational progress bar — no internal state, no polling; the
 * caller owns value/max and re-renders it as work advances. */
export function ProgressBar({ value, max, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-cream-soft ${className ?? ''}`}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
