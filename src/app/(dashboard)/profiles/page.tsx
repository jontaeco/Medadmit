import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApplicantProfile } from '@/types/database'

export default async function ProfilesPage() {
  const user = await getUser()
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('applicant_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: ApplicantProfile[] | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Profiles</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your applicant profiles and generate predictions
          </p>
        </div>
        <Link href="/profiles/new">
          <Button>Create New Profile</Button>
        </Link>
      </div>

      {!profiles || profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">No profiles yet</h3>
            <p className="text-slate-500 mb-4">
              Create your first applicant profile to start generating predictions
            </p>
            <Link href="/profiles/new">
              <Button>Create Your First Profile</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <Card key={profile.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {profile.profile_name}
                      {profile.is_primary && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Created {new Date(profile.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Link href={`/profiles/${profile.id}`}>
                    <Button variant="outline" size="sm">
                      View / Edit
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">GPA</p>
                    <p className="font-medium">
                      {profile.cumulative_gpa?.toFixed(2) || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">MCAT</p>
                    <p className="font-medium">{profile.mcat_total || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Clinical Hours</p>
                    <p className="font-medium">{profile.clinical_hours || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Research Hours</p>
                    <p className="font-medium">{profile.research_hours || 0}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex gap-3">
                  <Link href={`/profiles/${profile.id}/predict`}>
                    <Button size="sm">Generate Prediction</Button>
                  </Link>
                  <Link href={`/profiles/${profile.id}`}>
                    <Button variant="ghost" size="sm">
                      Edit Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
