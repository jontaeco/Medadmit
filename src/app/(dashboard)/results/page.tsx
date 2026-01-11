import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PredictionResult } from '@/types/database'

export default async function ResultsPage() {
  const user = await getUser()
  const supabase = await createClient()

  const { data: predictions } = await supabase
    .from('prediction_results')
    .select('*')
    .eq('user_id', user.id)
    .order('computed_at', { ascending: false }) as { data: PredictionResult[] | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Results</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View your prediction history and school recommendations
          </p>
        </div>
        <Link href="/profiles">
          <Button>Generate New Prediction</Button>
        </Link>
      </div>

      {!predictions || predictions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">No predictions yet</h3>
            <p className="text-slate-500 mb-4">
              Generate your first prediction to see school recommendations
            </p>
            <Link href="/profiles">
              <Button>Create Profile & Predict</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {predictions.map((prediction) => (
            <Card key={prediction.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      Score: {prediction.applicant_score}/1000
                      <TierBadge score={prediction.applicant_score || 0} />
                    </CardTitle>
                    <CardDescription>
                      Generated {new Date(prediction.computed_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Link href={`/results/${prediction.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Acceptance Probability</p>
                    <p className="font-medium text-lg">
                      {prediction.global_acceptance_probability
                        ? `${(prediction.global_acceptance_probability * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Confidence Range</p>
                    <p className="font-medium">
                      {prediction.global_acceptance_ci_lower && prediction.global_acceptance_ci_upper
                        ? `${(prediction.global_acceptance_ci_lower * 100).toFixed(0)}% - ${(prediction.global_acceptance_ci_upper * 100).toFixed(0)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Schools Analyzed</p>
                    <p className="font-medium">
                      {(prediction.school_results as any)?.total || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Model Version</p>
                    <p className="font-medium">{prediction.model_version}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TierBadge({ score }: { score: number }) {
  let tier: string
  let colors: string

  if (score >= 800) {
    tier = 'Exceptional'
    colors = 'bg-green-100 text-green-700'
  } else if (score >= 650) {
    tier = 'Strong'
    colors = 'bg-blue-100 text-blue-700'
  } else if (score >= 500) {
    tier = 'Competitive'
    colors = 'bg-yellow-100 text-yellow-700'
  } else if (score >= 350) {
    tier = 'Below Average'
    colors = 'bg-orange-100 text-orange-700'
  } else {
    tier = 'Low'
    colors = 'bg-red-100 text-red-700'
  }

  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors}`}>
      {tier}
    </span>
  )
}
