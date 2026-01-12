import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  generateNativePrediction,
  type NativePredictionRequest,
} from '@/lib/model'
import { RACE_ETHNICITY_CATEGORIES } from '@/types/data'

/**
 * Prediction API (v2.0)
 *
 * Uses the rigorous probabilistic model with:
 * - Competitiveness Score (C) on -3 to +3 scale, calibrated to AAMC A-23
 * - Two-stage probability: P(accept) = P(interview) × P(accept|interview)
 * - 80% credible intervals via parametric bootstrap
 * - Correlated Monte Carlo simulation
 */

// Validation schema for applicant input
const ApplicantInputSchema = z.object({
  // Academic Credentials
  cumulativeGPA: z.number().min(0).max(4.0),
  scienceGPA: z.number().min(0).max(4.0).nullable().optional(),
  mcatTotal: z.number().min(472).max(528),
  mcatCPBS: z.number().min(118).max(132).nullable().optional(),
  mcatCARS: z.number().min(118).max(132).nullable().optional(),
  mcatBBFL: z.number().min(118).max(132).nullable().optional(),
  mcatPSBB: z.number().min(118).max(132).nullable().optional(),

  // Demographics
  stateOfResidence: z.string().length(2),
  raceEthnicity: z.enum(RACE_ETHNICITY_CATEGORIES as unknown as [string, ...string[]]).nullable().optional(),
  isFirstGeneration: z.boolean().default(false),
  isDisadvantaged: z.boolean().default(false),
  isRuralBackground: z.boolean().default(false),

  // Experiences
  clinicalHoursTotal: z.number().min(0).default(0),
  clinicalHoursPaid: z.number().min(0).default(0),
  researchHoursTotal: z.number().min(0).default(0),
  publicationCount: z.number().min(0).default(0),
  volunteerHoursNonClinical: z.number().min(0).default(0),
  shadowingHours: z.number().min(0).default(0),
  leadershipExperiences: z.number().min(0).default(0),
  teachingHours: z.number().min(0).default(0),

  // Application Details
  applicationYear: z.number().min(2020).max(2030).default(new Date().getFullYear()),
  isReapplicant: z.boolean().default(false),
  hasInstitutionalAction: z.boolean().default(false),
  hasCriminalHistory: z.boolean().default(false),
})

const PredictionOptionsSchema = z.object({
  includeSimulation: z.boolean().default(true),
  simulationIterations: z.number().min(1000).max(50000).default(5000),
  schoolIds: z.array(z.string()).optional(),
}).optional()

const RequestSchema = z.object({
  applicant: ApplicantInputSchema,
  options: PredictionOptionsSchema,
  profileId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = RequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { applicant, options, profileId } = validationResult.data

    // Build native prediction request
    const nativeRequest: NativePredictionRequest = {
      gpa: applicant.cumulativeGPA,
      scienceGpa: applicant.scienceGPA,
      mcat: applicant.mcatTotal,
      mcatSections: {
        cpbs: applicant.mcatCPBS,
        cars: applicant.mcatCARS,
        bbfl: applicant.mcatBBFL,
        psbb: applicant.mcatPSBB,
      },
      state: applicant.stateOfResidence,
      raceEthnicity: applicant.raceEthnicity ?? null,
      isFirstGen: applicant.isFirstGeneration,
      isDisadvantaged: applicant.isDisadvantaged,
      isRural: applicant.isRuralBackground,
      clinicalHours: applicant.clinicalHoursTotal,
      clinicalHoursPaid: applicant.clinicalHoursPaid,
      researchHours: applicant.researchHoursTotal,
      volunteerHours: applicant.volunteerHoursNonClinical,
      shadowingHours: applicant.shadowingHours,
      leadershipCount: applicant.leadershipExperiences,
      publicationCount: applicant.publicationCount,
      teachingHours: applicant.teachingHours,
      applicationYear: applicant.applicationYear,
      isReapplicant: applicant.isReapplicant,
      hasInstitutionalAction: applicant.hasInstitutionalAction,
      hasCriminalHistory: applicant.hasCriminalHistory,
    }

    // Generate prediction using v2.0 model
    const prediction = generateNativePrediction(nativeRequest, {
      includeSimulation: options?.includeSimulation ?? true,
      simulationIterations: options?.simulationIterations ?? 5000,
      schoolIds: options?.schoolIds,
    })

    // Save to database
    const supabase = await createClient()
    const predictionData = {
      profile_id: profileId || null,
      user_id: user.id,
      model_version: prediction.metadata.modelVersion,
      data_sources_version: '2.0.0',
      input_snapshot: nativeRequest,
      // Store C score mapped to 0-1000 range for database compatibility
      applicant_score: Math.round(500 + prediction.competitiveness.C * 100),
      score_breakdown: {
        competitiveness: prediction.competitiveness,
        experience: prediction.experience,
        demographics: prediction.demographics,
      },
      global_acceptance_probability: prediction.listMetrics.pAtLeastOne.mean,
      global_acceptance_ci_lower: prediction.listMetrics.pAtLeastOne.ci80[0],
      global_acceptance_ci_upper: prediction.listMetrics.pAtLeastOne.ci80[1],
      school_results: {
        total: prediction.schools.length,
        schools: prediction.schools,
      },
      simulation_results: {
        ...prediction.simulation,
        expectedInterviews: prediction.listMetrics.expectedInterviews,
        expectedAcceptances: prediction.listMetrics.expectedAcceptances,
        distributionBuckets: prediction.listMetrics.distributionBuckets,
        uncertainty: prediction.uncertainty,
      },
      computed_at: prediction.metadata.computedAt,
      compute_time_ms: 100,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedPrediction, error: saveError } = await (supabase as any)
      .from('prediction_results')
      .insert(predictionData)
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save prediction:', saveError)
      throw new Error('Failed to save prediction')
    }

    return NextResponse.json({
      success: true,
      predictionId: savedPrediction.id,
      prediction,
    })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    )
  }
}
