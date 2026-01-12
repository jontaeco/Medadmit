'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sankey,
  Tooltip,
  Rectangle,
  Layer,
  ResponsiveContainer,
} from 'recharts'
import type { PerSchoolOutcome, ModalOutcome, LegacySchoolProbability as SchoolProbability } from '@/lib/model'

interface ApplicantProfile {
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

interface SankeyDiagramProps {
  schoolList: {
    reach: SchoolProbability[]
    target: SchoolProbability[]
    safety: SchoolProbability[]
  }
  modalOutcome: ModalOutcome
  optimisticOutcome?: ModalOutcome
  pessimisticOutcome?: ModalOutcome
  perSchoolOutcomes: PerSchoolOutcome[]
  applicantProfile: ApplicantProfile
}

// Custom node component for the Sankey
function SankeyNode({ x, y, width, height, payload, containerWidth }: any) {
  const isSchool = payload.depth === 0
  const isMiddle = payload.depth === 1
  const isAcceptedSchool = payload.isAcceptedSchool === true
  const isRejectedSchool = payload.isRejectedSchool === true
  const isRightSideSchool = isAcceptedSchool || isRejectedSchool

  // Color based on node type
  let fill = '#64748b' // Default gray
  if (isSchool && !isRightSideSchool) {
    // Left side schools - color by category
    if (payload.schoolCategory === 'reach') fill = '#8b5cf6' // Purple
    else if (payload.schoolCategory === 'target') fill = '#3b82f6' // Blue
    else if (payload.schoolCategory === 'safety') fill = '#22c55e' // Green
  } else if (isAcceptedSchool) {
    // Right side acceptances - green tinted by category
    if (payload.schoolCategory === 'reach') fill = '#8b5cf6' // Purple
    else if (payload.schoolCategory === 'target') fill = '#3b82f6' // Blue
    else if (payload.schoolCategory === 'safety') fill = '#22c55e' // Green
  } else if (isRejectedSchool) {
    // Right side rejections - red
    fill = '#ef4444'
  } else if (isMiddle) {
    if (payload.name === 'Interviews') fill = '#f59e0b' // Amber
    else fill = '#ef4444' // Red for rejections
  }

  const truncateName = (name: string, maxLen: number) =>
    name.length > maxLen ? name.slice(0, maxLen) + '...' : name

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.9}
      />
      {/* Labels for LEFT side schools - positioned left of node */}
      {isSchool && !isRightSideSchool && (
        <text
          x={x - 5}
          y={y + height / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#374151"
          fontSize={9}
        >
          {truncateName(payload.name, 18)}
        </text>
      )}
      {/* Labels for RIGHT side schools (acceptances & rejections) - positioned right of node */}
      {isRightSideSchool && (
        <text
          x={x + width + 5}
          y={y + height / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fill={isRejectedSchool ? '#dc2626' : '#374151'}
          fontSize={9}
        >
          {truncateName(payload.name, 18)}
        </text>
      )}
      {/* Labels for middle nodes - inside the node */}
      {isMiddle && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={12}
          fontWeight="bold"
        >
          {payload.name}
        </text>
      )}
    </Layer>
  )
}

// Helper function to generate Sankey data for any outcome
function generateSankeyData(
  schoolList: { reach: SchoolProbability[]; target: SchoolProbability[]; safety: SchoolProbability[] },
  outcome: ModalOutcome
) {
  const nodes: { name: string; depth?: number; schoolCategory?: string; isAcceptedSchool?: boolean; isRejectedSchool?: boolean }[] = []
  const links: { source: number; target: number; value: number }[] = []

  // Combine all schools and track their categories, sorted by tier
  const allSchools = [
    ...schoolList.reach.map((s) => ({ ...s, category: 'reach' as const })),
    ...schoolList.target.map((s) => ({ ...s, category: 'target' as const })),
    ...schoolList.safety.map((s) => ({ ...s, category: 'safety' as const })),
  ].sort((a, b) => {
    const tierDiff = (a.school.warsTier ?? 99) - (b.school.warsTier ?? 99)
    if (tierDiff !== 0) return tierDiff
    return b.probability - a.probability
  })

  // Create school nodes (LEFT side - depth 0)
  allSchools.forEach((school) => {
    nodes.push({
      name: school.school.shortName || school.school.name,
      depth: 0,
      schoolCategory: school.category,
    })
  })

  // Create middle stage nodes (depth 1)
  const interviewNodeIndex = nodes.length
  nodes.push({ name: 'Interviews', depth: 1 })
  const rejectedPreIINodeIndex = nodes.length
  nodes.push({ name: 'Rejected (Pre-II)', depth: 1 })

  // Create INDIVIDUAL school nodes for acceptances (RIGHT side - depth 2)
  const acceptedSchoolNodeIndices: Map<string, number> = new Map()

  outcome.schoolsWithAcceptance.forEach((schoolId) => {
    const school = allSchools.find((s) => s.school.id === schoolId)
    if (school) {
      const nodeIdx = nodes.length
      nodes.push({
        name: school.school.shortName || school.school.name,
        depth: 2,
        schoolCategory: school.category,
        isAcceptedSchool: true,
      })
      acceptedSchoolNodeIndices.set(schoolId, nodeIdx)
    }
  })

  // Create INDIVIDUAL school nodes for post-II rejections (RIGHT side - depth 2)
  const rejectedPostIISchoolIds = outcome.schoolsWithInterview.filter(
    (id) => !outcome.schoolsWithAcceptance.includes(id)
  )
  const rejectedPostIINodeIndices: Map<string, number> = new Map()

  rejectedPostIISchoolIds.forEach((schoolId) => {
    const school = allSchools.find((s) => s.school.id === schoolId)
    if (school) {
      const nodeIdx = nodes.length
      nodes.push({
        name: school.school.shortName || school.school.name,
        depth: 2,
        schoolCategory: school.category,
        isRejectedSchool: true,
      })
      rejectedPostIINodeIndices.set(schoolId, nodeIdx)
    }
  })

  // Build links: Schools -> Interview/Rejection stage
  allSchools.forEach((school, idx) => {
    const gotInterview = outcome.schoolsWithInterview.includes(school.school.id)
    if (gotInterview) {
      links.push({ source: idx, target: interviewNodeIndex, value: 1 })
    } else {
      links.push({ source: idx, target: rejectedPreIINodeIndex, value: 1 })
    }
  })

  // Build links: Interviews -> Individual Acceptances
  outcome.schoolsWithAcceptance.forEach((schoolId) => {
    const targetIdx = acceptedSchoolNodeIndices.get(schoolId)
    if (targetIdx !== undefined) {
      links.push({ source: interviewNodeIndex, target: targetIdx, value: 1 })
    }
  })

  // Build links: Interviews -> Individual Post-II Rejections
  rejectedPostIISchoolIds.forEach((schoolId) => {
    const targetIdx = rejectedPostIINodeIndices.get(schoolId)
    if (targetIdx !== undefined) {
      links.push({ source: interviewNodeIndex, target: targetIdx, value: 1 })
    }
  })

  return { nodes, links }
}

export function SankeyDiagram({
  schoolList,
  modalOutcome,
  optimisticOutcome,
  pessimisticOutcome,
  perSchoolOutcomes,
  applicantProfile,
}: SankeyDiagramProps) {
  const [scenario, setScenario] = useState<'modal' | 'optimistic' | 'pessimistic'>('modal')

  // Select the current outcome based on scenario
  const currentOutcome = scenario === 'optimistic' && optimisticOutcome
    ? optimisticOutcome
    : scenario === 'pessimistic' && pessimisticOutcome
    ? pessimisticOutcome
    : modalOutcome

  const sankeyData = useMemo(
    () => generateSankeyData(schoolList, currentOutcome),
    [schoolList, currentOutcome]
  )

  // Calculate totals for display
  const totalSchools =
    schoolList.reach.length + schoolList.target.length + schoolList.safety.length

  return (
    <div className="space-y-4">
      {/* Scenario Selector */}
      {(optimisticOutcome || pessimisticOutcome) && (
        <div className="flex gap-2">
          <button
            onClick={() => setScenario('pessimistic')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              scenario === 'pessimistic'
                ? 'bg-red-100 text-red-700 border border-red-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Pessimistic ({pessimisticOutcome?.totalAcceptances || 0} acceptances)
          </button>
          <button
            onClick={() => setScenario('modal')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              scenario === 'modal'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Most Likely ({modalOutcome.totalAcceptances} acceptances)
          </button>
          <button
            onClick={() => setScenario('optimistic')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              scenario === 'optimistic'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Optimistic ({optimisticOutcome?.totalAcceptances || 0} acceptances)
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Sankey Diagram */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Cycle Visualization</CardTitle>
            <CardDescription>
              {scenario === 'modal' && `Most likely outcome (${(modalOutcome.frequency * 100).toFixed(1)}% of simulations)`}
              {scenario === 'optimistic' && `Best-case scenario (${((optimisticOutcome?.frequency ?? 0) * 100).toFixed(1)}% of simulations)`}
              {scenario === 'pessimistic' && `Worst-case scenario (${((pessimisticOutcome?.frequency ?? 0) * 100).toFixed(1)}% of simulations)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={sankeyData}
                  node={(props: any) => (
                    <SankeyNode {...props} containerWidth={800} />
                  )}
                  link={{ stroke: '#94a3b8', strokeOpacity: 0.5 }}
                  nodePadding={8}
                  nodeWidth={10}
                  margin={{ top: 20, right: 200, bottom: 20, left: 200 }}
                >
                  <Tooltip
                    content={({ payload }: any) => {
                      if (!payload || !payload[0]) return null
                      const data = payload[0].payload
                      return (
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border">
                          <p className="font-medium">{data.name}</p>
                          {data.schoolCategory && (
                            <p className="text-sm text-slate-500 capitalize">
                              {data.schoolCategory} school
                            </p>
                          )}
                        </div>
                      )
                    }}
                  />
                </Sankey>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-700">{totalSchools}</p>
                <p className="text-sm text-slate-500">Schools Applied</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">{currentOutcome.totalInterviews}</p>
                <p className="text-sm text-slate-500">Interviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{currentOutcome.totalAcceptances}</p>
                <p className="text-sm text-slate-500">Acceptances</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span>Reach ({schoolList.reach.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Target ({schoolList.target.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Safety ({schoolList.safety.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Interviews</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>Rejections</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Applicant Profile</CardTitle>
            <CardDescription>Summary of your application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Academics</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>GPA</span>
                  <span className="font-medium">{applicantProfile.gpa.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>MCAT</span>
                  <span className="font-medium">{applicantProfile.mcat}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Experiences (Hours)</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Clinical</span>
                  <span className="font-medium">{applicantProfile.clinicalHours.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Research</span>
                  <span className="font-medium">{applicantProfile.researchHours.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Volunteer</span>
                  <span className="font-medium">{applicantProfile.volunteerHours.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shadowing</span>
                  <span className="font-medium">{applicantProfile.shadowingHours}</span>
                </div>
                <div className="flex justify-between">
                  <span>Teaching</span>
                  <span className="font-medium">{applicantProfile.teachingHours}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Demographics</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>State</span>
                  <span className="font-medium">{applicantProfile.state}</span>
                </div>
                {applicantProfile.raceEthnicity && (
                  <div className="flex justify-between">
                    <span>Race/Ethnicity</span>
                    <span className="font-medium text-right">{applicantProfile.raceEthnicity}</span>
                  </div>
                )}
                {applicantProfile.isFirstGen && (
                  <div className="text-blue-600">First Generation</div>
                )}
                {applicantProfile.isDisadvantaged && (
                  <div className="text-blue-600">Disadvantaged Background</div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Outcome</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Interviews</span>
                  <span className="font-medium text-amber-600">{currentOutcome.totalInterviews}</span>
                </div>
                <div className="flex justify-between">
                  <span>Acceptances</span>
                  <span className="font-medium text-green-600">{currentOutcome.totalAcceptances}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
