/**
 * WedgeDawg Applicant Rating System (WARS) Score Calculator
 *
 * Formula: (Stats*5) + (Research*3) + (Clinical [9,5,-10]) +
 *          (Shadowing [6,-5]) + (Volunteering*2) + (Leadership*2) +
 *          (Misc*3) + [(Undergrad-1)*3] + [(URM-1)*7] + [(Trend-1)*4]
 *
 * Max possible: 121
 * Levels: S (85+), A (80-84), B (75-79), C (68-74), D (60-67), E (<60)
 */

import type { WARSLevel, UndergraduateSchoolTier, GPATrend, MiscellaneousLevel } from '@/types/data'

// =============================================================================
// WARS Input Types
// =============================================================================

export interface WARSInput {
  // Stats (from existing profile)
  gpa: number
  mcat: number

  // Experiences (from existing profile)
  researchLevel: 1 | 2 | 3 | 4 | 5
  clinicalLevel: 1 | 2 | 3
  shadowingLevel: 1 | 2
  volunteeringLevel: 1 | 2 | 3
  leadershipLevel: 1 | 2 | 3

  // New fields
  undergraduateSchoolTier: UndergraduateSchoolTier
  miscellaneousLevel: MiscellaneousLevel
  isURM: boolean
  hasUpwardTrend: boolean
}

export interface WARSResult {
  score: number // 0-121
  level: WARSLevel
  breakdown: {
    stats: number // 0-50
    research: number // 0-15
    clinical: number // -10 to +9
    shadowing: number // -5 to +6
    volunteering: number // 0-6
    leadership: number // 0-6
    miscellaneous: number // 0-12
    undergraduate: number // 0-6
    urm: number // 0-7
    trend: number // 0-4
  }
}

// =============================================================================
// WARS Stats Score Lookup Table
// =============================================================================

/**
 * GPA/MCAT grid for stats score (before multiplying by 5)
 * Based on WedgeDawg's original table
 */
const STATS_SCORE_GRID: Record<string, Record<string, number>> = {
  '3.85+': {
    '521+': 10,
    '518-520': 9,
    '515-517': 8,
    '511-514': 6,
    '507-510': 5,
    '504-506': 5,
    '<504': 4,
  },
  '3.70-3.84': {
    '521+': 9,
    '518-520': 8,
    '515-517': 7,
    '511-514': 6,
    '507-510': 5,
    '504-506': 4,
    '<504': 2,
  },
  '3.55-3.69': {
    '521+': 8,
    '518-520': 7,
    '515-517': 6,
    '511-514': 5,
    '507-510': 4,
    '504-506': 3,
    '<504': 1,
  },
  '3.40-3.54': {
    '521+': 7,
    '518-520': 6,
    '515-517': 5,
    '511-514': 4,
    '507-510': 3,
    '504-506': 2,
    '<504': 1,
  },
  '3.25-3.39': {
    '521+': 6,
    '518-520': 5,
    '515-517': 4,
    '511-514': 3,
    '507-510': 2,
    '504-506': 1,
    '<504': 0,
  },
  '3.00-3.24': {
    '521+': 5,
    '518-520': 3,
    '515-517': 3,
    '511-514': 2,
    '507-510': 1,
    '504-506': 1,
    '<504': 0,
  },
  '<3.00': {
    '521+': 3,
    '518-520': 2,
    '515-517': 2,
    '511-514': 1,
    '507-510': 1,
    '504-506': 0,
    '<504': -1,
  },
}

/**
 * Get GPA bin for stats lookup
 */
function getGPABin(gpa: number): string {
  if (gpa >= 3.85) return '3.85+'
  if (gpa >= 3.70) return '3.70-3.84'
  if (gpa >= 3.55) return '3.55-3.69'
  if (gpa >= 3.40) return '3.40-3.54'
  if (gpa >= 3.25) return '3.25-3.39'
  if (gpa >= 3.00) return '3.00-3.24'
  return '<3.00'
}

/**
 * Get MCAT bin for stats lookup
 */
function getMCATBin(mcat: number): string {
  if (mcat >= 521) return '521+'
  if (mcat >= 518) return '518-520'
  if (mcat >= 515) return '515-517'
  if (mcat >= 511) return '511-514'
  if (mcat >= 507) return '507-510'
  if (mcat >= 504) return '504-506'
  return '<504'
}

/**
 * Calculate stats score (before multiplying by 5)
 */
function calculateStatsScore(gpa: number, mcat: number): number {
  const gpaBin = getGPABin(gpa)
  const mcatBin = getMCATBin(mcat)
  return STATS_SCORE_GRID[gpaBin][mcatBin]
}

// =============================================================================
// Experience Level Scoring
// =============================================================================

/**
 * Research score (0-5, multiplied by 3 in final calc)
 * Level 5: 1000+ hours AND (first-author pub OR high-impact pub OR major conference)
 * Level 4: 500+ hours AND (any publication OR poster OR thesis)
 * Level 3: 200+ hours OR completed project
 * Level 2: <200 hours, limited activity
 * Level 1: No research
 */
function getResearchScore(level: 1 | 2 | 3 | 4 | 5): number {
  return level
}

/**
 * Clinical score (1-3, mapped to specific values)
 * Level 3: 500+ hours sustained clinical experience → 9
 * Level 2: 100-500 hours adequate exposure → 5
 * Level 1: <100 hours or none → -10
 */
function getClinicalScore(level: 1 | 2 | 3): number {
  switch (level) {
    case 3:
      return 9
    case 2:
      return 5
    case 1:
      return -10
  }
}

/**
 * Shadowing score (1-2, mapped to specific values)
 * Level 2: 40+ hours adequate shadowing → 6
 * Level 1: <40 hours → -5
 */
function getShadowingScore(level: 1 | 2): number {
  return level === 2 ? 6 : -5
}

/**
 * Volunteering score (1-3, multiplied by 2 in final calc)
 * Level 3: 300+ hours sustained, diverse volunteering
 * Level 2: 100-300 hours moderate volunteering
 * Level 1: <100 hours
 */
function getVolunteeringScore(level: 1 | 2 | 3): number {
  return level
}

/**
 * Leadership score (1-3, multiplied by 2 in final calc)
 * Level 3: Major leadership role (organization president, sustained teaching)
 * Level 2: Some leadership (officer, TA, tutor)
 * Level 1: Minimal/none
 */
function getLeadershipScore(level: 1 | 2 | 3): number {
  return level
}

/**
 * Miscellaneous score (1-4, multiplied by 3 in final calc)
 * Level 4: Outstanding (Rhodes, Olympics, professional sports, etc.)
 * Level 3: Significant (PhD, JD, Peace Corps, military)
 * Level 2: Moderate (notable hobbies, work experience)
 * Level 1: None/minimal
 */
function getMiscellaneousScore(level: MiscellaneousLevel): number {
  return level
}

/**
 * Undergraduate tier score (formula: (tier - 1) * 3)
 * Tier 1 (HYPSM): (1-1)*3 = 0... wait, that's wrong.
 * Actually WARS formula gives +6 for HYPSM, +3 for Elite, 0 for Standard
 * So it should be: (3 - tier) * 3
 */
function getUndergraduateScore(tier: UndergraduateSchoolTier): number {
  // Tier 1 (HYPSM): (3-1)*3 = 6
  // Tier 2 (Elite): (3-2)*3 = 3
  // Tier 3 (Standard): (3-3)*3 = 0
  return (3 - tier) * 3
}

/**
 * URM bonus score
 * URM (yes): 7 points
 * Non-URM: 0 points
 */
function getURMScore(isURM: boolean): number {
  return isURM ? 7 : 0
}

/**
 * GPA trend score
 * Upward trend: 4 points
 * Flat: 0 points
 * Downward: Could be negative, but WARS typically gives 0
 */
function getTrendScore(hasUpwardTrend: boolean): number {
  return hasUpwardTrend ? 4 : 0
}

// =============================================================================
// Main WARS Calculator
// =============================================================================

/**
 * Calculate WARS score from applicant inputs
 */
export function calculateWARSScore(input: WARSInput): WARSResult {
  // Calculate individual components
  const statsRaw = calculateStatsScore(input.gpa, input.mcat)
  const stats = statsRaw * 5 // Multiply by 5

  const researchRaw = getResearchScore(input.researchLevel)
  const research = researchRaw * 3 // Multiply by 3

  const clinical = getClinicalScore(input.clinicalLevel) // Already final value

  const shadowing = getShadowingScore(input.shadowingLevel) // Already final value

  const volunteeringRaw = getVolunteeringScore(input.volunteeringLevel)
  const volunteering = volunteeringRaw * 2 // Multiply by 2

  const leadershipRaw = getLeadershipScore(input.leadershipLevel)
  const leadership = leadershipRaw * 2 // Multiply by 2

  const miscellaneousRaw = getMiscellaneousScore(input.miscellaneousLevel)
  const miscellaneous = miscellaneousRaw * 3 // Multiply by 3

  const undergraduate = getUndergraduateScore(input.undergraduateSchoolTier)

  const urm = getURMScore(input.isURM)

  const trend = getTrendScore(input.hasUpwardTrend)

  // Sum all components
  const score = stats + research + clinical + shadowing + volunteering + leadership + miscellaneous + undergraduate + urm + trend

  // Determine level
  const level = getWARSLevel(score)

  return {
    score,
    level,
    breakdown: {
      stats,
      research,
      clinical,
      shadowing,
      volunteering,
      leadership,
      miscellaneous,
      undergraduate,
      urm,
      trend,
    },
  }
}

/**
 * Determine WARS level from score
 */
export function getWARSLevel(score: number): WARSLevel {
  if (score >= 85) return 'S'
  if (score >= 80) return 'A'
  if (score >= 75) return 'B'
  if (score >= 68) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

/**
 * Get descriptive label for WARS level
 */
export function getWARSLevelDescription(level: WARSLevel): string {
  switch (level) {
    case 'S':
      return 'Elite Applicant (85+)'
    case 'A':
      return 'Very Strong Applicant (80-84)'
    case 'B':
      return 'Strong Applicant (75-79)'
    case 'C':
      return 'Competitive Applicant (68-74)'
    case 'D':
      return 'Moderate Applicant (60-67)'
    case 'E':
      return 'Developing Applicant (<60)'
  }
}
