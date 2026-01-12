import { describe, it, expect } from 'vitest'
import {
  saturatingContribution,
  contributionWithThreshold,
  publicationContribution,
  calculateExperienceContribution,
  getExperienceBreakdown,
  checkMinimumThresholds,
  DEFAULT_EXPERIENCE_PARAMS,
} from '@/lib/model/experience'
import type { ApplicantProfile, PublicationRecord, ExperienceDomainParams } from '@/lib/model/types'

// Helper to create a base applicant profile
function createApplicant(overrides: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    gpa: 3.7,
    mcat: 515,
    clinicalHours: 300,
    researchHours: 500,
    volunteerHours: 150,
    shadowingHours: 50,
    leadershipCount: 2,
    publications: {
      firstAuthor: 0,
      other: 0,
      posters: 0,
    },
    ...overrides,
  }
}

describe('Saturating Contribution Function', () => {
  const testParams: ExperienceDomainParams = {
    tau: 400,
    alpha: 0.30,
  }

  it('should return 0 for 0 hours', () => {
    const result = saturatingContribution(0, testParams)
    expect(result).toBe(0)
  })

  it('should return 0 for negative hours', () => {
    const result = saturatingContribution(-100, testParams)
    expect(result).toBe(0)
  })

  it('should be approximately 63% of alpha at tau hours', () => {
    const result = saturatingContribution(testParams.tau, testParams)
    const expected = testParams.alpha * (1 - 1 / Math.E) // ~63.2%
    expect(result).toBeCloseTo(expected, 4)
  })

  it('should approach alpha for very high hours', () => {
    const result = saturatingContribution(10000, testParams)
    expect(result).toBeCloseTo(testParams.alpha, 2)
  })

  it('should be monotonically increasing', () => {
    const hours = [0, 100, 200, 400, 800, 1600, 3200]
    const values = hours.map(h => saturatingContribution(h, testParams))

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })

  it('should have diminishing returns (concave)', () => {
    // Check that marginal contribution decreases
    const v100 = saturatingContribution(100, testParams)
    const v200 = saturatingContribution(200, testParams)
    const v300 = saturatingContribution(300, testParams)
    const v400 = saturatingContribution(400, testParams)

    const marginal1 = v200 - v100 // Gain from 100→200
    const marginal2 = v400 - v300 // Gain from 300→400

    expect(marginal2).toBeLessThan(marginal1)
  })

  it('should scale with alpha', () => {
    const paramsLow = { tau: 400, alpha: 0.10 }
    const paramsHigh = { tau: 400, alpha: 0.50 }

    const low = saturatingContribution(500, paramsLow)
    const high = saturatingContribution(500, paramsHigh)

    expect(high).toBeCloseTo(low * 5, 4)
  })

  it('should saturate faster with lower tau', () => {
    const paramsSlowSat = { tau: 800, alpha: 0.30 }
    const paramsFastSat = { tau: 200, alpha: 0.30 }

    // At 400 hours, fast saturation should be closer to max
    const slow = saturatingContribution(400, paramsSlowSat)
    const fast = saturatingContribution(400, paramsFastSat)

    expect(fast).toBeGreaterThan(slow)
  })
})

describe('Contribution With Threshold', () => {
  const testParams: ExperienceDomainParams = {
    tau: 400,
    alpha: 0.30,
    minThreshold: 100,
  }

  it('should return large negative value for hard threshold violation', () => {
    const result = contributionWithThreshold(50, testParams, 'hard')
    expect(result).toBe(-2.0)
  })

  it('should pass hard threshold when at minimum', () => {
    const result = contributionWithThreshold(100, testParams, 'hard')
    expect(result).toBeGreaterThan(0)
  })

  it('should apply penalty for soft threshold violation', () => {
    const softPenalty = -0.10
    const atMin = contributionWithThreshold(100, testParams, 'soft', softPenalty)
    const belowMin = contributionWithThreshold(50, testParams, 'soft', softPenalty)

    // Below minimum should get base contribution minus penalty
    expect(belowMin).toBeLessThan(atMin)
  })

  it('should not apply penalty when above soft minimum', () => {
    const withSoft = contributionWithThreshold(200, testParams, 'soft', -0.10)
    const withNone = contributionWithThreshold(200, testParams, 'none')

    expect(withSoft).toBe(withNone)
  })

  it('should return normal contribution with no threshold', () => {
    const withThreshold = contributionWithThreshold(50, testParams, 'none')
    const directCalc = saturatingContribution(50, testParams)

    expect(withThreshold).toBe(directCalc)
  })

  it('should handle softMinimum alias', () => {
    const paramsWithSoftMin: ExperienceDomainParams = {
      tau: 400,
      alpha: 0.30,
      softMinimum: 100,
    }

    const result = contributionWithThreshold(50, paramsWithSoftMin, 'soft', -0.05)
    expect(result).toBeDefined()
  })
})

describe('Publication Contribution', () => {
  const pubParams = DEFAULT_EXPERIENCE_PARAMS.publications

  it('should return 0 for no publications', () => {
    const pubs: PublicationRecord = { firstAuthor: 0, other: 0, posters: 0 }
    expect(publicationContribution(pubs, pubParams)).toBe(0)
  })

  it('should give full value for first publication', () => {
    const pubs: PublicationRecord = { firstAuthor: 1, other: 0, posters: 0 }
    expect(publicationContribution(pubs, pubParams)).toBe(pubParams.firstAuthor)
  })

  it('should apply diminishing returns to subsequent publications', () => {
    const onePub: PublicationRecord = { firstAuthor: 1, other: 0, posters: 0 }
    const twoPub: PublicationRecord = { firstAuthor: 2, other: 0, posters: 0 }
    const threePub: PublicationRecord = { firstAuthor: 3, other: 0, posters: 0 }

    const v1 = publicationContribution(onePub, pubParams)
    const v2 = publicationContribution(twoPub, pubParams)
    const v3 = publicationContribution(threePub, pubParams)

    const marginal2 = v2 - v1
    const marginal3 = v3 - v2

    expect(marginal2).toBeLessThan(v1) // Second pub worth less than first
    expect(marginal3).toBeLessThan(marginal2) // Third worth less than second
  })

  it('should value first-author publications more than middle-author', () => {
    const firstAuthor: PublicationRecord = { firstAuthor: 1, other: 0, posters: 0 }
    const middleAuthor: PublicationRecord = { firstAuthor: 0, other: 1, posters: 0 }

    const vFirst = publicationContribution(firstAuthor, pubParams)
    const vMiddle = publicationContribution(middleAuthor, pubParams)

    expect(vFirst).toBeGreaterThan(vMiddle)
  })

  it('should value peer-reviewed publications more than posters', () => {
    const middleAuthor: PublicationRecord = { firstAuthor: 0, other: 1, posters: 0 }
    const poster: PublicationRecord = { firstAuthor: 0, other: 0, posters: 1 }

    const vMiddle = publicationContribution(middleAuthor, pubParams)
    const vPoster = publicationContribution(poster, pubParams)

    expect(vMiddle).toBeGreaterThan(vPoster)
  })

  it('should be monotonically increasing with more publications', () => {
    for (let i = 1; i <= 5; i++) {
      const fewer: PublicationRecord = { firstAuthor: i - 1, other: 0, posters: 0 }
      const more: PublicationRecord = { firstAuthor: i, other: 0, posters: 0 }

      expect(publicationContribution(more, pubParams)).toBeGreaterThan(
        publicationContribution(fewer, pubParams)
      )
    }
  })

  it('should handle mixed publication types', () => {
    const mixed: PublicationRecord = { firstAuthor: 2, other: 3, posters: 4 }
    const result = publicationContribution(mixed, pubParams)

    // Result should be positive and less than sum of max values
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(
      pubParams.firstAuthor * 2 + pubParams.middle * 3 + pubParams.poster * 4
    )
  })
})

describe('Calculate Experience Contribution', () => {
  it('should return a positive total for typical applicant', () => {
    const applicant = createApplicant()
    const total = calculateExperienceContribution(applicant)

    expect(total).toBeGreaterThan(0)
  })

  it('should return higher value for stronger experience', () => {
    const weak = createApplicant({
      clinicalHours: 100,
      researchHours: 100,
      volunteerHours: 50,
      shadowingHours: 20,
      leadershipCount: 0,
    })

    const strong = createApplicant({
      clinicalHours: 2000,
      researchHours: 2000,
      volunteerHours: 500,
      shadowingHours: 100,
      leadershipCount: 5,
      publications: { firstAuthor: 2, other: 1, posters: 3 },
    })

    expect(calculateExperienceContribution(strong)).toBeGreaterThan(
      calculateExperienceContribution(weak)
    )
  })

  it('should penalize below clinical minimum', () => {
    const belowMin = createApplicant({ clinicalHours: 50 })
    const atMin = createApplicant({ clinicalHours: 100 })

    // With hard threshold, below minimum should have much lower contribution
    const belowResult = calculateExperienceContribution(belowMin)
    const atResult = calculateExperienceContribution(atMin)

    expect(belowResult).toBeLessThan(atResult)
  })

  it('should use custom parameters when provided', () => {
    const applicant = createApplicant({ clinicalHours: 500 })

    const paramsHighAlpha = {
      ...DEFAULT_EXPERIENCE_PARAMS,
      clinical: { ...DEFAULT_EXPERIENCE_PARAMS.clinical, alpha: 1.0 },
    }

    const standard = calculateExperienceContribution(applicant)
    const highAlpha = calculateExperienceContribution(applicant, paramsHighAlpha)

    expect(highAlpha).toBeGreaterThan(standard)
  })

  it('should be bounded (not grow without limit)', () => {
    const maxedOut = createApplicant({
      clinicalHours: 10000,
      researchHours: 10000,
      volunteerHours: 10000,
      shadowingHours: 10000,
      leadershipCount: 100,
      publications: { firstAuthor: 10, other: 10, posters: 10 },
    })

    const total = calculateExperienceContribution(maxedOut)

    // Should be bounded by sum of alphas plus max publication contribution
    const maxPossible =
      DEFAULT_EXPERIENCE_PARAMS.clinical.alpha +
      DEFAULT_EXPERIENCE_PARAMS.research.alpha +
      DEFAULT_EXPERIENCE_PARAMS.volunteer.alpha +
      DEFAULT_EXPERIENCE_PARAMS.shadowing.alpha +
      DEFAULT_EXPERIENCE_PARAMS.leadership.alpha +
      2.0 // Generous upper bound for publications

    expect(total).toBeLessThan(maxPossible)
  })
})

describe('Get Experience Breakdown', () => {
  it('should return all component contributions', () => {
    const applicant = createApplicant()
    const breakdown = getExperienceBreakdown(applicant)

    expect(breakdown).toHaveProperty('clinical')
    expect(breakdown).toHaveProperty('research')
    expect(breakdown).toHaveProperty('volunteer')
    expect(breakdown).toHaveProperty('shadowing')
    expect(breakdown).toHaveProperty('leadership')
    expect(breakdown).toHaveProperty('publications')
    expect(breakdown).toHaveProperty('total')
  })

  it('should have total equal to sum of components', () => {
    const applicant = createApplicant({
      publications: { firstAuthor: 1, other: 2, posters: 1 },
    })
    const breakdown = getExperienceBreakdown(applicant)

    const calculatedTotal =
      breakdown.clinical +
      breakdown.research +
      breakdown.volunteer +
      breakdown.shadowing +
      breakdown.leadership +
      breakdown.publications

    expect(breakdown.total).toBeCloseTo(calculatedTotal, 10)
  })

  it('should match calculateExperienceContribution result', () => {
    const applicant = createApplicant()
    const breakdown = getExperienceBreakdown(applicant)
    const direct = calculateExperienceContribution(applicant)

    expect(breakdown.total).toBeCloseTo(direct, 10)
  })

  it('should show zero for missing experiences', () => {
    const minimal = createApplicant({
      clinicalHours: 0,
      researchHours: 0,
      volunteerHours: 0,
      shadowingHours: 0,
      leadershipCount: 0,
      publications: { firstAuthor: 0, other: 0, posters: 0 },
    })

    const breakdown = getExperienceBreakdown(minimal)

    // Clinical with hard threshold returns -2.0 when below minimum
    expect(breakdown.clinical).toBeLessThanOrEqual(0)
    expect(breakdown.research).toBe(0)
    expect(breakdown.leadership).toBe(0)
    expect(breakdown.publications).toBe(0)
  })
})

describe('Check Minimum Thresholds', () => {
  it('should pass when clinical hours meet minimum', () => {
    const applicant = createApplicant({ clinicalHours: 200 })
    const result = checkMinimumThresholds(applicant)

    expect(result.meetsAll).toBe(true)
    expect(result.clinical.met).toBe(true)
  })

  it('should fail when clinical hours below minimum', () => {
    const applicant = createApplicant({ clinicalHours: 50 })
    const result = checkMinimumThresholds(applicant)

    expect(result.meetsAll).toBe(false)
    expect(result.clinical.met).toBe(false)
  })

  it('should return threshold details', () => {
    const applicant = createApplicant({ clinicalHours: 150 })
    const result = checkMinimumThresholds(applicant)

    expect(result.clinical.actual).toBe(150)
    expect(result.clinical.required).toBeGreaterThan(0)
  })

  it('should pass at exactly the minimum', () => {
    // Get the required minimum from the check function
    const probe = createApplicant({ clinicalHours: 0 })
    const { clinical } = checkMinimumThresholds(probe)

    const atMin = createApplicant({ clinicalHours: clinical.required })
    const result = checkMinimumThresholds(atMin)

    expect(result.clinical.met).toBe(true)
    expect(result.meetsAll).toBe(true)
  })
})

describe('Default Experience Parameters', () => {
  it('should have all required domains', () => {
    expect(DEFAULT_EXPERIENCE_PARAMS.clinical).toBeDefined()
    expect(DEFAULT_EXPERIENCE_PARAMS.research).toBeDefined()
    expect(DEFAULT_EXPERIENCE_PARAMS.volunteer).toBeDefined()
    expect(DEFAULT_EXPERIENCE_PARAMS.shadowing).toBeDefined()
    expect(DEFAULT_EXPERIENCE_PARAMS.leadership).toBeDefined()
    expect(DEFAULT_EXPERIENCE_PARAMS.publications).toBeDefined()
  })

  it('should have positive tau values', () => {
    expect(DEFAULT_EXPERIENCE_PARAMS.clinical.tau).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.research.tau).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.volunteer.tau).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.shadowing.tau).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.leadership.tau).toBeGreaterThan(0)
  })

  it('should have positive alpha values', () => {
    expect(DEFAULT_EXPERIENCE_PARAMS.clinical.alpha).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.research.alpha).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.volunteer.alpha).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.shadowing.alpha).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.leadership.alpha).toBeGreaterThan(0)
  })

  it('should have publication parameters', () => {
    expect(DEFAULT_EXPERIENCE_PARAMS.publications.firstAuthor).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.publications.middle).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.publications.poster).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.publications.diminishing).toBeGreaterThan(0)
    expect(DEFAULT_EXPERIENCE_PARAMS.publications.diminishing).toBeLessThan(1)
  })
})

describe('Edge Cases', () => {
  it('should handle very large hour values without overflow', () => {
    const applicant = createApplicant({ clinicalHours: 1e9 })
    const result = calculateExperienceContribution(applicant)

    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeLessThan(10) // Bounded by alpha values
  })

  it('should handle fractional hours', () => {
    const params: ExperienceDomainParams = { tau: 100, alpha: 0.5 }
    const result = saturatingContribution(50.5, params)

    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
  })

  it('should handle zero tau gracefully', () => {
    const params: ExperienceDomainParams = { tau: 0, alpha: 0.5 }
    const result = saturatingContribution(100, params)

    expect(result).toBe(0)
  })

  it('should handle applicant with all zeros', () => {
    const applicant = createApplicant({
      clinicalHours: 0,
      researchHours: 0,
      volunteerHours: 0,
      shadowingHours: 0,
      leadershipCount: 0,
      publications: { firstAuthor: 0, other: 0, posters: 0 },
    })

    // Should still compute without errors
    const result = calculateExperienceContribution(applicant)
    expect(Number.isFinite(result)).toBe(true)
  })
})
