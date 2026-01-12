import { describe, it, expect } from 'vitest'
import {
  sampleSchoolParams,
  sampleCompetitiveness,
  sampleExperienceEffect,
  calculatePredictionSample,
  bootstrapSchoolPrediction,
  computeCredibleInterval,
  computeVariance,
  aggregateBootstrapSamples,
  calculateSchoolPredictionWithUncertainty,
  calculateListPredictionWithUncertainty,
  decomposeUncertainty,
  quickUncertaintyEstimate,
  describeUncertainty,
  formatConfidenceInterval,
  DEFAULT_UNCERTAINTY_PARAMS,
  DEFAULT_UNCERTAINTY_CONFIG,
} from '@/lib/model/uncertainty'
import { createSeededRandom } from '@/lib/model/monte-carlo'
import type { ApplicantProfile, SchoolData, SchoolModelParams } from '@/lib/model/types'

// Test fixtures
const testApplicant: ApplicantProfile = {
  gpa: 3.7,
  mcat: 515,
  gpaTrend: 'flat',
  clinicalHours: 500,
  researchHours: 800,
  volunteerHours: 200,
  shadowingHours: 60,
  leadershipCount: 3,
  publications: { firstAuthor: 1, other: 1, posters: 2 },
  stateOfResidence: 'CA',
  raceEthnicity: null,
  isUrm: false,
  isFirstGen: false,
  isDisadvantaged: false,
  isRural: false,
}

const testSchool: SchoolData = {
  id: 'ucsf',
  name: 'UCSF School of Medicine',
  state: 'CA',
  isPublic: true,
  medianGPA: 3.85,
  medianMCAT: 519,
  gpaPercentiles: { p10: 3.6, p25: 3.75, p50: 3.85, p75: 3.95, p90: 4.0 },
  mcatPercentiles: { p10: 512, p25: 516, p50: 519, p75: 522, p90: 525 },
  totalApplicants: 8000,
  totalInterviewed: 600,
  totalAccepted: 350,
  interviewRate: 0.075,
  interviewToAcceptRate: 0.58,
  inStateInterviewRate: 0.15,
  oosInterviewRate: 0.05,
  pctInStateMatriculants: 60,
  pctOutOfStateMatriculants: 40,
  oosFriendliness: 'neutral',
  missionFeatures: {
    ruralMission: false,
    researchIntensive: true,
    primaryCareFocus: false,
    hbcu: false,
    diversityFocus: true,
  },
  tier: 1,
}

const baseSchoolParams: SchoolModelParams = {
  interceptInterview: -2.5,
  interceptAccept: -0.1,
  slopeC_interview: 1.3,
  slopeC_accept: 0.65,
  inStateBonus_interview: 0.9,
  inStateBonus_accept: 0.3,
}

describe('Parameter Sampling', () => {
  it('should sample school params with variation', () => {
    const rng = createSeededRandom(42)
    const samples: SchoolModelParams[] = []

    for (let i = 0; i < 100; i++) {
      samples.push(sampleSchoolParams(baseSchoolParams, DEFAULT_UNCERTAINTY_PARAMS, rng))
    }

    // Check that there's variation
    const intercepts = samples.map((s) => s.interceptInterview)
    const minInt = Math.min(...intercepts)
    const maxInt = Math.max(...intercepts)
    expect(maxInt - minInt).toBeGreaterThan(0.1)

    // Check mean is close to base
    const meanInt = intercepts.reduce((a, b) => a + b, 0) / intercepts.length
    expect(meanInt).toBeCloseTo(baseSchoolParams.interceptInterview, 0)
  })

  it('should sample competitiveness with variation', () => {
    const rng = createSeededRandom(42)
    const baseC = 0.5
    const samples: number[] = []

    for (let i = 0; i < 100; i++) {
      samples.push(sampleCompetitiveness(baseC, DEFAULT_UNCERTAINTY_PARAMS, rng))
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length
    const sd = Math.sqrt(variance)

    expect(mean).toBeCloseTo(baseC, 0)
    expect(sd).toBeGreaterThan(0.05)
    expect(sd).toBeLessThan(0.2)
  })

  it('should sample experience effect with variation', () => {
    const rng = createSeededRandom(42)
    const baseEffect = 0.3
    const samples: number[] = []

    for (let i = 0; i < 100; i++) {
      samples.push(sampleExperienceEffect(baseEffect, DEFAULT_UNCERTAINTY_PARAMS, rng))
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(mean).toBeCloseTo(baseEffect, 0)
  })

  it('should be deterministic with seeded RNG', () => {
    const rng1 = createSeededRandom(12345)
    const rng2 = createSeededRandom(12345)

    const sample1 = sampleSchoolParams(baseSchoolParams, DEFAULT_UNCERTAINTY_PARAMS, rng1)
    const sample2 = sampleSchoolParams(baseSchoolParams, DEFAULT_UNCERTAINTY_PARAMS, rng2)

    expect(sample1.interceptInterview).toBe(sample2.interceptInterview)
    expect(sample1.slopeC_interview).toBe(sample2.slopeC_interview)
  })
})

describe('Prediction Sample Calculation', () => {
  it('should calculate valid probabilities', () => {
    const sample = calculatePredictionSample(
      testApplicant,
      testSchool,
      baseSchoolParams,
      0.5, // C
      0.2, // experience effect
      0.1, // demographic effect
      { uFile: 0, uInterview: 0 }
    )

    expect(sample.pInterview).toBeGreaterThan(0)
    expect(sample.pInterview).toBeLessThan(1)
    expect(sample.pAcceptGivenInterview).toBeGreaterThan(0)
    expect(sample.pAcceptGivenInterview).toBeLessThan(1)
    expect(sample.pAccept).toBe(sample.pInterview * sample.pAcceptGivenInterview)
  })

  it('should increase probability with positive random effects', () => {
    const baseResult = calculatePredictionSample(
      testApplicant,
      testSchool,
      baseSchoolParams,
      0.5,
      0.2,
      0.1,
      { uFile: 0, uInterview: 0 }
    )

    const boostedResult = calculatePredictionSample(
      testApplicant,
      testSchool,
      baseSchoolParams,
      0.5,
      0.2,
      0.1,
      { uFile: 1.0, uInterview: 1.0 }
    )

    expect(boostedResult.pInterview).toBeGreaterThan(baseResult.pInterview)
    expect(boostedResult.pAcceptGivenInterview).toBeGreaterThan(
      baseResult.pAcceptGivenInterview
    )
  })

  it('should apply in-state bonus for matching state', () => {
    const inStateApplicant = { ...testApplicant, stateOfResidence: 'CA' }
    const oosApplicant = { ...testApplicant, stateOfResidence: 'NY' }

    const inStateResult = calculatePredictionSample(
      inStateApplicant,
      testSchool,
      baseSchoolParams,
      0.5,
      0.2,
      0.1,
      { uFile: 0, uInterview: 0 }
    )

    const oosResult = calculatePredictionSample(
      oosApplicant,
      testSchool,
      baseSchoolParams,
      0.5,
      0.2,
      0.1,
      { uFile: 0, uInterview: 0 }
    )

    expect(inStateResult.pInterview).toBeGreaterThan(oosResult.pInterview)
    expect(inStateResult.pAcceptGivenInterview).toBeGreaterThan(
      oosResult.pAcceptGivenInterview
    )
  })
})

describe('Bootstrap School Prediction', () => {
  it('should generate specified number of samples', () => {
    const samples = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 50,
      seed: 42,
    })

    expect(samples.length).toBe(50)
  })

  it('should produce varied samples', () => {
    const samples = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 100,
      seed: 42,
    })

    const pAccepts = samples.map((s) => s.pAccept)
    const min = Math.min(...pAccepts)
    const max = Math.max(...pAccepts)

    expect(max - min).toBeGreaterThan(0.05) // Should have variation
  })

  it('should be deterministic with seed', () => {
    const samples1 = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 20,
      seed: 12345,
    })

    const samples2 = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 20,
      seed: 12345,
    })

    expect(samples1.map((s) => s.pAccept)).toEqual(samples2.map((s) => s.pAccept))
  })

  it('should return empty for unknown school', () => {
    const unknownSchool = { ...testSchool, id: 'unknown-school' }
    const samples = bootstrapSchoolPrediction(testApplicant, unknownSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 10,
      seed: 42,
    })

    expect(samples.length).toBe(0)
  })

  it('should produce wider intervals with parameter uncertainty', () => {
    const withParamUncertainty = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 200,
      seed: 42,
      includeParameterUncertainty: true,
      includeRandomEffects: false,
    })

    const withoutParamUncertainty = bootstrapSchoolPrediction(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 200,
      seed: 42,
      includeParameterUncertainty: false,
      includeRandomEffects: false,
    })

    const varWith = computeVariance(withParamUncertainty.map((s) => s.pAccept))
    const varWithout = computeVariance(withoutParamUncertainty.map((s) => s.pAccept))

    expect(varWith).toBeGreaterThan(varWithout)
  })
})

describe('Credible Interval Computation', () => {
  it('should compute correct mean', () => {
    const samples = [0.1, 0.2, 0.3, 0.4, 0.5]
    const ci = computeCredibleInterval(samples)
    expect(ci.mean).toBeCloseTo(0.3, 10)
  })

  it('should compute correct percentiles', () => {
    // Create 100 samples from 0.01 to 1.00
    const samples = Array.from({ length: 100 }, (_, i) => (i + 1) / 100)
    const ci = computeCredibleInterval(samples, 80)

    // 80% CI should be 10th to 90th percentile
    expect(ci.ci80[0]).toBeCloseTo(0.1, 1)
    expect(ci.ci80[1]).toBeCloseTo(0.9, 1)
  })

  it('should handle empty array', () => {
    const ci = computeCredibleInterval([])
    expect(ci.mean).toBe(0)
    expect(ci.ci80).toEqual([0, 0])
  })

  it('should handle single value', () => {
    const ci = computeCredibleInterval([0.5])
    expect(ci.mean).toBe(0.5)
    expect(ci.ci80).toEqual([0.5, 0.5])
  })
})

describe('Variance Computation', () => {
  it('should compute correct variance', () => {
    const samples = [1, 2, 3, 4, 5]
    const variance = computeVariance(samples)
    expect(variance).toBeCloseTo(2, 5) // Population variance of [1,2,3,4,5]
  })

  it('should return 0 for empty array', () => {
    expect(computeVariance([])).toBe(0)
  })

  it('should return 0 for single value', () => {
    expect(computeVariance([5])).toBe(0)
  })
})

describe('Bootstrap Aggregation', () => {
  it('should aggregate samples correctly', () => {
    const samples = [
      { pInterview: 0.2, pAcceptGivenInterview: 0.4, pAccept: 0.08 },
      { pInterview: 0.3, pAcceptGivenInterview: 0.5, pAccept: 0.15 },
      { pInterview: 0.4, pAcceptGivenInterview: 0.6, pAccept: 0.24 },
    ]

    const result = aggregateBootstrapSamples('test-school', samples)

    expect(result.schoolId).toBe('test-school')
    expect(result.pInterview.mean).toBeCloseTo(0.3, 5)
    expect(result.pAcceptGivenInterview.mean).toBeCloseTo(0.5, 5)
    expect(result.pAccept.mean).toBeCloseTo(0.157, 2)
  })

  it('should categorize schools correctly', () => {
    const reachSamples = Array(10).fill({
      pInterview: 0.1,
      pAcceptGivenInterview: 0.3,
      pAccept: 0.03,
    })
    const safetySamples = Array(10).fill({
      pInterview: 0.8,
      pAcceptGivenInterview: 0.9,
      pAccept: 0.72,
    })

    const reach = aggregateBootstrapSamples('reach-school', reachSamples)
    const safety = aggregateBootstrapSamples('safety-school', safetySamples)

    expect(reach.category).toBe('reach')
    expect(safety.category).toBe('safety')
  })
})

describe('Full Prediction with Uncertainty', () => {
  it('should return null for unknown school', () => {
    const unknownSchool = { ...testSchool, id: 'unknown-school' }
    const result = calculateSchoolPredictionWithUncertainty(
      testApplicant,
      unknownSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 10, seed: 42 }
    )

    expect(result).toBeNull()
  })

  it('should return valid prediction for known school', () => {
    const result = calculateSchoolPredictionWithUncertainty(
      testApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result).not.toBeNull()
    expect(result!.schoolId).toBe('ucsf')
    expect(result!.pInterview.mean).toBeGreaterThan(0)
    expect(result!.pInterview.mean).toBeLessThan(1)
    expect(result!.pAccept.ci80[0]).toBeLessThanOrEqual(result!.pAccept.mean)
    expect(result!.pAccept.ci80[1]).toBeGreaterThanOrEqual(result!.pAccept.mean)
  })

  it('should produce uncertainty breakdown', () => {
    const result = calculateSchoolPredictionWithUncertainty(
      testApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 100, seed: 42 }
    )

    expect(result!.uncertaintyBreakdown.totalVariance).toBeGreaterThan(0)
  })
})

describe('List Prediction with Uncertainty', () => {
  const testSchools: SchoolData[] = [
    testSchool,
    {
      ...testSchool,
      id: 'stanford-med',
      name: 'Stanford',
      state: 'CA',
      isPublic: false,
    },
  ]

  it('should return predictions for valid schools', () => {
    const result = calculateListPredictionWithUncertainty(
      testApplicant,
      testSchools,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result.schools.length).toBe(2)
  })

  it('should compute list-level metrics', () => {
    const result = calculateListPredictionWithUncertainty(
      testApplicant,
      testSchools,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 100, seed: 42 }
    )

    expect(result.expectedInterviews.mean).toBeGreaterThan(0)
    expect(result.expectedAcceptances.mean).toBeGreaterThan(0)
    expect(result.pAtLeastOne.mean).toBeGreaterThan(0)
    expect(result.pAtLeastOne.mean).toBeLessThanOrEqual(1)
  })

  it('should compute distribution buckets summing to 1', () => {
    const result = calculateListPredictionWithUncertainty(
      testApplicant,
      testSchools,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 100, seed: 42 }
    )

    const total =
      result.distributionBuckets.zero +
      result.distributionBuckets.one +
      result.distributionBuckets.twoThree +
      result.distributionBuckets.fourPlus

    expect(total).toBeCloseTo(1, 5)
  })

  it('should sort schools by acceptance probability', () => {
    const result = calculateListPredictionWithUncertainty(
      testApplicant,
      testSchools,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    for (let i = 1; i < result.schools.length; i++) {
      expect(result.schools[i - 1].pAccept.mean).toBeGreaterThanOrEqual(
        result.schools[i].pAccept.mean
      )
    }
  })
})

describe('Uncertainty Decomposition', () => {
  it('should decompose uncertainty into components', () => {
    const decomposition = decomposeUncertainty(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 100,
      seed: 42,
    })

    expect(decomposition.parameterOnly).toBeGreaterThanOrEqual(0)
    expect(decomposition.randomEffectOnly).toBeGreaterThanOrEqual(0)
    expect(decomposition.combined).toBeGreaterThanOrEqual(0)
    expect(decomposition.interaction).toBeGreaterThanOrEqual(0)
  })

  it('should have combined >= sum of individual components', () => {
    const decomposition = decomposeUncertainty(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 200,
      seed: 42,
    })

    // Combined should be at least the sum (due to interaction)
    // Allow some tolerance for sampling variance
    const sumComponents =
      decomposition.parameterOnly + decomposition.randomEffectOnly
    expect(decomposition.combined).toBeGreaterThanOrEqual(sumComponents * 0.8)
  })
})

describe('Quick Uncertainty Estimate', () => {
  it('should return valid confidence interval', () => {
    const ci = quickUncertaintyEstimate(0.3)

    expect(ci.mean).toBe(0.3)
    expect(ci.ci80[0]).toBeLessThan(ci.mean)
    expect(ci.ci80[1]).toBeGreaterThan(ci.mean)
    expect(ci.ci80[0]).toBeGreaterThanOrEqual(0)
    expect(ci.ci80[1]).toBeLessThanOrEqual(1)
  })

  it('should have wider interval for mid-range probabilities', () => {
    const ci_mid = quickUncertaintyEstimate(0.5)
    const ci_low = quickUncertaintyEstimate(0.1)
    const ci_high = quickUncertaintyEstimate(0.9)

    const width_mid = ci_mid.ci80[1] - ci_mid.ci80[0]
    const width_low = ci_low.ci80[1] - ci_low.ci80[0]
    const width_high = ci_high.ci80[1] - ci_high.ci80[0]

    expect(width_mid).toBeGreaterThan(width_low)
    expect(width_mid).toBeGreaterThan(width_high)
  })

  it('should have wider interval with higher uncertainty params', () => {
    const ci_default = quickUncertaintyEstimate(0.3, DEFAULT_UNCERTAINTY_PARAMS)
    const ci_high = quickUncertaintyEstimate(0.3, {
      ...DEFAULT_UNCERTAINTY_PARAMS,
      interceptSd: 0.5,
      slopeSd: 0.3,
    })

    const width_default = ci_default.ci80[1] - ci_default.ci80[0]
    const width_high = ci_high.ci80[1] - ci_high.ci80[0]

    expect(width_high).toBeGreaterThan(width_default)
  })
})

describe('Uncertainty Description', () => {
  it('should describe very narrow intervals as very_precise', () => {
    const ci = { mean: 0.5, ci80: [0.48, 0.52] as [number, number] }
    expect(describeUncertainty(ci)).toBe('very_precise')
  })

  it('should describe wide intervals as uncertain', () => {
    const ci = { mean: 0.5, ci80: [0.38, 0.62] as [number, number] } // width = 0.24
    expect(describeUncertainty(ci)).toBe('uncertain')
  })

  it('should describe very wide intervals as highly_uncertain', () => {
    const ci = { mean: 0.5, ci80: [0.2, 0.8] as [number, number] }
    expect(describeUncertainty(ci)).toBe('highly_uncertain')
  })
})

describe('Confidence Interval Formatting', () => {
  it('should format as percentage', () => {
    const ci = { mean: 0.35, ci80: [0.25, 0.45] as [number, number] }
    const formatted = formatConfidenceInterval(ci, true)

    expect(formatted).toBe('35.0% (25.0% - 45.0%)')
  })

  it('should format as decimal', () => {
    const ci = { mean: 0.35, ci80: [0.25, 0.45] as [number, number] }
    const formatted = formatConfidenceInterval(ci, false)

    expect(formatted).toBe('0.350 (0.250 - 0.450)')
  })
})

describe('Edge Cases', () => {
  it('should handle very low probability applicants', () => {
    const lowApplicant: ApplicantProfile = {
      ...testApplicant,
      gpa: 3.0,
      mcat: 500,
    }

    const result = calculateSchoolPredictionWithUncertainty(
      lowApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result).not.toBeNull()
    expect(result!.pAccept.mean).toBeLessThan(0.1)
    expect(result!.category).toBe('reach')
  })

  it('should handle very high probability applicants', () => {
    const highApplicant: ApplicantProfile = {
      ...testApplicant,
      gpa: 3.95,
      mcat: 525,
    }

    // Use a school where this applicant would have high probability
    const result = calculateSchoolPredictionWithUncertainty(
      highApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result).not.toBeNull()
    expect(result!.pAccept.mean).toBeGreaterThan(0.1)
  })

  it('should handle out-of-state applicants', () => {
    const oosApplicant: ApplicantProfile = {
      ...testApplicant,
      stateOfResidence: 'TX',
    }

    const result = calculateSchoolPredictionWithUncertainty(
      oosApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result).not.toBeNull()
    // OOS should have lower probability than in-state
    const inStateResult = calculateSchoolPredictionWithUncertainty(
      testApplicant,
      testSchool,
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result!.pAccept.mean).toBeLessThan(inStateResult!.pAccept.mean)
  })

  it('should handle empty school list', () => {
    const result = calculateListPredictionWithUncertainty(
      testApplicant,
      [],
      { ...DEFAULT_UNCERTAINTY_CONFIG, bootstrapIterations: 50, seed: 42 }
    )

    expect(result.schools.length).toBe(0)
    expect(result.expectedInterviews.mean).toBe(0)
    expect(result.expectedAcceptances.mean).toBe(0)
  })
})

describe('Performance', () => {
  it('should complete bootstrap in reasonable time', () => {
    const start = Date.now()

    calculateSchoolPredictionWithUncertainty(testApplicant, testSchool, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 500,
      seed: 42,
    })

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000) // Should complete in < 2 seconds
  })

  it('should complete list prediction in reasonable time', () => {
    const schools = Array(10)
      .fill(null)
      .map((_, i) => ({
        ...testSchool,
        id: i === 0 ? 'ucsf' : `school-${i}`,
      }))

    const start = Date.now()

    calculateListPredictionWithUncertainty(testApplicant, schools, {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: 100,
      seed: 42,
    })

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000) // Should complete in < 5 seconds
  })
})
