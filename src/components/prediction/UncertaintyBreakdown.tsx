'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { UncertaintyResponse, UncertaintyLevel } from '@/lib/model'

interface UncertaintyBreakdownProps {
  uncertainty: UncertaintyResponse
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline'
  /** Custom class name */
  className?: string
}

const levelConfig: Record<UncertaintyLevel, { label: string; color: string; bgColor: string; description: string }> = {
  very_precise: {
    label: 'Very Precise',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    description: 'Predictions have very narrow confidence intervals',
  },
  precise: {
    label: 'Precise',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    description: 'Predictions have reasonably narrow confidence intervals',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    description: 'Predictions have moderate uncertainty - typical for most applicants',
  },
  uncertain: {
    label: 'Uncertain',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    description: 'Predictions have wider confidence intervals',
  },
  highly_uncertain: {
    label: 'Highly Uncertain',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    description: 'Predictions have very wide confidence intervals',
  },
}

/**
 * Displays uncertainty decomposition showing parameter vs random effect variance
 */
export function UncertaintyBreakdown({
  uncertainty,
  variant = 'card',
  className,
}: UncertaintyBreakdownProps) {
  const { overallLevel, decomposition } = uncertainty
  const config = levelConfig[overallLevel] || levelConfig.moderate

  const { parameterVariance, randomEffectVariance, totalVariance } = decomposition

  // Calculate percentages for the pie/bar
  const total = parameterVariance + randomEffectVariance
  const paramPct = total > 0 ? (parameterVariance / total) * 100 : 50
  const rePct = total > 0 ? (randomEffectVariance / total) * 100 : 50

  const content = (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Overall level badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Prediction Uncertainty</span>
          <span
            className={cn(
              'px-3 py-1 rounded-full border text-sm font-medium',
              config.bgColor,
              config.color
            )}
          >
            {config.label}
          </span>
        </div>

        {/* Variance decomposition bar */}
        <div className="space-y-2">
          <div className="h-6 rounded-full overflow-hidden flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="bg-blue-400 cursor-help flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${paramPct}%` }}
                >
                  {paramPct >= 15 && `${paramPct.toFixed(0)}%`}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">Parameter Uncertainty</p>
                <p className="text-xs text-slate-400">
                  Variance: {parameterVariance.toFixed(4)}
                </p>
                <p className="text-xs text-slate-400">
                  From model calibration and limited data
                </p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="bg-purple-400 cursor-help flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${rePct}%` }}
                >
                  {rePct >= 15 && `${rePct.toFixed(0)}%`}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">Random Effect Uncertainty</p>
                <p className="text-xs text-slate-400">
                  Variance: {randomEffectVariance.toFixed(4)}
                </p>
                <p className="text-xs text-slate-400">
                  From applicant-level variation (essay, interview, etc.)
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-400" />
              <span className="text-slate-600">Parameter ({paramPct.toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-400" />
              <span className="text-slate-600">Random Effects ({rePct.toFixed(0)}%)</span>
            </div>
          </div>
        </div>

        {/* Variance values */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
          <div>
            <p className="text-lg font-semibold text-blue-600">
              {parameterVariance.toFixed(3)}
            </p>
            <p className="text-xs text-slate-500">Parameter</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-purple-600">
              {randomEffectVariance.toFixed(3)}
            </p>
            <p className="text-xs text-slate-500">Random Effect</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">
              {totalVariance.toFixed(3)}
            </p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        </div>

        {/* Explanation */}
        <div className="pt-2 border-t">
          <p className="text-sm text-slate-600">{config.description}</p>
          <p className="text-xs text-slate-400 mt-2">
            {rePct > 60
              ? 'Most uncertainty comes from applicant-level variation in essays, interviews, and other holistic factors.'
              : paramPct > 60
              ? 'Most uncertainty comes from limited calibration data and model parameters.'
              : 'Uncertainty is balanced between model parameters and applicant-level variation.'}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )

  if (variant === 'inline') {
    return content
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Uncertainty Analysis</CardTitle>
        <CardDescription>
          Breakdown of what drives prediction uncertainty
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

/**
 * Compact badge showing just the uncertainty level
 */
export function UncertaintyBadge({
  level,
  showLabel = true,
}: {
  level: UncertaintyLevel
  showLabel?: boolean
}) {
  const config = levelConfig[level] || levelConfig.moderate

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium cursor-help',
              config.bgColor,
              config.color
            )}
          >
            <UncertaintyIcon level={level} />
            {showLabel && config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function UncertaintyIcon({ level }: { level: UncertaintyLevel }) {
  // Simple indicator bars
  const bars = {
    very_precise: 1,
    precise: 2,
    moderate: 3,
    uncertain: 4,
    highly_uncertain: 5,
  }[level]

  return (
    <div className="flex gap-0.5 items-end h-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 rounded-full',
            i <= bars ? 'bg-current' : 'bg-current opacity-20'
          )}
          style={{ height: `${i * 20}%` }}
        />
      ))}
    </div>
  )
}
