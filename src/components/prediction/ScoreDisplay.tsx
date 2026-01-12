'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

/**
 * @deprecated This component uses the legacy 0-1000 scoring system.
 * For the v2.0 model, use CompetitivenessGauge instead which displays
 * the Competitiveness Score (C) on a -3 to +3 scale calibrated against
 * AAMC admission data.
 *
 * This component is maintained for backward compatibility with legacy
 * prediction format.
 */

// Score maximums - must match applicant-score.ts calculations
const SCORE_MAXIMUMS = {
  total: 1000,
  academic: {
    total: 720,
    gpa: 360,
    mcat: 360,
  },
  experience: {
    total: 330,
    clinical: 90,
    research: 90,
    volunteering: 60,
    leadership: 35,
    shadowing: 25,
    teaching: 30,
  },
  wars: 121,
}

interface ScoreBreakdown {
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
  // WARS scoring (optional)
  warsScore?: number
  warsLevel?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
  warsBreakdown?: {
    stats: number
    research: number
    clinical: number
    shadowing: number
    volunteering: number
    leadership: number
    miscellaneous: number
    undergraduate: number
    urm: number
    trend: number
  }
}

interface ScoreDisplayProps {
  score: ScoreBreakdown
  /** Optional v2.0 competitiveness score - if provided, shows C score alongside legacy score */
  competitiveness?: {
    C: number
    percentile: number
  }
}

const tierColors = {
  exceptional: 'text-green-600 bg-green-50 border-green-200',
  strong: 'text-blue-600 bg-blue-50 border-blue-200',
  competitive: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  'below-average': 'text-orange-600 bg-orange-50 border-orange-200',
  low: 'text-red-600 bg-red-50 border-red-200',
}

const tierDescriptions = {
  exceptional: 'Exceptionally strong profile - competitive at top schools',
  strong: 'Strong profile - competitive at many medical schools',
  competitive: 'Competitive profile - focus on target schools',
  'below-average': 'Some areas to strengthen - consider strategic school list',
  low: 'Profile may benefit from additional preparation',
}

const warsLevelColors = {
  S: 'text-purple-700 bg-purple-50 border-purple-300',
  A: 'text-blue-700 bg-blue-50 border-blue-300',
  B: 'text-green-700 bg-green-50 border-green-300',
  C: 'text-yellow-700 bg-yellow-50 border-yellow-300',
  D: 'text-orange-700 bg-orange-50 border-orange-300',
  E: 'text-red-700 bg-red-50 border-red-300',
}

const warsLevelDescriptions = {
  S: 'Elite Applicant (85+) - Competitive at TOP and HIGH tier schools',
  A: 'Very Strong Applicant (80-84) - Strong chances at HIGH tier schools',
  B: 'Strong Applicant (75-79) - Competitive at MID tier schools',
  C: 'Competitive Applicant (68-74) - Focus on MID and LOW tier schools',
  D: 'Moderate Applicant (60-67) - Focus on LOW tier schools',
  E: 'Developing Applicant (<60) - Consider strengthening profile',
}

export function ScoreDisplay({ score, competitiveness }: ScoreDisplayProps) {
  const scorePercentage = (score.totalScore / 1000) * 100

  // Determine grid columns based on what scores are available
  const hasWars = score.warsScore !== undefined && score.warsLevel
  const hasCompetitiveness = competitiveness !== undefined
  const cardCount = 1 + (hasWars ? 1 : 0) + (hasCompetitiveness ? 1 : 0)
  const gridCols = cardCount === 1 ? 'md:grid-cols-1' : cardCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'

  return (
    <div className="space-y-6">
      {/* Score Cards Row */}
      <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
        {/* Main Score Card (Legacy) */}
        <Card>
          <CardHeader className="text-center pb-2">
            <CardDescription>Your Applicant Score</CardDescription>
            <CardTitle className="text-6xl font-bold">{score.totalScore}</CardTitle>
            <p className="text-slate-500">out of 1000</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={scorePercentage} className="h-3" />
            <div
              className={`p-4 rounded-lg border text-center ${tierColors[score.tier]}`}
            >
              <p className="font-semibold capitalize">{score.tier.replace('-', ' ')}</p>
              <p className="text-sm mt-1">{tierDescriptions[score.tier]}</p>
            </div>
            <p className="text-center text-slate-600">
              {score.percentile}th percentile among applicants
            </p>
          </CardContent>
        </Card>

        {/* Competitiveness Score Card (v2.0) */}
        {hasCompetitiveness && (
          <Card>
            <CardHeader className="text-center pb-2">
              <CardDescription>Competitiveness Score</CardDescription>
              <CardTitle className="text-6xl font-bold">
                {competitiveness!.C >= 0 ? '+' : ''}{competitiveness!.C.toFixed(2)}
              </CardTitle>
              <p className="text-slate-500">C score (v2.0)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mini gauge */}
              <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-blue-500 rounded-full"
                  style={{
                    left: competitiveness!.C >= 0 ? '50%' : `${50 + (competitiveness!.C / 3) * 50}%`,
                    width: `${Math.abs(competitiveness!.C / 3) * 50}%`,
                  }}
                />
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
              </div>
              <div className="p-4 rounded-lg border text-center bg-blue-50 border-blue-200">
                <p className="font-semibold text-blue-700">
                  {competitiveness!.percentile}th Percentile
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Calibrated against AAMC data
                </p>
              </div>
              <p className="text-center text-xs text-slate-500">
                Each +1.0 in C roughly doubles odds
              </p>
            </CardContent>
          </Card>
        )}

        {/* WARS Score Card */}
        {hasWars && (
          <Card>
            <CardHeader className="text-center pb-2">
              <CardDescription>WARS Level</CardDescription>
              <CardTitle className="text-6xl font-bold">{score.warsLevel}</CardTitle>
              <p className="text-slate-500">
                {score.warsScore} / 121 points
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(score.warsScore! / 121) * 100} className="h-3" />
              <div
                className={`p-4 rounded-lg border text-center ${
                  warsLevelColors[score.warsLevel!]
                }`}
              >
                <p className="font-semibold">Level {score.warsLevel}</p>
                <p className="text-sm mt-1">{warsLevelDescriptions[score.warsLevel!]}</p>
              </div>
              <p className="text-center text-xs text-slate-500">
                WedgeDawg Applicant Rating System
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Academic Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Academic</CardTitle>
            <CardDescription>{score.academicScore} / {SCORE_MAXIMUMS.academic.total} points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>GPA</span>
                <span>{score.academicDetails.gpaContribution} / {SCORE_MAXIMUMS.academic.gpa}</span>
              </div>
              <Progress
                value={(score.academicDetails.gpaContribution / SCORE_MAXIMUMS.academic.gpa) * 100}
                className="h-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                {score.academicDetails.gpaPercentile}th percentile
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>MCAT</span>
                <span>{score.academicDetails.mcatContribution} / {SCORE_MAXIMUMS.academic.mcat}</span>
              </div>
              <Progress
                value={(score.academicDetails.mcatContribution / SCORE_MAXIMUMS.academic.mcat) * 100}
                className="h-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                {score.academicDetails.mcatPercentile}th percentile
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Experience Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Experiences</CardTitle>
            <CardDescription>{score.experienceScore} / {SCORE_MAXIMUMS.experience.total} points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreBar
              label="Clinical"
              value={score.experienceDetails.clinicalContribution}
              max={SCORE_MAXIMUMS.experience.clinical}
            />
            <ScoreBar
              label="Research"
              value={score.experienceDetails.researchContribution}
              max={SCORE_MAXIMUMS.experience.research}
            />
            <ScoreBar
              label="Volunteering"
              value={score.experienceDetails.volunteerContribution}
              max={SCORE_MAXIMUMS.experience.volunteering}
            />
            <ScoreBar
              label="Leadership"
              value={score.experienceDetails.leadershipContribution}
              max={SCORE_MAXIMUMS.experience.leadership}
            />
            <ScoreBar
              label="Shadowing"
              value={score.experienceDetails.shadowingContribution}
              max={SCORE_MAXIMUMS.experience.shadowing}
            />
            <ScoreBar
              label="Teaching"
              value={score.experienceDetails.teachingContribution ?? 0}
              max={SCORE_MAXIMUMS.experience.teaching}
            />
          </CardContent>
        </Card>
      </div>

      {/* Adjustments */}
      {(score.demographicAdjustment !== 0 || score.redFlagPenalty !== 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {score.demographicAdjustment !== 0 && (
              <div className="flex justify-between">
                <span className="text-sm">Demographic Factors</span>
                <span
                  className={`font-medium ${
                    score.demographicAdjustment > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {score.demographicAdjustment > 0 ? '+' : ''}
                  {score.demographicAdjustment}
                </span>
              </div>
            )}
            {score.redFlagPenalty !== 0 && (
              <div className="flex justify-between">
                <span className="text-sm">Application Factors</span>
                <span className="font-medium text-red-600">{score.redFlagPenalty}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ScoreBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
      <Progress value={(value / max) * 100} className="h-1.5" />
    </div>
  )
}
