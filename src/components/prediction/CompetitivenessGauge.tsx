'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CompetitivenessResponse } from '@/lib/model'

interface CompetitivenessGaugeProps {
  competitiveness: CompetitivenessResponse
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline'
  /** Custom class name */
  className?: string
}

const classificationConfig: Record<string, { label: string; color: string; description: string }> = {
  very_low: {
    label: 'Very Low',
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Significantly below average competitiveness',
  },
  low: {
    label: 'Low',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    description: 'Below average competitiveness',
  },
  below_average: {
    label: 'Below Average',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Slightly below average competitiveness',
  },
  average: {
    label: 'Average',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    description: 'Average competitiveness among applicants',
  },
  above_average: {
    label: 'Above Average',
    color: 'text-lime-600 bg-lime-50 border-lime-200',
    description: 'Slightly above average competitiveness',
  },
  high: {
    label: 'High',
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Well above average competitiveness',
  },
  very_high: {
    label: 'Very High',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Exceptionally high competitiveness',
  },
}

/**
 * Visual gauge showing competitiveness score (C) on a -3 to +3 scale
 */
export function CompetitivenessGauge({
  competitiveness,
  variant = 'card',
  className,
}: CompetitivenessGaugeProps) {
  const { C, percentile, classification, breakdown } = competitiveness
  const config = classificationConfig[classification] || classificationConfig.average

  // Calculate position on gauge (0-100%)
  // C ranges from -3 to +3, so we map to 0-100%
  const gaugePosition = ((C + 3) / 6) * 100
  const clampedPosition = Math.max(0, Math.min(100, gaugePosition))

  // Determine color based on C value
  const getGradientColor = (c: number) => {
    if (c < -1.5) return 'from-red-500 via-red-400 to-orange-400'
    if (c < -0.5) return 'from-orange-400 via-yellow-400 to-yellow-300'
    if (c < 0.5) return 'from-yellow-300 via-lime-300 to-lime-400'
    if (c < 1.5) return 'from-lime-400 via-green-400 to-green-500'
    return 'from-green-500 via-emerald-400 to-emerald-500'
  }

  const content = (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Main gauge */}
        <div className="space-y-2">
          {/* Gauge bar */}
          <div className="relative">
            {/* Background gradient */}
            <div className="h-4 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 opacity-30" />

            {/* Filled portion */}
            <div
              className={cn(
                'absolute top-0 left-0 h-4 rounded-l-full bg-gradient-to-r',
                getGradientColor(C)
              )}
              style={{ width: `${clampedPosition}%` }}
            />

            {/* Position marker */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 -ml-2.5 bg-white border-2 border-slate-800 rounded-full shadow-lg cursor-help flex items-center justify-center"
                  style={{ left: `${clampedPosition}%` }}
                >
                  <div className="w-2 h-2 bg-slate-800 rounded-full" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">C = {C.toFixed(2)}</p>
                <p className="text-xs text-slate-400">{percentile}th percentile</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-xs text-slate-500">
            <span>-3</span>
            <span>-2</span>
            <span>-1</span>
            <span className="font-medium">0</span>
            <span>+1</span>
            <span>+2</span>
            <span>+3</span>
          </div>
        </div>

        {/* Score and classification */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">
              C = {C >= 0 ? '+' : ''}{C.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500">
              {percentile}th percentile
            </p>
          </div>
          <span
            className={cn(
              'px-3 py-1 rounded-full border text-sm font-medium',
              config.color
            )}
          >
            {config.label}
          </span>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">
              {breakdown.gpaContribution >= 0 ? '+' : ''}
              {breakdown.gpaContribution.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">GPA Contribution</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-purple-600">
              {breakdown.mcatContribution >= 0 ? '+' : ''}
              {breakdown.mcatContribution.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">MCAT Contribution</p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-slate-500 text-center">
          {config.description}. C = 0 corresponds to 3.75 GPA and 512 MCAT (anchor point).
        </p>
      </div>
    </TooltipProvider>
  )

  if (variant === 'inline') {
    return content
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Competitiveness Score</CardTitle>
        <CardDescription>
          Your academic competitiveness relative to the applicant pool
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

/**
 * Compact version for use in summaries
 */
export function CompetitivenessCompact({
  C,
  percentile,
  classification,
}: {
  C: number
  percentile: number
  classification: string
}) {
  const config = classificationConfig[classification] || classificationConfig.average

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <span className="text-xl font-bold">
              C = {C >= 0 ? '+' : ''}{C.toFixed(1)}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full border text-xs font-medium',
                config.color
              )}
            >
              {config.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{percentile}th percentile</p>
          <p className="text-xs text-slate-400">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
