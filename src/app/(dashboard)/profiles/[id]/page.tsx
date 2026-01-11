import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApplicantProfile, PredictionResult } from '@/types/database'
import { ProfileEditor } from './ProfileEditor'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const user = await getUser()
  const supabase = await createClient()

  // Fetch profile
  const { data: profile, error } = await supabase
    .from('applicant_profiles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: ApplicantProfile | null; error: any }

  if (error) {
    console.error('Error fetching profile:', error)
  }

  if (!profile) {
    console.log('Profile not found for ID:', id, 'User:', user.id)
    notFound()
  }

  // Fetch predictions for this profile
  const { data: predictions } = await supabase
    .from('prediction_results')
    .select('*')
    .eq('profile_id', id)
    .order('computed_at', { ascending: false })
    .limit(5) as { data: PredictionResult[] | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{profile.profile_name}</h1>
            {profile.is_primary && (
              <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                Primary
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Last updated {new Date(profile.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/profiles/${id}/predict`}>
            <Button>Generate Prediction</Button>
          </Link>
        </div>
      </div>

      {/* Current Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Cumulative GPA</p>
            <p className="text-2xl font-bold">
              {profile.cumulative_gpa?.toFixed(2) || 'Not set'}
            </p>
            {profile.science_gpa && (
              <p className="text-sm text-slate-500">Science: {profile.science_gpa.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">MCAT Total</p>
            <p className="text-2xl font-bold">{profile.mcat_total || 'Not set'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Clinical Hours</p>
            <p className="text-2xl font-bold">{profile.clinical_hours}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Research Hours</p>
            <p className="text-2xl font-bold">{profile.research_hours}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Predictions */}
      {predictions && predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Predictions</CardTitle>
            <CardDescription>
              Predictions generated from this profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {predictions.map((prediction) => (
                <Link
                  key={prediction.id}
                  href={`/results/${prediction.id}`}
                  className="block p-4 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Score: {prediction.applicant_score}/1000
                      </p>
                      <p className="text-sm text-slate-500">
                        {prediction.global_acceptance_probability
                          ? `${(prediction.global_acceptance_probability * 100).toFixed(1)}% acceptance probability`
                          : 'Processing...'}
                      </p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {new Date(prediction.computed_at).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>
            Update your applicant information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileEditor profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
