'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

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

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const scorePercentage = (score.totalScore / 1000) * 100

  return (
    <div className="space-y-6">
      {/* Score Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main Score Card */}
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

        {/* WARS Score Card */}
        {score.warsScore !== undefined && score.warsLevel && (
          <Card>
            <CardHeader className="text-center pb-2">
              <CardDescription>WARS Level</CardDescription>
              <CardTitle className="text-6xl font-bold">{score.warsLevel}</CardTitle>
              <p className="text-slate-500">
                {score.warsScore} / 121 points
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(score.warsScore / 121) * 100} className="h-3" />
              <div
                className={`p-4 rounded-lg border text-center ${
                  warsLevelColors[score.warsLevel]
                }`}
              >
                <p className="font-semibold">Level {score.warsLevel}</p>
                <p className="text-sm mt-1">{warsLevelDescriptions[score.warsLevel]}</p>
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
            <CardDescription>{score.academicScore} / 600 points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>GPA</span>
                <span>{score.academicDetails.gpaContribution} / 300</span>
              </div>
              <Progress
                value={(score.academicDetails.gpaContribution / 300) * 100}
                className="h-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                {score.academicDetails.gpaPercentile}th percentile
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>MCAT</span>
                <span>{score.academicDetails.mcatContribution} / 300</span>
              </div>
              <Progress
                value={(score.academicDetails.mcatContribution / 300) * 100}
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
            <CardDescription>{score.experienceScore} / 250 points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreBar
              label="Clinical"
              value={score.experienceDetails.clinicalContribution}
              max={75}
            />
            <ScoreBar
              label="Research"
              value={score.experienceDetails.researchContribution}
              max={75}
            />
            <ScoreBar
              label="Volunteering"
              value={score.experienceDetails.volunteerContribution}
              max={50}
            />
            <ScoreBar
              label="Leadership"
              value={score.experienceDetails.leadershipContribution}
              max={30}
            />
            <ScoreBar
              label="Shadowing"
              value={score.experienceDetails.shadowingContribution}
              max={20}
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
