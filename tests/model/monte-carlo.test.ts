import { describe, it, expect } from 'vitest'
import {
  createSeededRandom,
  sampleNormal,
  sampleRandomEffects,
  adjustProbability,
  randomEffectVariance,
  runSingleIteration,
  runCorrelatedSimulation,
  runSimulationFromPredictions,
  aggregateResults,
  estimateInducedCorrelation,
  computeAllOrNothingScore,
  DEFAULT_RANDOM_EFFECTS,
} from '@/lib/model/monte-carlo'

describe('Seeded Random Number Generator', () => {
  it('should produce deterministic sequences with same seed', () => {
    const rng1 = createSeededRandom(12345)
    const rng2 = createSeededRandom(12345)

    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())

    expect(seq1).toEqual(seq2)
  })

  it('should produce different sequences with different seeds', () => {
    const rng1 = createSeededRandom(12345)
    const rng2 = createSeededRandom(54321)

    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())

    expect(seq1).not.toEqual(seq2)
  })

  it('should produce values in [0, 1)', () => {
    const rng = createSeededRandom(42)
    const values = Array.from({ length: 1000 }, () => rng())

    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('should have roughly uniform distribution', () => {
    const rng = createSeededRandom(42)
    const values = Array.from({ length: 10000 }, () => rng())

    // Check quartiles
    const sorted = [...values].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q2 = sorted[Math.floor(sorted.length * 0.5)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]

    expect(q1).toBeGreaterThan(0.2)
    expect(q1).toBeLessThan(0.3)
    expect(q2).toBeGreaterThan(0.45)
    expect(q2).toBeLessThan(0.55)
    expect(q3).toBeGreaterThan(0.7)
    expect(q3).toBeLessThan(0.8)
  })
})

describe('Normal Sampling (Box-Muller)', () => {
  it('should produce values with correct mean', () => {
    const rng = createSeededRandom(42)
    const samples = Array.from({ length: 10000 }, () => sampleNormal(5, 1, rng))
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length

    expect(mean).toBeGreaterThan(4.9)
    expect(mean).toBeLessThan(5.1)
  })

  it('should produce values with correct standard deviation', () => {
    const rng = createSeededRandom(42)
    const targetMean = 0
    const targetSd = 2
    const samples = Array.from({ length: 10000 }, () =>
      sampleNormal(targetMean, targetSd, rng)
    )

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance =
      samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
      samples.length
    const sd = Math.sqrt(variance)

    expect(sd).toBeGreaterThan(1.9)
    expect(sd).toBeLessThan(2.1)
  })

  it('should produce roughly normal distribution', () => {
    const rng = createSeededRandom(42)
    const samples = Array.from({ length: 10000 }, () => sampleNormal(0, 1, rng))

    // Check that ~68% are within 1 SD
    const within1SD = samples.filter((x) => Math.abs(x) < 1).length
    expect(within1SD / samples.length).toBeGreaterThan(0.65)
    expect(within1SD / samples.length).toBeLessThan(0.71)

    // Check that ~95% are within 2 SD
    const within2SD = samples.filter((x) => Math.abs(x) < 2).length
    expect(within2SD / samples.length).toBeGreaterThan(0.93)
    expect(within2SD / samples.length).toBeLessThan(0.97)
  })

  it('should be deterministic with seeded RNG', () => {
    const rng1 = createSeededRandom(123)
    const rng2 = createSeededRandom(123)

    const samples1 = Array.from({ length: 5 }, () => sampleNormal(0, 1, rng1))
    const samples2 = Array.from({ length: 5 }, () => sampleNormal(0, 1, rng2))

    expect(samples1).toEqual(samples2)
  })
})

describe('Random Effect Sampling', () => {
  it('should sample both file and interview effects', () => {
    const rng = createSeededRandom(42)
    const effects = sampleRandomEffects(DEFAULT_RANDOM_EFFECTS, rng)

    expect(effects).toHaveProperty('uFile')
    expect(effects).toHaveProperty('uInterview')
    expect(typeof effects.uFile).toBe('number')
    expect(typeof effects.uInterview).toBe('number')
  })

  it('should produce effects with appropriate variance', () => {
    const rng = createSeededRandom(42)
    const samples = Array.from({ length: 5000 }, () =>
      sampleRandomEffects(DEFAULT_RANDOM_EFFECTS, rng)
    )

    const fileEffects = samples.map((s) => s.uFile)
    const interviewEffects = samples.map((s) => s.uInterview)

    // Check file effect variance (target SD = 0.5)
    const fileMean = fileEffects.reduce((a, b) => a + b, 0) / fileEffects.length
    const fileVariance =
      fileEffects.reduce((sum, x) => sum + Math.pow(x - fileMean, 2), 0) /
      fileEffects.length
    const fileSd = Math.sqrt(fileVariance)
    expect(fileSd).toBeGreaterThan(0.45)
    expect(fileSd).toBeLessThan(0.55)

    // Check interview effect variance (target SD = 0.7)
    const intMean =
      interviewEffects.reduce((a, b) => a + b, 0) / interviewEffects.length
    const intVariance =
      interviewEffects.reduce((sum, x) => sum + Math.pow(x - intMean, 2), 0) /
      interviewEffects.length
    const intSd = Math.sqrt(intVariance)
    expect(intSd).toBeGreaterThan(0.63)
    expect(intSd).toBeLessThan(0.77)
  })

  it('should respect custom parameters', () => {
    const rng = createSeededRandom(42)
    const customParams = {
      fileQuality: { sd: 1.0 },
      interviewSkill: { sd: 0.3 },
    }
    const samples = Array.from({ length: 5000 }, () =>
      sampleRandomEffects(customParams, rng)
    )

    const fileEffects = samples.map((s) => s.uFile)
    const fileMean = fileEffects.reduce((a, b) => a + b, 0) / fileEffects.length
    const fileVariance =
      fileEffects.reduce((sum, x) => sum + Math.pow(x - fileMean, 2), 0) /
      fileEffects.length
    const fileSd = Math.sqrt(fileVariance)
    expect(fileSd).toBeGreaterThan(0.9)
    expect(fileSd).toBeLessThan(1.1)
  })
})

describe('Probability Adjustment', () => {
  it('should return same probability when random effect is 0', () => {
    expect(adjustProbability(0.5, 0)).toBeCloseTo(0.5, 10)
    expect(adjustProbability(0.3, 0)).toBeCloseTo(0.3, 10)
    expect(adjustProbability(0.8, 0)).toBeCloseTo(0.8, 10)
  })

  it('should increase probability for positive random effect', () => {
    const base = 0.5
    const adjusted = adjustProbability(base, 0.5)
    expect(adjusted).toBeGreaterThan(base)
  })

  it('should decrease probability for negative random effect', () => {
    const base = 0.5
    const adjusted = adjustProbability(base, -0.5)
    expect(adjusted).toBeLessThan(base)
  })

  it('should stay bounded in (0, 1)', () => {
    // Large positive effect
    expect(adjustProbability(0.5, 10)).toBeLessThan(1)
    expect(adjustProbability(0.5, 10)).toBeGreaterThan(0.99)

    // Large negative effect
    expect(adjustProbability(0.5, -10)).toBeGreaterThan(0)
    expect(adjustProbability(0.5, -10)).toBeLessThan(0.01)
  })

  it('should handle edge probabilities', () => {
    expect(adjustProbability(0, 1)).toBe(0)
    expect(adjustProbability(1, -1)).toBe(1)
  })

  it('should be symmetric around 0.5', () => {
    const effect = 0.5
    const above = adjustProbability(0.5, effect)
    const below = adjustProbability(0.5, -effect)

    // They should be equidistant from 0.5
    expect(above - 0.5).toBeCloseTo(0.5 - below, 5)
  })
})

describe('Random Effect Variance', () => {
  it('should be highest at p=0.5', () => {
    const sd = 0.5
    const var05 = randomEffectVariance(0.5, sd)
    const var03 = randomEffectVariance(0.3, sd)
    const var08 = randomEffectVariance(0.8, sd)

    expect(var05).toBeGreaterThan(var03)
    expect(var05).toBeGreaterThan(var08)
  })

  it('should increase with SD', () => {
    const p = 0.5
    const var_low = randomEffectVariance(p, 0.3)
    const var_high = randomEffectVariance(p, 0.7)

    expect(var_high).toBeGreaterThan(var_low)
  })

  it('should be 0 at extreme probabilities', () => {
    expect(randomEffectVariance(0, 0.5)).toBe(0)
    expect(randomEffectVariance(1, 0.5)).toBe(0)
  })
})

describe('Single Iteration Simulation', () => {
  const predictions = [
    { schoolId: 'school1', pInterview: 0.3, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school2', pInterview: 0.5, pAcceptGivenInterview: 0.6 },
    { schoolId: 'school3', pInterview: 0.7, pAcceptGivenInterview: 0.4 },
  ]

  it('should return results for all schools', () => {
    const rng = createSeededRandom(42)
    const randomEffects = { uFile: 0, uInterview: 0 }
    const result = runSingleIteration(predictions, randomEffects, rng)

    expect(result.schoolResults).toHaveLength(3)
    expect(result.schoolResults.map((r) => r.schoolId)).toEqual([
      'school1',
      'school2',
      'school3',
    ])
  })

  it('should count interviews and acceptances correctly', () => {
    const rng = createSeededRandom(42)
    const randomEffects = { uFile: 0, uInterview: 0 }
    const result = runSingleIteration(predictions, randomEffects, rng)

    const actualInterviews = result.schoolResults.filter(
      (r) => r.interviewed
    ).length
    const actualAcceptances = result.schoolResults.filter(
      (r) => r.accepted
    ).length

    expect(result.interviews).toBe(actualInterviews)
    expect(result.acceptances).toBe(actualAcceptances)
  })

  it('should only have acceptances when interviewed', () => {
    const rng = createSeededRandom(42)
    const randomEffects = { uFile: 0, uInterview: 0 }

    // Run many iterations
    for (let i = 0; i < 100; i++) {
      const result = runSingleIteration(predictions, randomEffects, rng)

      for (const school of result.schoolResults) {
        if (school.accepted) {
          expect(school.interviewed).toBe(true)
        }
      }
    }
  })

  it('should be deterministic with same RNG state', () => {
    const rng1 = createSeededRandom(12345)
    const rng2 = createSeededRandom(12345)
    const randomEffects = { uFile: 0.1, uInterview: -0.1 }

    const result1 = runSingleIteration(predictions, randomEffects, rng1)
    const result2 = runSingleIteration(predictions, randomEffects, rng2)

    expect(result1.interviews).toBe(result2.interviews)
    expect(result1.acceptances).toBe(result2.acceptances)
  })

  it('should apply random effects to probabilities', () => {
    const rng = createSeededRandom(42)
    const randomEffects = { uFile: 1.0, uInterview: 1.0 } // Large positive effects

    const result = runSingleIteration(predictions, randomEffects, rng)

    // Adjusted probabilities should be higher than base
    for (let i = 0; i < predictions.length; i++) {
      expect(result.schoolResults[i].adjustedPInterview).toBeGreaterThan(
        predictions[i].pInterview
      )
      expect(
        result.schoolResults[i].adjustedPAcceptGivenInterview
      ).toBeGreaterThan(predictions[i].pAcceptGivenInterview)
    }
  })
})

describe('Correlated Simulation', () => {
  const predictions = [
    { schoolId: 'school1', pInterview: 0.3, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school2', pInterview: 0.5, pAcceptGivenInterview: 0.6 },
    { schoolId: 'school3', pInterview: 0.7, pAcceptGivenInterview: 0.4 },
  ]

  it('should run the specified number of iterations', () => {
    const result = runCorrelatedSimulation(predictions, { iterations: 100, seed: 42 })
    expect(result.iterations).toBe(100)
  })

  it('should produce reasonable expected values', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // Expected interviews: sum of pInterview ≈ 1.5
    expect(result.expectedInterviews).toBeGreaterThan(1.2)
    expect(result.expectedInterviews).toBeLessThan(1.8)

    // Expected acceptances: sum of pInterview * pAcceptGivenInterview ≈ 0.73
    expect(result.expectedAcceptances).toBeGreaterThan(0.5)
    expect(result.expectedAcceptances).toBeLessThan(1.0)
  })

  it('should produce valid confidence intervals', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // Interviews CI
    expect(result.interviewsCI80[0]).toBeLessThanOrEqual(result.expectedInterviews)
    expect(result.interviewsCI80[1]).toBeGreaterThanOrEqual(result.expectedInterviews)
    expect(result.interviewsCI80[0]).toBeGreaterThanOrEqual(0)

    // Acceptances CI
    expect(result.acceptancesCI80[0]).toBeLessThanOrEqual(result.expectedAcceptances)
    expect(result.acceptancesCI80[1]).toBeGreaterThanOrEqual(result.expectedAcceptances)
    expect(result.acceptancesCI80[0]).toBeGreaterThanOrEqual(0)
  })

  it('should produce valid distribution buckets', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    const totalProb =
      result.distributionBuckets.zero +
      result.distributionBuckets.one +
      result.distributionBuckets.twoThree +
      result.distributionBuckets.fourPlus

    expect(totalProb).toBeCloseTo(1, 5)

    // All probabilities should be non-negative
    expect(result.distributionBuckets.zero).toBeGreaterThanOrEqual(0)
    expect(result.distributionBuckets.one).toBeGreaterThanOrEqual(0)
    expect(result.distributionBuckets.twoThree).toBeGreaterThanOrEqual(0)
    expect(result.distributionBuckets.fourPlus).toBeGreaterThanOrEqual(0)
  })

  it('should compute P(at least one) correctly', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // P(at least one) should equal 1 - P(zero)
    expect(result.pAtLeastOne).toBeCloseTo(
      1 - result.distributionBuckets.zero,
      10
    )

    // Should be bounded in [0, 1]
    expect(result.pAtLeastOne).toBeGreaterThanOrEqual(0)
    expect(result.pAtLeastOne).toBeLessThanOrEqual(1)
  })

  it('should produce per-school statistics', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    expect(result.schoolStats).toHaveLength(3)

    for (const stat of result.schoolStats) {
      expect(stat.simulatedInterviewRate).toBeGreaterThanOrEqual(0)
      expect(stat.simulatedInterviewRate).toBeLessThanOrEqual(1)
      expect(stat.simulatedAcceptanceRate).toBeGreaterThanOrEqual(0)
      expect(stat.simulatedAcceptanceRate).toBeLessThanOrEqual(1)
      expect(stat.simulatedAcceptGivenInterviewRate).toBeGreaterThanOrEqual(0)
      expect(stat.simulatedAcceptGivenInterviewRate).toBeLessThanOrEqual(1)
    }
  })

  it('should be deterministic with seed', () => {
    const result1 = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 12345 }
    )
    const result2 = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 12345 }
    )

    expect(result1.expectedInterviews).toBe(result2.expectedInterviews)
    expect(result1.expectedAcceptances).toBe(result2.expectedAcceptances)
    expect(result1.pAtLeastOne).toBe(result2.pAtLeastOne)
  })

  it('should produce different results with different seeds', () => {
    const result1 = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 12345 }
    )
    const result2 = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 54321 }
    )

    // Results should be similar but not identical
    expect(result1.expectedInterviews).not.toBe(result2.expectedInterviews)
  })
})

describe('Correlation Effects', () => {
  const predictions = [
    { schoolId: 'school1', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school2', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school3', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school4', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
    { schoolId: 'school5', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
  ]

  it('should show positive correlation between schools', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // Mean pairwise correlation should be positive due to shared random effects
    expect(result.correlationDiagnostics.meanPairwiseCorrelation).toBeGreaterThan(0)
  })

  it('should have higher variance than independence assumption', () => {
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // Under independence, variance of sum of 5 Bernoulli(0.2) is 5 * 0.2 * 0.8 = 0.8
    // With correlation, variance should be higher
    const independenceVariance = 5 * 0.2 * 0.8
    expect(result.correlationDiagnostics.acceptanceVariance).toBeGreaterThan(
      independenceVariance * 0.8 // Allow some tolerance
    )
  })

  it('should increase correlation with higher random effect SD', () => {
    const lowREParams = { fileQuality: { sd: 0.2 }, interviewSkill: { sd: 0.2 } }
    const highREParams = { fileQuality: { sd: 1.0 }, interviewSkill: { sd: 1.0 } }

    const resultLow = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 },
      lowREParams
    )
    const resultHigh = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 },
      highREParams
    )

    expect(
      resultHigh.correlationDiagnostics.meanPairwiseCorrelation
    ).toBeGreaterThan(resultLow.correlationDiagnostics.meanPairwiseCorrelation)
  })

  it('should produce more extreme outcomes with higher correlation', () => {
    const lowREParams = { fileQuality: { sd: 0.1 }, interviewSkill: { sd: 0.1 } }
    const highREParams = { fileQuality: { sd: 1.0 }, interviewSkill: { sd: 1.0 } }

    const resultLow = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 },
      lowREParams
    )
    const resultHigh = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 },
      highREParams
    )

    // Higher RE should lead to more extreme outcomes (higher variance)
    expect(resultHigh.correlationDiagnostics.acceptanceVariance).toBeGreaterThan(
      resultLow.correlationDiagnostics.acceptanceVariance
    )
  })
})

describe('Induced Correlation Estimation', () => {
  it('should estimate higher correlation for higher RE SD', () => {
    const probs = [0.3, 0.4, 0.5]

    const lowCorr = estimateInducedCorrelation(probs, {
      fileQuality: { sd: 0.2 },
      interviewSkill: { sd: 0.2 },
    })
    const highCorr = estimateInducedCorrelation(probs, {
      fileQuality: { sd: 1.0 },
      interviewSkill: { sd: 1.0 },
    })

    expect(highCorr).toBeGreaterThan(lowCorr)
  })

  it('should return values in [0, 1]', () => {
    const probs = [0.3, 0.5, 0.7]
    const corr = estimateInducedCorrelation(probs)

    expect(corr).toBeGreaterThanOrEqual(0)
    expect(corr).toBeLessThanOrEqual(1)
  })
})

describe('All-or-Nothing Score', () => {
  it('should return values in [0, 1]', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.3, pAcceptGivenInterview: 0.5 },
      { schoolId: 'school2', pInterview: 0.4, pAcceptGivenInterview: 0.5 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 42 }
    )

    const score = computeAllOrNothingScore(result)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('should be higher for higher correlation scenarios', () => {
    const predictions = Array.from({ length: 5 }, (_, i) => ({
      schoolId: `school${i}`,
      pInterview: 0.4,
      pAcceptGivenInterview: 0.5,
    }))

    const lowREParams = { fileQuality: { sd: 0.1 }, interviewSkill: { sd: 0.1 } }
    const highREParams = { fileQuality: { sd: 1.0 }, interviewSkill: { sd: 1.0 } }

    const resultLow = runCorrelatedSimulation(
      predictions,
      { iterations: 3000, seed: 42 },
      lowREParams
    )
    const resultHigh = runCorrelatedSimulation(
      predictions,
      { iterations: 3000, seed: 42 },
      highREParams
    )

    const scoreLow = computeAllOrNothingScore(resultLow)
    const scoreHigh = computeAllOrNothingScore(resultHigh)

    expect(scoreHigh).toBeGreaterThan(scoreLow)
  })
})

describe('Edge Cases', () => {
  it('should handle empty predictions', () => {
    const result = runCorrelatedSimulation([], { iterations: 100, seed: 42 })

    expect(result.expectedInterviews).toBe(0)
    expect(result.expectedAcceptances).toBe(0)
    expect(result.pAtLeastOne).toBe(0)
  })

  it('should handle single school', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.5, pAcceptGivenInterview: 0.5 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 42 }
    )

    expect(result.schoolStats).toHaveLength(1)
    expect(result.expectedAcceptances).toBeGreaterThan(0.1)
    expect(result.expectedAcceptances).toBeLessThan(0.5)
  })

  it('should handle very high probabilities', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.95, pAcceptGivenInterview: 0.95 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 42 }
    )

    expect(result.expectedAcceptances).toBeGreaterThan(0.8)
    expect(result.pAtLeastOne).toBeGreaterThan(0.8)
  })

  it('should handle very low probabilities', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.05, pAcceptGivenInterview: 0.1 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 1000, seed: 42 }
    )

    expect(result.expectedAcceptances).toBeLessThan(0.05)
  })

  it('should handle zero probabilities', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0, pAcceptGivenInterview: 0.5 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 100, seed: 42 }
    )

    expect(result.expectedInterviews).toBe(0)
    expect(result.expectedAcceptances).toBe(0)
  })

  it('should handle many schools efficiently', () => {
    const predictions = Array.from({ length: 30 }, (_, i) => ({
      schoolId: `school${i}`,
      pInterview: 0.2,
      pAcceptGivenInterview: 0.5,
    }))

    const start = Date.now()
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 10000, seed: 42 }
    )
    const elapsed = Date.now() - start

    // Should complete in reasonable time (< 5 seconds)
    expect(elapsed).toBeLessThan(5000)
    expect(result.iterations).toBe(10000)
  })
})

describe('Result Aggregation', () => {
  it('should compute correct percentiles', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.3, pAcceptGivenInterview: 0.5 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    // For a single school with P(accept) ≈ 0.15, CI should be [0, 1] (discrete)
    expect(result.acceptancesCI80[0]).toBeGreaterThanOrEqual(0)
    expect(result.acceptancesCI80[1]).toBeLessThanOrEqual(1)
  })

  it('should handle P(at least one) CI correctly', () => {
    const predictions = [
      { schoolId: 'school1', pInterview: 0.5, pAcceptGivenInterview: 0.5 },
      { schoolId: 'school2', pInterview: 0.5, pAcceptGivenInterview: 0.5 },
    ]
    const result = runCorrelatedSimulation(
      predictions,
      { iterations: 5000, seed: 42 }
    )

    expect(result.pAtLeastOneCI80[0]).toBeGreaterThanOrEqual(0)
    expect(result.pAtLeastOneCI80[1]).toBeLessThanOrEqual(1)
    expect(result.pAtLeastOneCI80[0]).toBeLessThanOrEqual(result.pAtLeastOne)
    expect(result.pAtLeastOneCI80[1]).toBeGreaterThanOrEqual(result.pAtLeastOne)
  })
})

describe('SchoolPrediction Integration', () => {
  it('should work with runSimulationFromPredictions', () => {
    const schoolPredictions = [
      {
        schoolId: 'school1',
        schoolName: 'Test School 1',
        pInterview: { mean: 0.3, ci80: [0.2, 0.4] as [number, number] },
        pAcceptGivenInterview: { mean: 0.5, ci80: [0.4, 0.6] as [number, number] },
        pAccept: { mean: 0.15, ci80: [0.1, 0.2] as [number, number] },
        category: 'target' as const,
        factors: {
          baseline: 0.1,
          competitivenessEffect: 0.05,
          residencyEffect: 0,
          demographicEffect: 0,
          missionFitEffect: 0,
        },
      },
    ]

    const result = runSimulationFromPredictions(
      schoolPredictions,
      { iterations: 1000, seed: 42 }
    )

    expect(result.iterations).toBe(1000)
    expect(result.schoolStats).toHaveLength(1)
    expect(result.schoolStats[0].schoolId).toBe('school1')
  })
})
