import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PredictionResult } from '@/types/database'
import { ResultsDisplay } from './ResultsDisplay'

interface ResultPageProps {
  params: Promise<{ id: string }>
}

export default async function ResultPage({ params }: ResultPageProps) {
  const { id } = await params
  const user = await getUser()
  const supabase = await createClient()

  // Fetch prediction
  const { data: prediction } = await supabase
    .from('prediction_results')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: PredictionResult | null }

  if (!prediction) {
    notFound()
  }

  // Parse JSON fields
  const scoreBreakdown = prediction.score_breakdown as any
  const schoolResults = prediction.school_results as any
  const simulationResults = prediction.simulation_results as any

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prediction Results</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Generated {new Date(prediction.computed_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/profiles">
            <Button variant="outline">New Prediction</Button>
          </Link>
          <Link href="/results">
            <Button variant="ghost">Back to Results</Button>
          </Link>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>Model: {prediction.model_version}</span>
            <span>|</span>
            <span>Data: {prediction.data_sources_version}</span>
            {prediction.compute_time_ms && (
              <>
                <span>|</span>
                <span>Computed in {prediction.compute_time_ms}ms</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Display Client Component */}
      <ResultsDisplay
        score={{
          academicScore: scoreBreakdown?.academicScore || 0,
          academicDetails: {
            gpaContribution: scoreBreakdown?.academicDetails?.gpaContribution || 0,
            mcatContribution: scoreBreakdown?.academicDetails?.mcatContribution || 0,
            gpaPercentile: scoreBreakdown?.academicDetails?.gpaPercentile || 0,
            mcatPercentile: scoreBreakdown?.academicDetails?.mcatPercentile || 0,
          },
          experienceScore: scoreBreakdown?.experienceScore || 0,
          experienceDetails: {
            clinicalContribution: scoreBreakdown?.experienceDetails?.clinicalContribution || 0,
            researchContribution: scoreBreakdown?.experienceDetails?.researchContribution || 0,
            volunteerContribution: scoreBreakdown?.experienceDetails?.volunteerContribution || 0,
            leadershipContribution: scoreBreakdown?.experienceDetails?.leadershipContribution || 0,
            shadowingContribution: scoreBreakdown?.experienceDetails?.shadowingContribution || 0,
            teachingContribution: scoreBreakdown?.experienceDetails?.teachingContribution || 0,
          },
          demographicAdjustment: scoreBreakdown?.demographicAdjustment || 0,
          redFlagPenalty: scoreBreakdown?.redFlagPenalty || 0,
          totalScore: scoreBreakdown?.totalScore || prediction.applicant_score || 0,
          percentile: scoreBreakdown?.percentile || 0,
          tier: scoreBreakdown?.tier || 'competitive',
          warsScore: scoreBreakdown?.warsScore,
          warsLevel: scoreBreakdown?.warsLevel,
          warsBreakdown: scoreBreakdown?.warsBreakdown,
        }}
        schoolList={{
          reach: schoolResults?.reach || [],
          target: schoolResults?.target || [],
          safety: schoolResults?.safety || [],
          summary: {
            totalSchools: schoolResults?.summary?.totalSchools || 0,
            expectedInterviews: simulationResults?.expectedInterviews || 0,
            expectedAcceptances: simulationResults?.expectedAcceptances || 0,
            probabilityOfAtLeastOne: simulationResults?.probabilityOfAtLeastOneAcceptance || 0,
          },
        }}
        simulation={{
          expectedInterviews: simulationResults?.expectedInterviews || 0,
          expectedAcceptances: simulationResults?.expectedAcceptances || 0,
          probabilityOfAtLeastOneAcceptance: simulationResults?.probabilityOfAtLeastOneAcceptance || 0,
          interviewDistribution: simulationResults?.interviewDistribution || [],
          acceptanceDistribution: simulationResults?.acceptanceDistribution || [],
          probabilityBuckets: simulationResults?.probabilityBuckets || {
            noAcceptances: 0,
            oneAcceptance: 0,
            twoToThree: 0,
            fourOrMore: 0,
          },
          perSchoolOutcomes: simulationResults?.perSchoolOutcomes,
          modalOutcome: simulationResults?.modalOutcome,
          optimisticOutcome: simulationResults?.optimisticOutcome,
          pessimisticOutcome: simulationResults?.pessimisticOutcome,
        }}
        globalProbability={prediction.global_acceptance_probability || 0}
        confidenceRange={{
          lower: prediction.global_acceptance_ci_lower || 0,
          upper: prediction.global_acceptance_ci_upper || 0,
        }}
        applicantProfile={prediction.input_snapshot ? {
          gpa: (prediction.input_snapshot as any).cumulativeGPA || 0,
          mcat: (prediction.input_snapshot as any).mcatTotal || 0,
          clinicalHours: (prediction.input_snapshot as any).clinicalHoursTotal || 0,
          researchHours: (prediction.input_snapshot as any).researchHoursTotal || 0,
          volunteerHours: (prediction.input_snapshot as any).volunteerHoursNonClinical || 0,
          shadowingHours: (prediction.input_snapshot as any).shadowingHours || 0,
          teachingHours: (prediction.input_snapshot as any).teachingHours || 0,
          raceEthnicity: (prediction.input_snapshot as any).raceEthnicity,
          state: (prediction.input_snapshot as any).stateOfResidence || '',
          isFirstGen: (prediction.input_snapshot as any).isFirstGeneration || false,
          isDisadvantaged: (prediction.input_snapshot as any).isDisadvantaged || false,
        } : undefined}
      />

      {/* Caveats & Methodology */}
      <Card>
        <CardHeader>
          <CardTitle>Important Caveats</CardTitle>
          <CardDescription>
            Understanding the limitations of this prediction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <p>
            <strong>This is a statistical model, not a guarantee.</strong> Actual admission decisions
            depend on many factors that cannot be quantified, including personal statements,
            letters of recommendation, interview performance, and institutional priorities.
          </p>
          <p>
            <strong>Data limitations:</strong> Our model is based on aggregate AAMC data and
            published research. Individual school admission processes vary significantly, and
            historical patterns may not predict future outcomes.
          </p>
          <p>
            <strong>Holistic review:</strong> Medical schools use holistic review processes that
            consider the full context of each applicant. Numbers alone do not determine admission.
          </p>
          <div className="pt-4 border-t">
            <Link
              href="/methodology"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Learn more about our methodology &rarr;
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
