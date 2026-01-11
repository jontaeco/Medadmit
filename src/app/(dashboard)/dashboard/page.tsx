import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClearDataButton } from '@/components/dashboard/ClearDataButton'
import type { ApplicantProfile, PredictionResult } from '@/types/database'

export default async function DashboardPage() {
  const user = await getUser()
  const supabase = await createClient()

  // Fetch user's profiles
  const { data: profiles } = await supabase
    .from('applicant_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: ApplicantProfile[] | null }

  // Fetch user's recent predictions
  const { data: predictions } = await supabase
    .from('prediction_results')
    .select('*')
    .eq('user_id', user.id)
    .order('computed_at', { ascending: false })
    .limit(5) as { data: PredictionResult[] | null }

  const hasProfiles = profiles && profiles.length > 0
  const hasPredictions = predictions && predictions.length > 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold">Welcome to MedAdmit</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Get data-driven insights for your medical school application journey.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profiles</CardDescription>
            <CardTitle className="text-4xl">{profiles?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              {hasProfiles ? 'applicant profiles created' : 'Create your first profile to get started'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Predictions</CardDescription>
            <CardTitle className="text-4xl">{predictions?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              {hasPredictions ? 'predictions generated' : 'No predictions yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account Status</CardDescription>
            <CardTitle className="text-4xl capitalize">{user.subscription_tier}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              {user.subscription_tier === 'free'
                ? 'Upgrade for more predictions'
                : 'Premium features enabled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started / Actions */}
      {!hasProfiles ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create your first applicant profile to generate predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                MedAdmit uses your academic credentials, experiences, and background to estimate
                your chances of admission to U.S. MD medical schools. Our predictions are based on
                AAMC data and peer-reviewed research.
              </p>
              <Link href="/profiles/new">
                <Button>Create Your Profile</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Profiles */}
          <Card>
            <CardHeader>
              <CardTitle>Your Profiles</CardTitle>
              <CardDescription>Manage your applicant profiles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profiles?.slice(0, 3).map((profile) => (
                  <Link
                    key={profile.id}
                    href={`/profiles/${profile.id}`}
                    className="block p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{profile.profile_name}</p>
                        <p className="text-sm text-slate-500">
                          GPA: {profile.cumulative_gpa || 'N/A'} | MCAT: {profile.mcat_total || 'N/A'}
                        </p>
                      </div>
                      {profile.is_primary && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
                <Link href="/profiles">
                  <Button variant="outline" className="w-full">View All Profiles</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Predictions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
              <CardDescription>Your latest admission predictions</CardDescription>
            </CardHeader>
            <CardContent>
              {hasPredictions ? (
                <div className="space-y-3">
                  {predictions?.map((prediction) => (
                    <Link
                      key={prediction.id}
                      href={`/results/${prediction.id}`}
                      className="block p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            Score: {typeof prediction.applicant_score === 'number'
                              ? prediction.applicant_score
                              : (prediction.applicant_score as any)?.totalScore || 0}/1000
                          </p>
                          <p className="text-sm text-slate-500">
                            {prediction.global_acceptance_probability
                              ? `${(prediction.global_acceptance_probability * 100).toFixed(1)}% acceptance probability`
                              : 'Processing...'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(prediction.computed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                  <Link href="/results">
                    <Button variant="outline" className="w-full">View All Results</Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-4">
                    Generate a prediction to see your admission chances
                  </p>
                  <Link href="/profiles">
                    <Button>Generate Prediction</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Management */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Data Management</CardTitle>
          <CardDescription className="text-red-700">
            Permanently delete all profiles and predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700 mb-4">
            This action cannot be undone. All your profiles and prediction data will be permanently deleted.
          </p>
          <ClearDataButton />
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How MedAdmit Works</CardTitle>
          <CardDescription>
            Our prediction model is grounded in real data from AAMC and peer-reviewed research
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
              </div>
              <h3 className="font-medium">Enter Your Stats</h3>
              <p className="text-sm text-slate-500">
                Input your GPA, MCAT, experiences, and background information into your profile.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
              </div>
              <h3 className="font-medium">Get Predictions</h3>
              <p className="text-sm text-slate-500">
                Our model analyzes your profile against AAMC data to estimate admission chances.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
              </div>
              <h3 className="font-medium">Build Your List</h3>
              <p className="text-sm text-slate-500">
                Get a personalized school list with reach, target, and safety schools.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
