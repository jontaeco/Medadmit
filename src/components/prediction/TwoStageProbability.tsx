'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CredibleInterval } from './CredibleInterval'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SchoolPredictionResponse, CredibleInterval as CredibleIntervalType } from '@/lib/model'

interface TwoStageProbabilityProps {
  school: SchoolPredictionResponse
  /** Whether to show detailed breakdown */
  showDetails?: boolean
  /** Custom class name */
  className?: string
}

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  reach: {
    label: 'Reach',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
  },
  target: {
    label: 'Target',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  likely: {
    label: 'Likely',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  safety: {
    label: 'Safety',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
}

/**
 * Displays two-stage probability for a single school
 */
export function TwoStageProbability({
  school,
  showDetails = true,
  className,
}: TwoStageProbabilityProps) {
  const config = categoryConfig[school.category] || categoryConfig.target

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{school.name}</CardTitle>
            <p className="text-sm text-slate-500">
              {school.state} {school.isPublic ? '(Public)' : '(Private)'}
              {school.isInState && ' - In-State'}
            </p>
          </div>
          <span
            className={cn(
              'px-2 py-1 rounded-full border text-xs font-medium shrink-0 ml-2',
              config.bgColor,
              config.color
            )}
          >
            {config.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Two-stage probabilities */}
        <div className="space-y-2">
          <CredibleInterval
            mean={school.pInterview.mean}
            ci80={school.pInterview.ci80}
            label="Interview"
            color="purple"
            size="sm"
          />
          <CredibleInterval
            mean={school.pAcceptGivenInterview.mean}
            ci80={school.pAcceptGivenInterview.ci80}
            label="Accept | Interview"
            color="blue"
            size="sm"
          />
          <div className="border-t pt-2">
            <CredibleInterval
              mean={school.pAccept.mean}
              ci80={school.pAccept.ci80}
              label="Overall Acceptance"
              color="green"
              size="md"
            />
          </div>
        </div>

        {/* Visual funnel */}
        <TooltipProvider>
          <div className="flex items-center justify-center gap-1 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-8 bg-purple-400 rounded-l cursor-help"
                  style={{ width: `${Math.max(10, school.pInterview.mean * 100)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">P(Interview) = {(school.pInterview.mean * 100).toFixed(0)}%</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-slate-400 text-xs px-1">x</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-8 bg-blue-400 cursor-help"
                  style={{ width: `${Math.max(10, school.pAcceptGivenInterview.mean * 100)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">P(Accept|Int) = {(school.pAcceptGivenInterview.mean * 100).toFixed(0)}%</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-slate-400 text-xs px-1">=</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-8 bg-green-500 rounded-r cursor-help"
                  style={{ width: `${Math.max(10, school.pAccept.mean * 100)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">P(Accept) = {(school.pAccept.mean * 100).toFixed(0)}%</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Factor breakdown (optional) */}
        {showDetails && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 mb-2">Contributing Factors</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <FactorRow
                label="Competitiveness"
                value={school.factors.competitivenessEffect}
              />
              <FactorRow
                label="In-State Bonus"
                value={school.factors.inStateBonus}
              />
              <FactorRow
                label="Demographics"
                value={school.factors.demographicEffect}
              />
              <FactorRow
                label="Mission Fit"
                value={school.factors.missionFitEffect}
              />
            </div>
            {school.missionAlignment.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {school.missionAlignment.map((m) => (
                  <span
                    key={m}
                    className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FactorRow({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0
  const isNegative = value < 0
  const displayValue = value === 0 ? '0' : (isPositive ? '+' : '') + value.toFixed(2)

  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span
        className={cn(
          'font-medium',
          isPositive && 'text-green-600',
          isNegative && 'text-red-600',
          !isPositive && !isNegative && 'text-slate-400'
        )}
      >
        {displayValue}
      </span>
    </div>
  )
}

/**
 * Compact version for school lists
 */
export function TwoStageProbabilityCompact({
  school,
}: {
  school: SchoolPredictionResponse
}) {
  const config = categoryConfig[school.category] || categoryConfig.target

  const formatPct = (val: number) => `${(val * 100).toFixed(0)}%`

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{school.name}</p>
          <p className="text-xs text-slate-500">
            {school.state} {school.isInState && '(In-State)'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-purple-600 cursor-help">
                {formatPct(school.pInterview.mean)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Interview: {formatPct(school.pInterview.ci80[0])}-{formatPct(school.pInterview.ci80[1])}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-slate-400">x</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-blue-600 cursor-help">
                {formatPct(school.pAcceptGivenInterview.mean)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Accept|Int: {formatPct(school.pAcceptGivenInterview.ci80[0])}-{formatPct(school.pAcceptGivenInterview.ci80[1])}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-slate-400">=</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-green-600 font-medium cursor-help">
                {formatPct(school.pAccept.mean)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Overall: {formatPct(school.pAccept.ci80[0])}-{formatPct(school.pAccept.ci80[1])}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <span
          className={cn(
            'px-2 py-0.5 rounded-full border text-xs font-medium',
            config.bgColor,
            config.color
          )}
        >
          {config.label}
        </span>
      </div>
    </TooltipProvider>
  )
}
