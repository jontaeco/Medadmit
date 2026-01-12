'use client'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CredibleIntervalProps {
  /** Mean/point estimate (0-1 for probabilities) */
  mean: number
  /** 80% credible interval [lower, upper] */
  ci80: [number, number]
  /** Label for the metric */
  label?: string
  /** Whether to show as percentage (multiply by 100) */
  asPercentage?: boolean
  /** Color theme */
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'slate'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show the numeric values */
  showValues?: boolean
  /** Custom class name */
  className?: string
}

const colorClasses = {
  blue: {
    bar: 'bg-blue-500',
    ci: 'bg-blue-200',
    text: 'text-blue-700',
  },
  green: {
    bar: 'bg-green-500',
    ci: 'bg-green-200',
    text: 'text-green-700',
  },
  purple: {
    bar: 'bg-purple-500',
    ci: 'bg-purple-200',
    text: 'text-purple-700',
  },
  orange: {
    bar: 'bg-orange-500',
    ci: 'bg-orange-200',
    text: 'text-orange-700',
  },
  slate: {
    bar: 'bg-slate-500',
    ci: 'bg-slate-200',
    text: 'text-slate-700',
  },
}

const sizeClasses = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

export function CredibleInterval({
  mean,
  ci80,
  label,
  asPercentage = true,
  color = 'blue',
  size = 'md',
  showValues = true,
  className,
}: CredibleIntervalProps) {
  const colors = colorClasses[color]
  const heightClass = sizeClasses[size]

  // Calculate positions (as percentages of the bar width)
  const meanPct = mean * 100
  const lowerPct = ci80[0] * 100
  const upperPct = ci80[1] * 100
  const ciWidth = upperPct - lowerPct

  // Format values for display
  const formatValue = (val: number) => {
    if (asPercentage) {
      return `${(val * 100).toFixed(0)}%`
    }
    return val.toFixed(2)
  }

  // Determine precision level based on CI width
  const ciWidthRaw = ci80[1] - ci80[0]
  const precisionLevel =
    ciWidthRaw < 0.05 ? 'precise' :
    ciWidthRaw < 0.15 ? 'moderate' :
    'uncertain'

  const precisionColors = {
    precise: 'text-green-600',
    moderate: 'text-yellow-600',
    uncertain: 'text-orange-600',
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
        {/* Label and value row */}
        {(label || showValues) && (
          <div className="flex justify-between items-center text-sm">
            {label && <span className="text-slate-600">{label}</span>}
            {showValues && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn('font-medium cursor-help', colors.text)}>
                    {formatValue(mean)}
                    <span className={cn('ml-1 text-xs', precisionColors[precisionLevel])}>
                      ({formatValue(ci80[0])}-{formatValue(ci80[1])})
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    80% Credible Interval: {formatValue(ci80[0])} to {formatValue(ci80[1])}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Precision: {precisionLevel}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Bar visualization */}
        <div className={cn('relative w-full bg-slate-100 rounded-full overflow-hidden', heightClass)}>
          {/* CI range background */}
          <div
            className={cn('absolute top-0 bottom-0 rounded-full', colors.ci)}
            style={{
              left: `${Math.max(0, lowerPct)}%`,
              width: `${Math.min(100 - lowerPct, ciWidth)}%`,
            }}
          />

          {/* Mean point */}
          <div
            className={cn('absolute top-0 bottom-0 w-1 -ml-0.5 rounded-full', colors.bar)}
            style={{ left: `${Math.min(100, Math.max(0, meanPct))}%` }}
          />

          {/* Fill up to mean */}
          <div
            className={cn('absolute top-0 bottom-0 left-0 rounded-l-full opacity-60', colors.bar)}
            style={{ width: `${Math.min(100, meanPct)}%` }}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * Compact version for use in tables/lists
 */
export function CredibleIntervalCompact({
  mean,
  ci80,
  asPercentage = true,
  color = 'blue',
}: Pick<CredibleIntervalProps, 'mean' | 'ci80' | 'asPercentage' | 'color'>) {
  const colors = colorClasses[color]

  const formatValue = (val: number) => {
    if (asPercentage) {
      return `${(val * 100).toFixed(0)}%`
    }
    return val.toFixed(2)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('font-medium cursor-help', colors.text)}>
            {formatValue(mean)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{formatValue(mean)}</p>
          <p className="text-xs text-slate-400">
            80% CI: {formatValue(ci80[0])} - {formatValue(ci80[1])}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
