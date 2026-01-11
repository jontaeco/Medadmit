/**
 * Probability Calibration Module
 *
 * Calibrates per-school probabilities to produce realistic expected acceptances.
 *
 * Key insight: AAMC Table A-23 shows P(at least 1 acceptance) for ~20 schools,
 * but this includes applicants with poorly constructed school lists.
 * Our model generates well-matched lists, so we expect better outcomes.
 *
 * The calibration:
 * 1. Calculates target E[acceptances] based on applicant strength
 * 2. Scales raw probabilities to match this target
 * 3. Preserves tier hierarchy (reach < target < safety)
 * 4. Accounts for URM boost, in-state advantages, and stellar applicant handling
 */

import type { ApplicantInput, SchoolProbability } from './types'
import { getAcceptanceRate } from '@/lib/data'

// =============================================================================
// Types
// =============================================================================

export type ApplicantStrengthCategory = 'weak' | 'average' | 'strong' | 'exceptional'

export interface CalibrationResult {
  calibrationFactor: number
  tierFactors: {
    reach: number
    target: number
    safety: number
  }
  targetExpectedAcceptances: number
  rawExpectedAcceptances: number
  applicantStrength: ApplicantStrengthCategory
  demographicBoost: number
}

export interface CalibratedSchoolListResult {
  schools: SchoolProbability[]
  calibration: CalibrationResult
  metrics: {
    expectedAcceptances: number
    probabilityOfAtLeastOne: number
    aamcBaseline: number
  }
}

// =============================================================================
// Constants
// =============================================================================

// AAMC data assumes approximately this many schools
const AAMC_BASELINE_SCHOOLS = 20

// Target E[acceptances] by applicant strength for a well-matched 20-school list
// These are HIGHER than raw AAMC would suggest because we assume optimal list construction
const TARGET_EXPECTED_ACCEPTANCES: Record<ApplicantStrengthCategory, { base: number; max: number }> = {
  weak: { base: 0.8, max: 2.0 },      // Honest/pessimistic
  average: { base: 2.0, max: 4.0 },   // Solid chances
  strong: { base: 3.0, max: 5.0 },    // Good outcomes expected
  exceptional: { base: 4.0, max: 7.0 } // Best outcomes
}

// Maximum probability caps by school tier for exceptional applicants
const EXCEPTIONAL_CAPS = {
  tier1: 0.35,  // Top schools like Harvard: max 35%
  tier2: 0.50,  // High tier: max 50%
  tier3: 0.70,  // Mid tier: max 70%
  tier4: 0.85,  // Low tier: max 85%
  inStatePublic: 0.85 // In-state public for stellar applicants
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Determine applicant strength category based on stats and AAMC probability
 */
export function getApplicantStrengthCategory(
  gpa: number,
  mcat: number,
  aamcProbability: number
): ApplicantStrengthCategory {
  // Exceptional: Very high stats AND high AAMC probability
  if (gpa >= 3.85 && mcat >= 518 && aamcProbability >= 0.75) {
    return 'exceptional'
  }

  // Strong: Good stats AND solid AAMC probability
  if (gpa >= 3.7 && mcat >= 512 && aamcProbability >= 0.55) {
    return 'strong'
  }

  // Average: Decent AAMC probability
  if (aamcProbability >= 0.35) {
    return 'average'
  }

  return 'weak'
}

/**
 * Calculate demographic boost multiplier for expected acceptances
 * URM applicants should see +30-50% more expected acceptances
 */
export function calculateDemographicBoost(applicant: ApplicantInput): number {
  let boost = 1.0

  // URM boost (+30-50%)
  if (applicant.raceEthnicity === 'Black or African American') {
    boost *= 1.45
  } else if (applicant.raceEthnicity === 'Hispanic, Latino, or of Spanish Origin') {
    boost *= 1.40
  } else if (applicant.raceEthnicity === 'American Indian or Alaska Native') {
    boost *= 1.50
  }

  // Additional smaller boosts
  if (applicant.isFirstGeneration) boost *= 1.05
  if (applicant.isDisadvantaged) boost *= 1.05
  if (applicant.isRuralBackground) boost *= 1.03

  return boost
}

/**
 * Calculate target expected acceptances for this applicant
 */
export function calculateTargetExpectedAcceptances(
  applicant: ApplicantInput,
  numberOfSchools: number,
  aamcProbability: number
): { target: number; strength: ApplicantStrengthCategory; demographicBoost: number } {
  const strength = getApplicantStrengthCategory(
    applicant.cumulativeGPA,
    applicant.mcatTotal,
    aamcProbability
  )

  const targets = TARGET_EXPECTED_ACCEPTANCES[strength]
  const demographicBoost = calculateDemographicBoost(applicant)

  // Base target for 20 schools
  let baseTarget = targets.base * demographicBoost

  // Adjust for number of schools applied
  // More schools = more acceptances, but with diminishing returns
  // User specified ~1.5x for 35 schools (ratio = 1.75), so we use a curve between linear and sqrt
  const schoolsRatio = numberOfSchools / AAMC_BASELINE_SCHOOLS

  // Use power of 0.7 for diminishing returns (between linear 1.0 and sqrt 0.5)
  const schoolsMultiplier = Math.pow(schoolsRatio, 0.7)

  let target = baseTarget * schoolsMultiplier

  // Apply maximum cap
  const maxTarget = targets.max * demographicBoost * schoolsMultiplier
  target = Math.min(target, maxTarget)

  // For weak applicants, ensure we don't promise too much
  if (strength === 'weak') {
    target = Math.min(target, 2.5)
  }

  return { target, strength, demographicBoost }
}

/**
 * Calculate calibration factor to scale raw probabilities
 */
export function calculateCalibrationFactor(
  rawProbabilities: SchoolProbability[],
  targetExpected: number,
  applicantStrength: ApplicantStrengthCategory
): CalibrationResult {
  const rawExpected = rawProbabilities.reduce((sum, sp) => sum + sp.probability, 0)

  if (rawExpected <= 0) {
    return {
      calibrationFactor: 1.0,
      tierFactors: { reach: 1.0, target: 1.0, safety: 1.0 },
      targetExpectedAcceptances: targetExpected,
      rawExpectedAcceptances: 0,
      applicantStrength,
      demographicBoost: 1.0
    }
  }

  // Base calibration factor
  let k = targetExpected / rawExpected

  // Clamp to reasonable range to avoid extreme distortions
  k = Math.max(0.05, Math.min(5.0, k))

  // Tier-specific factors
  // User specified small spread: reaches only ~1.5x harder than safeties
  // If k < 1 (scaling down), reaches get slightly more reduction
  // If k > 1 (scaling up), safeties get slightly more boost
  const tierFactors = {
    reach: k * 0.92,   // Reaches slightly harder
    target: k * 1.0,   // Targets as calculated
    safety: k * 1.08   // Safeties slightly more reliable
  }

  return {
    calibrationFactor: k,
    tierFactors,
    targetExpectedAcceptances: targetExpected,
    rawExpectedAcceptances: rawExpected,
    applicantStrength,
    demographicBoost: 1.0
  }
}

/**
 * Apply calibration to a single probability
 * Uses odds-based scaling to preserve relative ordering
 */
export function applyCalibration(
  rawProbability: number,
  factor: number,
  options?: {
    minFloor?: number
    maxCap?: number
  }
): number {
  if (rawProbability <= 0) return 0
  if (rawProbability >= 1) return 0.95

  // Convert to odds, scale, convert back
  const odds = rawProbability / (1 - rawProbability)
  const scaledOdds = odds * factor
  let calibratedProbability = scaledOdds / (1 + scaledOdds)

  // Apply floor and cap
  const minFloor = options?.minFloor ?? 0.001
  const maxCap = options?.maxCap ?? 0.90

  return Math.max(minFloor, Math.min(maxCap, calibratedProbability))
}

/**
 * Apply special handling for in-state public schools
 * Stellar applicants at their state school should have very high probability
 */
function getInStatePublicFloor(
  applicant: ApplicantInput,
  school: SchoolProbability['school'],
  applicantStrength: ApplicantStrengthCategory
): number {
  const isInState = applicant.stateOfResidence === school.state
  const isPublic = school.isPublic

  if (!isInState || !isPublic) return 0

  // Base floor for in-state public
  switch (applicantStrength) {
    case 'exceptional':
      return 0.70  // 70% floor for stellar at in-state public
    case 'strong':
      return 0.45  // 45% floor
    case 'average':
      return 0.25  // 25% floor
    case 'weak':
      return 0.10  // 10% floor even for weak
    default:
      return 0
  }
}

/**
 * Get maximum probability cap for a school based on tier
 */
function getSchoolCap(
  school: SchoolProbability['school'],
  applicantStrength: ApplicantStrengthCategory
): number {
  // Only exceptional applicants get boosted caps
  if (applicantStrength !== 'exceptional') {
    return 0.90
  }

  const tier = school.warsTier ?? 3

  switch (tier) {
    case 1: return EXCEPTIONAL_CAPS.tier1  // 35%
    case 2: return EXCEPTIONAL_CAPS.tier2  // 50%
    case 3: return EXCEPTIONAL_CAPS.tier3  // 70%
    default: return EXCEPTIONAL_CAPS.tier4 // 85%
  }
}

/**
 * Master calibration function
 * Calibrates an entire school list to produce realistic expected acceptances
 */
export function calibrateSchoolList(
  applicant: ApplicantInput,
  rawSchoolList: SchoolProbability[]
): CalibratedSchoolListResult {
  // 1. Get AAMC baseline probability
  const aamcProbability = getAcceptanceRate(
    applicant.cumulativeGPA,
    applicant.mcatTotal
  )

  // 2. Calculate target expected acceptances
  const { target, strength, demographicBoost } = calculateTargetExpectedAcceptances(
    applicant,
    rawSchoolList.length,
    aamcProbability
  )

  // 3. Calculate calibration factor
  const calibration = calculateCalibrationFactor(rawSchoolList, target, strength)
  calibration.demographicBoost = demographicBoost

  // 4. Apply calibration to each school
  const calibratedSchools = rawSchoolList.map(sp => {
    const tierFactor = calibration.tierFactors[sp.category]

    // Get in-state public floor
    const inStateFloor = getInStatePublicFloor(applicant, sp.school, strength)

    // Get school-specific cap
    const schoolCap = getSchoolCap(sp.school, strength)

    // Apply calibration with floor and cap
    let calibratedProb = applyCalibration(sp.probability, tierFactor, {
      minFloor: inStateFloor || 0.001,
      maxCap: schoolCap
    })

    // Ensure in-state floor is respected
    if (inStateFloor > 0) {
      calibratedProb = Math.max(inStateFloor, calibratedProb)
    }

    // Recalculate confidence intervals
    const ciWidth = calibratedProb * 0.25
    const probabilityLower = Math.max(0.001, calibratedProb - ciWidth)
    const probabilityUpper = Math.min(0.95, calibratedProb + ciWidth)

    return {
      ...sp,
      probability: calibratedProb,
      probabilityLower,
      probabilityUpper,
      factors: {
        ...sp.factors,
        calibrationFactor: tierFactor,
        rawProbability: sp.probability,
        finalProbability: calibratedProb
      }
    }
  })

  // 5. Calculate final metrics
  const expectedAcceptances = calibratedSchools.reduce(
    (sum, sp) => sum + sp.probability,
    0
  )

  const probabilityOfAtLeastOne = 1 - calibratedSchools.reduce(
    (product, sp) => product * (1 - sp.probability),
    1.0
  )

  return {
    schools: calibratedSchools,
    calibration,
    metrics: {
      expectedAcceptances,
      probabilityOfAtLeastOne,
      aamcBaseline: aamcProbability
    }
  }
}

/**
 * Get a summary of the calibration for debugging/display
 */
export function getCalibrationSummary(result: CalibratedSchoolListResult): string {
  const { calibration, metrics } = result

  return `Calibration Summary:
- Applicant Strength: ${calibration.applicantStrength}
- Demographic Boost: ${(calibration.demographicBoost * 100 - 100).toFixed(0)}%
- Raw E[acceptances]: ${calibration.rawExpectedAcceptances.toFixed(2)}
- Target E[acceptances]: ${calibration.targetExpectedAcceptances.toFixed(2)}
- Final E[acceptances]: ${metrics.expectedAcceptances.toFixed(2)}
- Calibration Factor: ${calibration.calibrationFactor.toFixed(3)}
- P(at least 1): ${(metrics.probabilityOfAtLeastOne * 100).toFixed(1)}%
- AAMC Baseline: ${(metrics.aamcBaseline * 100).toFixed(1)}%`
}
