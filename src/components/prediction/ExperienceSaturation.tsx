'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExperienceResponse } from '@/lib/model'

interface ExperienceSaturationProps {
  experience: ExperienceResponse
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline'
  /** Custom class name */
  className?: string
}

interface DomainConfig {
  label: string
  color: string
  bgColor: string
  icon: string
  unit: string
}

const domainConfigs: Record<string, DomainConfig> = {
  clinical: {
    label: 'Clinical',
    color: 'text-red-600',
    bgColor: 'bg-red-500',
    icon: '🏥',
    unit: 'hrs',
  },
  research: {
    label: 'Research',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500',
    icon: '🔬',
    unit: 'hrs',
  },
  volunteer: {
    label: 'Volunteer',
    color: 'text-green-600',
    bgColor: 'bg-green-500',
    icon: '🤝',
    unit: 'hrs',
  },
  shadowing: {
    label: 'Shadowing',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500',
    icon: '👤',
    unit: 'hrs',
  },
  leadership: {
    label: 'Leadership',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500',
    icon: '🎯',
    unit: 'roles',
  },
  publications: {
    label: 'Publications',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500',
    icon: '📄',
    unit: '',
  },
}

/**
 * Displays experience contributions with saturation indicators
 */
export function ExperienceSaturation({
  experience,
  variant = 'card',
  className,
}: ExperienceSaturationProps) {
  const domains = experience.domains

  const content = (
    <TooltipProvider>
      <div className={cn('space-y-4', className)}>
        {/* Total contribution */}
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="text-sm text-slate-600">Total Experience Contribution</span>
          <span className="text-lg font-bold text-slate-800">
            {experience.totalContribution >= 0 ? '+' : ''}
            {experience.totalContribution.toFixed(2)}
          </span>
        </div>

        {/* Domain bars */}
        <div className="space-y-3">
          {/* Clinical */}
          <SaturationBar
            config={domainConfigs.clinical}
            hours={domains.clinical.hours}
            contribution={domains.clinical.contribution}
            saturationPct={domains.clinical.saturationPct}
            thresholdMet={experience.thresholdsMet.clinical}
            isRequired
          />

          {/* Research */}
          <SaturationBar
            config={domainConfigs.research}
            hours={domains.research.hours}
            contribution={domains.research.contribution}
            saturationPct={domains.research.saturationPct}
          />

          {/* Volunteer */}
          <SaturationBar
            config={domainConfigs.volunteer}
            hours={domains.volunteer.hours}
            contribution={domains.volunteer.contribution}
            saturationPct={domains.volunteer.saturationPct}
          />

          {/* Shadowing */}
          <SaturationBar
            config={domainConfigs.shadowing}
            hours={domains.shadowing.hours}
            contribution={domains.shadowing.contribution}
            saturationPct={domains.shadowing.saturationPct}
          />

          {/* Leadership */}
          <SaturationBar
            config={domainConfigs.leadership}
            hours={domains.leadership.count}
            contribution={domains.leadership.contribution}
            saturationPct={domains.leadership.saturationPct ?? 0}
          />

          {/* Publications */}
          <SaturationBar
            config={domainConfigs.publications}
            hours={domains.publications.count}
            contribution={domains.publications.contribution}
            saturationPct={undefined}
          />
        </div>

        {/* Threshold status */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-3 h-3 rounded-full',
                experience.thresholdsMet.overall ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span className="text-sm text-slate-600">
              {experience.thresholdsMet.overall
                ? 'All minimum thresholds met'
                : 'Some minimum thresholds not met'}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-slate-500">
          Bars show saturation level. Additional hours beyond ~90% saturation provide
          diminishing returns.
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
        <CardTitle className="text-lg">Experience Analysis</CardTitle>
        <CardDescription>
          Your experience contributions with diminishing returns visualization
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

interface SaturationBarProps {
  config: DomainConfig
  hours: number
  contribution: number
  saturationPct?: number
  thresholdMet?: boolean
  isRequired?: boolean
}

function SaturationBar({
  config,
  hours,
  contribution,
  saturationPct,
  thresholdMet,
  isRequired,
}: SaturationBarProps) {
  const hasSaturation = saturationPct !== undefined
  const saturation = saturationPct ?? 100

  // Determine bar color based on saturation
  const getBarOpacity = () => {
    if (saturation >= 90) return 'opacity-100'
    if (saturation >= 60) return 'opacity-80'
    if (saturation >= 30) return 'opacity-60'
    return 'opacity-40'
  }

  // Format hours/count display
  const formatAmount = () => {
    if (config.unit === 'roles' || config.unit === '') {
      return hours.toString()
    }
    return `${hours} ${config.unit}`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="space-y-1 cursor-help">
          {/* Label row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span>{config.icon}</span>
              <span className={config.color}>{config.label}</span>
              {isRequired && !thresholdMet && (
                <span className="text-xs text-red-500 font-medium">
                  (Below min)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs">{formatAmount()}</span>
              <span className="font-medium">
                {contribution >= 0 ? '+' : ''}
                {contribution.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Saturation bar */}
          <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'absolute top-0 left-0 h-full rounded-full transition-all',
                config.bgColor,
                getBarOpacity()
              )}
              style={{ width: `${Math.min(100, saturation)}%` }}
            />
            {/* 90% marker */}
            {hasSaturation && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                style={{ left: '90%' }}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">
          <p className="font-medium">{config.label}: {formatAmount()}</p>
          <p>Contribution: {contribution >= 0 ? '+' : ''}{contribution.toFixed(3)} logit units</p>
          {hasSaturation && (
            <p className="text-slate-400">
              {saturation.toFixed(0)}% saturated
              {saturation >= 90 && ' (near maximum benefit)'}
            </p>
          )}
          {isRequired && (
            <p className={thresholdMet ? 'text-green-400' : 'text-red-400'}>
              {thresholdMet ? 'Meets minimum requirement' : 'Below minimum requirement'}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Compact version for summaries
 */
export function ExperienceCompact({
  experience,
}: {
  experience: ExperienceResponse
}) {
  const domains = [
    { key: 'clinical', ...experience.domains.clinical },
    { key: 'research', ...experience.domains.research },
    { key: 'volunteer', ...experience.domains.volunteer },
    { key: 'shadowing', ...experience.domains.shadowing },
  ]

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Experience</span>
          <span className="text-sm font-bold">
            {experience.totalContribution >= 0 ? '+' : ''}
            {experience.totalContribution.toFixed(2)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {domains.map((d) => {
            const config = domainConfigs[d.key]
            const satPct = d.saturationPct
            return (
              <Tooltip key={d.key}>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help">
                    <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div
                        className={cn('h-full rounded-full', config.bgColor)}
                        style={{ width: `${Math.min(100, satPct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{config.label.slice(0, 4)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{config.label}: {d.hours} hrs ({satPct.toFixed(0)}% saturated)</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
