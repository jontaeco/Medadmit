'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileForm } from '@/components/profile/ProfileForm'
import type { ApplicantProfile } from '@/types/database'

interface ProfileEditorProps {
  profile: ApplicantProfile
}

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Convert database profile to form data format
  const initialData = {
    profileName: profile.profile_name || '',
    cumulativeGPA: profile.cumulative_gpa || 3.5,
    scienceGPA: profile.science_gpa || null,
    mcatTotal: profile.mcat_total || 510,
    mcatCPBS: (profile.mcat_sections as any)?.cpbs || null,
    mcatCARS: (profile.mcat_sections as any)?.cars || null,
    mcatBBFL: (profile.mcat_sections as any)?.bbfl || null,
    mcatPSBB: (profile.mcat_sections as any)?.psbb || null,
    stateOfResidence: profile.state_of_residence || 'CA',
    raceEthnicity: profile.race_ethnicity?.[0] || null,
    isFirstGeneration: profile.first_generation || false,
    isDisadvantaged: profile.socioeconomically_disadvantaged || false,
    isRuralBackground: profile.rural_background || false,
    clinicalHoursPaid: Math.round((profile.clinical_hours || 0) * 0.5),
    clinicalHoursVolunteer: Math.round((profile.clinical_hours || 0) * 0.5),
    researchHoursTotal: profile.research_hours || 0,
    hasResearchPublications: (profile.publications as any)?.count > 0 || false,
    publicationCount: (profile.publications as any)?.count || 0,
    volunteerHoursNonClinical: profile.volunteer_hours || 0,
    shadowingHours: profile.shadowing_hours || 0,
    leadershipExperiences: 0,
    teachingHours: 0,
    isReapplicant: false,
    hasInstitutionalAction: false,
    hasCriminalHistory: false,
    // WARS-specific fields
    undergraduateSchoolTier: profile.undergraduate_school_tier || null,
    gpaTrend: profile.gpa_trend || null,
    miscellaneousLevel: profile.miscellaneous_level || null,
  }

  async function handleSubmit(data: any) {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-green-700">Profile updated successfully!</p>
        </div>
      )}

      <ProfileForm
        initialData={initialData}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
