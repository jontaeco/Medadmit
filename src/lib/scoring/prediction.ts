/**
 * Full Prediction Engine
 *
 * Combines all scoring components to generate a complete prediction:
 * - Applicant score (0-1000)
 * - School-specific probabilities
 * - Optimized school list
 * - Monte Carlo cycle simulation
 */

import type {
  ApplicantInput,
  PredictionResult,
  ScoreBreakdown,
  SchoolList,
  SimulationResult,
} from './types'
import { calculateApplicantScore, getScoreInterpretation } from './applicant-score'
import { calculateAllSchoolProbabilities } from './school-probability'
import { generateSchoolList, type SchoolListOptions } from './school-list'
import { runSimulation, getSimulationSummary } from './monte-carlo'
import { calibrateSchoolList, getCalibrationSummary } from './calibration'
import { getAcceptanceRate } from '@/lib/data'

const MODEL_VERSION = '1.0.0'
const DATA_VERSION = '2024.1.0'

/**
 * Generate a complete prediction for an applicant
 */
export function generatePrediction(
  applicant: ApplicantInput,
  schoolListOptions?: SchoolListOptions
): PredictionResult {
  const warnings: string[] = []
  const caveats: string[] = []

  // 1. Calculate applicant score
  const applicantScore = calculateApplicantScore(applicant)

  // Add warnings based on score components
  if (applicantScore.redFlagDetails.institutionalActionPenalty < 0) {
    warnings.push(
      'Institutional action on record may require explanation in applications.'
    )
  }
  if (applicantScore.redFlagDetails.lowExperiencePenalty < 0) {
    warnings.push(
      'Clinical experience is below typical accepted applicant levels.'
    )
  }
  if (applicantScore.experienceDetails.researchContribution < 20) {
    caveats.push(
      'Research experience is limited. This may affect competitiveness at research-focused schools.'
    )
  }

  // 2. Calculate global acceptance probability
  const baseAcceptanceRate = getAcceptanceRate(
    applicant.cumulativeGPA,
    applicant.mcatTotal
  )

  // Adjust global probability based on demographics
  const globalAcceptanceProbability = adjustGlobalProbability(
    baseAcceptanceRate,
    applicant
  )

  // Calculate confidence range (using score as rough guide)
  const scoreRatio = applicantScore.totalScore / 1000
  const globalProbabilityRange = {
    lower: Math.max(0.01, globalAcceptanceProbability * (0.7 + scoreRatio * 0.1)),
    upper: Math.min(0.95, globalAcceptanceProbability * (1.1 + scoreRatio * 0.2)),
  }

  // 3. Generate school list (raw probabilities)
  const rawSchoolList = generateSchoolList(applicant, schoolListOptions)

  // 4. Apply calibration to produce realistic expected acceptances
  const allRawSchools = [
    ...rawSchoolList.reach,
    ...rawSchoolList.target,
    ...rawSchoolList.safety,
  ]
  const calibrationResult = calibrateSchoolList(applicant, allRawSchools)

  // Log calibration for debugging (can be removed in production)
  console.log('[Prediction] Calibration applied:')
  console.log(getCalibrationSummary(calibrationResult))

  // Rebuild school list with calibrated probabilities
  const calibratedSchools = calibrationResult.schools
  const schoolList = {
    reach: calibratedSchools.filter(s => s.category === 'reach'),
    target: calibratedSchools.filter(s => s.category === 'target'),
    safety: calibratedSchools.filter(s => s.category === 'safety'),
    summary: {
      totalSchools: calibratedSchools.length,
      expectedInterviews: calibrationResult.metrics.expectedAcceptances / 0.45, // Approximate
      expectedAcceptances: calibrationResult.metrics.expectedAcceptances,
      probabilityOfAtLeastOne: calibrationResult.metrics.probabilityOfAtLeastOne,
    }
  }

  // Add caveats based on school list
  if (schoolList.safety.length < 3) {
    caveats.push(
      'Your school list has limited safety schools. Consider adding more.'
    )
  }
  if (schoolList.summary.probabilityOfAtLeastOne < 0.7) {
    warnings.push(
      'Your school list has lower than recommended coverage. Review the recommendations.'
    )
  }

  // 5. Run full simulation with CALIBRATED probabilities
  const simulation = runSimulation({
    iterations: 10000,
    schoolList: calibratedSchools,
    interviewToAcceptanceRate: 0.45,
  })

  // 6. Add standard caveats
  caveats.push(
    'Predictions are based on historical data and statistical models. Individual outcomes may vary.'
  )
  caveats.push(
    'Holistic review factors (essays, letters, interviews) are not fully captured in this model.'
  )
  if (applicant.isReapplicant) {
    caveats.push(
      'Reapplicant status can work in your favor with demonstrated improvement and growth.'
    )
  }

  return {
    applicantScore,
    globalAcceptanceProbability,
    globalProbabilityRange,
    schoolList,
    simulation,
    computedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    dataVersion: DATA_VERSION,
    warnings,
    caveats,
  }
}

/**
 * Adjust global probability based on demographic factors AND experiences
 *
 * IMPORTANT: The AAMC table baseline assumes AVERAGE experiences for each GPA/MCAT bin.
 * We must adjust down for deficient experiences and up for exceptional ones.
 */
function adjustGlobalProbability(
  baseRate: number,
  applicant: ApplicantInput
): number {
  let odds = baseRate / (1 - baseRate)

  // EXPERIENCE ADJUSTMENTS (CRITICAL!)
  // AAMC table assumes ~1000 clinical hours, ~500 research hours for average applicant

  // Clinical experience (paid + volunteer)
  const totalClinical = applicant.clinicalHoursPaid + applicant.clinicalHoursVolunteer
  if (totalClinical < 100) {
    odds *= 0.3  // Devastating penalty for <100 hours
  } else if (totalClinical < 500) {
    odds *= 0.5  // Major penalty for <500 hours
  } else if (totalClinical < 800) {
    odds *= 0.75  // Moderate penalty for below average
  } else if (totalClinical < 1200) {
    odds *= 1.0  // Average range
  } else if (totalClinical >= 2000) {
    odds *= 1.2  // Exceptional clinical experience
  }

  // Research experience
  if (applicant.researchHoursTotal === 0 && !applicant.hasResearchPublications) {
    odds *= 0.6  // Significant penalty for zero research
  } else if (applicant.researchHoursTotal < 200) {
    odds *= 0.8  // Moderate penalty for minimal research
  } else if (applicant.researchHoursTotal >= 1000 || applicant.publicationCount >= 2) {
    odds *= 1.3  // Boost for strong research
  } else if (applicant.hasResearchPublications) {
    odds *= 1.15  // Modest boost for publications
  }

  // Volunteering (non-clinical)
  if (applicant.volunteerHoursNonClinical < 50) {
    odds *= 0.85  // Penalty for minimal volunteering
  } else if (applicant.volunteerHoursNonClinical >= 300) {
    odds *= 1.1  // Boost for strong volunteering
  }

  // Shadowing (less critical but still important)
  if (applicant.shadowingHours < 20) {
    odds *= 0.9  // Minor penalty for insufficient shadowing
  } else if (applicant.shadowingHours >= 100) {
    odds *= 1.05  // Minor boost for extensive shadowing
  }

  // Leadership
  if (applicant.leadershipExperiences >= 3) {
    odds *= 1.15  // Strong leadership boost
  } else if (applicant.leadershipExperiences >= 1) {
    odds *= 1.05  // Modest leadership boost
  }

  // DEMOGRAPHIC ADJUSTMENTS
  if (applicant.raceEthnicity === 'Black or African American') {
    odds *= 5.0
  } else if (applicant.raceEthnicity === 'Hispanic, Latino, or of Spanish Origin') {
    odds *= 3.5
  } else if (applicant.raceEthnicity === 'American Indian or Alaska Native') {
    odds *= 5.5
  } else if (applicant.raceEthnicity === 'Asian') {
    odds *= 0.9
  }

  if (applicant.isFirstGeneration) odds *= 1.1
  if (applicant.isDisadvantaged) odds *= 1.15
  if (applicant.isRuralBackground) odds *= 1.1

  // RED FLAG PENALTIES
  if (applicant.hasInstitutionalAction) odds *= 0.5
  if (applicant.hasCriminalHistory) odds *= 0.6

  // Convert back to probability
  let probability = odds / (1 + odds)

  // Clamp to reasonable range
  return Math.max(0.01, Math.min(0.95, probability))
}

/**
 * Generate a prediction summary report
 */
export function generatePredictionReport(result: PredictionResult): string {
  const { applicantScore, globalAcceptanceProbability, schoolList, simulation, warnings, caveats } = result

  let report = `# MedAdmit Prediction Report\n\n`
  report += `Generated: ${new Date(result.computedAt).toLocaleDateString()}\n`
  report += `Model Version: ${result.modelVersion}\n\n`

  // Applicant Score
  report += `## Applicant Score: ${applicantScore.totalScore}/1000\n\n`
  report += getScoreInterpretation(applicantScore) + '\n\n'

  report += `### Score Breakdown\n`
  report += `- Academic: ${applicantScore.academicScore}/600\n`
  report += `  - GPA: ${applicantScore.academicDetails.gpaContribution}/300 (${applicantScore.academicDetails.gpaPercentile}th percentile)\n`
  report += `  - MCAT: ${applicantScore.academicDetails.mcatContribution}/300 (${applicantScore.academicDetails.mcatPercentile}th percentile)\n`
  report += `- Experiences: ${applicantScore.experienceScore}/250\n`
  report += `- Demographic Factors: ${applicantScore.demographicAdjustment >= 0 ? '+' : ''}${applicantScore.demographicAdjustment}\n`
  if (applicantScore.redFlagPenalty < 0) {
    report += `- Adjustments: ${applicantScore.redFlagPenalty}\n`
  }
  report += '\n'

  // Global Probability
  report += `## Overall Acceptance Probability\n\n`
  report += `**${(globalAcceptanceProbability * 100).toFixed(1)}%**`
  report += ` (range: ${(result.globalProbabilityRange.lower * 100).toFixed(1)}% - ${(result.globalProbabilityRange.upper * 100).toFixed(1)}%)\n\n`

  // School List Summary
  report += `## School List\n\n`
  report += `Total: ${schoolList.summary.totalSchools} schools\n`
  report += `- Reach: ${schoolList.reach.length}\n`
  report += `- Target: ${schoolList.target.length}\n`
  report += `- Safety: ${schoolList.safety.length}\n\n`

  // Simulation Results
  report += `## Cycle Simulation Results\n\n`
  report += getSimulationSummary(simulation) + '\n'

  // Top School Picks
  report += `## Top School Recommendations\n\n`

  report += `### Reach Schools\n`
  for (const school of schoolList.reach.slice(0, 5)) {
    report += `- **${school.school.name}** - ${(school.probability * 100).toFixed(1)}% probability\n`
  }
  report += '\n'

  report += `### Target Schools\n`
  for (const school of schoolList.target.slice(0, 5)) {
    report += `- **${school.school.name}** - ${(school.probability * 100).toFixed(1)}% probability\n`
  }
  report += '\n'

  report += `### Safety Schools\n`
  for (const school of schoolList.safety.slice(0, 5)) {
    report += `- **${school.school.name}** - ${(school.probability * 100).toFixed(1)}% probability\n`
  }
  report += '\n'

  // Warnings and Caveats
  if (warnings.length > 0) {
    report += `## Important Notes\n\n`
    for (const warning of warnings) {
      report += `⚠️ ${warning}\n`
    }
    report += '\n'
  }

  report += `## Caveats\n\n`
  for (const caveat of caveats) {
    report += `- ${caveat}\n`
  }
  report += '\n'

  report += `---\n`
  report += `*This prediction is based on AAMC data and statistical models. `
  report += `Individual outcomes depend on many factors not captured here, including essays, letters of recommendation, interview performance, and holistic review.*\n`

  return report
}

/**
 * Quick prediction (without full simulation) for real-time updates
 */
export function generateQuickPrediction(applicant: ApplicantInput): {
  score: number
  tier: string
  globalProbability: number
  expectedAcceptances: number
} {
  const applicantScore = calculateApplicantScore(applicant)
  const baseRate = getAcceptanceRate(applicant.cumulativeGPA, applicant.mcatTotal)
  const globalProbability = adjustGlobalProbability(baseRate, applicant)

  // Quick estimate of expected acceptances based on score
  const expectedAcceptances =
    applicantScore.totalScore >= 700
      ? 3 + (applicantScore.totalScore - 700) / 100
      : applicantScore.totalScore >= 500
        ? 1.5 + (applicantScore.totalScore - 500) / 133
        : applicantScore.totalScore >= 300
          ? 0.5 + (applicantScore.totalScore - 300) / 400
          : 0.1

  return {
    score: applicantScore.totalScore,
    tier: applicantScore.tier,
    globalProbability,
    expectedAcceptances: Math.round(expectedAcceptances * 10) / 10,
  }
}
