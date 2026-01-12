/**
 * School List Generator
 *
 * Generates optimized school lists with the right balance of:
 * - Reach schools (low probability but worth applying)
 * - Target schools (moderate probability, core of the list)
 * - Safety schools (high probability for backup)
 *
 * Also handles filtering by state, mission, and other preferences.
 */

import type { ApplicantInput, SchoolList, SchoolProbability } from './types'
import type { StateCode, WARSLevel } from '@/types/data'
import { getAllSchools, filterSchools, type SchoolFilters } from '@/lib/data'
import { calculateAllSchoolProbabilities } from './school-probability'
import {
  runQuickSimulation,
  calculateTheoreticalProbability,
  calculateExpectedAcceptances,
} from './monte-carlo'
import { applicantInputToWARSInput, calculateWARSScore } from './index'

// WWAMI Program - states that share University of Washington School of Medicine
// These states don't have public medical schools but participate in regional programs
const WWAMI_STATES: StateCode[] = ['WA', 'WY', 'AK', 'MT', 'ID']

/**
 * Get WARS tier display name
 */
export function getWARSTierName(tier: number): string {
  switch (tier) {
    case 1:
      return 'TOP'
    case 2:
      return 'HIGH'
    case 3:
      return 'MID'
    case 4:
      return 'LOW'
    case 5:
      return 'STATE'
    case 6:
      return 'LOW YIELD'
    default:
      return 'UNKNOWN'
  }
}

/**
 * Get WARS tier description
 */
export function getWARSTierDescription(tier: number): string {
  switch (tier) {
    case 1:
      return 'Elite schools (Harvard, Stanford, Hopkins, etc.)'
    case 2:
      return 'Highly competitive schools (Michigan, UCLA, Vanderbilt, etc.)'
    case 3:
      return 'Competitive schools (UVA, Ohio State, USC-Keck, etc.)'
    case 4:
      return 'Standard MD programs'
    case 5:
      return 'In-state public schools'
    case 6:
      return 'High-volume private schools (approach with caution)'
    default:
      return ''
  }
}

export interface SchoolListOptions {
  // Target counts
  totalSchools?: number // Default 20-25
  reachCount?: number // Default 4-6
  targetCount?: number // Default 12-15
  safetyCount?: number // Default 4-6

  // WARS-based distribution (overrides reach/target/safety counts if enabled)
  useWARSDistribution?: boolean // Default: true
  warsLevel?: WARSLevel // Auto-calculated if not provided
  tier1Count?: number // TOP schools (override percentage)
  tier2Count?: number // HIGH schools (override percentage)
  tier3Count?: number // MID schools (override percentage)
  tier4Count?: number // LOW schools (override percentage)
  includeLowYield?: boolean // Include tier 6 (LOW_YIELD) schools
  excludeLowYield?: boolean // Explicitly exclude tier 6 schools

  // Filters
  excludeStates?: StateCode[]
  includeStates?: StateCode[] // Only these states
  onlyPublic?: boolean
  onlyPrivate?: boolean
  onlyOOSFriendly?: boolean
  includeMDPhD?: boolean
  excludeMDPhD?: boolean
  missionKeywords?: string[]

  // Preferences
  prioritizeInState?: boolean // Boost in-state schools in ranking
  prioritizeResearch?: boolean // Boost research-focused schools
  prioritizePrimaryCare?: boolean // Boost primary care focused schools
  minimumProbability?: number // Don't include schools below this

  // Budget considerations
  maxTuition?: number
  preferLowerTuition?: boolean
}

const DEFAULT_OPTIONS: SchoolListOptions = {
  totalSchools: 22,
  reachCount: 5,
  targetCount: 12,
  safetyCount: 5,
  minimumProbability: 0.01,
  useWARSDistribution: true, // Enable WARS distribution by default
}

/**
 * WARS Distribution Table
 * Defines school tier percentages and low-yield inclusion based on applicant's WARS level
 */
interface WARSDistribution {
  tier1Pct: number // TOP schools %
  tier2Pct: number // HIGH schools %
  tier3Pct: number // MID schools %
  tier4Pct: number // LOW schools %
  includeLowYield: boolean
  suggestedTotal: number
}

export const WARS_DISTRIBUTIONS: Record<WARSLevel, WARSDistribution> = {
  S: {
    tier1Pct: 0.45,
    tier2Pct: 0.35,
    tier3Pct: 0.15,
    tier4Pct: 0.05,
    includeLowYield: false,
    suggestedTotal: 22,
  },
  A: {
    tier1Pct: 0.30,
    tier2Pct: 0.30,
    tier3Pct: 0.25,
    tier4Pct: 0.15,
    includeLowYield: false,
    suggestedTotal: 27,
  },
  B: {
    tier1Pct: 0.10,
    tier2Pct: 0.20,
    tier3Pct: 0.35,
    tier4Pct: 0.35,
    includeLowYield: false,
    suggestedTotal: 27,
  },
  C: {
    tier1Pct: 0.05,
    tier2Pct: 0.15,
    tier3Pct: 0.25,
    tier4Pct: 0.55,
    includeLowYield: true, // Consider low-yield schools
    suggestedTotal: 32,
  },
  D: {
    tier1Pct: 0.00,
    tier2Pct: 0.05,
    tier3Pct: 0.15,
    tier4Pct: 0.80,
    includeLowYield: true,
    suggestedTotal: 37,
  },
  E: {
    tier1Pct: 0.00,
    tier2Pct: 0.00,
    tier3Pct: 0.00,
    tier4Pct: 1.00,
    includeLowYield: true,
    suggestedTotal: 40,
  },
}

/**
 * Calculate school counts based on WARS distribution
 */
function getWARSSchoolCounts(
  warsLevel: WARSLevel,
  totalSchools: number
): {
  tier1Count: number
  tier2Count: number
  tier3Count: number
  tier4Count: number
  includeLowYield: boolean
} {
  const distribution = WARS_DISTRIBUTIONS[warsLevel]

  const tier1Count = Math.round(totalSchools * distribution.tier1Pct)
  const tier2Count = Math.round(totalSchools * distribution.tier2Pct)
  const tier3Count = Math.round(totalSchools * distribution.tier3Pct)
  const tier4Count = Math.round(totalSchools * distribution.tier4Pct)

  // Adjust to match exact total
  const sum = tier1Count + tier2Count + tier3Count + tier4Count
  let adjustedTier4 = tier4Count
  if (sum < totalSchools) {
    adjustedTier4 += (totalSchools - sum)
  } else if (sum > totalSchools) {
    adjustedTier4 -= (sum - totalSchools)
  }

  return {
    tier1Count,
    tier2Count,
    tier3Count,
    tier4Count: Math.max(0, adjustedTier4),
    includeLowYield: distribution.includeLowYield,
  }
}

/**
 * Generate an optimized school list for an applicant
 */
export function generateSchoolList(
  applicant: ApplicantInput,
  options: SchoolListOptions = {}
): SchoolList {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Calculate WARS level if using WARS distribution
  let warsLevel: WARSLevel | undefined = opts.warsLevel
  let useWARS = opts.useWARSDistribution ?? true

  if (useWARS && !warsLevel) {
    try {
      const warsInput = applicantInputToWARSInput(applicant)
      const warsResult = calculateWARSScore(warsInput)
      warsLevel = warsResult.level
    } catch (error) {
      // If WARS calculation fails, fall back to legacy distribution
      console.warn('WARS calculation failed, using legacy distribution:', error)
      useWARS = false
    }
  }

  // Determine school counts based on WARS distribution or legacy
  let tier1Count: number, tier2Count: number, tier3Count: number, tier4Count: number
  let includeLowYield = opts.includeLowYield ?? false

  if (useWARS && warsLevel) {
    // Use WARS-based distribution
    const totalSchools = opts.totalSchools ?? WARS_DISTRIBUTIONS[warsLevel].suggestedTotal
    const warsCounts = getWARSSchoolCounts(warsLevel, totalSchools)

    tier1Count = opts.tier1Count ?? warsCounts.tier1Count
    tier2Count = opts.tier2Count ?? warsCounts.tier2Count
    tier3Count = opts.tier3Count ?? warsCounts.tier3Count
    tier4Count = opts.tier4Count ?? warsCounts.tier4Count
    includeLowYield = opts.excludeLowYield ? false : (opts.includeLowYield ?? warsCounts.includeLowYield)
  } else {
    // Legacy distribution: convert reach/target/safety to tiers
    // This is a simplified mapping for backward compatibility
    if (options.totalSchools && !options.reachCount && !options.targetCount && !options.safetyCount) {
      const total = options.totalSchools
      // Distribute: ~20% reach, ~55% target, ~25% safety
      opts.reachCount = Math.round(total * 0.20)
      opts.targetCount = Math.round(total * 0.55)
      opts.safetyCount = Math.round(total * 0.25)

      // Adjust to match exact total
      const sum = opts.reachCount + opts.targetCount + opts.safetyCount
      if (sum < total) {
        opts.targetCount += (total - sum)
      } else if (sum > total) {
        opts.targetCount -= (sum - total)
      }
    }

    // Map legacy categories to tiers (approximate)
    tier1Count = Math.round((opts.reachCount ?? 5) * 0.4)
    tier2Count = Math.round((opts.reachCount ?? 5) * 0.6) + Math.round((opts.targetCount ?? 12) * 0.3)
    tier3Count = Math.round((opts.targetCount ?? 12) * 0.5)
    tier4Count = Math.round((opts.targetCount ?? 12) * 0.2) + (opts.safetyCount ?? 5)
  }

  // 1. Build filters from options
  const filters: SchoolFilters = {}
  if (opts.excludeStates) filters.excludeStates = opts.excludeStates
  if (opts.includeStates) filters.states = opts.includeStates
  if (opts.onlyPublic) filters.isPublic = true
  if (opts.onlyPrivate) filters.isPublic = false
  if (opts.onlyOOSFriendly) filters.oosFriendly = true
  if (opts.missionKeywords) filters.missionKeywords = opts.missionKeywords

  // 2. Get filtered schools and calculate probabilities
  let schools = filterSchools(filters)

  // MD-PhD filter
  if (opts.includeMDPhD === false) {
    schools = schools.filter((s) => !s.hasMDPhD)
  }
  if (opts.excludeMDPhD) {
    schools = schools.filter((s) => !s.hasMDPhD)
  }

  // Low-yield filter
  if (opts.excludeLowYield || !includeLowYield) {
    schools = schools.filter((s) => !s.isLowYield)
  }

  // Tuition filter
  if (opts.maxTuition) {
    const isInState = (state: string) => state === applicant.stateOfResidence
    schools = schools.filter((s) =>
      isInState(s.state) ? s.tuitionInState <= opts.maxTuition! : s.tuitionOutOfState <= opts.maxTuition!
    )
  }

  // 3. Calculate probabilities for all schools
  const allProbabilities = calculateAllSchoolProbabilities(applicant, schools)

  // 4. Identify public state schools that should always be included
  const isWwamiState = WWAMI_STATES.includes(applicant.stateOfResidence as StateCode)
  const stateSchoolIds = new Set(
    allProbabilities
      .filter((sp) => {
        // Direct in-state public schools
        if (sp.school.state === applicant.stateOfResidence && sp.school.isPublic) {
          return true
        }
        // WWAMI partnership schools for applicable states
        if (isWwamiState && sp.school.missionKeywords?.includes('wwami')) {
          return true
        }
        return false
      })
      .map((sp) => sp.school.id)
  )

  // 5. Filter by minimum probability BUT exempt state schools
  let candidateSchools = allProbabilities.filter(
    (sp) => sp.probability >= (opts.minimumProbability ?? 0.01) || stateSchoolIds.has(sp.school.id)
  )

  // 6. Apply preference boosts for ranking
  candidateSchools = applyPreferenceBoosts(candidateSchools, applicant, opts)

  // 7. Separate into WARS tiers if using WARS distribution, otherwise use legacy categories
  let allSelected: SchoolProbability[]

  if (useWARS && warsLevel) {
    // WARS tier-based selection
    const tier1Schools = candidateSchools
      .filter((s) => s.school.warsTier === 1)
      .sort((a, b) => {
        const scoreA = (a as any)._rankingScore ?? a.probability
        const scoreB = (b as any)._rankingScore ?? b.probability
        return scoreB - scoreA
      })

    const tier2Schools = candidateSchools
      .filter((s) => s.school.warsTier === 2)
      .sort((a, b) => {
        const scoreA = (a as any)._rankingScore ?? a.probability
        const scoreB = (b as any)._rankingScore ?? b.probability
        return scoreB - scoreA
      })

    const tier3Schools = candidateSchools
      .filter((s) => s.school.warsTier === 3)
      .sort((a, b) => {
        const scoreA = (a as any)._rankingScore ?? a.probability
        const scoreB = (b as any)._rankingScore ?? b.probability
        return scoreB - scoreA
      })

    const tier4Schools = candidateSchools
      .filter((s) => s.school.warsTier === 4)
      .sort((a, b) => {
        const scoreA = (a as any)._rankingScore ?? a.probability
        const scoreB = (b as any)._rankingScore ?? b.probability
        return scoreB - scoreA
      })

    // Select from each tier
    const selectedTier1 = selectBestSchools(tier1Schools, tier1Count, applicant, opts, stateSchoolIds)
    const selectedTier2 = selectBestSchools(tier2Schools, tier2Count, applicant, opts, stateSchoolIds)
    const selectedTier3 = selectBestSchools(tier3Schools, tier3Count, applicant, opts, stateSchoolIds)
    const selectedTier4 = selectBestSchools(tier4Schools, tier4Count, applicant, opts, stateSchoolIds)

    allSelected = [...selectedTier1, ...selectedTier2, ...selectedTier3, ...selectedTier4]

    // If we don't have enough schools, add more from any tier
    const totalRequested = tier1Count + tier2Count + tier3Count + tier4Count
    if (allSelected.length < totalRequested) {
      const selectedIds = new Set(allSelected.map(s => s.school.id))
      const remaining = candidateSchools
        .filter(s => !selectedIds.has(s.school.id))
        .sort((a, b) => {
          const scoreA = (a as any)._rankingScore ?? a.probability
          const scoreB = (b as any)._rankingScore ?? b.probability
          return scoreB - scoreA
        })
      const slotsToFill = totalRequested - allSelected.length
      allSelected = [...allSelected, ...remaining.slice(0, slotsToFill)]
    }
  } else {
    // Legacy category-based selection (reach/target/safety)
    candidateSchools.sort((a, b) => b.probability - a.probability)

    const reaches = candidateSchools.filter((s) => s.category === 'reach')
    const targets = candidateSchools.filter((s) => s.category === 'target')
    const safeties = candidateSchools.filter((s) => s.category === 'safety')

    const totalRequested = opts.reachCount! + opts.targetCount! + opts.safetyCount!

    const selectedReaches = selectBestSchools(reaches, opts.reachCount!, applicant, opts, stateSchoolIds)
    const selectedTargets = selectBestSchools(targets, opts.targetCount!, applicant, opts, stateSchoolIds)
    const selectedSafeties = selectBestSchools(safeties, opts.safetyCount!, applicant, opts, stateSchoolIds)

    allSelected = [...selectedReaches, ...selectedTargets, ...selectedSafeties]

    if (allSelected.length < totalRequested) {
      const selectedIds = new Set(allSelected.map(s => s.school.id))
      const remaining = candidateSchools
        .filter(s => !selectedIds.has(s.school.id))
        .sort((a, b) => {
          const scoreA = (a as any)._rankingScore ?? a.probability
          const scoreB = (b as any)._rankingScore ?? b.probability
          return scoreB - scoreA
        })
      const slotsToFill = totalRequested - allSelected.length
      allSelected = [...allSelected, ...remaining.slice(0, slotsToFill)]
    }
  }

  // Re-categorize all selected schools for proper return
  const finalReaches = allSelected.filter(s => s.category === 'reach')
  const finalTargets = allSelected.filter(s => s.category === 'target')
  const finalSafeties = allSelected.filter(s => s.category === 'safety')

  const simulation = runQuickSimulation(allSelected, 5000)

  const summary = {
    totalSchools: allSelected.length,
    expectedInterviews: simulation.expectedInterviews,
    expectedAcceptances: simulation.expectedAcceptances,
    probabilityOfAtLeastOne: simulation.probabilityOfAtLeastOneAcceptance,
  }

  return {
    reach: finalReaches,
    target: finalTargets,
    safety: finalSafeties,
    summary,
  }
}

/**
 * Apply preference boosts to school rankings
 */
function applyPreferenceBoosts(
  schools: SchoolProbability[],
  applicant: ApplicantInput,
  options: SchoolListOptions
): SchoolProbability[] {
  return schools.map((sp) => {
    let boostFactor = 1.0

    // In-state preference
    if (options.prioritizeInState && sp.fit.isInState) {
      boostFactor *= 1.3
    }

    // Research preference
    if (
      options.prioritizeResearch &&
      sp.school.missionKeywords.includes('research')
    ) {
      boostFactor *= 1.2
    }

    // Primary care preference
    if (
      options.prioritizePrimaryCare &&
      sp.school.missionKeywords.includes('primary-care')
    ) {
      boostFactor *= 1.2
    }

    // Lower tuition preference
    if (options.preferLowerTuition) {
      const tuition = sp.fit.isInState
        ? sp.school.tuitionInState
        : sp.school.tuitionOutOfState
      if (tuition < 40000) {
        boostFactor *= 1.15
      } else if (tuition < 50000) {
        boostFactor *= 1.05
      }
    }

    // Mission alignment boost
    if (sp.fit.missionAlignment.length >= 2) {
      boostFactor *= 1.1
    }

    // Create new object with adjusted probability for ranking (not actual probability)
    return {
      ...sp,
      _rankingScore: sp.probability * boostFactor,
    } as SchoolProbability & { _rankingScore: number }
  })
}

/**
 * Select the best schools from a category
 * State schools are always included first, then remaining slots filled by ranking
 */
function selectBestSchools(
  schools: SchoolProbability[],
  count: number,
  applicant: ApplicantInput,
  options: SchoolListOptions,
  stateSchoolIds: Set<string> = new Set()
): SchoolProbability[] {
  if (schools.length <= count) {
    return schools
  }

  // Separate state schools (always included) from others
  const stateSchools = schools.filter((s) => stateSchoolIds.has(s.school.id))
  const otherSchools = schools.filter((s) => !stateSchoolIds.has(s.school.id))

  // Sort other schools by ranking score if present, otherwise by probability
  const sortedOthers = [...otherSchools].sort((a, b) => {
    const scoreA = (a as any)._rankingScore ?? a.probability
    const scoreB = (b as any)._rankingScore ?? b.probability
    return scoreB - scoreA
  })

  // Always include state schools first, then fill remaining slots with top-ranked others
  // No geographic diversity limits - if user requests 35 schools, give them 35
  const remainingSlots = Math.max(0, count - stateSchools.length)
  return [...stateSchools, ...sortedOthers.slice(0, remainingSlots)]
}

/**
 * Optimize an existing school list
 */
export function optimizeSchoolList(
  currentList: SchoolProbability[],
  applicant: ApplicantInput,
  targetProbability: number = 0.85
): {
  recommendations: string[]
  suggestedAdditions: SchoolProbability[]
  suggestedRemovals: SchoolProbability[]
  optimizedProbability: number
} {
  const currentProbability = calculateTheoreticalProbability(currentList)
  const recommendations: string[] = []
  const suggestedAdditions: SchoolProbability[] = []
  const suggestedRemovals: SchoolProbability[] = []

  // Analyze current list composition
  const reaches = currentList.filter((s) => s.category === 'reach')
  const targets = currentList.filter((s) => s.category === 'target')
  const safeties = currentList.filter((s) => s.category === 'safety')

  // Check if list is reach-heavy
  if (reaches.length > targets.length * 0.5) {
    recommendations.push(
      `Your list has ${reaches.length} reach schools vs ${targets.length} targets. Consider replacing some reaches with targets.`
    )

    // Suggest removing lowest probability reaches
    const sortedReaches = [...reaches].sort((a, b) => a.probability - b.probability)
    suggestedRemovals.push(...sortedReaches.slice(0, Math.min(2, reaches.length - 3)))
  }

  // Check if we need more safeties
  if (safeties.length < 3 && currentProbability < targetProbability) {
    recommendations.push(
      `You only have ${safeties.length} safety schools. Adding more safeties would significantly improve your chances.`
    )

    // Find potential safety schools not in list
    const allProbs = calculateAllSchoolProbabilities(applicant)
    const potentialSafeties = allProbs.filter(
      (sp) =>
        sp.category === 'safety' &&
        !currentList.some((c) => c.school.id === sp.school.id)
    )
    suggestedAdditions.push(...potentialSafeties.slice(0, 3 - safeties.length))
  }

  // Check overall probability
  if (currentProbability < targetProbability) {
    const gap = targetProbability - currentProbability
    recommendations.push(
      `Current probability of at least one acceptance: ${(currentProbability * 100).toFixed(1)}%. Target: ${(targetProbability * 100).toFixed(1)}%.`
    )

    if (gap > 0.2) {
      recommendations.push(
        'Consider adding 3-5 more target or safety schools to reach your target probability.'
      )
    } else if (gap > 0.1) {
      recommendations.push(
        'Consider adding 1-2 more safety schools to reach your target probability.'
      )
    }
  }

  // Calculate optimized probability
  const optimizedList = [
    ...currentList.filter((s) => !suggestedRemovals.includes(s)),
    ...suggestedAdditions,
  ]
  const optimizedProbability = calculateTheoreticalProbability(optimizedList)

  return {
    recommendations,
    suggestedAdditions,
    suggestedRemovals,
    optimizedProbability,
  }
}

/**
 * Get school list summary with key insights
 */
export function getSchoolListSummary(list: SchoolList): string {
  const { reach, target, safety, summary } = list

  let text = `## School List Summary\n\n`
  text += `**Total Schools:** ${summary.totalSchools}\n`
  text += `- Reach: ${reach.length}\n`
  text += `- Target: ${target.length}\n`
  text += `- Safety: ${safety.length}\n\n`

  text += `**Expected Outcomes:**\n`
  text += `- Expected interviews: ${summary.expectedInterviews}\n`
  text += `- Expected acceptances: ${summary.expectedAcceptances}\n`
  text += `- Probability of at least one acceptance: ${(summary.probabilityOfAtLeastOne * 100).toFixed(1)}%\n\n`

  // Assessment
  if (summary.probabilityOfAtLeastOne >= 0.9) {
    text += `**Assessment:** Excellent coverage. Your school list is well-balanced.\n`
  } else if (summary.probabilityOfAtLeastOne >= 0.75) {
    text += `**Assessment:** Good coverage. Consider adding 1-2 more safety schools for extra security.\n`
  } else if (summary.probabilityOfAtLeastOne >= 0.5) {
    text += `**Assessment:** Moderate coverage. Recommend adding more target and safety schools.\n`
  } else {
    text += `**Assessment:** Your list may be too aggressive. Strongly recommend adding more schools at all tiers.\n`
  }

  return text
}

/**
 * Compare two school lists
 */
export function compareSchoolLists(
  list1: SchoolList,
  list2: SchoolList
): {
  comparison: string
  list1Better: boolean
  probabilityDifference: number
} {
  const prob1 = list1.summary.probabilityOfAtLeastOne
  const prob2 = list2.summary.probabilityOfAtLeastOne
  const probabilityDifference = prob1 - prob2

  let comparison = `List 1: ${(prob1 * 100).toFixed(1)}% vs List 2: ${(prob2 * 100).toFixed(1)}%\n`

  if (Math.abs(probabilityDifference) < 0.05) {
    comparison += 'Both lists have similar overall probability of acceptance.'
  } else if (probabilityDifference > 0) {
    comparison += `List 1 has ${(probabilityDifference * 100).toFixed(1)}% higher probability of at least one acceptance.`
  } else {
    comparison += `List 2 has ${(-probabilityDifference * 100).toFixed(1)}% higher probability of at least one acceptance.`
  }

  return {
    comparison,
    list1Better: probabilityDifference > 0,
    probabilityDifference,
  }
}
