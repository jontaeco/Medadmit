import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProfileUpdate = Database['public']['Tables']['applicant_profiles']['Update']

const UpdateProfileSchema = z.object({
  profileName: z.string().min(1, 'Profile name is required'),
  cumulativeGPA: z.coerce.number().min(0).max(4.0),
  scienceGPA: z.coerce.number().min(0).max(4.0).nullable().optional(),
  mcatTotal: z.coerce.number().min(472).max(528),
  mcatCPBS: z.coerce.number().min(118).max(132).nullable().optional(),
  mcatCARS: z.coerce.number().min(118).max(132).nullable().optional(),
  mcatBBFL: z.coerce.number().min(118).max(132).nullable().optional(),
  mcatPSBB: z.coerce.number().min(118).max(132).nullable().optional(),
  stateOfResidence: z.string().length(2),
  raceEthnicity: z.string().nullable().optional(),
  isFirstGeneration: z.boolean().default(false),
  isDisadvantaged: z.boolean().default(false),
  isRuralBackground: z.boolean().default(false),
  clinicalHoursPaid: z.coerce.number().min(0).default(0),
  clinicalHoursVolunteer: z.coerce.number().min(0).default(0),
  researchHoursTotal: z.coerce.number().min(0).default(0),
  hasResearchPublications: z.boolean().default(false),
  publicationCount: z.coerce.number().min(0).default(0),
  volunteerHoursNonClinical: z.coerce.number().min(0).default(0),
  shadowingHours: z.coerce.number().min(0).default(0),
  leadershipExperiences: z.coerce.number().min(0).default(0),
  teachingHours: z.coerce.number().min(0).default(0),
  isReapplicant: z.boolean().default(false),
  hasInstitutionalAction: z.boolean().default(false),
  hasCriminalHistory: z.boolean().default(false),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: profile, error } = await supabase
      .from('applicant_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = UpdateProfileSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const supabase = await createClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from('applicant_profiles')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Update profile
    const updateData: ProfileUpdate = {
      profile_name: data.profileName,
      cumulative_gpa: data.cumulativeGPA,
      science_gpa: data.scienceGPA || null,
      mcat_total: data.mcatTotal,
      mcat_sections: {
        cpbs: data.mcatCPBS || null,
        cars: data.mcatCARS || null,
        bbfl: data.mcatBBFL || null,
        psbb: data.mcatPSBB || null,
      },
      clinical_hours: data.clinicalHoursPaid + data.clinicalHoursVolunteer,
      volunteer_hours: data.volunteerHoursNonClinical,
      shadowing_hours: data.shadowingHours,
      research_hours: data.researchHoursTotal,
      publications: data.hasResearchPublications
        ? { count: data.publicationCount }
        : null,
      state_of_residence: data.stateOfResidence,
      race_ethnicity: data.raceEthnicity ? [data.raceEthnicity] : null,
      first_generation: data.isFirstGeneration,
      socioeconomically_disadvantaged: data.isDisadvantaged,
      rural_background: data.isRuralBackground,
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase as any)
      .from('applicant_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from('applicant_profiles')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Delete profile
    const { error } = await supabase
      .from('applicant_profiles')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
  }
}
