/**
 * Medical School Data Utilities
 *
 * Functions for loading, filtering, and analyzing medical school data.
 * Based on MSAR (Medical School Admission Requirements) database.
 */

import type { SchoolProfile, StateCode } from '@/types/data'

// Import the JSON data
import schoolsData from '../../../data/schools/md-schools.json'

export interface SchoolMatch {
  school: SchoolProfile
  fitScore: number
  category: 'reach' | 'target' | 'safety'
  reasons: string[]
}

export interface SchoolFilters {
  states?: StateCode[]
  excludeStates?: StateCode[]
  isPublic?: boolean
  hasMDPhD?: boolean
  oosFriendly?: boolean
  minRank?: number
  maxRank?: number
  minMedianMCAT?: number
  maxMedianMCAT?: number
  minMedianGPA?: number
  maxMedianGPA?: number
  missionKeywords?: string[]
  interviewFormat?: ('mmi' | 'traditional' | 'hybrid')[]
}

/**
 * Normalize school data to match SchoolProfile interface
 * Fills in missing optional fields with defaults
 */
function normalizeSchoolData(school: any): SchoolProfile {
  return {
    ...school,
    gpa25thPercentile: school.gpa25thPercentile ?? null,
    gpa75thPercentile: school.gpa75thPercentile ?? null,
    mcat10thPercentile: school.mcat10thPercentile ?? null,
    mcat25thPercentile: school.mcat25thPercentile ?? null,
    mcat75thPercentile: school.mcat75thPercentile ?? null,
    mcat90thPercentile: school.mcat90thPercentile ?? null,
    inStateAcceptanceRate: school.inStateAcceptanceRate ?? null,
    hasMilitaryProgram: school.hasMilitaryProgram ?? false,
    interviewFormat: school.interviewFormat ?? 'unknown',
    usNewsRankPrimaryCare: school.usNewsRankPrimaryCare ?? null,
    dataSource: school.dataSource ?? 'MSAR 2024',
    dataRetrievedAt: school.dataRetrievedAt ?? new Date('2024-01-01').toISOString(),
  } as SchoolProfile
}

/**
 * US territories to exclude (non-continental US)
 */
const EXCLUDED_STATES = ['PR'] // Puerto Rico

/**
 * Get all medical schools (LCME-accredited US MD programs only)
 */
export function getAllSchools(): SchoolProfile[] {
  return (schoolsData.schools as any[])
    .map(normalizeSchoolData)
    .filter((school) => !EXCLUDED_STATES.includes(school.state))
}

/**
 * Get a school by its ID
 */
export function getSchoolById(id: string): SchoolProfile | undefined {
  return getAllSchools().find((school) => school.id === id)
}

/**
 * Get schools by state
 */
export function getSchoolsByState(state: StateCode): SchoolProfile[] {
  return getAllSchools().filter((school) => school.state === state)
}

/**
 * Filter schools based on criteria
 */
export function filterSchools(filters: SchoolFilters): SchoolProfile[] {
  let schools = getAllSchools()

  if (filters.states && filters.states.length > 0) {
    schools = schools.filter((s) => filters.states!.includes(s.state as StateCode))
  }

  if (filters.excludeStates && filters.excludeStates.length > 0) {
    schools = schools.filter((s) => !filters.excludeStates!.includes(s.state as StateCode))
  }

  if (filters.isPublic !== undefined) {
    schools = schools.filter((s) => s.isPublic === filters.isPublic)
  }

  if (filters.hasMDPhD !== undefined) {
    schools = schools.filter((s) => s.hasMDPhD === filters.hasMDPhD)
  }

  if (filters.oosFriendly) {
    schools = schools.filter((s) => s.oosFriendliness === 'friendly' || s.oosFriendliness === 'neutral')
  }

  if (filters.minRank !== undefined) {
    schools = schools.filter((s) => s.usNewsRankResearch === null || s.usNewsRankResearch >= filters.minRank!)
  }

  if (filters.maxRank !== undefined) {
    schools = schools.filter((s) => s.usNewsRankResearch !== null && s.usNewsRankResearch <= filters.maxRank!)
  }

  if (filters.minMedianMCAT !== undefined) {
    schools = schools.filter((s) => s.medianMCAT >= filters.minMedianMCAT!)
  }

  if (filters.maxMedianMCAT !== undefined) {
    schools = schools.filter((s) => s.medianMCAT <= filters.maxMedianMCAT!)
  }

  if (filters.minMedianGPA !== undefined) {
    schools = schools.filter((s) => s.medianGPA >= filters.minMedianGPA!)
  }

  if (filters.maxMedianGPA !== undefined) {
    schools = schools.filter((s) => s.medianGPA <= filters.maxMedianGPA!)
  }

  if (filters.missionKeywords && filters.missionKeywords.length > 0) {
    schools = schools.filter((s) =>
      filters.missionKeywords!.some((kw) => s.missionKeywords.includes(kw))
    )
  }

  if (filters.interviewFormat && filters.interviewFormat.length > 0) {
    schools = schools.filter(
      (s) => s.interviewFormat !== 'unknown' && filters.interviewFormat!.includes(s.interviewFormat as 'mmi' | 'traditional' | 'hybrid')
    )
  }

  return schools
}

/**
 * Calculate how well an applicant fits a school based on stats
 */
export function calculateSchoolFit(
  school: SchoolProfile,
  applicantGPA: number,
  applicantMCAT: number,
  applicantState: StateCode
): {
  category: 'reach' | 'target' | 'safety'
  gpaPercentile: number
  mcatPercentile: number
  isInState: boolean
  stateAdvantage: number
} {
  // Calculate where applicant falls in the school's distribution
  // Using 10th, 25th, 50th (median), 75th, 90th percentiles

  // GPA percentile estimation
  let gpaPercentile: number
  if (school.gpa10thPercentile && applicantGPA < school.gpa10thPercentile) {
    gpaPercentile = 5 + ((applicantGPA - (school.gpa10thPercentile - 0.3)) / 0.3) * 5
  } else if (school.gpa25thPercentile && applicantGPA < school.gpa25thPercentile) {
    gpaPercentile = 10 + ((applicantGPA - school.gpa10thPercentile!) / (school.gpa25thPercentile - school.gpa10thPercentile!)) * 15
  } else if (applicantGPA < school.medianGPA) {
    const low = school.gpa25thPercentile ?? school.gpa10thPercentile ?? school.medianGPA - 0.15
    gpaPercentile = 25 + ((applicantGPA - low) / (school.medianGPA - low)) * 25
  } else if (school.gpa75thPercentile && applicantGPA < school.gpa75thPercentile) {
    gpaPercentile = 50 + ((applicantGPA - school.medianGPA) / (school.gpa75thPercentile - school.medianGPA)) * 25
  } else if (school.gpa90thPercentile && applicantGPA < school.gpa90thPercentile) {
    gpaPercentile = 75 + ((applicantGPA - school.gpa75thPercentile!) / (school.gpa90thPercentile - school.gpa75thPercentile!)) * 15
  } else {
    gpaPercentile = 90 + Math.min(10, (applicantGPA - (school.gpa90thPercentile ?? school.medianGPA + 0.1)) / 0.1 * 10)
  }
  gpaPercentile = Math.max(0, Math.min(100, gpaPercentile))

  // MCAT percentile estimation
  let mcatPercentile: number
  if (school.mcat10thPercentile && applicantMCAT < school.mcat10thPercentile) {
    mcatPercentile = 5 + ((applicantMCAT - (school.mcat10thPercentile - 5)) / 5) * 5
  } else if (school.mcat25thPercentile && applicantMCAT < school.mcat25thPercentile) {
    mcatPercentile = 10 + ((applicantMCAT - school.mcat10thPercentile!) / (school.mcat25thPercentile - school.mcat10thPercentile!)) * 15
  } else if (applicantMCAT < school.medianMCAT) {
    const low = school.mcat25thPercentile ?? school.mcat10thPercentile ?? school.medianMCAT - 3
    mcatPercentile = 25 + ((applicantMCAT - low) / (school.medianMCAT - low)) * 25
  } else if (school.mcat75thPercentile && applicantMCAT < school.mcat75thPercentile) {
    mcatPercentile = 50 + ((applicantMCAT - school.medianMCAT) / (school.mcat75thPercentile - school.medianMCAT)) * 25
  } else if (school.mcat90thPercentile && applicantMCAT < school.mcat90thPercentile) {
    mcatPercentile = 75 + ((applicantMCAT - school.mcat75thPercentile!) / (school.mcat90thPercentile - school.mcat75thPercentile!)) * 15
  } else {
    mcatPercentile = 90 + Math.min(10, (applicantMCAT - (school.mcat90thPercentile ?? school.medianMCAT + 2)) / 2 * 10)
  }
  mcatPercentile = Math.max(0, Math.min(100, mcatPercentile))

  // State advantage
  const isInState = school.state === applicantState
  let stateAdvantage = 1.0
  if (isInState && school.isPublic) {
    // Calculate advantage from in-state vs OOS acceptance rates
    if (school.inStateAcceptanceRate && school.oosAcceptanceRate) {
      stateAdvantage = school.inStateAcceptanceRate / school.oosAcceptanceRate
    } else {
      // Estimate from matriculant percentages
      stateAdvantage = 2.0 + (school.pctInStateMatriculants * 2)
    }
  }

  // Determine category
  const avgPercentile = (gpaPercentile + mcatPercentile) / 2
  let category: 'reach' | 'target' | 'safety'

  if (avgPercentile < 25) {
    category = 'reach'
  } else if (avgPercentile < 60) {
    category = 'target'
  } else {
    category = 'safety'
  }

  // Adjust category for state advantage
  if (isInState && school.oosFriendliness === 'hostile') {
    // Being in-state at a state-focused school is a big advantage
    if (category === 'reach' && avgPercentile > 15) {
      category = 'target'
    }
  } else if (!isInState && school.oosFriendliness === 'hostile') {
    // Being OOS at a state-focused school is a disadvantage
    if (category === 'target') {
      category = 'reach'
    }
  }

  return {
    category,
    gpaPercentile,
    mcatPercentile,
    isInState,
    stateAdvantage,
  }
}

/**
 * Build a school list for an applicant
 */
export function buildSchoolList(
  applicantGPA: number,
  applicantMCAT: number,
  applicantState: StateCode,
  options: {
    targetCount?: number
    includeReach?: boolean
    includeSafety?: boolean
    filters?: SchoolFilters
  } = {}
): SchoolMatch[] {
  const {
    targetCount = 20,
    includeReach = true,
    includeSafety = true,
    filters = {},
  } = options

  let schools = filterSchools(filters)

  const matches: SchoolMatch[] = schools.map((school) => {
    const fit = calculateSchoolFit(school, applicantGPA, applicantMCAT, applicantState)
    const fitScore = (fit.gpaPercentile + fit.mcatPercentile) / 2

    const reasons: string[] = []

    if (fit.isInState) {
      reasons.push('In-state applicant')
    }
    if (fit.gpaPercentile >= 50) {
      reasons.push('GPA at or above median')
    }
    if (fit.mcatPercentile >= 50) {
      reasons.push('MCAT at or above median')
    }
    if (school.oosFriendliness === 'friendly' && !fit.isInState) {
      reasons.push('OOS-friendly school')
    }

    return {
      school,
      fitScore,
      category: fit.category,
      reasons,
    }
  })

  // Sort by fit score descending
  matches.sort((a, b) => b.fitScore - a.fitScore)

  // Filter by category if needed
  let filtered = matches
  if (!includeReach) {
    filtered = filtered.filter((m) => m.category !== 'reach')
  }
  if (!includeSafety) {
    filtered = filtered.filter((m) => m.category !== 'safety')
  }

  // Build balanced list
  const reach = filtered.filter((m) => m.category === 'reach')
  const target = filtered.filter((m) => m.category === 'target')
  const safety = filtered.filter((m) => m.category === 'safety')

  // Aim for roughly 20% reach, 60% target, 20% safety
  const reachCount = Math.min(reach.length, Math.ceil(targetCount * 0.2))
  const safetyCount = Math.min(safety.length, Math.ceil(targetCount * 0.2))
  const targetMatchCount = Math.min(target.length, targetCount - reachCount - safetyCount)

  const finalList: SchoolMatch[] = [
    ...reach.slice(0, reachCount),
    ...target.slice(0, targetMatchCount),
    ...safety.slice(0, safetyCount),
  ]

  return finalList.sort((a, b) => {
    // Sort by category first (reach, target, safety), then by fit score
    const categoryOrder = { reach: 0, target: 1, safety: 2 }
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category]
    }
    return b.fitScore - a.fitScore
  })
}

/**
 * Get schools statistics summary
 */
export function getSchoolsStatistics(): {
  totalSchools: number
  publicSchools: number
  privateSchools: number
  avgMedianGPA: number
  avgMedianMCAT: number
  byOOSFriendliness: Record<string, number>
} {
  const schools = getAllSchools()

  const publicCount = schools.filter((s) => s.isPublic).length
  const avgGPA = schools.reduce((sum, s) => sum + s.medianGPA, 0) / schools.length
  const avgMCAT = schools.reduce((sum, s) => sum + s.medianMCAT, 0) / schools.length

  const byOOS: Record<string, number> = {
    friendly: 0,
    neutral: 0,
    unfriendly: 0,
    hostile: 0,
  }
  for (const school of schools) {
    byOOS[school.oosFriendliness]++
  }

  return {
    totalSchools: schools.length,
    publicSchools: publicCount,
    privateSchools: schools.length - publicCount,
    avgMedianGPA: Math.round(avgGPA * 100) / 100,
    avgMedianMCAT: Math.round(avgMCAT),
    byOOSFriendliness: byOOS,
  }
}

/**
 * Get metadata about the schools data
 */
export function getSchoolsMetadata(): typeof schoolsData.metadata {
  return schoolsData.metadata
}
