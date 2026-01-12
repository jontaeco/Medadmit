/**
 * Applicant Score Calculation Engine
 *
 * Calculates a 0-1000 applicant score based on:
 * - Academic credentials (GPA/MCAT): 0-720 points
 * - Experiences: 0-330 points
 * - Demographic adjustments: -100 to +150 points
 * - Red flag penalties: 0 to -100 points
 *
 * Total available points: ~1200 (allows multiple paths to 1000)
 *
 * The score is designed to correlate with overall acceptance probability
 * and is used for school list generation and cycle simulation.
 */

import type { ApplicantInput, ScoreBreakdown } from './types'
import { DEFAULT_EXPERIENCE_THRESHOLDS } from './types'
import {
  getAcceptanceRate,
  getApplicantPercentile,
  getRaceEthnicityOddsRatio,
} from '@/lib/data'
import { calculateWARSScore } from './wars-score'
import { applicantInputToWARSInput } from './wars-conversion'

/**
 * Calculate the complete applicant score
 */
export function calculateApplicantScore(input: ApplicantInput): ScoreBreakdown {
  // 1. Calculate academic score (0-720)
  const academicDetails = calculateAcademicScore(input)

  // 2. Calculate experience score (0-330)
  const experienceDetails = calculateExperienceScore(input)

  // 3. Calculate demographic adjustments (-100 to +150)
  const demographicDetails = calculateDemographicAdjustment(input)

  // 4. Calculate red flag penalties (0 to -100)
  const redFlagDetails = calculateRedFlagPenalty(input)

  // Sum all components
  const rawScore =
    academicDetails.gpaContribution +
    academicDetails.mcatContribution +
    experienceDetails.clinicalContribution +
    experienceDetails.researchContribution +
    experienceDetails.volunteerContribution +
    experienceDetails.leadershipContribution +
    experienceDetails.shadowingContribution +
    experienceDetails.teachingContribution +
    demographicDetails.raceEthnicityAdjustment +
    demographicDetails.firstGenAdjustment +
    demographicDetails.disadvantagedAdjustment +
    demographicDetails.ruralAdjustment +
    redFlagDetails.institutionalActionPenalty +
    redFlagDetails.criminalHistoryPenalty +
    redFlagDetails.reapplicantAdjustment +
    redFlagDetails.lowExperiencePenalty

  // Clamp to 0-1000
  const totalScore = Math.max(0, Math.min(1000, Math.round(rawScore)))

  // Calculate percentile and tier
  const percentile = scoreToPercentile(totalScore)
  const tier = scoreToTier(totalScore)

  // 5. Calculate WARS score (if data is available)
  let warsScore: number | undefined
  let warsLevel: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | undefined
  let warsBreakdown: ScoreBreakdown['warsBreakdown'] | undefined

  try {
    const warsInput = applicantInputToWARSInput(input)
    const warsResult = calculateWARSScore(warsInput)
    warsScore = warsResult.score
    warsLevel = warsResult.level
    warsBreakdown = warsResult.breakdown
  } catch (error) {
    // WARS calculation failed - likely missing required data
    // This is fine, WARS score is optional
    console.warn('WARS score calculation failed:', error)
  }

  return {
    academicScore: academicDetails.gpaContribution + academicDetails.mcatContribution,
    academicDetails: {
      gpaContribution: academicDetails.gpaContribution,
      mcatContribution: academicDetails.mcatContribution,
      gpaPercentile: academicDetails.gpaPercentile,
      mcatPercentile: academicDetails.mcatPercentile,
    },
    experienceScore:
      experienceDetails.clinicalContribution +
      experienceDetails.researchContribution +
      experienceDetails.volunteerContribution +
      experienceDetails.leadershipContribution +
      experienceDetails.shadowingContribution +
      experienceDetails.teachingContribution,
    experienceDetails,
    demographicAdjustment:
      demographicDetails.raceEthnicityAdjustment +
      demographicDetails.firstGenAdjustment +
      demographicDetails.disadvantagedAdjustment +
      demographicDetails.ruralAdjustment,
    demographicDetails,
    redFlagPenalty:
      redFlagDetails.institutionalActionPenalty +
      redFlagDetails.criminalHistoryPenalty +
      redFlagDetails.reapplicantAdjustment +
      redFlagDetails.lowExperiencePenalty,
    redFlagDetails,
    totalScore,
    percentile,
    tier,
    // WARS scoring (optional)
    warsScore,
    warsLevel,
    warsBreakdown,
  }
}

/**
 * Calculate academic score from GPA and MCAT (0-720 points)
 * Scaled 1.2x from original to allow ~1200 total available points
 */
function calculateAcademicScore(input: ApplicantInput): {
  gpaContribution: number
  mcatContribution: number
  gpaPercentile: number
  mcatPercentile: number
} {
  // Use the higher of cumulative or science GPA (science GPA often weighted more)
  const effectiveGPA = input.scienceGPA
    ? Math.max(input.cumulativeGPA, input.scienceGPA * 0.6 + input.cumulativeGPA * 0.4)
    : input.cumulativeGPA

  // Get acceptance rate for this GPA/MCAT combination as baseline
  const acceptanceRate = getAcceptanceRate(effectiveGPA, input.mcatTotal)
  const applicantPercentile = getApplicantPercentile(effectiveGPA, input.mcatTotal)

  // GPA contribution (0-360 points, scaled 1.2x from original 0-300)
  // Scale: 2.0 GPA = 0, 4.0 GPA = 360
  // Use exponential scaling to reward higher GPAs more
  let gpaContribution: number
  if (effectiveGPA < 2.5) {
    gpaContribution = (effectiveGPA - 2.0) * 24 // 0-12 for 2.0-2.5
  } else if (effectiveGPA < 3.0) {
    gpaContribution = 12 + (effectiveGPA - 2.5) * 48 // 12-36 for 2.5-3.0
  } else if (effectiveGPA < 3.5) {
    gpaContribution = 36 + (effectiveGPA - 3.0) * 120 // 36-96 for 3.0-3.5
  } else if (effectiveGPA < 3.7) {
    gpaContribution = 96 + (effectiveGPA - 3.5) * 240 // 96-144 for 3.5-3.7
  } else if (effectiveGPA < 3.8) {
    gpaContribution = 144 + (effectiveGPA - 3.7) * 480 // 144-192 for 3.7-3.8
  } else if (effectiveGPA < 3.9) {
    gpaContribution = 192 + (effectiveGPA - 3.8) * 720 // 192-264 for 3.8-3.9
  } else {
    gpaContribution = 264 + (effectiveGPA - 3.9) * 960 // 264-360 for 3.9-4.0
  }
  gpaContribution = Math.min(360, Math.max(0, gpaContribution))

  // MCAT contribution (0-360 points, scaled 1.2x from original 0-300)
  // Scale: 472 = 0, 528 = 360
  // Use sigmoid-like scaling centered around 510
  const mcatNormalized = (input.mcatTotal - 472) / (528 - 472) // 0-1
  let mcatContribution: number
  if (input.mcatTotal < 495) {
    mcatContribution = mcatNormalized * 120 // slow growth below 495
  } else if (input.mcatTotal < 505) {
    const basePoints = ((495 - 472) / 56) * 120 // ~49 points at 495
    mcatContribution = basePoints + (input.mcatTotal - 495) * 4.8 // faster growth
  } else if (input.mcatTotal < 515) {
    const basePoints = ((495 - 472) / 56) * 120 + 10 * 4.8 // ~97 points at 505
    mcatContribution = basePoints + (input.mcatTotal - 505) * 9.6 // even faster
  } else if (input.mcatTotal < 520) {
    const basePoints = ((495 - 472) / 56) * 120 + 10 * 4.8 + 10 * 9.6 // ~193 at 515
    mcatContribution = basePoints + (input.mcatTotal - 515) * 18 // premium growth
  } else {
    const basePoints = ((495 - 472) / 56) * 120 + 10 * 4.8 + 10 * 9.6 + 5 * 18 // ~283 at 520
    mcatContribution = basePoints + (input.mcatTotal - 520) * 9.6 // slower at top
  }
  mcatContribution = Math.min(360, Math.max(0, mcatContribution))

  // Calculate percentiles for display
  const gpaPercentile = gpaToPercentile(effectiveGPA)
  const mcatPercentile = mcatToPercentile(input.mcatTotal)

  return {
    gpaContribution: Math.round(gpaContribution),
    mcatContribution: Math.round(mcatContribution),
    gpaPercentile,
    mcatPercentile,
  }
}

/**
 * Calculate experience score (0-330 points)
 * Scaled 1.2x from original to allow ~1200 total available points
 * Teaching/tutoring is now a separate category (0-30 points)
 */
function calculateExperienceScore(input: ApplicantInput): {
  clinicalContribution: number
  researchContribution: number
  volunteerContribution: number
  leadershipContribution: number
  shadowingContribution: number
  teachingContribution: number
} {
  const thresholds = DEFAULT_EXPERIENCE_THRESHOLDS

  // Clinical experience (0-90 points, scaled 1.2x from 75)
  let clinicalContribution: number
  if (input.clinicalHoursTotal < thresholds.clinical.minimum) {
    clinicalContribution = (input.clinicalHoursTotal / thresholds.clinical.minimum) * 24
  } else if (input.clinicalHoursTotal < thresholds.clinical.competitive) {
    clinicalContribution =
      24 +
      ((input.clinicalHoursTotal - thresholds.clinical.minimum) /
        (thresholds.clinical.competitive - thresholds.clinical.minimum)) *
        30
  } else if (input.clinicalHoursTotal < thresholds.clinical.strong) {
    clinicalContribution =
      54 +
      ((input.clinicalHoursTotal - thresholds.clinical.competitive) /
        (thresholds.clinical.strong - thresholds.clinical.competitive)) *
        24
  } else {
    clinicalContribution = 78 + Math.min(12, (input.clinicalHoursTotal - thresholds.clinical.strong) / 100)
  }
  clinicalContribution = Math.min(90, Math.max(0, clinicalContribution))

  // Research experience (0-90 points, scaled 1.2x from 75)
  let researchContribution: number
  if (input.researchHoursTotal === 0) {
    researchContribution = 0
  } else if (input.researchHoursTotal < thresholds.research.competitive) {
    researchContribution = (input.researchHoursTotal / thresholds.research.competitive) * 36
  } else if (input.researchHoursTotal < thresholds.research.strong) {
    researchContribution =
      36 +
      ((input.researchHoursTotal - thresholds.research.competitive) /
        (thresholds.research.strong - thresholds.research.competitive)) *
        24
  } else {
    researchContribution = 60 + Math.min(18, (input.researchHoursTotal - thresholds.research.strong) / 100)
  }

  // Publication bonus (up to +12 points, scaled 1.2x from 10)
  if (input.hasResearchPublications) {
    researchContribution += Math.min(12, 6 + input.publicationCount * 2.4)
  }
  researchContribution = Math.min(90, Math.max(0, researchContribution))

  // Volunteer experience (0-60 points, scaled 1.2x from 50)
  let volunteerContribution: number
  if (input.volunteerHoursNonClinical < thresholds.volunteer.minimum) {
    volunteerContribution = (input.volunteerHoursNonClinical / thresholds.volunteer.minimum) * 18
  } else if (input.volunteerHoursNonClinical < thresholds.volunteer.competitive) {
    volunteerContribution =
      18 +
      ((input.volunteerHoursNonClinical - thresholds.volunteer.minimum) /
        (thresholds.volunteer.competitive - thresholds.volunteer.minimum)) *
        24
  } else {
    volunteerContribution = 42 + Math.min(18, (input.volunteerHoursNonClinical - thresholds.volunteer.competitive) / 50)
  }
  volunteerContribution = Math.min(60, Math.max(0, volunteerContribution))

  // Leadership (0-35 points, scaled ~1.16x from 30)
  // Each significant leadership role worth ~10-12 points, diminishing returns
  let leadershipContribution: number
  if (input.leadershipExperiences === 0) {
    leadershipContribution = 0
  } else if (input.leadershipExperiences === 1) {
    leadershipContribution = 12
  } else if (input.leadershipExperiences === 2) {
    leadershipContribution = 21
  } else if (input.leadershipExperiences === 3) {
    leadershipContribution = 28
  } else {
    leadershipContribution = 28 + Math.min(7, (input.leadershipExperiences - 3) * 2.3)
  }
  leadershipContribution = Math.min(35, leadershipContribution)

  // Shadowing (0-25 points, scaled 1.25x from 20)
  let shadowingContribution: number
  if (input.shadowingHours < thresholds.shadowing.minimum) {
    shadowingContribution = (input.shadowingHours / thresholds.shadowing.minimum) * 12.5
  } else if (input.shadowingHours < thresholds.shadowing.recommended) {
    shadowingContribution =
      12.5 +
      ((input.shadowingHours - thresholds.shadowing.minimum) /
        (thresholds.shadowing.recommended - thresholds.shadowing.minimum)) *
        10
  } else {
    shadowingContribution = 22.5 + Math.min(2.5, (input.shadowingHours - thresholds.shadowing.recommended) / 25)
  }
  shadowingContribution = Math.min(25, Math.max(0, shadowingContribution))

  // Teaching/Tutoring (0-30 points) - NEW CATEGORY
  // Provides points for teaching assistantships, tutoring, mentoring
  let teachingContribution: number
  if (input.teachingHours === 0) {
    teachingContribution = 0
  } else if (input.teachingHours < 25) {
    teachingContribution = (input.teachingHours / 25) * 8 // 0-8 for <25 hours
  } else if (input.teachingHours < 50) {
    teachingContribution = 8 + ((input.teachingHours - 25) / 25) * 7 // 8-15 for 25-50 hours
  } else if (input.teachingHours < 100) {
    teachingContribution = 15 + ((input.teachingHours - 50) / 50) * 8 // 15-23 for 50-100 hours
  } else if (input.teachingHours < 200) {
    teachingContribution = 23 + ((input.teachingHours - 100) / 100) * 5 // 23-28 for 100-200 hours
  } else {
    teachingContribution = 28 + Math.min(2, (input.teachingHours - 200) / 100) // 28-30 for 200+ hours
  }
  teachingContribution = Math.min(30, Math.max(0, teachingContribution))

  return {
    clinicalContribution: Math.round(clinicalContribution),
    researchContribution: Math.round(researchContribution),
    volunteerContribution: Math.round(volunteerContribution),
    leadershipContribution: Math.round(leadershipContribution),
    shadowingContribution: Math.round(shadowingContribution),
    teachingContribution: Math.round(teachingContribution),
  }
}

/**
 * Calculate demographic adjustments (-100 to +150 points)
 */
function calculateDemographicAdjustment(input: ApplicantInput): {
  raceEthnicityAdjustment: number
  firstGenAdjustment: number
  disadvantagedAdjustment: number
  ruralAdjustment: number
} {
  // Race/Ethnicity adjustment based on odds ratios
  // Convert OR to point adjustment: OR of 5 = ~+80 points, OR of 0.85 = ~-15 points
  const raceOR = getRaceEthnicityOddsRatio(input.raceEthnicity)
  let raceEthnicityAdjustment: number
  if (raceOR.oddsRatio >= 1) {
    // Positive adjustment for OR > 1
    // Use log scale: OR of 2 = ~+30, OR of 5 = ~+70, OR of 7 = ~+85
    raceEthnicityAdjustment = Math.log(raceOR.oddsRatio) * 40
  } else {
    // Negative adjustment for OR < 1
    // OR of 0.85 = ~-15 points
    raceEthnicityAdjustment = Math.log(raceOR.oddsRatio) * 100
  }
  raceEthnicityAdjustment = Math.max(-50, Math.min(100, raceEthnicityAdjustment))

  // First-generation bonus (+15 points)
  const firstGenAdjustment = input.isFirstGeneration ? 15 : 0

  // Disadvantaged background bonus (+20 points)
  const disadvantagedAdjustment = input.isDisadvantaged ? 20 : 0

  // Rural background bonus (+15 points)
  const ruralAdjustment = input.isRuralBackground ? 15 : 0

  return {
    raceEthnicityAdjustment: Math.round(raceEthnicityAdjustment),
    firstGenAdjustment,
    disadvantagedAdjustment,
    ruralAdjustment,
  }
}

/**
 * Calculate red flag penalties (0 to -100 points)
 */
function calculateRedFlagPenalty(input: ApplicantInput): {
  institutionalActionPenalty: number
  criminalHistoryPenalty: number
  reapplicantAdjustment: number
  lowExperiencePenalty: number
} {
  // Institutional action is a significant red flag
  const institutionalActionPenalty = input.hasInstitutionalAction ? -40 : 0

  // Criminal history is a major red flag
  const criminalHistoryPenalty = input.hasCriminalHistory ? -30 : 0

  // Reapplicant is slightly negative (but shows persistence)
  const reapplicantAdjustment = input.isReapplicant ? -10 : 0

  // Penalty for very low clinical experience
  let lowExperiencePenalty = 0
  if (input.clinicalHoursTotal < 50) {
    lowExperiencePenalty = -20
  } else if (input.clinicalHoursTotal < 100) {
    lowExperiencePenalty = -10
  }

  return {
    institutionalActionPenalty,
    criminalHistoryPenalty,
    reapplicantAdjustment,
    lowExperiencePenalty,
  }
}

/**
 * Convert GPA to percentile among medical school applicants
 */
function gpaToPercentile(gpa: number): number {
  // Based on AAMC data, median GPA is around 3.6-3.7
  if (gpa < 3.0) return Math.max(0, (gpa - 2.0) * 10)
  if (gpa < 3.3) return 10 + (gpa - 3.0) * 30 // 10-19
  if (gpa < 3.5) return 19 + (gpa - 3.3) * 50 // 19-29
  if (gpa < 3.6) return 29 + (gpa - 3.5) * 80 // 29-37
  if (gpa < 3.7) return 37 + (gpa - 3.6) * 100 // 37-47
  if (gpa < 3.8) return 47 + (gpa - 3.7) * 130 // 47-60
  if (gpa < 3.9) return 60 + (gpa - 3.8) * 200 // 60-80
  return 80 + Math.min(20, (gpa - 3.9) * 200) // 80-100
}

// AAMC official MCAT percentile lookup table (2023-2024 data)
// Source: AAMC MCAT Score Percentile Ranks
const MCAT_PERCENTILES: Record<number, number> = {
  472: 0, 473: 0, 474: 0, 475: 1, 476: 1, 477: 1, 478: 2, 479: 2, 480: 3,
  481: 3, 482: 4, 483: 4, 484: 5, 485: 6, 486: 6, 487: 7, 488: 8, 489: 9,
  490: 10, 491: 12, 492: 13, 493: 15, 494: 16, 495: 18, 496: 20, 497: 22,
  498: 25, 499: 27, 500: 30, 501: 33, 502: 36, 503: 39, 504: 42, 505: 46,
  506: 49, 507: 53, 508: 57, 509: 60, 510: 64, 511: 67, 512: 70, 513: 73,
  514: 76, 515: 79, 516: 82, 517: 85, 518: 88, 519: 91, 520: 93, 521: 95,
  522: 96, 523: 97, 524: 98, 525: 99, 526: 99, 527: 99, 528: 100
}

/**
 * Convert MCAT to percentile among medical school applicants
 * Uses exact AAMC percentile data
 */
function mcatToPercentile(mcat: number): number {
  // Clamp to valid range
  const clampedMcat = Math.max(472, Math.min(528, Math.round(mcat)))
  return MCAT_PERCENTILES[clampedMcat] ?? 0
}

/**
 * Format MCAT percentile for display
 * Returns ">99" for scores 523+ since they're all in the top 1%
 */
export function formatMcatPercentile(mcat: number): string {
  const percentile = mcatToPercentile(mcat)
  if (mcat >= 523) {
    return '>99'
  }
  return `${percentile}`
}

/**
 * Convert applicant score to percentile
 */
function scoreToPercentile(score: number): number {
  // Approximate normal distribution centered around 500
  if (score < 300) return Math.max(0, score / 30)
  if (score < 400) return 10 + (score - 300) / 10
  if (score < 500) return 20 + (score - 400) / 5
  if (score < 600) return 40 + (score - 500) / 5
  if (score < 700) return 60 + (score - 600) / 5
  if (score < 800) return 80 + (score - 700) / 10
  return 90 + Math.min(10, (score - 800) / 20)
}

/**
 * Convert applicant score to tier
 */
function scoreToTier(
  score: number
): 'exceptional' | 'strong' | 'competitive' | 'below-average' | 'low' {
  if (score >= 750) return 'exceptional'
  if (score >= 600) return 'strong'
  if (score >= 450) return 'competitive'
  if (score >= 300) return 'below-average'
  return 'low'
}

/**
 * Get score interpretation text
 */
export function getScoreInterpretation(score: ScoreBreakdown): string {
  const { totalScore, tier, percentile } = score

  const tierDescriptions = {
    exceptional:
      'Your profile is exceptionally strong. You are competitive at the most selective medical schools and have excellent chances across a broad range of programs.',
    strong:
      'Your profile is strong. You are competitive at many medical schools and should have good results with a well-constructed school list.',
    competitive:
      'Your profile is competitive. With a strategic school list focusing on target and safety schools, you have reasonable chances of acceptance.',
    'below-average':
      'Your profile has some areas that could be strengthened. Consider focusing on schools where your profile aligns well with their mission and statistics.',
    low: 'Your profile may benefit from additional preparation before applying. Consider strengthening your academic credentials or gaining more experiences.',
  }

  return `Score: ${totalScore}/1000 (${percentile}th percentile) - ${tier.charAt(0).toUpperCase() + tier.slice(1)}\n\n${tierDescriptions[tier]}`
}
