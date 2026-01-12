/**
 * Monte Carlo Cycle Simulator
 *
 * Simulates thousands of application cycles to estimate:
 * - Expected number of interviews
 * - Expected number of acceptances
 * - Probability of at least one acceptance
 * - Distribution of outcomes
 *
 * Uses the calculated per-school probabilities and accounts for:
 * - Interview rate (secondary to interview conversion)
 * - Interview to acceptance rate
 * - Correlation between outcomes (limited)
 */

import type { SimulationConfig, SimulationResult, SchoolProbability, PerSchoolOutcome, ModalOutcome } from './types'

// Seeded random for reproducibility (optional)
class SeededRandom {
  private seed: number

  constructor(seed?: number) {
    this.seed = seed ?? Date.now()
  }

  next(): number {
    // Simple LCG for reproducible randomness
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }
}

/**
 * Default simulation configuration
 */
export const DEFAULT_SIMULATION_CONFIG: Partial<SimulationConfig> = {
  iterations: 10000,
  interviewToAcceptanceRate: 0.45, // National average ~40-50%
}

/**
 * Run Monte Carlo simulation for application cycle
 * Now tracks per-school outcomes and calculates modal outcome for Sankey visualization
 */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const {
    iterations,
    schoolList,
    interviewToAcceptanceRate,
  } = config

  const rng = new SeededRandom()

  // Arrays to collect results from each iteration
  const interviewCounts: number[] = []
  const acceptanceCounts: number[] = []

  // Track per-school outcomes for Sankey visualization
  const schoolInterviewCounts: Record<string, number> = {}
  const schoolAcceptanceCounts: Record<string, number> = {}

  // Track specific outcome patterns for modal calculation
  // Key = sorted comma-separated list of school IDs that gave acceptances
  const outcomePatterns: Map<string, { count: number, interviews: string[], acceptances: string[] }> = new Map()

  // Initialize per-school counters
  for (const school of schoolList) {
    schoolInterviewCounts[school.school.id] = 0
    schoolAcceptanceCounts[school.school.id] = 0
  }

  for (let i = 0; i < iterations; i++) {
    let interviews = 0
    let acceptances = 0
    const thisIterationInterviews: string[] = []
    const thisIterationAcceptances: string[] = []

    for (const schoolProb of schoolList) {
      const schoolId = schoolProb.school.id

      // Step 1: Did we get an interview?
      // The probability already accounts for getting to interview stage
      // We'll model this as: P(interview) = P(acceptance) / P(acceptance|interview)
      //
      // USE PER-SCHOOL INTERVIEW-TO-ACCEPTANCE RATE when available
      // This is critical - schools have VERY different rates:
      // - Harvard: 26% (interview many, accept few)
      // - Michigan: 82% (interview few, accept most)
      // - NYU: 21% (very selective post-interview)
      const schoolRate = schoolProb.school.interviewToAcceptanceRate ?? interviewToAcceptanceRate
      const interviewProbability = Math.min(
        0.95,
        schoolProb.probability / schoolRate
      )

      const gotInterview = rng.next() < interviewProbability

      if (gotInterview) {
        interviews++
        thisIterationInterviews.push(schoolId)
        schoolInterviewCounts[schoolId]++

        // Step 2: Given interview, did we get accepted?
        // Use the school's actual interview-to-acceptance rate
        const acceptanceGivenInterview = schoolRate

        const gotAccepted = rng.next() < acceptanceGivenInterview

        if (gotAccepted) {
          acceptances++
          thisIterationAcceptances.push(schoolId)
          schoolAcceptanceCounts[schoolId]++
        }
      }
    }

    interviewCounts.push(interviews)
    acceptanceCounts.push(acceptances)

    // Track this outcome pattern for modal calculation
    // Use sorted acceptance list as key for consistent matching
    const patternKey = thisIterationAcceptances.sort().join(',')
    const existing = outcomePatterns.get(patternKey)
    if (existing) {
      existing.count++
    } else {
      outcomePatterns.set(patternKey, {
        count: 1,
        interviews: thisIterationInterviews,
        acceptances: thisIterationAcceptances,
      })
    }
  }

  // Find modal, optimistic, and pessimistic outcomes
  let modalKey = ''
  let maxFrequency = 0
  let optimisticKey = ''
  let maxAcceptances = 0
  let pessimisticKey = ''
  let minAcceptances = Infinity

  for (const [key, data] of outcomePatterns) {
    // Modal: most frequent
    if (data.count > maxFrequency) {
      maxFrequency = data.count
      modalKey = key
    }

    // Optimistic: most acceptances
    const acceptanceCount = data.acceptances.length
    if (acceptanceCount > maxAcceptances) {
      maxAcceptances = acceptanceCount
      optimisticKey = key
    }

    // Pessimistic: least acceptances
    if (acceptanceCount < minAcceptances) {
      minAcceptances = acceptanceCount
      pessimisticKey = key
    }
  }

  const modalPattern = outcomePatterns.get(modalKey)
  const modalAcceptances = modalKey ? modalKey.split(',').filter(Boolean) : []
  const optimisticPattern = outcomePatterns.get(optimisticKey)
  const optimisticAcceptances = optimisticKey ? optimisticKey.split(',').filter(Boolean) : []
  const pessimisticPattern = outcomePatterns.get(pessimisticKey)
  const pessimisticAcceptances = pessimisticKey ? pessimisticKey.split(',').filter(Boolean) : []

  // For modal/optimistic/pessimistic interviews, use schools involved in those outcomes
  const modalInterviews = modalPattern?.interviews || []
  const optimisticInterviews = optimisticPattern?.interviews || []
  const pessimisticInterviews = pessimisticPattern?.interviews || []

  // Build per-school outcomes
  const perSchoolOutcomes: PerSchoolOutcome[] = schoolList.map((sp) => ({
    schoolId: sp.school.id,
    schoolName: sp.school.shortName || sp.school.name,
    category: sp.category,
    interviewRate: schoolInterviewCounts[sp.school.id] / iterations,
    acceptanceRate: schoolAcceptanceCounts[sp.school.id] / iterations,
    modalInterview: modalInterviews.includes(sp.school.id),
    modalAcceptance: modalAcceptances.includes(sp.school.id),
  }))

  // Build modal outcome
  const modalOutcome: ModalOutcome = {
    totalInterviews: modalInterviews.length,
    totalAcceptances: modalAcceptances.length,
    schoolsWithInterview: modalInterviews,
    schoolsWithAcceptance: modalAcceptances,
    frequency: maxFrequency / iterations,
  }

  // Build optimistic outcome
  const optimisticOutcome: ModalOutcome = {
    totalInterviews: optimisticInterviews.length,
    totalAcceptances: optimisticAcceptances.length,
    schoolsWithInterview: optimisticInterviews,
    schoolsWithAcceptance: optimisticAcceptances,
    frequency: (optimisticPattern?.count || 0) / iterations,
  }

  // Build pessimistic outcome
  const pessimisticOutcome: ModalOutcome = {
    totalInterviews: pessimisticInterviews.length,
    totalAcceptances: pessimisticAcceptances.length,
    schoolsWithInterview: pessimisticInterviews,
    schoolsWithAcceptance: pessimisticAcceptances,
    frequency: (pessimisticPattern?.count || 0) / iterations,
  }

  // Calculate statistics (sort for percentile calculations)
  interviewCounts.sort((a, b) => a - b)
  acceptanceCounts.sort((a, b) => a - b)

  const expectedInterviews =
    interviewCounts.reduce((sum, x) => sum + x, 0) / iterations
  const expectedAcceptances =
    acceptanceCounts.reduce((sum, x) => sum + x, 0) / iterations

  const zeroAcceptances = acceptanceCounts.filter((x) => x === 0).length
  const probabilityOfAtLeastOne = 1 - zeroAcceptances / iterations

  // Distribution percentiles
  const interviewDistribution = {
    percentile10: interviewCounts[Math.floor(iterations * 0.1)],
    percentile25: interviewCounts[Math.floor(iterations * 0.25)],
    median: interviewCounts[Math.floor(iterations * 0.5)],
    percentile75: interviewCounts[Math.floor(iterations * 0.75)],
    percentile90: interviewCounts[Math.floor(iterations * 0.9)],
  }

  const acceptanceDistribution = {
    percentile10: acceptanceCounts[Math.floor(iterations * 0.1)],
    percentile25: acceptanceCounts[Math.floor(iterations * 0.25)],
    median: acceptanceCounts[Math.floor(iterations * 0.5)],
    percentile75: acceptanceCounts[Math.floor(iterations * 0.75)],
    percentile90: acceptanceCounts[Math.floor(iterations * 0.9)],
  }

  // Probability buckets
  const oneAcceptance = acceptanceCounts.filter((x) => x === 1).length
  const twoToThree = acceptanceCounts.filter((x) => x >= 2 && x <= 3).length
  const fourPlus = acceptanceCounts.filter((x) => x >= 4).length

  const probabilityBuckets = {
    zeroAcceptances: zeroAcceptances / iterations,
    oneAcceptance: oneAcceptance / iterations,
    twoToThreeAcceptances: twoToThree / iterations,
    fourPlusAcceptances: fourPlus / iterations,
  }

  return {
    expectedInterviews: Math.round(expectedInterviews * 10) / 10,
    expectedAcceptances: Math.round(expectedAcceptances * 10) / 10,
    probabilityOfAtLeastOneAcceptance:
      Math.round(probabilityOfAtLeastOne * 1000) / 1000,
    interviewDistribution,
    acceptanceDistribution,
    probabilityBuckets,
    iterations,
    rawInterviewCounts: interviewCounts,
    rawAcceptanceCounts: acceptanceCounts,
    perSchoolOutcomes,
    modalOutcome,
    optimisticOutcome,
    pessimisticOutcome,
  }
}

/**
 * Run quick simulation with fewer iterations (for real-time updates)
 */
export function runQuickSimulation(
  schoolList: SchoolProbability[],
  iterations: number = 1000
): SimulationResult {
  return runSimulation({
    iterations,
    schoolList,
    interviewToAcceptanceRate: 0.45,
  })
}

/**
 * Calculate theoretical probability of at least one acceptance
 * (without Monte Carlo - faster but less accurate for complex scenarios)
 */
export function calculateTheoreticalProbability(
  schoolList: SchoolProbability[]
): number {
  // P(at least one) = 1 - P(none)
  // P(none) = product of (1 - P_i) for all schools
  let probabilityOfNone = 1.0

  for (const school of schoolList) {
    probabilityOfNone *= 1 - school.probability
  }

  return 1 - probabilityOfNone
}

/**
 * Calculate expected number of acceptances (theoretical)
 */
export function calculateExpectedAcceptances(
  schoolList: SchoolProbability[]
): number {
  // E[acceptances] = sum of all probabilities (linearity of expectation)
  return schoolList.reduce((sum, school) => sum + school.probability, 0)
}

/**
 * Estimate interview count (theoretical)
 * Uses per-school interview-to-acceptance rates when available
 */
export function calculateExpectedInterviews(
  schoolList: SchoolProbability[],
  fallbackRate: number = 0.45
): number {
  // Estimate: each acceptance probability implies interview probability
  // Use per-school rates when available for more accurate estimation
  return schoolList.reduce((sum, school) => {
    const schoolRate = school.school.interviewToAcceptanceRate ?? fallbackRate
    const interviewProb = Math.min(0.95, school.probability / schoolRate)
    return sum + interviewProb
  }, 0)
}

/**
 * Get histogram data for visualization
 */
export function getHistogramData(
  counts: number[],
  binCount: number = 10
): { bin: string; count: number; percentage: number }[] {
  if (counts.length === 0) return []

  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const binWidth = Math.max(1, Math.ceil((max - min + 1) / binCount))

  const bins: { bin: string; count: number; percentage: number }[] = []

  for (let i = 0; i <= max; i += binWidth) {
    const binEnd = Math.min(i + binWidth - 1, max)
    const binLabel = binWidth === 1 ? `${i}` : `${i}-${binEnd}`
    const binCount = counts.filter((x) => x >= i && x <= binEnd).length
    bins.push({
      bin: binLabel,
      count: binCount,
      percentage: (binCount / counts.length) * 100,
    })
  }

  return bins
}

/**
 * Get simulation summary text
 */
export function getSimulationSummary(result: SimulationResult): string {
  const { expectedInterviews, expectedAcceptances, probabilityOfAtLeastOneAcceptance } = result

  const percentChance = Math.round(probabilityOfAtLeastOneAcceptance * 100)

  let summaryText = `Based on ${result.iterations.toLocaleString()} simulated application cycles:\n\n`

  summaryText += `• Expected interviews: ${expectedInterviews} (range: ${result.interviewDistribution.percentile10}-${result.interviewDistribution.percentile90})\n`
  summaryText += `• Expected acceptances: ${expectedAcceptances} (range: ${result.acceptanceDistribution.percentile10}-${result.acceptanceDistribution.percentile90})\n`
  summaryText += `• Chance of at least one acceptance: ${percentChance}%\n\n`

  if (percentChance >= 90) {
    summaryText += 'Excellent outlook - Your school list provides very strong coverage.'
  } else if (percentChance >= 75) {
    summaryText += 'Good outlook - Your school list provides solid coverage. Consider adding 1-2 more safety schools.'
  } else if (percentChance >= 50) {
    summaryText += 'Moderate outlook - Consider adding more target and safety schools to improve your chances.'
  } else if (percentChance >= 25) {
    summaryText += 'Challenging outlook - Your school list is reach-heavy. Strongly recommend adding more target and safety schools.'
  } else {
    summaryText += 'Difficult outlook - Your school list may be too aggressive. Consider adding significantly more schools at all tiers.'
  }

  return summaryText
}

/**
 * Sensitivity analysis - how does adding/removing schools affect outcomes?
 */
export function runSensitivityAnalysis(
  baseSchoolList: SchoolProbability[],
  iterations: number = 5000
): {
  withAllSchools: SimulationResult
  withoutReaches: SimulationResult
  withExtraSafeties: SimulationResult
  recommendations: string[]
} {
  // Base simulation
  const withAllSchools = runSimulation({
    iterations,
    schoolList: baseSchoolList,
    interviewToAcceptanceRate: 0.45,
  })

  // Without reach schools
  const withoutReaches = runSimulation({
    iterations,
    schoolList: baseSchoolList.filter((s) => s.category !== 'reach'),
    interviewToAcceptanceRate: 0.45,
  })

  // With extra safeties (boost safety school probabilities as proxy)
  const boostedList = baseSchoolList.map((s) => ({
    ...s,
    probability: s.category === 'safety' ? Math.min(0.9, s.probability * 1.5) : s.probability,
  }))
  const withExtraSafeties = runSimulation({
    iterations,
    schoolList: boostedList,
    interviewToAcceptanceRate: 0.45,
  })

  // Generate recommendations
  const recommendations: string[] = []

  const reachCount = baseSchoolList.filter((s) => s.category === 'reach').length
  const targetCount = baseSchoolList.filter((s) => s.category === 'target').length
  const safetyCount = baseSchoolList.filter((s) => s.category === 'safety').length

  if (reachCount > targetCount) {
    recommendations.push('Your school list is reach-heavy. Consider adding more target schools.')
  }

  if (safetyCount < 2) {
    recommendations.push('Consider adding more safety schools to ensure at least one acceptance.')
  }

  if (withAllSchools.probabilityOfAtLeastOneAcceptance < 0.8 && safetyCount < targetCount * 0.3) {
    recommendations.push('With your current stats, more safety schools would significantly improve your chances.')
  }

  const reachContribution =
    withAllSchools.expectedAcceptances - withoutReaches.expectedAcceptances
  if (reachContribution < 0.1 && reachCount > 3) {
    recommendations.push('Your reach schools contribute minimally to expected acceptances. Consider reallocating applications to more target schools.')
  }

  return {
    withAllSchools,
    withoutReaches,
    withExtraSafeties,
    recommendations,
  }
}
