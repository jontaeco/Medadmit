/**
 * Demographics and Race/Ethnicity Adjustment Utilities
 *
 * Functions for applying demographic-based adjustments to acceptance probabilities.
 * Based on AAMC Table A-18 and BMC Medical Education 2023 study findings.
 */

import type { RaceEthnicityCategory, TableA18Data, RaceEthnicityStats } from '@/types/data'
import { RACE_ETHNICITY_CATEGORIES } from '@/types/data'

// Import the JSON data
import tableA18Data from '../../../data/aamc/table-a18.json'

export interface DemographicAdjustment {
  raceEthnicity: RaceEthnicityCategory | null
  isFirstGen: boolean
  isDisadvantaged: boolean
  isRural: boolean
}

export interface AdjustmentResult {
  baselineOdds: number
  adjustedOdds: number
  oddsRatio: number
  factors: {
    factor: string
    oddsRatio: number
    source: string
  }[]
  probability: number
  warnings: string[]
}

/**
 * Get the full Table A-18 dataset
 */
export function getTableA18(): TableA18Data {
  return tableA18Data as unknown as TableA18Data
}

/**
 * Get statistics for a specific race/ethnicity category
 */
export function getRaceEthnicityStats(
  category: RaceEthnicityCategory
): RaceEthnicityStats | null {
  const data = getTableA18()
  return data.byRaceEthnicity[category] ?? null
}

/**
 * Get odds ratio for a race/ethnicity category
 * Returns the multiplier applied to baseline acceptance odds
 */
export function getRaceEthnicityOddsRatio(
  category: RaceEthnicityCategory | null
): {
  oddsRatio: number
  ciLower: number
  ciUpper: number
  evidenceLevel: string
  source: string
} {
  if (!category) {
    return {
      oddsRatio: 1.0,
      ciLower: 1.0,
      ciUpper: 1.0,
      evidenceLevel: 'not_specified',
      source: 'none',
    }
  }

  const data = tableA18Data as any
  const factors = data.adjustmentFactors?.factors

  if (factors && factors[category]) {
    const factor = factors[category]
    return {
      oddsRatio: factor.oddsRatio,
      ciLower: factor.ciLower,
      ciUpper: factor.ciUpper,
      evidenceLevel: factor.evidenceLevel,
      source: 'AAMC Table A-18 + BMC 2023',
    }
  }

  // Default if not found
  return {
    oddsRatio: 1.0,
    ciLower: 0.9,
    ciUpper: 1.1,
    evidenceLevel: 'unknown',
    source: 'default',
  }
}

/**
 * Check if a category is considered URM (Underrepresented in Medicine)
 */
export function isURM(category: RaceEthnicityCategory | null): boolean {
  if (!category) return false

  const urmCategories: RaceEthnicityCategory[] = [
    'American Indian or Alaska Native',
    'Black or African American',
    'Hispanic, Latino, or of Spanish Origin',
    'Native Hawaiian or Other Pacific Islander',
  ]

  return urmCategories.includes(category)
}

/**
 * Calculate combined demographic adjustment
 * Applies multiple adjustment factors multiplicatively
 */
export function calculateDemographicAdjustment(
  baselineProbability: number,
  demographics: DemographicAdjustment
): AdjustmentResult {
  // Convert probability to odds
  const baselineOdds = baselineProbability / (1 - baselineProbability)

  let adjustedOdds = baselineOdds
  const factors: { factor: string; oddsRatio: number; source: string }[] = []
  const warnings: string[] = []

  // Race/Ethnicity adjustment
  if (demographics.raceEthnicity) {
    const raceOR = getRaceEthnicityOddsRatio(demographics.raceEthnicity)
    adjustedOdds *= raceOR.oddsRatio
    factors.push({
      factor: `Race/Ethnicity: ${demographics.raceEthnicity}`,
      oddsRatio: raceOR.oddsRatio,
      source: raceOR.source,
    })

    if (raceOR.evidenceLevel === 'weak') {
      warnings.push(
        `Limited sample size for ${demographics.raceEthnicity}; estimate has high uncertainty.`
      )
    }
  }

  // First-generation college student adjustment
  if (demographics.isFirstGen) {
    const firstGenOR = 1.15
    adjustedOdds *= firstGenOR
    factors.push({
      factor: 'First-generation college student',
      oddsRatio: firstGenOR,
      source: 'Holistic review literature (estimated)',
    })
    warnings.push('First-gen advantage varies significantly by school mission.')
  }

  // Socioeconomic disadvantage adjustment
  if (demographics.isDisadvantaged) {
    const sesOR = 1.25
    adjustedOdds *= sesOR
    factors.push({
      factor: 'Disadvantaged/Low SES background',
      oddsRatio: sesOR,
      source: 'Holistic review literature (estimated)',
    })
    warnings.push('SES advantage varies significantly by school mission.')
  }

  // Rural background adjustment
  if (demographics.isRural) {
    const ruralOR = 1.30
    adjustedOdds *= ruralOR
    factors.push({
      factor: 'Rural background',
      oddsRatio: ruralOR,
      source: 'UW WWAMI program studies',
    })
    warnings.push('Rural advantage strongest at schools with rural medicine missions.')
  }

  // Calculate total odds ratio
  const totalOddsRatio = adjustedOdds / baselineOdds

  // Convert back to probability
  let adjustedProbability = adjustedOdds / (1 + adjustedOdds)

  // Cap at reasonable maximum (99%)
  adjustedProbability = Math.min(0.99, adjustedProbability)

  return {
    baselineOdds,
    adjustedOdds,
    oddsRatio: totalOddsRatio,
    factors,
    probability: adjustedProbability,
    warnings,
  }
}

/**
 * Get aggregate statistics for URM vs non-URM applicants
 */
export function getURMStatistics(): {
  urm: { applicants: number; matriculants: number; avgGPA: number; avgMCAT: number }
  nonUrm: { applicants: number; matriculants: number; avgGPA: number; avgMCAT: number }
} {
  const data = getTableA18()

  const urmCategories: RaceEthnicityCategory[] = [
    'American Indian or Alaska Native',
    'Black or African American',
    'Hispanic, Latino, or of Spanish Origin',
    'Native Hawaiian or Other Pacific Islander',
  ]

  let urmApplicants = 0
  let urmMatriculants = 0
  let urmGPASum = 0
  let urmMCATSum = 0

  let nonUrmApplicants = 0
  let nonUrmMatriculants = 0
  let nonUrmGPASum = 0
  let nonUrmMCATSum = 0

  for (const category of RACE_ETHNICITY_CATEGORIES) {
    const stats = data.byRaceEthnicity[category]
    if (!stats) continue

    if (urmCategories.includes(category)) {
      urmApplicants += stats.applicants
      urmMatriculants += stats.matriculants
      urmGPASum += stats.avgGPA * stats.applicants
      urmMCATSum += stats.avgMCAT * stats.applicants
    } else if (category !== 'Unknown') {
      nonUrmApplicants += stats.applicants
      nonUrmMatriculants += stats.matriculants
      nonUrmGPASum += stats.avgGPA * stats.applicants
      nonUrmMCATSum += stats.avgMCAT * stats.applicants
    }
  }

  return {
    urm: {
      applicants: urmApplicants,
      matriculants: urmMatriculants,
      avgGPA: urmApplicants > 0 ? urmGPASum / urmApplicants : 0,
      avgMCAT: urmApplicants > 0 ? Math.round(urmMCATSum / urmApplicants) : 0,
    },
    nonUrm: {
      applicants: nonUrmApplicants,
      matriculants: nonUrmMatriculants,
      avgGPA: nonUrmApplicants > 0 ? nonUrmGPASum / nonUrmApplicants : 0,
      avgMCAT: nonUrmApplicants > 0 ? Math.round(nonUrmMCATSum / nonUrmApplicants) : 0,
    },
  }
}

/**
 * Get all race/ethnicity categories
 */
export function getAllRaceEthnicityCategories(): RaceEthnicityCategory[] {
  return [...RACE_ETHNICITY_CATEGORIES]
}

/**
 * Get metadata about the Table A-18 data source
 */
export function getTableA18Metadata(): TableA18Data['metadata'] {
  return getTableA18().metadata
}
