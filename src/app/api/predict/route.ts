import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generatePrediction, type ApplicantInput } from '@/lib/scoring'
import { RACE_ETHNICITY_CATEGORIES } from '@/types/data'

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
  clinicalHoursVolunteer: z.number().min(0).default(0),
  researchHoursTotal: z.number().min(0).default(0),
  hasResearchPublications: z.boolean().default(false),
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

  // WARS-specific fields (optional)
  undergraduateSchoolTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  gpaTrend: z.enum(['upward', 'flat', 'downward']).optional(),
  miscellaneousLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

const SchoolListOptionsSchema = z.object({
  totalSchools: z.number().min(1).max(50).optional(),
  reachCount: z.number().min(0).max(20).optional(),
  targetCount: z.number().min(0).max(30).optional(),
  safetyCount: z.number().min(0).max(15).optional(),
  excludeStates: z.array(z.string()).optional(),
  includeStates: z.array(z.string()).optional(),
  onlyPublic: z.boolean().optional(),
  onlyPrivate: z.boolean().optional(),
  onlyOOSFriendly: z.boolean().optional(),
  missionKeywords: z.array(z.string()).optional(),
  prioritizeInState: z.boolean().optional(),
  prioritizeResearch: z.boolean().optional(),
  prioritizePrimaryCare: z.boolean().optional(),
  minimumProbability: z.number().min(0).max(1).optional(),
  maxTuition: z.number().min(0).optional(),
  preferLowerTuition: z.boolean().optional(),
}).optional()

const RequestSchema = z.object({
  applicant: ApplicantInputSchema,
  options: SchoolListOptionsSchema,
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

    // Convert to ApplicantInput type with defaults
    const applicantInput: ApplicantInput = {
      cumulativeGPA: applicant.cumulativeGPA,
      scienceGPA: applicant.scienceGPA ?? null,
      mcatTotal: applicant.mcatTotal,
      mcatCPBS: applicant.mcatCPBS ?? null,
      mcatCARS: applicant.mcatCARS ?? null,
      mcatBBFL: applicant.mcatBBFL ?? null,
      mcatPSBB: applicant.mcatPSBB ?? null,
      stateOfResidence: applicant.stateOfResidence as any,
      raceEthnicity: (applicant.raceEthnicity as any) ?? null,
      isFirstGeneration: applicant.isFirstGeneration,
      isDisadvantaged: applicant.isDisadvantaged,
      isRuralBackground: applicant.isRuralBackground,
      clinicalHoursTotal: applicant.clinicalHoursTotal,
      clinicalHoursPaid: applicant.clinicalHoursPaid,
      clinicalHoursVolunteer: applicant.clinicalHoursVolunteer,
      researchHoursTotal: applicant.researchHoursTotal,
      hasResearchPublications: applicant.hasResearchPublications,
      publicationCount: applicant.publicationCount,
      volunteerHoursNonClinical: applicant.volunteerHoursNonClinical,
      shadowingHours: applicant.shadowingHours,
      leadershipExperiences: applicant.leadershipExperiences,
      teachingHours: applicant.teachingHours,
      applicationYear: applicant.applicationYear,
      isReapplicant: applicant.isReapplicant,
      hasInstitutionalAction: applicant.hasInstitutionalAction,
      hasCriminalHistory: applicant.hasCriminalHistory,
      // WARS-specific fields (optional)
      undergraduateSchoolTier: applicant.undergraduateSchoolTier,
      gpaTrend: applicant.gpaTrend,
      miscellaneousLevel: applicant.miscellaneousLevel,
    }

    // Generate prediction
    const prediction = generatePrediction(applicantInput, options as any)

    // Transform simulation distributions to array format for charts
    // Convert raw counts to distribution array
    console.log('[Predict API] Raw interview counts length:', prediction.simulation.rawInterviewCounts?.length || 0)
    console.log('[Predict API] Raw acceptance counts length:', prediction.simulation.rawAcceptanceCounts?.length || 0)
    const interviewDistArray = countToDistribution(prediction.simulation.rawInterviewCounts || [])
    const acceptanceDistArray = countToDistribution(prediction.simulation.rawAcceptanceCounts || [])
    console.log('[Predict API] Interview distribution array length:', interviewDistArray.length)
    console.log('[Predict API] Acceptance distribution array length:', acceptanceDistArray.length)

    // Save prediction to database
    const supabase = await createClient()
    console.log('[Predict API] Saving applicant_score:', typeof prediction.applicantScore.totalScore, prediction.applicantScore.totalScore)
    const predictionData = {
      profile_id: profileId || null,
      user_id: user.id,
      model_version: prediction.modelVersion,
      data_sources_version: prediction.dataVersion,
      input_snapshot: applicantInput,
      applicant_score: prediction.applicantScore.totalScore,
      score_breakdown: prediction.applicantScore,
      global_acceptance_probability: prediction.globalAcceptanceProbability,
      global_acceptance_ci_lower: prediction.globalProbabilityRange.lower,
      global_acceptance_ci_upper: prediction.globalProbabilityRange.upper,
      school_results: {
        total: prediction.schoolList.reach.length + prediction.schoolList.target.length + prediction.schoolList.safety.length,
        reach: prediction.schoolList.reach.map(formatSchoolProbability),
        target: prediction.schoolList.target.map(formatSchoolProbability),
        safety: prediction.schoolList.safety.map(formatSchoolProbability),
        summary: prediction.schoolList.summary,
      },
      simulation_results: {
        expectedInterviews: prediction.simulation.expectedInterviews,
        expectedAcceptances: prediction.simulation.expectedAcceptances,
        probabilityOfAtLeastOneAcceptance: prediction.simulation.probabilityOfAtLeastOneAcceptance,
        interviewDistribution: interviewDistArray,
        acceptanceDistribution: acceptanceDistArray,
        probabilityBuckets: {
          noAcceptances: (prediction.simulation.probabilityBuckets as any).zeroAcceptances,
          oneAcceptance: prediction.simulation.probabilityBuckets.oneAcceptance,
          twoToThree: (prediction.simulation.probabilityBuckets as any).twoToThreeAcceptances,
          fourOrMore: (prediction.simulation.probabilityBuckets as any).fourPlusAcceptances,
        },
        // Sankey diagram data
        perSchoolOutcomes: prediction.simulation.perSchoolOutcomes,
        modalOutcome: prediction.simulation.modalOutcome,
        optimisticOutcome: prediction.simulation.optimisticOutcome,
        pessimisticOutcome: prediction.simulation.pessimisticOutcome,
      },
      computed_at: prediction.computedAt,
      compute_time_ms: 100, // Mock compute time
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

    // Return prediction result with ID
    return NextResponse.json({
      success: true,
      predictionId: savedPrediction.id,
      prediction: {
        applicantScore: prediction.applicantScore.totalScore,
        scoreBreakdown: prediction.applicantScore,
        globalAcceptanceProbability: prediction.globalAcceptanceProbability,
        globalProbabilityRange: prediction.globalProbabilityRange,
        schoolList: {
          reach: prediction.schoolList.reach.map(formatSchoolProbability),
          target: prediction.schoolList.target.map(formatSchoolProbability),
          safety: prediction.schoolList.safety.map(formatSchoolProbability),
          summary: prediction.schoolList.summary,
        },
        simulation: {
          expectedInterviews: prediction.simulation.expectedInterviews,
          expectedAcceptances: prediction.simulation.expectedAcceptances,
          probabilityOfAtLeastOneAcceptance: prediction.simulation.probabilityOfAtLeastOneAcceptance,
          interviewDistribution: interviewDistArray,
          acceptanceDistribution: acceptanceDistArray,
          probabilityBuckets: {
            noAcceptances: (prediction.simulation.probabilityBuckets as any).zeroAcceptances,
            oneAcceptance: prediction.simulation.probabilityBuckets.oneAcceptance,
            twoToThree: (prediction.simulation.probabilityBuckets as any).twoToThreeAcceptances,
            fourOrMore: (prediction.simulation.probabilityBuckets as any).fourPlusAcceptances,
          },
          perSchoolOutcomes: prediction.simulation.perSchoolOutcomes,
          modalOutcome: prediction.simulation.modalOutcome,
          optimisticOutcome: prediction.simulation.optimisticOutcome,
          pessimisticOutcome: prediction.simulation.pessimisticOutcome,
        },
        warnings: prediction.warnings,
        caveats: prediction.caveats,
        metadata: {
          computedAt: prediction.computedAt,
          modelVersion: prediction.modelVersion,
          dataVersion: prediction.dataVersion,
        },
      },
    })
  } catch (error) {
    console.error('Prediction error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    )
  }
}

// Helper to convert raw count array to distribution array
function countToDistribution(counts: number[]): { count: number; probability: number }[] {
  const frequencyMap = new Map<number, number>()

  // Count occurrences of each value
  for (const count of counts) {
    frequencyMap.set(count, (frequencyMap.get(count) || 0) + 1)
  }

  // Convert to probability distribution
  const total = counts.length
  const distribution: { count: number; probability: number }[] = []

  frequencyMap.forEach((frequency, count) => {
    distribution.push({
      count,
      probability: frequency / total,
    })
  })

  // Sort by count
  return distribution.sort((a, b) => a.count - b.count)
}

// Helper to format school probability for API response
function formatSchoolProbability(sp: any) {
  return {
    school: {
      id: sp.school.id,
      name: sp.school.name,
      shortName: sp.school.shortName,
      state: sp.school.state,
      city: sp.school.city,
      medianGPA: sp.school.medianGPA,
      medianMCAT: sp.school.medianMCAT,
      isPublic: sp.school.isPublic,
      oosFriendliness: sp.school.oosFriendliness,
      tuitionInState: sp.school.tuitionInState,
      tuitionOutOfState: sp.school.tuitionOutOfState,
      warsTier: sp.school.warsTier,
      isLowYield: sp.school.isLowYield,
    },
    probability: sp.probability,
    probabilityLower: sp.probabilityLower,
    probabilityUpper: sp.probabilityUpper,
    category: sp.category,
    fit: sp.fit,
  }
}
