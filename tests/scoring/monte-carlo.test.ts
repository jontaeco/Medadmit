import { describe, it, expect } from 'vitest'
import {
  runSimulation,
  runQuickSimulation,
  calculateTheoreticalProbability,
  calculateExpectedAcceptances,
  getHistogramData,
} from '@/lib/scoring/monte-carlo'
import type { SchoolProbability } from '@/lib/scoring/types'

// Helper to create mock school probabilities
function createMockSchoolList(
  probabilities: { prob: number; category: 'reach' | 'target' | 'safety' }[]
): SchoolProbability[] {
  return probabilities.map((p, i) => ({
    school: {
      id: `school-${i}`,
      aamcId: `${1000 + i}`,
      name: `Test School ${i}`,
      shortName: `TS${i}`,
      state: 'CA',
      city: 'Test City',
      medianGPA: 3.7,
      medianMCAT: 515,
      gpa10thPercentile: 3.5,
      gpa25thPercentile: 3.6,
      gpa75thPercentile: 3.8,
      gpa90thPercentile: 3.9,
      mcat10thPercentile: 510,
      mcat25thPercentile: 512,
      mcat75thPercentile: 518,
      mcat90thPercentile: 520,
      totalApplicants: 5000,
      totalInterviewed: 500,
      totalAccepted: 200,
      totalMatriculated: 150,
      classSize: 150,
      pctInStateMatriculants: 0.3,
      pctOutOfStateMatriculants: 0.7,
      oosAcceptanceRate: 0.03,
      inStateAcceptanceRate: 0.08,
      oosFriendliness: 'neutral' as const,
      isPublic: false,
      hasMDPhD: true,
      hasMilitaryProgram: false,
      interviewFormat: 'mmi' as const,
      missionKeywords: ['research'],
      tuitionInState: 60000,
      tuitionOutOfState: 60000,
      usNewsRankResearch: 30,
      usNewsRankPrimaryCare: 30,
      dataSource: 'test',
      dataRetrievedAt: '2024-01-01',
    },
    probability: p.prob,
    probabilityLower: p.prob * 0.8,
    probabilityUpper: Math.min(0.95, p.prob * 1.2),
    category: p.category,
    factors: {
      baselineProbability: p.prob,
      stateAdjustment: 1.0,
      demographicAdjustment: 1.0,
      missionFitBonus: 1.0,
      finalProbability: p.prob,
    },
    fit: {
      gpaPercentile: 50,
      mcatPercentile: 50,
      isInState: false,
      missionAlignment: [],
    },
  }))
}

describe('Monte Carlo Simulation', () => {
  it('should run simulation with valid results', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.1, category: 'reach' },
      { prob: 0.3, category: 'target' },
      { prob: 0.5, category: 'safety' },
    ])

    const result = runSimulation({
      iterations: 1000,
      schoolList,
      interviewToAcceptanceRate: 0.45,
    })

    expect(result.expectedInterviews).toBeGreaterThanOrEqual(0)
    expect(result.expectedAcceptances).toBeGreaterThanOrEqual(0)
    expect(result.probabilityOfAtLeastOneAcceptance).toBeGreaterThanOrEqual(0)
    expect(result.probabilityOfAtLeastOneAcceptance).toBeLessThanOrEqual(1)
  })

  it('should return valid distribution statistics', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.2, category: 'target' },
      { prob: 0.3, category: 'target' },
      { prob: 0.4, category: 'safety' },
    ])

    const result = runSimulation({
      iterations: 5000,
      schoolList,
      interviewToAcceptanceRate: 0.45,
    })

    // Percentiles should be non-decreasing
    expect(result.interviewDistribution.percentile10).toBeLessThanOrEqual(
      result.interviewDistribution.percentile25
    )
    expect(result.interviewDistribution.percentile25).toBeLessThanOrEqual(
      result.interviewDistribution.median
    )
    expect(result.interviewDistribution.median).toBeLessThanOrEqual(
      result.interviewDistribution.percentile75
    )
    expect(result.interviewDistribution.percentile75).toBeLessThanOrEqual(
      result.interviewDistribution.percentile90
    )

    // Same for acceptance distribution
    expect(result.acceptanceDistribution.percentile10).toBeLessThanOrEqual(
      result.acceptanceDistribution.percentile25
    )
    expect(result.acceptanceDistribution.percentile25).toBeLessThanOrEqual(
      result.acceptanceDistribution.median
    )
  })

  it('should return valid probability buckets', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.2, category: 'target' },
      { prob: 0.3, category: 'target' },
    ])

    const result = runSimulation({
      iterations: 5000,
      schoolList,
      interviewToAcceptanceRate: 0.45,
    })

    // Probability buckets should sum to 1
    const total =
      result.probabilityBuckets.zeroAcceptances +
      result.probabilityBuckets.oneAcceptance +
      result.probabilityBuckets.twoToThreeAcceptances +
      result.probabilityBuckets.fourPlusAcceptances

    expect(Math.abs(total - 1)).toBeLessThan(0.01)
  })

  it('should give higher expected acceptances for higher probabilities', () => {
    const lowProbList = createMockSchoolList([
      { prob: 0.05, category: 'reach' },
      { prob: 0.05, category: 'reach' },
    ])

    const highProbList = createMockSchoolList([
      { prob: 0.4, category: 'target' },
      { prob: 0.5, category: 'safety' },
    ])

    const lowResult = runSimulation({
      iterations: 3000,
      schoolList: lowProbList,
      interviewToAcceptanceRate: 0.45,
    })

    const highResult = runSimulation({
      iterations: 3000,
      schoolList: highProbList,
      interviewToAcceptanceRate: 0.45,
    })

    expect(highResult.expectedAcceptances).toBeGreaterThan(lowResult.expectedAcceptances)
    expect(highResult.probabilityOfAtLeastOneAcceptance).toBeGreaterThan(
      lowResult.probabilityOfAtLeastOneAcceptance
    )
  })
})

describe('Quick Simulation', () => {
  it('should run quick simulation with fewer iterations', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.2, category: 'target' },
      { prob: 0.3, category: 'target' },
    ])

    const result = runQuickSimulation(schoolList, 500)

    expect(result.iterations).toBe(500)
    expect(result.expectedAcceptances).toBeGreaterThanOrEqual(0)
  })
})

describe('Theoretical Calculations', () => {
  it('should calculate theoretical probability correctly', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.3, category: 'target' },
      { prob: 0.4, category: 'safety' },
    ])

    const theoretical = calculateTheoreticalProbability(schoolList)

    // P(at least one) = 1 - P(none) = 1 - (0.7 * 0.6) = 1 - 0.42 = 0.58
    expect(Math.abs(theoretical - 0.58)).toBeLessThan(0.01)
  })

  it('should calculate expected acceptances correctly', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.3, category: 'target' },
      { prob: 0.4, category: 'safety' },
    ])

    const expected = calculateExpectedAcceptances(schoolList)

    // E[acceptances] = 0.3 + 0.4 = 0.7
    expect(Math.abs(expected - 0.7)).toBeLessThan(0.01)
  })

  it('should give zero probability for empty list', () => {
    const theoretical = calculateTheoreticalProbability([])
    expect(theoretical).toBe(0)
  })

  it('should give probability close to 1 for many high-probability schools', () => {
    const schoolList = createMockSchoolList([
      { prob: 0.5, category: 'safety' },
      { prob: 0.5, category: 'safety' },
      { prob: 0.5, category: 'safety' },
      { prob: 0.5, category: 'safety' },
    ])

    const theoretical = calculateTheoreticalProbability(schoolList)

    // P(at least one) = 1 - (0.5^4) = 1 - 0.0625 = 0.9375
    expect(theoretical).toBeGreaterThan(0.9)
  })
})

describe('Histogram Data', () => {
  it('should generate valid histogram data', () => {
    const counts = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 5]
    const histogram = getHistogramData(counts, 5)

    expect(histogram.length).toBeGreaterThan(0)
    for (const bin of histogram) {
      expect(bin.count).toBeGreaterThanOrEqual(0)
      expect(bin.percentage).toBeGreaterThanOrEqual(0)
      expect(bin.percentage).toBeLessThanOrEqual(100)
    }
  })

  it('should handle empty array', () => {
    const histogram = getHistogramData([])
    expect(histogram).toEqual([])
  })

  it('should have percentages summing to 100', () => {
    const counts = [0, 1, 1, 2, 2, 2, 3, 4]
    const histogram = getHistogramData(counts, 5)

    const totalPercentage = histogram.reduce((sum, bin) => sum + bin.percentage, 0)
    expect(Math.abs(totalPercentage - 100)).toBeLessThan(1)
  })
})
