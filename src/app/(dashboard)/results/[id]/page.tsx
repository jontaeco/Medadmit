import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PredictionResult } from '@/types/database'
import type { NativePredictionResponse } from '@/lib/model'
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

  // Parse JSON fields - all predictions are now v2.0 format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoreBreakdown = prediction.score_breakdown as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolResults = prediction.school_results as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simulationResults = prediction.simulation_results as any

  // Build NativePredictionResponse from stored data
  const nativePrediction: NativePredictionResponse = {
    competitiveness: scoreBreakdown.competitiveness,
    experience: scoreBreakdown.experience,
    demographics: scoreBreakdown.demographics,
    schools: schoolResults?.schools || [],
    listMetrics: {
      expectedInterviews: simulationResults?.expectedInterviews ?? { mean: 0, ci80: [0, 0] },
      expectedAcceptances: simulationResults?.expectedAcceptances ?? { mean: 0, ci80: [0, 0] },
      pAtLeastOne: {
        mean: prediction.global_acceptance_probability ?? 0,
        ci80: [
          prediction.global_acceptance_ci_lower ?? 0,
          prediction.global_acceptance_ci_upper ?? 0,
        ],
      },
      distributionBuckets: simulationResults?.distributionBuckets ?? {
        zero: 0,
        one: 0,
        twoThree: 0,
        fourPlus: 0,
      },
    },
    uncertainty: simulationResults?.uncertainty ?? {
      overallLevel: 'moderate' as const,
      decomposition: {
        parameterVariance: 0,
        randomEffectVariance: 0,
        totalVariance: 0,
      },
    },
    simulation: {
      iterations: simulationResults?.iterations ?? 5000,
      correlationDiagnostics: simulationResults?.correlationDiagnostics ?? {
        meanPairwiseCorrelation: 0,
        acceptanceVariance: 0,
      },
      perSchool: simulationResults?.perSchool ?? [],
    },
    metadata: {
      modelVersion: prediction.model_version ?? '2.0.0',
      computedAt: prediction.computed_at,
    },
  }

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

      {/* Results Display */}
      <ResultsDisplay prediction={nativePrediction} />

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
