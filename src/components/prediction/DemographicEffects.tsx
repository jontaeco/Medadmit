'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { DemographicResponse } from '@/lib/model'

interface DemographicEffectsProps {
  demographics: DemographicResponse
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline'
  /** Custom class name */
  className?: string
}

interface FactorConfig {
  label: string
  description: string
  icon: string
}

const factorConfigs: Record<string, FactorConfig> = {
  raceEthnicity: {
    label: 'Race/Ethnicity',
    description: 'Effect based on AAMC diversity data',
    icon: '🌍',
  },
  firstGen: {
    label: 'First Generation',
    description: 'First in family to attend medical school',
    icon: '🎓',
  },
  disadvantaged: {
    label: 'Disadvantaged',
    description: 'Socioeconomically disadvantaged background',
    icon: '📊',
  },
  rural: {
    label: 'Rural Background',
    description: 'From a rural or underserved area',
    icon: '🏡',
  },
}

/**
 * Displays demographic effect breakdown
 */
export function DemographicEffects({
  demographics,
  variant = 'card',
  className,
}: DemographicEffectsProps) {
  const { totalEffect, breakdown } = demographics

  // Convert breakdown to array for rendering
  const factors = [
    { key: 'raceEthnicity', value: breakdown.raceEthnicity },
    { key: 'firstGen', value: breakdown.firstGen },
    { key: 'disadvantaged', value: breakdown.disadvantaged },
    { key: 'rural', value: breakdown.rural },
  ].filter((f) => f.value !== 0) // Only show non-zero factors

  const hasEffects = totalEffect !== 0 || factors.length > 0

  const content = (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Total effect */}
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="text-sm text-slate-600">Total Demographic Effect</span>
          <span
            className={cn(
              'text-xl font-bold',
              totalEffect > 0 && 'text-green-600',
              totalEffect < 0 && 'text-red-600',
              totalEffect === 0 && 'text-slate-400'
            )}
          >
            {totalEffect > 0 ? '+' : ''}
            {totalEffect.toFixed(2)}
          </span>
        </div>

        {/* Factor breakdown */}
        {hasEffects ? (
          <div className="space-y-3">
            {factors.map(({ key, value }) => {
              const config = factorConfigs[key]
              if (!config) return null

              return (
                <EffectRow
                  key={key}
                  icon={config.icon}
                  label={config.label}
                  description={config.description}
                  value={value}
                />
              )
            })}

            {factors.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">
                No demographic factors applied
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            No demographic adjustments for your profile
          </p>
        )}

        {/* Explanation */}
        <div className="pt-2 border-t">
          <p className="text-xs text-slate-500">
            Demographic effects are based on AAMC admission data and reflect
            holistic review practices. Effects are expressed in logit units -
            positive values increase admission probability.
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
        <CardTitle className="text-lg">Demographic Effects</CardTitle>
        <CardDescription>
          How demographic factors affect your predictions
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

interface EffectRowProps {
  icon: string
  label: string
  description: string
  value: number
}

function EffectRow({ icon, label, description, value }: EffectRowProps) {
  const isPositive = value > 0
  const isNegative = value < 0

  // Calculate bar width (max effect around ±1.0)
  const barWidth = Math.min(100, Math.abs(value) * 50)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-1 cursor-help">
          {/* Label and value */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{icon}</span>
              <span className="text-sm text-slate-700">{label}</span>
            </div>
            <span
              className={cn(
                'font-medium',
                isPositive && 'text-green-600',
                isNegative && 'text-red-600',
                !isPositive && !isNegative && 'text-slate-400'
              )}
            >
              {value > 0 ? '+' : ''}
              {value.toFixed(2)}
            </span>
          </div>

          {/* Effect bar */}
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />

            {/* Effect bar */}
            {isPositive && (
              <div
                className="absolute top-0 bottom-0 left-1/2 bg-green-400 rounded-r-full"
                style={{ width: `${barWidth / 2}%` }}
              />
            )}
            {isNegative && (
              <div
                className="absolute top-0 bottom-0 right-1/2 bg-red-400 rounded-l-full"
                style={{ width: `${barWidth / 2}%` }}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
        <p className="text-xs mt-1">
          Effect: {value > 0 ? '+' : ''}{value.toFixed(3)} logit units
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Compact version for summaries
 */
export function DemographicCompact({
  demographics,
}: {
  demographics: DemographicResponse
}) {
  const { totalEffect, breakdown } = demographics

  // Count active factors
  const activeFactors = Object.values(breakdown).filter((v) => v !== 0).length

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <span className="text-sm text-slate-600">Demographics</span>
            <span
              className={cn(
                'font-medium',
                totalEffect > 0 && 'text-green-600',
                totalEffect < 0 && 'text-red-600',
                totalEffect === 0 && 'text-slate-400'
              )}
            >
              {totalEffect > 0 ? '+' : ''}
              {totalEffect.toFixed(2)}
            </span>
            {activeFactors > 0 && (
              <span className="text-xs text-slate-400">
                ({activeFactors} factor{activeFactors !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">Demographic Effects</p>
            {breakdown.raceEthnicity !== 0 && (
              <p>Race/Ethnicity: {breakdown.raceEthnicity >= 0 ? '+' : ''}{breakdown.raceEthnicity.toFixed(2)}</p>
            )}
            {breakdown.firstGen !== 0 && (
              <p>First Gen: {breakdown.firstGen >= 0 ? '+' : ''}{breakdown.firstGen.toFixed(2)}</p>
            )}
            {breakdown.disadvantaged !== 0 && (
              <p>Disadvantaged: {breakdown.disadvantaged >= 0 ? '+' : ''}{breakdown.disadvantaged.toFixed(2)}</p>
            )}
            {breakdown.rural !== 0 && (
              <p>Rural: {breakdown.rural >= 0 ? '+' : ''}{breakdown.rural.toFixed(2)}</p>
            )}
            {activeFactors === 0 && (
              <p className="text-slate-400">No demographic adjustments</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
