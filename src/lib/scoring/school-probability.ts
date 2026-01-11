/**
 * School-Specific Probability Calculator
 *
 * Calculates acceptance probability for each medical school based on:
 * - Baseline probability from Table A-23 (GPA/MCAT grid)
 * - School-specific adjustments (in-state advantage, selectivity)
 * - Demographic adjustments (race/ethnicity, first-gen, etc.)
 * - Mission fit bonuses
 */

import type { ApplicantInput, SchoolProbability } from './types'
import type { SchoolProfile, StateCode } from '@/types/data'
import {
  getAcceptanceRate,
  getAcceptanceRateWithConfidence,
  getAllSchools,
  getRaceEthnicityOddsRatio,
} from '@/lib/data'

/**
 * Calculate acceptance probability for a single school
 *
 * CRITICAL FIX: Use school's actual acceptance rate as baseline, NOT AAMC A-23.
 * A-23 is applicant-level probability (at least one acceptance), not per-school rate.
 */
export function calculateSchoolProbability(
  applicant: ApplicantInput,
  school: SchoolProfile
): SchoolProbability {
  // 1. Start with SCHOOL'S actual acceptance rate as baseline
  const schoolBaselineRate = school.totalAccepted / school.totalApplicants

  // 2. Calculate applicant strength multiplier from AAMC A-23
  // This tells us: "How much better/worse is this applicant than average for their GPA/MCAT?"
  const applicantStrengthMultiplier = calculateApplicantStrengthMultiplier(
    applicant.cumulativeGPA,
    applicant.mcatTotal
  )

  // 3. Calculate school-specific adjustment based on applicant fit to THIS school
  const schoolFitAdjustment = calculateSchoolAdjustment(applicant, school)

  // 4. Calculate state-based adjustment
  const stateAdjustment = calculateStateAdjustment(
    applicant.stateOfResidence,
    school
  )

  // 5. Calculate demographic adjustment
  const demographicAdjustment = calculateDemographicOddsRatio(applicant)

  // 6. Calculate mission fit bonus
  const missionFit = calculateMissionFit(applicant, school)

  // 7. Calculate experience-based adjustment (matches global probability logic)
  const experienceAdjustment = calculateExperienceMultiplier(applicant)

  // Combine all adjustments
  // Start with school's baseline, multiply by applicant strength and all other factors
  const schoolOdds = schoolBaselineRate / (1 - schoolBaselineRate)
  const adjustedOdds =
    schoolOdds *
    applicantStrengthMultiplier *
    schoolFitAdjustment *
    stateAdjustment *
    demographicAdjustment *
    experienceAdjustment *
    missionFit.oddsRatio

  // Convert back to probability
  let probability = adjustedOdds / (1 + adjustedOdds)

  // Clamp to reasonable range
  probability = Math.max(0.001, Math.min(0.95, probability))

  // Calculate confidence interval (±25% of probability for now)
  let probabilityLower = probability * 0.75
  let probabilityUpper = Math.min(0.95, probability * 1.25)
  probabilityLower = Math.max(0.001, probabilityLower)

  // Determine category
  const category = categorizeSchool(probability, school, applicant)

  // Calculate fit metrics
  const fit = calculateFitMetrics(applicant, school)

  return {
    school,
    probability,
    probabilityLower,
    probabilityUpper,
    category,
    factors: {
      baselineProbability: schoolBaselineRate,
      stateAdjustment,
      demographicAdjustment,
      missionFitBonus: missionFit.oddsRatio,
      finalProbability: probability,
    },
    fit: {
      gpaPercentile: fit.gpaPercentile,
      mcatPercentile: fit.mcatPercentile,
      isInState: applicant.stateOfResidence === school.state,
      missionAlignment: missionFit.alignedKeywords,
    },
  }
}

/**
 * Calculate probabilities for all schools
 */
export function calculateAllSchoolProbabilities(
  applicant: ApplicantInput,
  schools?: SchoolProfile[]
): SchoolProbability[] {
  const schoolList = schools ?? getAllSchools()
  return schoolList.map((school) => calculateSchoolProbability(applicant, school))
}

/**
 * Calculate applicant strength multiplier from AAMC A-23
 *
 * This determines: "How much better/worse is this applicant than the AVERAGE applicant
 * in their GPA/MCAT bin?"
 *
 * Returns a multiplier (1.0 = average, >1.0 = above average, <1.0 = below average)
 */
function calculateApplicantStrengthMultiplier(gpa: number, mcat: number): number {
  // Get the AAMC acceptance rate for this GPA/MCAT bin
  const aamcRate = getAcceptanceRate(gpa, mcat)

  // The AAMC rate tells us what % of applicants in this bin get into at least one school
  // We use this to infer relative strength

  // Baseline multiplier from AAMC percentile
  // High acceptance rate bins (e.g., 3.8+ GPA, 515+ MCAT) = strong applicants
  // Low acceptance rate bins (e.g., 3.0 GPA, 500 MCAT) = weaker applicants
  let strengthMultiplier = 1.0

  if (aamcRate >= 0.7) {
    strengthMultiplier = 1.5 // Very strong (>70% of similar applicants get in somewhere)
  } else if (aamcRate >= 0.5) {
    strengthMultiplier = 1.25 // Strong (50-70%)
  } else if (aamcRate >= 0.3) {
    strengthMultiplier = 1.0 // Average (30-50%)
  } else if (aamcRate >= 0.15) {
    strengthMultiplier = 0.8 // Below average (15-30%)
  } else if (aamcRate >= 0.05) {
    strengthMultiplier = 0.6 // Weak (5-15%)
  } else {
    strengthMultiplier = 0.4 // Very weak (<5%)
  }

  return strengthMultiplier
}

/**
 * Calculate experience-based multiplier
 *
 * Matches the logic from prediction.ts adjustGlobalProbability
 * to ensure consistency between global and per-school probabilities
 */
function calculateExperienceMultiplier(applicant: ApplicantInput): number {
  let multiplier = 1.0

  // Clinical experience
  const totalClinical = applicant.clinicalHoursPaid + applicant.clinicalHoursVolunteer
  if (totalClinical < 100) {
    multiplier *= 0.3
  } else if (totalClinical < 500) {
    multiplier *= 0.5
  } else if (totalClinical < 800) {
    multiplier *= 0.75
  } else if (totalClinical < 1200) {
    multiplier *= 1.0
  } else if (totalClinical >= 2000) {
    multiplier *= 1.2
  }

  // Research experience
  if (applicant.researchHoursTotal === 0 && !applicant.hasResearchPublications) {
    multiplier *= 0.6
  } else if (applicant.researchHoursTotal < 200) {
    multiplier *= 0.8
  } else if (applicant.researchHoursTotal >= 1000 || applicant.publicationCount >= 2) {
    multiplier *= 1.3
  } else if (applicant.hasResearchPublications) {
    multiplier *= 1.15
  }

  // Volunteering (non-clinical)
  if (applicant.volunteerHoursNonClinical < 50) {
    multiplier *= 0.85
  } else if (applicant.volunteerHoursNonClinical >= 300) {
    multiplier *= 1.1
  }

  // Shadowing
  if (applicant.shadowingHours < 20) {
    multiplier *= 0.9
  } else if (applicant.shadowingHours >= 100) {
    multiplier *= 1.05
  }

  // Leadership
  if (applicant.leadershipExperiences >= 3) {
    multiplier *= 1.15
  } else if (applicant.leadershipExperiences >= 1) {
    multiplier *= 1.05
  }

  // Red flags
  if (applicant.hasInstitutionalAction) multiplier *= 0.5
  if (applicant.hasCriminalHistory) multiplier *= 0.6

  return multiplier
}

/**
 * Calculate school-specific adjustment based on how applicant compares to school stats
 */
function calculateSchoolAdjustment(
  applicant: ApplicantInput,
  school: SchoolProfile
): number {
  // Compare applicant's GPA to school's distribution
  let gpaOR = 1.0
  const gpaDiff = applicant.cumulativeGPA - school.medianGPA

  if (gpaDiff >= 0.15) {
    gpaOR = 1.3 // Well above median
  } else if (gpaDiff >= 0.05) {
    gpaOR = 1.15 // Above median
  } else if (gpaDiff >= -0.05) {
    gpaOR = 1.0 // At median
  } else if (gpaDiff >= -0.15) {
    gpaOR = 0.75 // Below median
  } else if (gpaDiff >= -0.25) {
    gpaOR = 0.5 // Well below median
  } else {
    gpaOR = 0.25 // Far below median
  }

  // Compare applicant's MCAT to school's distribution
  let mcatOR = 1.0
  const mcatDiff = applicant.mcatTotal - school.medianMCAT

  if (mcatDiff >= 5) {
    mcatOR = 1.4 // Well above median
  } else if (mcatDiff >= 2) {
    mcatOR = 1.2 // Above median
  } else if (mcatDiff >= -2) {
    mcatOR = 1.0 // At median
  } else if (mcatDiff >= -5) {
    mcatOR = 0.7 // Below median
  } else if (mcatDiff >= -10) {
    mcatOR = 0.4 // Well below median
  } else {
    mcatOR = 0.15 // Far below median
  }

  // Combine GPA and MCAT adjustments
  // Weight MCAT slightly more heavily (40/60 split after both are normalized)
  const combinedOR = Math.pow(gpaOR, 0.4) * Math.pow(mcatOR, 0.6)

  // Adjust for school selectivity
  // More selective schools (lower acceptance rates) have lower baseline probability
  // but the relative adjustment should be similar
  const selectivityFactor = school.totalAccepted / school.totalApplicants
  const selectivityAdjustment = selectivityFactor < 0.03 ? 0.8 : selectivityFactor < 0.05 ? 0.9 : 1.0

  return combinedOR * selectivityAdjustment
}

/**
 * Calculate state-based odds ratio
 */
function calculateStateAdjustment(
  applicantState: StateCode,
  school: SchoolProfile
): number {
  const isInState = applicantState === school.state

  if (!isInState) {
    // Out-of-state applicant
    if (school.oosFriendliness === 'hostile') {
      return 0.15 // Very significant disadvantage
    } else if (school.oosFriendliness === 'unfriendly') {
      return 0.4 // Significant disadvantage
    } else if (school.oosFriendliness === 'neutral') {
      return 0.8 // Slight disadvantage
    } else {
      return 1.0 // No disadvantage at OOS-friendly schools
    }
  } else {
    // In-state applicant at public school
    if (school.isPublic) {
      // Calculate advantage from school's in-state rate data
      if (school.inStateAcceptanceRate && school.oosAcceptanceRate) {
        // Use actual rate ratio, capped at reasonable values
        return Math.min(5, school.inStateAcceptanceRate / school.oosAcceptanceRate)
      }
      // Estimate from matriculant percentages
      // Higher in-state matriculant % = stronger in-state preference
      return 1.0 + school.pctInStateMatriculants * 3
    }
    // In-state at private school - slight advantage
    return 1.1
  }
}

/**
 * Calculate demographic odds ratio
 */
function calculateDemographicOddsRatio(applicant: ApplicantInput): number {
  let totalOR = 1.0

  // Race/Ethnicity
  if (applicant.raceEthnicity) {
    const raceOR = getRaceEthnicityOddsRatio(applicant.raceEthnicity)
    totalOR *= raceOR.oddsRatio
  }

  // First-generation
  if (applicant.isFirstGeneration) {
    totalOR *= 1.15
  }

  // Disadvantaged background
  if (applicant.isDisadvantaged) {
    totalOR *= 1.25
  }

  // Rural background (varies by school - handled in mission fit)
  // Base rural adjustment is modest
  if (applicant.isRuralBackground) {
    totalOR *= 1.1
  }

  return totalOR
}

/**
 * Calculate mission fit and identify aligned keywords
 */
function calculateMissionFit(
  applicant: ApplicantInput,
  school: SchoolProfile
): {
  oddsRatio: number
  alignedKeywords: string[]
} {
  const alignedKeywords: string[] = []
  let missionOR = 1.0

  // Check rural mission alignment
  if (
    applicant.isRuralBackground &&
    school.missionKeywords.includes('rural-health')
  ) {
    missionOR *= 1.4
    alignedKeywords.push('rural-health')
  }

  // Check underserved mission alignment
  if (
    applicant.isDisadvantaged &&
    school.missionKeywords.includes('underserved')
  ) {
    missionOR *= 1.2
    alignedKeywords.push('underserved')
  }

  // Check research alignment (based on research hours)
  if (
    applicant.researchHoursTotal >= 500 &&
    school.missionKeywords.includes('research')
  ) {
    missionOR *= 1.15
    alignedKeywords.push('research')
  }

  // Check primary care alignment (based on clinical volunteer hours)
  if (
    applicant.clinicalHoursVolunteer >= 200 &&
    school.missionKeywords.includes('primary-care')
  ) {
    missionOR *= 1.1
    alignedKeywords.push('primary-care')
  }

  // Check diversity alignment for URM applicants
  if (
    applicant.raceEthnicity &&
    ['Black or African American', 'Hispanic, Latino, or of Spanish Origin', 'American Indian or Alaska Native'].includes(
      applicant.raceEthnicity
    ) &&
    school.missionKeywords.includes('diversity')
  ) {
    missionOR *= 1.1
    alignedKeywords.push('diversity')
  }

  // HBCU alignment for Black applicants
  if (
    applicant.raceEthnicity === 'Black or African American' &&
    school.missionKeywords.includes('hbcu')
  ) {
    missionOR *= 1.3
    alignedKeywords.push('hbcu')
  }

  return { oddsRatio: missionOR, alignedKeywords }
}

/**
 * Categorize school as reach, target, or safety
 */
function categorizeSchool(
  probability: number,
  school: SchoolProfile,
  applicant: ApplicantInput
): 'reach' | 'target' | 'safety' {
  // Factor in both probability and percentile placement
  const gpaDiff = applicant.cumulativeGPA - school.medianGPA
  const mcatDiff = applicant.mcatTotal - school.medianMCAT

  // Base categorization on probability
  let baseCategory: 'reach' | 'target' | 'safety'
  if (probability < 0.15) {
    baseCategory = 'reach'
  } else if (probability < 0.40) {
    baseCategory = 'target'
  } else {
    baseCategory = 'safety'
  }

  // Adjust based on stats comparison
  // If stats are well above median, upgrade category
  if (gpaDiff >= 0.1 && mcatDiff >= 3) {
    if (baseCategory === 'reach') return 'target'
    if (baseCategory === 'target') return 'safety'
  }

  // If stats are below median, downgrade category
  if (gpaDiff <= -0.1 && mcatDiff <= -3) {
    if (baseCategory === 'safety') return 'target'
    if (baseCategory === 'target') return 'reach'
  }

  // Special handling for hostile OOS schools
  if (
    school.oosFriendliness === 'hostile' &&
    applicant.stateOfResidence !== school.state
  ) {
    return 'reach' // Always a reach for OOS at hostile schools
  }

  return baseCategory
}

/**
 * Calculate fit metrics (percentiles within school's distribution)
 */
function calculateFitMetrics(
  applicant: ApplicantInput,
  school: SchoolProfile
): {
  gpaPercentile: number
  mcatPercentile: number
} {
  // Estimate percentile within school's accepted class
  // Using linear interpolation between known percentiles

  let gpaPercentile: number
  if (school.gpa10thPercentile && applicant.cumulativeGPA < school.gpa10thPercentile) {
    gpaPercentile = 5 * (applicant.cumulativeGPA / school.gpa10thPercentile)
  } else if (school.gpa25thPercentile && applicant.cumulativeGPA < school.gpa25thPercentile) {
    gpaPercentile =
      10 +
      15 *
        ((applicant.cumulativeGPA - (school.gpa10thPercentile ?? school.medianGPA - 0.2)) /
          ((school.gpa25thPercentile ?? school.medianGPA - 0.1) - (school.gpa10thPercentile ?? school.medianGPA - 0.2)))
  } else if (applicant.cumulativeGPA < school.medianGPA) {
    const low = school.gpa25thPercentile ?? school.medianGPA - 0.1
    gpaPercentile = 25 + 25 * ((applicant.cumulativeGPA - low) / (school.medianGPA - low))
  } else if (school.gpa75thPercentile && applicant.cumulativeGPA < school.gpa75thPercentile) {
    gpaPercentile =
      50 +
      25 *
        ((applicant.cumulativeGPA - school.medianGPA) /
          (school.gpa75thPercentile - school.medianGPA))
  } else if (school.gpa90thPercentile && applicant.cumulativeGPA < school.gpa90thPercentile) {
    gpaPercentile =
      75 +
      15 *
        ((applicant.cumulativeGPA - (school.gpa75thPercentile ?? school.medianGPA + 0.1)) /
          (school.gpa90thPercentile - (school.gpa75thPercentile ?? school.medianGPA + 0.1)))
  } else {
    gpaPercentile = 90 + 10 * Math.min(1, (applicant.cumulativeGPA - (school.gpa90thPercentile ?? school.medianGPA + 0.15)) / 0.1)
  }
  gpaPercentile = Math.max(0, Math.min(100, gpaPercentile))

  // MCAT percentile
  let mcatPercentile: number
  if (school.mcat10thPercentile && applicant.mcatTotal < school.mcat10thPercentile) {
    mcatPercentile = 5 * (applicant.mcatTotal / school.mcat10thPercentile)
  } else if (school.mcat25thPercentile && applicant.mcatTotal < school.mcat25thPercentile) {
    mcatPercentile =
      10 +
      15 *
        ((applicant.mcatTotal - (school.mcat10thPercentile ?? school.medianMCAT - 5)) /
          ((school.mcat25thPercentile ?? school.medianMCAT - 3) - (school.mcat10thPercentile ?? school.medianMCAT - 5)))
  } else if (applicant.mcatTotal < school.medianMCAT) {
    const low = school.mcat25thPercentile ?? school.medianMCAT - 3
    mcatPercentile = 25 + 25 * ((applicant.mcatTotal - low) / (school.medianMCAT - low))
  } else if (school.mcat75thPercentile && applicant.mcatTotal < school.mcat75thPercentile) {
    mcatPercentile =
      50 +
      25 *
        ((applicant.mcatTotal - school.medianMCAT) /
          (school.mcat75thPercentile - school.medianMCAT))
  } else if (school.mcat90thPercentile && applicant.mcatTotal < school.mcat90thPercentile) {
    mcatPercentile =
      75 +
      15 *
        ((applicant.mcatTotal - (school.mcat75thPercentile ?? school.medianMCAT + 3)) /
          (school.mcat90thPercentile - (school.mcat75thPercentile ?? school.medianMCAT + 3)))
  } else {
    mcatPercentile = 90 + 10 * Math.min(1, (applicant.mcatTotal - (school.mcat90thPercentile ?? school.medianMCAT + 5)) / 3)
  }
  mcatPercentile = Math.max(0, Math.min(100, mcatPercentile))

  return {
    gpaPercentile: Math.round(gpaPercentile),
    mcatPercentile: Math.round(mcatPercentile),
  }
}

/**
 * Get probability interpretation text
 */
export function getProbabilityInterpretation(probability: number): string {
  if (probability >= 0.6) {
    return 'Strong chance - Above average probability based on your stats'
  } else if (probability >= 0.4) {
    return 'Good chance - Solid probability with competitive stats'
  } else if (probability >= 0.2) {
    return 'Moderate chance - Realistic target with complete application'
  } else if (probability >= 0.1) {
    return 'Lower chance - Consider as reach school'
  } else if (probability >= 0.05) {
    return 'Long shot - Significant reach based on stats alone'
  } else {
    return 'Very unlikely - Stats significantly below school median'
  }
}
