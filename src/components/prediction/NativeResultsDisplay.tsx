'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CompetitivenessGauge } from './CompetitivenessGauge'
import { ExperienceSaturation, ExperienceCompact } from './ExperienceSaturation'
import { DemographicEffects, DemographicCompact } from './DemographicEffects'
import { UncertaintyBreakdown, UncertaintyBadge } from './UncertaintyBreakdown'
import { TwoStageProbability } from './TwoStageProbability'
import type { NativePredictionResponse } from '@/lib/model'

interface NativeResultsDisplayProps {
  prediction: NativePredictionResponse
}

/**
 * Results display component for native v2.0 prediction format.
 * Shows all new model features: competitiveness, two-stage probabilities,
 * experience saturation, demographic effects, and uncertainty analysis.
 */
export function NativeResultsDisplay({ prediction }: NativeResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')

  const {
    competitiveness,
    experience,
    demographics,
    schools,
    listMetrics,
    uncertainty,
    simulation,
  } = prediction

  // Categorize schools
  const reachSchools = schools.filter((s) => s.category === 'reach')
  const targetSchools = schools.filter((s) => s.category === 'target')
  const likelySchools = schools.filter((s) => s.category === 'likely')
  const safetySchools = schools.filter((s) => s.category === 'safety')

  return (
    <div className="space-y-6">
      {/* Top-level Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Competitiveness Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Competitiveness</p>
                <p className="text-3xl font-bold">
                  C = {competitiveness.C >= 0 ? '+' : ''}{competitiveness.C.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-blue-600">
                  {competitiveness.percentile}th
                </p>
                <p className="text-xs text-slate-500">percentile</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">GPA:</span>
              <span className="font-medium text-blue-600">
                {competitiveness.breakdown.gpaContribution >= 0 ? '+' : ''}
                {competitiveness.breakdown.gpaContribution.toFixed(2)}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">MCAT:</span>
              <span className="font-medium text-purple-600">
                {competitiveness.breakdown.mcatContribution >= 0 ? '+' : ''}
                {competitiveness.breakdown.mcatContribution.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* List Metrics Card */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-500">P(At Least One)</p>
                <p className="text-3xl font-bold text-green-600">
                  {(listMetrics.pAtLeastOne.mean * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-slate-400">
                  {(listMetrics.pAtLeastOne.ci80[0] * 100).toFixed(0)}% - {(listMetrics.pAtLeastOne.ci80[1] * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Expected Interviews</p>
                <p className="text-3xl font-bold text-purple-600">
                  {listMetrics.expectedInterviews.mean.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">
                  {listMetrics.expectedInterviews.ci80[0].toFixed(1)} - {listMetrics.expectedInterviews.ci80[1].toFixed(1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Expected Acceptances</p>
                <p className="text-3xl font-bold text-blue-600">
                  {listMetrics.expectedAcceptances.mean.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">
                  {listMetrics.expectedAcceptances.ci80[0].toFixed(1)} - {listMetrics.expectedAcceptances.ci80[1].toFixed(1)}
                </p>
              </div>
            </div>

            {/* Probability distribution buckets */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-xs">
                <div className="text-center">
                  <p className="text-slate-500">0 accepts</p>
                  <p className="font-medium text-red-600">
                    {(listMetrics.distributionBuckets.zero * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">1 accept</p>
                  <p className="font-medium text-orange-600">
                    {(listMetrics.distributionBuckets.one * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">2-3 accepts</p>
                  <p className="font-medium text-yellow-600">
                    {(listMetrics.distributionBuckets.twoThree * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-500">4+ accepts</p>
                  <p className="font-medium text-green-600">
                    {(listMetrics.distributionBuckets.fourPlus * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <ExperienceCompact experience={experience} />
        </Card>
        <Card className="p-4">
          <DemographicCompact demographics={demographics} />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Uncertainty</span>
            <UncertaintyBadge level={uncertainty.overallLevel} />
          </div>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="competitiveness">Competitiveness</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="uncertainty">Uncertainty</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompetitivenessGauge competitiveness={competitiveness} />
            <ExperienceSaturation experience={experience} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DemographicEffects demographics={demographics} />
            <UncertaintyBreakdown uncertainty={uncertainty} />
          </div>
        </TabsContent>

        {/* Competitiveness Tab */}
        <TabsContent value="competitiveness" className="mt-6">
          <CompetitivenessGauge competitiveness={competitiveness} />
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Understanding Your C Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                The Competitiveness Score (C) measures your academic profile against the
                medical school applicant pool. It combines GPA and MCAT into a single
                metric calibrated against AAMC admission data.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>C = 0</strong> corresponds to the anchor point: 3.75 GPA and 512 MCAT
                </li>
                <li>
                  <strong>Positive C</strong> means above-average competitiveness
                </li>
                <li>
                  <strong>Negative C</strong> means below-average competitiveness
                </li>
                <li>
                  Each +1.0 in C roughly doubles your odds of admission
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experience Tab */}
        <TabsContent value="experience" className="mt-6">
          <ExperienceSaturation experience={experience} />
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Diminishing Returns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                Experience contributions follow a saturation curve. Each additional hour
                provides less benefit than the previous one. This reflects how admissions
                committees value quality over pure quantity.
              </p>
              <p>
                When a domain shows 90%+ saturation, additional hours in that area
                provide minimal benefit. Consider diversifying your experiences instead.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schools Tab */}
        <TabsContent value="schools" className="mt-6 space-y-6">
          {/* School count summary */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{reachSchools.length}</p>
              <p className="text-sm text-slate-500">Reach</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{targetSchools.length}</p>
              <p className="text-sm text-slate-500">Target</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{likelySchools.length}</p>
              <p className="text-sm text-slate-500">Likely</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{safetySchools.length}</p>
              <p className="text-sm text-slate-500">Safety</p>
            </Card>
          </div>

          {/* School list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schools.map((school) => (
              <TwoStageProbability key={school.id} school={school} />
            ))}
          </div>
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monte Carlo Simulation</CardTitle>
              <CardDescription>
                {simulation.iterations.toLocaleString()} simulated application cycles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Correlation diagnostics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {(simulation.correlationDiagnostics.meanPairwiseCorrelation * 100).toFixed(0)}%
                  </p>
                  <p className="text-sm text-slate-500">Mean Pairwise Correlation</p>
                  <p className="text-xs text-slate-400 mt-1">
                    How correlated your outcomes are across schools
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {simulation.correlationDiagnostics.acceptanceVariance.toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-500">Acceptance Variance</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Spread in number of acceptances
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Why outcomes are correlated:</strong> Unmeasured factors like
                  essay quality and interview performance affect all your applications
                  similarly. This creates &quot;all-or-nothing&quot; patterns where strong applicants
                  tend to get multiple acceptances while others may get none.
                </p>
              </div>

              {/* Per-school simulation rates */}
              {simulation.perSchool.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    Simulated Rates by School
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {simulation.perSchool.map((s) => {
                      const school = schools.find((sch) => sch.id === s.schoolId)
                      return (
                        <div
                          key={s.schoolId}
                          className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded"
                        >
                          <span className="text-slate-700 truncate flex-1">
                            {school?.name || s.schoolId}
                          </span>
                          <div className="flex gap-4 text-xs">
                            <span className="text-purple-600">
                              Int: {(s.interviewRate * 100).toFixed(0)}%
                            </span>
                            <span className="text-green-600">
                              Acc: {(s.acceptanceRate * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Uncertainty Tab */}
        <TabsContent value="uncertainty" className="mt-6">
          <UncertaintyBreakdown uncertainty={uncertainty} />
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Sources of Uncertainty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="font-medium text-slate-700">Parameter Uncertainty</p>
                <p>
                  Comes from limited calibration data and model estimation. Even with
                  perfect information about you, we can&apos;t know exact school parameters.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Random Effect Uncertainty</p>
                <p>
                  Comes from applicant-level variation in essays, letters of recommendation,
                  interview performance, and other holistic factors we can&apos;t measure.
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-yellow-800">
                  <strong>Note:</strong> Wider confidence intervals mean less certainty.
                  Focus on the overall trend rather than precise numbers.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
