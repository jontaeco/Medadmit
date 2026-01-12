'use client'

/**
 * School List Component (v2.0)
 *
 * Displays school predictions with two-stage probability model:
 * - P(interview) × P(accept|interview) = P(accept)
 * - 80% credible intervals
 * - Category tiers: reach, target, likely, safety
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'

interface SchoolProbability {
  school: {
    id: string
    name: string
    shortName: string
    state: string
    city: string
    medianGPA: number
    medianMCAT: number
    isPublic: boolean
    oosFriendliness: string
    tuitionInState: number
    tuitionOutOfState: number
    warsTier?: number
    isLowYield?: boolean
    interviewToAcceptanceRate?: number
  }
  probability: number
  probabilityLower: number
  probabilityUpper: number
  category: 'reach' | 'target' | 'safety'
  fit: {
    gpaPercentile: number
    mcatPercentile: number
    isInState: boolean
    missionAlignment: string[]
  }
  // New v2.0 two-stage probability fields
  pInterview?: number
  pInterviewCI?: [number, number]
  pAcceptGivenInterview?: number
  pAcceptGivenInterviewCI?: [number, number]
  pAcceptCI?: [number, number]
}

interface SchoolListProps {
  reach: SchoolProbability[]
  target: SchoolProbability[]
  safety: SchoolProbability[]
  summary: {
    totalSchools: number
    expectedInterviews: number
    expectedAcceptances: number
    probabilityOfAtLeastOne: number
  }
}

const categoryColors = {
  reach: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
  },
  target: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
  safety: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
  },
}

const warsTierColors: Record<number, string> = {
  1: 'bg-purple-600 text-white', // TOP
  2: 'bg-blue-600 text-white',   // HIGH
  3: 'bg-green-600 text-white',  // MID
  4: 'bg-gray-600 text-white',   // LOW
  5: 'bg-amber-600 text-white',  // STATE
  6: 'bg-red-600 text-white',    // LOW YIELD
}

const warsTierNames: Record<number, string> = {
  1: 'TOP',
  2: 'HIGH',
  3: 'MID',
  4: 'LOW',
  5: 'STATE',
  6: 'LOW YIELD',
}

// Helper to sort schools by tier then probability
function sortByTier<T extends SchoolProbability>(schools: T[]): T[] {
  return [...schools].sort((a, b) => {
    const tierDiff = (a.school.warsTier ?? 99) - (b.school.warsTier ?? 99)
    if (tierDiff !== 0) return tierDiff
    return b.probability - a.probability
  })
}

export function SchoolList({ reach, target, safety, summary }: SchoolListProps) {
  const [activeTab, setActiveTab] = useState('all')

  // Sort all lists by tier
  const sortedReach = sortByTier(reach)
  const sortedTarget = sortByTier(target)
  const sortedSafety = sortByTier(safety)

  const allSchools = sortByTier([
    ...reach.map((s) => ({ ...s, category: 'reach' as const })),
    ...target.map((s) => ({ ...s, category: 'target' as const })),
    ...safety.map((s) => ({ ...s, category: 'safety' as const })),
  ])

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>School List Summary</CardTitle>
          <CardDescription>
            {summary.totalSchools} schools selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-purple-600">{reach.length}</p>
              <p className="text-sm text-slate-500">Reach</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">{target.length}</p>
              <p className="text-sm text-slate-500">Target</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">{safety.length}</p>
              <p className="text-sm text-slate-500">Safety</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {(summary.probabilityOfAtLeastOne * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-slate-500">Success Chance</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl font-semibold">{summary.expectedInterviews}</p>
              <p className="text-sm text-slate-500">Expected Interviews</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{summary.expectedAcceptances}</p>
              <p className="text-sm text-slate-500">Expected Acceptances</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* School Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({allSchools.length})</TabsTrigger>
              <TabsTrigger value="reach">Reach ({reach.length})</TabsTrigger>
              <TabsTrigger value="target">Target ({target.length})</TabsTrigger>
              <TabsTrigger value="safety">Safety ({safety.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <SchoolGrid schools={allSchools} showTierHeaders />
            </TabsContent>
            <TabsContent value="reach" className="mt-4">
              <SchoolGrid schools={sortedReach} showTierHeaders />
            </TabsContent>
            <TabsContent value="target" className="mt-4">
              <SchoolGrid schools={sortedTarget} showTierHeaders />
            </TabsContent>
            <TabsContent value="safety" className="mt-4">
              <SchoolGrid schools={sortedSafety} showTierHeaders />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SchoolGrid({ schools, showTierHeaders = false }: { schools: SchoolProbability[]; showTierHeaders?: boolean }) {
  if (schools.length === 0) {
    return (
      <p className="text-center py-8 text-slate-500">
        No schools in this category
      </p>
    )
  }

  if (!showTierHeaders) {
    return (
      <div className="space-y-3">
        {schools.map((sp) => (
          <SchoolCard key={sp.school.id} schoolProb={sp} />
        ))}
      </div>
    )
  }

  // Group schools by tier with headers
  const schoolsByTier: Record<number, SchoolProbability[]> = {}
  schools.forEach((sp) => {
    const tier = sp.school.warsTier ?? 99
    if (!schoolsByTier[tier]) schoolsByTier[tier] = []
    schoolsByTier[tier].push(sp)
  })

  const sortedTiers = Object.keys(schoolsByTier)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      {sortedTiers.map((tier) => (
        <div key={tier}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`text-sm px-3 py-1 rounded font-semibold ${
                warsTierColors[tier] || 'bg-gray-600 text-white'
              }`}
            >
              {warsTierNames[tier] || `Tier ${tier}`}
            </span>
            <span className="text-sm text-slate-500">
              ({schoolsByTier[tier].length} school{schoolsByTier[tier].length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-3">
            {schoolsByTier[tier].map((sp) => (
              <SchoolCard key={sp.school.id} schoolProb={sp} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SchoolCard({ schoolProb }: { schoolProb: SchoolProbability }) {
  const { school, probability, fit, category, pInterview, pAcceptGivenInterview, pAcceptCI } = schoolProb
  const colors = categoryColors[category]
  const acceptancePercent = Math.round(probability * 100)

  // Use v2.0 two-stage probabilities if available, otherwise fall back to legacy calculation
  const hasNativeProbs = pInterview !== undefined && pAcceptGivenInterview !== undefined

  let interviewProb: number
  let condAcceptProb: number
  if (hasNativeProbs) {
    interviewProb = pInterview
    condAcceptProb = pAcceptGivenInterview
  } else {
    // Legacy calculation: reverse-engineer from acceptance probability
    const schoolRate = school.interviewToAcceptanceRate ?? 0.45
    interviewProb = Math.min(0.95, probability / schoolRate)
    condAcceptProb = schoolRate
  }

  const interviewPercent = Math.round(interviewProb * 100)
  const condAcceptPercent = Math.round(condAcceptProb * 100)

  return (
    <div
      className={`p-4 rounded-lg border ${colors.bg} ${colors.border} transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{school.name}</h3>
            {school.warsTier && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  warsTierColors[school.warsTier] || 'bg-gray-600 text-white'
                }`}
              >
                {warsTierNames[school.warsTier] || `Tier ${school.warsTier}`}
              </span>
            )}
            {fit.isInState && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                In-State
              </span>
            )}
            {school.isLowYield && (
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                Low Yield
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {school.city}, {school.state} • {school.isPublic ? 'Public' : 'Private'}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-slate-500">
            <span>Median GPA: {school.medianGPA}</span>
            <span>Median MCAT: {school.medianMCAT}</span>
          </div>
          {fit.missionAlignment.length > 0 && (
            <div className="flex gap-1 mt-2">
              {fit.missionAlignment.map((keyword) => (
                <span
                  key={keyword}
                  className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right ml-4">
          <span className={`text-xs px-2 py-1 rounded ${colors.badge} capitalize`}>
            {category}
          </span>
          {/* Two-stage probability display */}
          {hasNativeProbs ? (
            <div className="mt-2">
              {/* Two-stage visualization */}
              <div className="flex items-center gap-1 justify-end text-sm">
                <span className="text-purple-600 font-semibold">{interviewPercent}%</span>
                <span className="text-slate-400">×</span>
                <span className="text-blue-600 font-semibold">{condAcceptPercent}%</span>
                <span className="text-slate-400">=</span>
                <span className="text-green-600 font-bold text-lg">{acceptancePercent}%</span>
              </div>
              <div className="flex items-center gap-1 justify-end text-xs text-slate-500 mt-0.5">
                <span>P(Int)</span>
                <span className="text-slate-300">×</span>
                <span>P(Acc|Int)</span>
                <span className="text-slate-300">=</span>
                <span>P(Acc)</span>
              </div>
              {/* Confidence intervals if available */}
              {pAcceptCI && (
                <p className="text-xs text-slate-400 mt-1">
                  80% CI: {Math.round(pAcceptCI[0] * 100)}% - {Math.round(pAcceptCI[1] * 100)}%
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Legacy display */}
              <div className="flex gap-3 mt-2 justify-end">
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-600">{interviewPercent}%</p>
                  <p className="text-xs text-slate-500">interview</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">{acceptancePercent}%</p>
                  <p className="text-xs text-slate-500">acceptance</p>
                </div>
              </div>
              {school.interviewToAcceptanceRate && (
                <p className="text-xs text-slate-400 mt-1">
                  {Math.round(school.interviewToAcceptanceRate * 100)}% int→acc rate
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Your fit</span>
          <span>
            GPA: {fit.gpaPercentile}th • MCAT: {fit.mcatPercentile}th percentile
          </span>
        </div>
        <div className="flex gap-2">
          <Progress value={fit.gpaPercentile} className="h-1.5 flex-1" />
          <Progress value={fit.mcatPercentile} className="h-1.5 flex-1" />
        </div>
      </div>
    </div>
  )
}
