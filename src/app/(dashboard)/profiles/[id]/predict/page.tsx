'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function PredictPage() {
  const router = useRouter()
  const params = useParams()
  const profileId = params.id as string

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [options, setOptions] = useState({
    totalSchools: 20,
    prioritizeInState: true,
    onlyOOSFriendly: false,
    prioritizeResearch: false,
    prioritizePrimaryCare: false,
    maxTuition: 0,
  })

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/profiles/${profileId}`)
        if (!response.ok) throw new Error('Profile not found')
        const data = await response.json()
        setProfile(data.profile)
      } catch (err) {
        setError('Failed to load profile')
      }
    }
    fetchProfile()
  }, [profileId])

  async function handleGenerate() {
    setIsLoading(true)
    setError(null)

    try {
      // First, get the full profile data
      const profileResponse = await fetch(`/api/profiles/${profileId}`)
      if (!profileResponse.ok) throw new Error('Profile not found')
      const { profile: fullProfile } = await profileResponse.json()

      // Build applicant input from profile
      const applicantInput = {
        cumulativeGPA: fullProfile.cumulative_gpa,
        scienceGPA: fullProfile.science_gpa,
        mcatTotal: fullProfile.mcat_total,
        mcatCPBS: fullProfile.mcat_sections?.cpbs || null,
        mcatCARS: fullProfile.mcat_sections?.cars || null,
        mcatBBFL: fullProfile.mcat_sections?.bbfl || null,
        mcatPSBB: fullProfile.mcat_sections?.psbb || null,
        stateOfResidence: fullProfile.state_of_residence,
        raceEthnicity: fullProfile.race_ethnicity?.[0] || null,
        isFirstGeneration: fullProfile.first_generation,
        isDisadvantaged: fullProfile.socioeconomically_disadvantaged,
        isRuralBackground: fullProfile.rural_background,
        clinicalHoursTotal: fullProfile.clinical_hours,
        clinicalHoursPaid: Math.round(fullProfile.clinical_hours * 0.5),
        clinicalHoursVolunteer: Math.round(fullProfile.clinical_hours * 0.5),
        researchHoursTotal: fullProfile.research_hours,
        hasResearchPublications: (fullProfile.publications?.count || 0) > 0,
        publicationCount: fullProfile.publications?.count || 0,
        volunteerHoursNonClinical: fullProfile.volunteer_hours,
        shadowingHours: fullProfile.shadowing_hours,
        leadershipExperiences: 0,
        teachingHours: 0,
        isReapplicant: false,
        hasInstitutionalAction: false,
        hasCriminalHistory: false,
      }

      // Generate prediction
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant: applicantInput,
          options: {
            totalSchools: options.totalSchools,
            prioritizeInState: options.prioritizeInState,
            onlyOOSFriendly: options.onlyOOSFriendly,
            prioritizeResearch: options.prioritizeResearch,
            prioritizePrimaryCare: options.prioritizePrimaryCare,
            maxTuition: options.maxTuition > 0 ? options.maxTuition : undefined,
          },
          profileId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate prediction')
      }

      const result = await response.json()

      // Navigate to results
      router.push(`/results/${result.predictionId || 'latest'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!profile && !error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Generate Prediction</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Customize your prediction settings for &quot;{profile?.profile_name}&quot;
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Summary</CardTitle>
          <CardDescription>
            Generating prediction based on these stats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">GPA</p>
              <p className="font-medium">{profile?.cumulative_gpa?.toFixed(2) || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">MCAT</p>
              <p className="font-medium">{profile?.mcat_total || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">State</p>
              <p className="font-medium">{profile?.state_of_residence || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500">Clinical Hours</p>
              <p className="font-medium">{profile?.clinical_hours || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle>School List Options</CardTitle>
          <CardDescription>
            Customize how your school list is generated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="totalSchools">Total Schools</Label>
            <Input
              id="totalSchools"
              type="number"
              min="5"
              max="50"
              value={options.totalSchools}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  totalSchools: parseInt(e.target.value) || 20,
                }))
              }
            />
            <p className="text-xs text-slate-500">
              Number of schools to include in your list (5-50)
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="prioritizeInState"
                checked={options.prioritizeInState}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    prioritizeInState: checked === true,
                  }))
                }
              />
              <Label htmlFor="prioritizeInState" className="font-normal">
                Prioritize in-state schools
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="onlyOOSFriendly"
                checked={options.onlyOOSFriendly}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    onlyOOSFriendly: checked === true,
                  }))
                }
              />
              <Label htmlFor="onlyOOSFriendly" className="font-normal">
                Only include out-of-state friendly schools
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="prioritizeResearch"
                checked={options.prioritizeResearch}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    prioritizeResearch: checked === true,
                  }))
                }
              />
              <Label htmlFor="prioritizeResearch" className="font-normal">
                Prioritize research-focused schools
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="prioritizePrimaryCare"
                checked={options.prioritizePrimaryCare}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    prioritizePrimaryCare: checked === true,
                  }))
                }
              />
              <Label htmlFor="prioritizePrimaryCare" className="font-normal">
                Prioritize primary care-focused schools
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTuition">Maximum Tuition (optional)</Label>
            <Input
              id="maxTuition"
              type="number"
              min="0"
              step="10000"
              placeholder="No limit"
              value={options.maxTuition || ''}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  maxTuition: parseInt(e.target.value) || 0,
                }))
              }
            />
            <p className="text-xs text-slate-500">
              Maximum annual tuition to consider (leave empty for no limit)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Generating...
            </>
          ) : (
            'Generate Prediction'
          )}
        </Button>
      </div>
    </div>
  )
}
