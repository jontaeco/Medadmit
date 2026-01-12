'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface SimulationResultsProps {
  simulation: {
    expectedInterviews: number
    expectedAcceptances: number
    probabilityOfAtLeastOneAcceptance: number
    interviewDistribution: { count: number; probability: number }[]
    acceptanceDistribution: { count: number; probability: number }[]
    probabilityBuckets: {
      noAcceptances: number
      oneAcceptance: number
      twoToThree: number
      fourOrMore: number
    }
    // New v2.0 correlation diagnostics
    correlationDiagnostics?: {
      meanPairwiseCorrelation: number
      acceptanceVariance: number
      randomEffectSD?: number
    }
    iterations?: number
    confidenceIntervals?: {
      expectedInterviews: [number, number]
      expectedAcceptances: [number, number]
      pAtLeastOne: [number, number]
    }
  }
}

export function SimulationResults({ simulation }: SimulationResultsProps) {
  // Handle both array format (new) and object format (old)
  const interviewChartData = Array.isArray(simulation.interviewDistribution)
    ? simulation.interviewDistribution.map((d) => ({
        name: d.count.toString(),
        probability: Math.round(d.probability * 100),
      }))
    : []

  const acceptanceChartData = Array.isArray(simulation.acceptanceDistribution)
    ? simulation.acceptanceDistribution.map((d) => ({
        name: d.count.toString(),
        probability: Math.round(d.probability * 100),
      }))
    : []

  // Dynamic bucket generation from acceptanceDistribution
  const bucketData = useMemo(() => {
    const dist = simulation.acceptanceDistribution || []

    // Fixed single buckets
    const bucket0 = dist.find((d) => d.count === 0)?.probability ?? 0
    const bucket1 = dist.find((d) => d.count === 1)?.probability ?? 0

    // Sum ranges for 2-count buckets
    const bucket2_3 = dist
      .filter((d) => d.count >= 2 && d.count <= 3)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket4_5 = dist
      .filter((d) => d.count >= 4 && d.count <= 5)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket6_7 = dist
      .filter((d) => d.count >= 6 && d.count <= 7)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket8_9 = dist
      .filter((d) => d.count >= 8 && d.count <= 9)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket10_11 = dist
      .filter((d) => d.count >= 10 && d.count <= 11)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket12_13 = dist
      .filter((d) => d.count >= 12 && d.count <= 13)
      .reduce((sum, d) => sum + d.probability, 0)
    const bucket14Plus = dist
      .filter((d) => d.count >= 14)
      .reduce((sum, d) => sum + d.probability, 0)

    // Build data array
    const allBuckets = [
      { name: '0', probability: Math.round(bucket0 * 100), fill: '#ef4444' },
      { name: '1', probability: Math.round(bucket1 * 100), fill: '#f59e0b' },
      { name: '2-3', probability: Math.round(bucket2_3 * 100), fill: '#22c55e' },
      { name: '4-5', probability: Math.round(bucket4_5 * 100), fill: '#3b82f6' },
      { name: '6-7', probability: Math.round(bucket6_7 * 100), fill: '#3b82f6' },
      { name: '8-9', probability: Math.round(bucket8_9 * 100), fill: '#3b82f6' },
      { name: '10-11', probability: Math.round(bucket10_11 * 100), fill: '#3b82f6' },
      { name: '12-13', probability: Math.round(bucket12_13 * 100), fill: '#3b82f6' },
      { name: '14+', probability: Math.round(bucket14Plus * 100), fill: '#3b82f6' },
    ]

    // Trim trailing zero buckets (but keep at least through 4-5)
    let lastNonZeroIdx = 3 // Always show through 4-5
    for (let i = allBuckets.length - 1; i > 3; i--) {
      if (allBuckets[i].probability > 0) {
        lastNonZeroIdx = i
        break
      }
    }

    return allBuckets.slice(0, lastNonZeroIdx + 1)
  }, [simulation.acceptanceDistribution])

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-blue-600">
              {(simulation.probabilityOfAtLeastOneAcceptance * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Probability of at least one acceptance
            </p>
            {simulation.confidenceIntervals?.pAtLeastOne && (
              <p className="text-xs text-slate-400 mt-0.5">
                80% CI: {(simulation.confidenceIntervals.pAtLeastOne[0] * 100).toFixed(0)}% - {(simulation.confidenceIntervals.pAtLeastOne[1] * 100).toFixed(0)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-purple-600">
              {simulation.expectedInterviews.toFixed(1)}
            </p>
            <p className="text-sm text-slate-500 mt-1">Expected interviews</p>
            {simulation.confidenceIntervals?.expectedInterviews && (
              <p className="text-xs text-slate-400 mt-0.5">
                80% CI: {simulation.confidenceIntervals.expectedInterviews[0].toFixed(1)} - {simulation.confidenceIntervals.expectedInterviews[1].toFixed(1)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-bold text-green-600">
              {simulation.expectedAcceptances.toFixed(1)}
            </p>
            <p className="text-sm text-slate-500 mt-1">Expected acceptances</p>
            {simulation.confidenceIntervals?.expectedAcceptances && (
              <p className="text-xs text-slate-400 mt-0.5">
                80% CI: {simulation.confidenceIntervals.expectedAcceptances[0].toFixed(1)} - {simulation.confidenceIntervals.expectedAcceptances[1].toFixed(1)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Correlation Diagnostics (v2.0 feature) */}
      {simulation.correlationDiagnostics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correlation Analysis</CardTitle>
            <CardDescription>
              How correlated your outcomes are across schools
              {simulation.iterations && ` (${simulation.iterations.toLocaleString()} simulations)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {(simulation.correlationDiagnostics.meanPairwiseCorrelation * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-slate-600">Mean Pairwise Correlation</p>
                <p className="text-xs text-slate-400 mt-1">
                  How linked your outcomes are across schools
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {simulation.correlationDiagnostics.acceptanceVariance.toFixed(2)}
                </p>
                <p className="text-sm text-slate-600">Acceptance Variance</p>
                <p className="text-xs text-slate-400 mt-1">
                  Spread in number of acceptances
                </p>
              </div>
              {simulation.correlationDiagnostics.randomEffectSD !== undefined && (
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-700">
                    {simulation.correlationDiagnostics.randomEffectSD.toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-600">Random Effect SD</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Applicant-level variation (σ_u)
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Why outcomes are correlated:</strong> Unmeasured factors like
                essay quality and interview performance affect all your applications
                similarly. This creates &quot;all-or-nothing&quot; patterns where strong applicants
                tend to get multiple acceptances while others may get none.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acceptance Outcome Buckets */}
      <Card>
        <CardHeader>
          <CardTitle>Acceptance Outcomes</CardTitle>
          <CardDescription>
            Probability distribution of total acceptances based on 10,000 simulated cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: 'Acceptances', position: 'bottom', offset: -5 }} />
                <YAxis label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Probability']}
                  labelFormatter={(label) => `${label} acceptance${label === '1' ? '' : 's'}`}
                />
                <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                  {bucketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>0</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>1</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>2-3</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>4+</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Interview Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview Distribution</CardTitle>
            <CardDescription>
              Probability of receiving each number of interviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {interviewChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interviewChartData.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Probability']}
                      labelFormatter={(label) => `${label} interviews`}
                    />
                    <Bar dataKey="probability" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Distribution data not available for this prediction
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Acceptance Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acceptance Distribution</CardTitle>
            <CardDescription>
              Probability of receiving each number of acceptances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {acceptanceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={acceptanceChartData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Probability']}
                      labelFormatter={(label) => `${label} acceptances`}
                    />
                    <Bar dataKey="probability" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  Distribution data not available for this prediction
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Understanding Your Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            These results are based on <strong>Monte Carlo simulation</strong> - running 10,000
            simulated application cycles using your profile data and school-specific acceptance rates.
          </p>
          <p>
            The simulation accounts for the two-stage nature of medical school admissions:
            first receiving an interview invitation, then receiving an acceptance decision after
            the interview.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="font-medium text-slate-800">Key Takeaways:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              {simulation.probabilityOfAtLeastOneAcceptance >= 0.9 && (
                <li className="text-green-700">
                  Excellent odds! You have a very strong chance of receiving at least one acceptance.
                </li>
              )}
              {simulation.probabilityOfAtLeastOneAcceptance >= 0.7 &&
                simulation.probabilityOfAtLeastOneAcceptance < 0.9 && (
                  <li className="text-blue-700">
                    Good odds. Your school list gives you a solid chance of acceptance.
                  </li>
                )}
              {simulation.probabilityOfAtLeastOneAcceptance >= 0.5 &&
                simulation.probabilityOfAtLeastOneAcceptance < 0.7 && (
                  <li className="text-amber-700">
                    Moderate odds. Consider adding more target or safety schools.
                  </li>
                )}
              {simulation.probabilityOfAtLeastOneAcceptance < 0.5 && (
                <li className="text-red-700">
                  Lower odds. Strongly consider expanding your school list with more realistic targets.
                </li>
              )}
              {simulation.expectedAcceptances >= 2 && (
                <li>
                  You may have choices! Expected {simulation.expectedAcceptances.toFixed(1)} acceptances
                  means you&apos;ll likely be able to compare offers.
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
