import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateQuickPrediction, type ApplicantInput } from '@/lib/scoring'
import { RACE_ETHNICITY_CATEGORIES } from '@/types/data'

// Simplified validation schema for quick prediction
const QuickPredictSchema = z.object({
  cumulativeGPA: z.number().min(0).max(4.0),
  mcatTotal: z.number().min(472).max(528),
  stateOfResidence: z.string().length(2),
  raceEthnicity: z.enum(RACE_ETHNICITY_CATEGORIES as unknown as [string, ...string[]]).nullable().optional(),
  isFirstGeneration: z.boolean().optional().default(false),
  isDisadvantaged: z.boolean().optional().default(false),
  clinicalHoursTotal: z.number().min(0).optional().default(0),
  researchHoursTotal: z.number().min(0).optional().default(0),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = QuickPredictSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Build minimal applicant input
    const applicantInput: ApplicantInput = {
      cumulativeGPA: data.cumulativeGPA,
      scienceGPA: null,
      mcatTotal: data.mcatTotal,
      mcatCPBS: null,
      mcatCARS: null,
      mcatBBFL: null,
      mcatPSBB: null,
      stateOfResidence: data.stateOfResidence as any,
      raceEthnicity: (data.raceEthnicity as any) ?? null,
      isFirstGeneration: data.isFirstGeneration,
      isDisadvantaged: data.isDisadvantaged,
      isRuralBackground: false,
      clinicalHoursTotal: data.clinicalHoursTotal,
      clinicalHoursPaid: 0,
      clinicalHoursVolunteer: data.clinicalHoursTotal,
      researchHoursTotal: data.researchHoursTotal,
      hasResearchPublications: false,
      publicationCount: 0,
      volunteerHoursNonClinical: 0,
      shadowingHours: 0,
      leadershipExperiences: 0,
      teachingHours: 0,
      applicationYear: new Date().getFullYear(),
      isReapplicant: false,
      hasInstitutionalAction: false,
      hasCriminalHistory: false,
    }

    // Generate quick prediction
    const result = generateQuickPrediction(applicantInput)

    return NextResponse.json({
      success: true,
      score: result.score,
      tier: result.tier,
      globalProbability: result.globalProbability,
      expectedAcceptances: result.expectedAcceptances,
    })
  } catch (error) {
    console.error('Quick prediction error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    )
  }
}
