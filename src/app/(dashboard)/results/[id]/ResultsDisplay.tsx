'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScoreDisplay } from '@/components/prediction/ScoreDisplay'
import { SchoolList } from '@/components/prediction/SchoolList'
import { SimulationResults } from '@/components/prediction/SimulationResults'
import { SankeyDiagram } from '@/components/prediction/SankeyDiagram'
import type { PerSchoolOutcome, ModalOutcome, SchoolProbability } from '@/lib/scoring/types'

interface ResultsDisplayProps {
  score: {
    academicScore: number
    academicDetails: {
      gpaContribution: number
      mcatContribution: number
      gpaPercentile: number
      mcatPercentile: number
    }
    experienceScore: number
    experienceDetails: {
      clinicalContribution: number
      researchContribution: number
      volunteerContribution: number
      leadershipContribution: number
      shadowingContribution: number
      teachingContribution?: number
    }
    demographicAdjustment: number
    redFlagPenalty: number
    totalScore: number
    percentile: number
    tier: 'exceptional' | 'strong' | 'competitive' | 'below-average' | 'low'
  }
  schoolList: {
    reach: any[]
    target: any[]
    safety: any[]
    summary: {
      totalSchools: number
      expectedInterviews: number
      expectedAcceptances: number
      probabilityOfAtLeastOne: number
    }
  }
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
    perSchoolOutcomes?: PerSchoolOutcome[]
    modalOutcome?: ModalOutcome
  }
  globalProbability: number
  confidenceRange: {
    lower: number
    upper: number
  }
  applicantProfile?: {
    gpa: number
    mcat: number
    clinicalHours: number
    researchHours: number
    volunteerHours: number
    shadowingHours: number
    teachingHours: number
    raceEthnicity?: string | null
    state: string
    isFirstGen: boolean
    isDisadvantaged: boolean
  }
}

export function ResultsDisplay({
  score,
  schoolList,
  simulation,
  globalProbability,
  confidenceRange,
  applicantProfile,
}: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')

  // Check if Sankey data is available
  const hasSankeyData = simulation.perSchoolOutcomes && simulation.modalOutcome && applicantProfile

  return (
    <div className="space-y-6">
      {/* Top-level Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-500">Your Score</p>
              <p className="text-5xl font-bold">{score.totalScore}</p>
              <p className="text-slate-500">/ 1000</p>
              <div className="mt-4">
                <TierBadge tier={score.tier} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500">Acceptance Probability</p>
                <p className="text-3xl font-bold text-blue-600">
                  {(globalProbability * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-slate-400">
                  Range: {(confidenceRange.lower * 100).toFixed(0)}% -{' '}
                  {(confidenceRange.upper * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Expected Interviews</p>
                <p className="text-3xl font-bold text-purple-600">
                  {simulation.expectedInterviews.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">Based on school list</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Expected Acceptances</p>
                <p className="text-3xl font-bold text-green-600">
                  {simulation.expectedAcceptances.toFixed(1)}
                </p>
                <p className="text-xs text-slate-400">Based on school list</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex justify-between text-sm text-slate-500 mb-2">
                <span>Overall Probability</span>
                <span>{(globalProbability * 100).toFixed(1)}%</span>
              </div>
              <Progress value={globalProbability * 100} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${hasSankeyData ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="overview">Score Breakdown</TabsTrigger>
          <TabsTrigger value="schools">School List</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          {hasSankeyData && (
            <TabsTrigger value="visualization">Cycle Visualization</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <ScoreDisplay score={score} />
        </TabsContent>

        <TabsContent value="schools" className="mt-6">
          <SchoolList
            reach={schoolList.reach}
            target={schoolList.target}
            safety={schoolList.safety}
            summary={schoolList.summary}
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <SimulationResults simulation={simulation} />
        </TabsContent>

        {hasSankeyData && (
          <TabsContent value="visualization" className="mt-6">
            <SankeyDiagram
              schoolList={schoolList}
              modalOutcome={simulation.modalOutcome!}
              perSchoolOutcomes={simulation.perSchoolOutcomes!}
              applicantProfile={applicantProfile!}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const tierConfig: Record<string, { label: string; colors: string }> = {
    exceptional: { label: 'Exceptional', colors: 'bg-green-100 text-green-700 border-green-200' },
    strong: { label: 'Strong', colors: 'bg-blue-100 text-blue-700 border-blue-200' },
    competitive: { label: 'Competitive', colors: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    'below-average': { label: 'Below Average', colors: 'bg-orange-100 text-orange-700 border-orange-200' },
    low: { label: 'Needs Improvement', colors: 'bg-red-100 text-red-700 border-red-200' },
  }

  const config = tierConfig[tier] || tierConfig.competitive

  return (
    <span className={`inline-block px-4 py-2 rounded-full border text-sm font-medium ${config.colors}`}>
      {config.label}
    </span>
  )
}
