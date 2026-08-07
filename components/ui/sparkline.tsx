import { cn } from '@/lib/utils'

interface SparklineProps {
  /** Oldest → newest. Fewer than two points renders nothing. */
  values: number[]
  /** Accessible sentence describing the trend. */
  label: string
  className?: string
}

/**
 * The trend line on a stat tile.
 *
 * Deliberately unlabelled and unaxed: it exists to say "rising, falling, or
 * flat" beside a number that already gives the magnitude. Every value it plots
 * is also readable in the monthly chart's table below, so nothing is gated
 * behind a shape nobody can hover.
 *
 * Drawn against a baseline of zero rather than the series minimum, so a run of
 * small positive months does not look like a collapse and a negative month is
 * visibly below the line. Most of the line is de-emphasised with the current
 * period picked out in the accent, which is what makes the newest value — the
 * one the tile's number reports — findable at a glance.
 */
export function Sparkline({ values, label, className }: SparklineProps) {
  if (values.length < 2) return null

  const W = 100
  const H = 28
  const PAD = 3

  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1

  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2)

  const points = values.map((v, i) => [x(i), y(v)] as const)
  const path = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')

  // The final segment carries the accent; everything before it recedes.
  const [prevX, prevY] = points[points.length - 2]
  const [lastX, lastY] = points[points.length - 1]

  const zeroY = y(0)
  const showZero = min < 0 && max > 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('h-7 w-full', className)}
      role="img"
      aria-label={label}
    >
      {/* Only drawn when the series actually crosses zero — otherwise it is a
          rule with no information in it. */}
      {showZero && (
        <line
          x1={0} y1={zeroY} x2={W} y2={zeroY}
          stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.45}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* The most recent period, in the accent — this is what marks the end of
          the line. No end-dot: the viewBox is stretched to the tile's width,
          which turns a circle into a wide ellipse that reads as an arrowhead.
          A stroke survives that (non-scaling-stroke); a fill does not. */}
      <path
        d={`M${prevX.toFixed(1)} ${prevY.toFixed(1)} L${lastX.toFixed(1)} ${lastY.toFixed(1)}`}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
