import { describe, it, expect } from 'vitest'
import {
  calculateCompetitiveness,
  calculateGpaContribution,
  calculateMcatContribution,
  getCompetitivenessBreakdown,
  competitivenessToBaselineProb,
  getAnchorCompetitiveness,
  classifyCompetitiveness,
  evaluateSpline,
  DEFAULT_SPLINES,
} from '@/lib/model/competitiveness'

describe('Competitiveness Calculation', () => {
  it('should return approximately 0 at anchor point (GPA=3.75, MCAT=512)', () => {
    const C = calculateCompetitiveness(3.75, 512)
    expect(C).toBeCloseTo(0, 1) // Within 0.1 of 0
  })

  it('should return positive value for above-anchor stats', () => {
    const C = calculateCompetitiveness(3.9, 520)
    expect(C).toBeGreaterThan(0)
  })

  it('should return negative value for below-anchor stats', () => {
    const C = calculateCompetitiveness(3.2, 500)
    expect(C).toBeLessThan(0)
  })

  it('should be monotonic in GPA', () => {
    const gpas = [2.5, 3.0, 3.3, 3.5, 3.7, 3.85, 4.0]
    const scores = gpas.map((gpa) => calculateCompetitiveness(gpa, 512))

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
  })

  it('should be monotonic in MCAT', () => {
    const mcats = [490, 500, 505, 510, 515, 520, 525]
    const scores = mcats.map((mcat) => calculateCompetitiveness(3.75, mcat))

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
  })

  it('should produce reasonable range for typical applicants', () => {
    // Very low stats
    const veryLow = calculateCompetitiveness(2.5, 490)
    expect(veryLow).toBeLessThan(-2)
    expect(veryLow).toBeGreaterThan(-5)

    // Very high stats (4.0 GPA, 525 MCAT gives C ≈ 1.2)
    const veryHigh = calculateCompetitiveness(4.0, 525)
    expect(veryHigh).toBeGreaterThan(1.0)
    expect(veryHigh).toBeLessThan(3)
  })
})

describe('GPA Contribution', () => {
  it('should be 0 or small at anchor GPA', () => {
    const contrib = calculateGpaContribution(3.75)
    expect(Math.abs(contrib)).toBeLessThan(0.5)
  })

  it('should increase with GPA', () => {
    const low = calculateGpaContribution(3.3)
    const high = calculateGpaContribution(3.9)
    expect(high).toBeGreaterThan(low)
  })

  it('should be bounded within spline range', () => {
    const atMin = calculateGpaContribution(2.0)
    const atMax = calculateGpaContribution(4.0)
    expect(Number.isFinite(atMin)).toBe(true)
    expect(Number.isFinite(atMax)).toBe(true)
  })

  it('should clamp values outside range', () => {
    const belowMin = calculateGpaContribution(1.5)
    const atMin = calculateGpaContribution(2.0)
    expect(belowMin).toBe(atMin)

    const aboveMax = calculateGpaContribution(4.5)
    const atMax = calculateGpaContribution(4.0)
    expect(aboveMax).toBe(atMax)
  })
})

describe('MCAT Contribution', () => {
  it('should be 0 or small at anchor MCAT', () => {
    const contrib = calculateMcatContribution(512)
    expect(Math.abs(contrib)).toBeLessThan(0.5)
  })

  it('should increase with MCAT', () => {
    const low = calculateMcatContribution(500)
    const high = calculateMcatContribution(520)
    expect(high).toBeGreaterThan(low)
  })

  it('should be bounded within spline range', () => {
    const atMin = calculateMcatContribution(486)
    const atMax = calculateMcatContribution(528)
    expect(Number.isFinite(atMin)).toBe(true)
    expect(Number.isFinite(atMax)).toBe(true)
  })
})

describe('Competitiveness Breakdown', () => {
  it('should return all components', () => {
    const breakdown = getCompetitivenessBreakdown(3.7, 515)

    expect(breakdown).toHaveProperty('gpaContribution')
    expect(breakdown).toHaveProperty('mcatContribution')
    expect(breakdown).toHaveProperty('total')
    expect(breakdown).toHaveProperty('globalIntercept')
  })

  it('should have total equal to sum of contributions', () => {
    const breakdown = getCompetitivenessBreakdown(3.8, 518)
    const expectedTotal = breakdown.gpaContribution + breakdown.mcatContribution
    expect(breakdown.total).toBeCloseTo(expectedTotal, 10)
  })

  it('should match direct calculation', () => {
    const gpa = 3.6
    const mcat = 510
    const breakdown = getCompetitivenessBreakdown(gpa, mcat)
    const direct = calculateCompetitiveness(gpa, mcat)
    expect(breakdown.total).toBeCloseTo(direct, 10)
  })
})

describe('Baseline Probability Conversion', () => {
  it('should return ~65% at anchor point', () => {
    const C = 0 // At anchor
    const prob = competitivenessToBaselineProb(C)
    expect(prob).toBeGreaterThan(0.55)
    expect(prob).toBeLessThan(0.75)
  })

  it('should be monotonic in C', () => {
    const Cs = [-2, -1, 0, 1, 2]
    const probs = Cs.map((c) => competitivenessToBaselineProb(c))

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThan(probs[i - 1])
    }
  })

  it('should be bounded between 0 and 1', () => {
    expect(competitivenessToBaselineProb(-10)).toBeGreaterThan(0)
    expect(competitivenessToBaselineProb(-10)).toBeLessThan(0.5)
    expect(competitivenessToBaselineProb(10)).toBeGreaterThan(0.5)
    expect(competitivenessToBaselineProb(10)).toBeLessThan(1)
  })
})

describe('Anchor Point Verification', () => {
  it('should return value close to 0', () => {
    const anchorC = getAnchorCompetitiveness()
    expect(Math.abs(anchorC)).toBeLessThan(0.1)
  })
})

describe('Competitiveness Classification', () => {
  it('should classify very low correctly', () => {
    expect(classifyCompetitiveness(-2.5)).toBe('very_low')
  })

  it('should classify low correctly', () => {
    expect(classifyCompetitiveness(-1.5)).toBe('low')
  })

  it('should classify average correctly', () => {
    expect(classifyCompetitiveness(0)).toBe('average')
  })

  it('should classify high correctly', () => {
    expect(classifyCompetitiveness(1.5)).toBe('high')
  })

  it('should classify very high correctly', () => {
    expect(classifyCompetitiveness(2.5)).toBe('very_high')
  })
})

describe('Spline Evaluation', () => {
  it('should evaluate GPA spline without errors', () => {
    const result = evaluateSpline(3.5, DEFAULT_SPLINES.gpaSpline)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('should evaluate MCAT spline without errors', () => {
    const result = evaluateSpline(510, DEFAULT_SPLINES.mcatSpline)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('should handle boundary values', () => {
    const gpaMin = evaluateSpline(2.0, DEFAULT_SPLINES.gpaSpline)
    const gpaMax = evaluateSpline(4.0, DEFAULT_SPLINES.gpaSpline)
    expect(Number.isFinite(gpaMin)).toBe(true)
    expect(Number.isFinite(gpaMax)).toBe(true)
    expect(gpaMax).toBeGreaterThan(gpaMin)
  })
})

describe('Edge Cases', () => {
  it('should handle extreme GPA values', () => {
    expect(Number.isFinite(calculateCompetitiveness(0, 512))).toBe(true)
    expect(Number.isFinite(calculateCompetitiveness(5, 512))).toBe(true)
  })

  it('should handle extreme MCAT values', () => {
    expect(Number.isFinite(calculateCompetitiveness(3.75, 400))).toBe(true)
    expect(Number.isFinite(calculateCompetitiveness(3.75, 600))).toBe(true)
  })

  it('should produce consistent results for same inputs', () => {
    const result1 = calculateCompetitiveness(3.7, 515)
    const result2 = calculateCompetitiveness(3.7, 515)
    expect(result1).toBe(result2)
  })
})

describe('Default Splines', () => {
  it('should have GPA spline parameters', () => {
    expect(DEFAULT_SPLINES.gpaSpline).toBeDefined()
    expect(DEFAULT_SPLINES.gpaSpline.coefficients.length).toBeGreaterThan(0)
    expect(DEFAULT_SPLINES.gpaSpline.x_min).toBe(2.0)
    expect(DEFAULT_SPLINES.gpaSpline.x_max).toBe(4.0)
  })

  it('should have MCAT spline parameters', () => {
    expect(DEFAULT_SPLINES.mcatSpline).toBeDefined()
    expect(DEFAULT_SPLINES.mcatSpline.coefficients.length).toBeGreaterThan(0)
    expect(DEFAULT_SPLINES.mcatSpline.x_min).toBe(486)
    expect(DEFAULT_SPLINES.mcatSpline.x_max).toBe(528)
  })

  it('should have anchor points', () => {
    expect(DEFAULT_SPLINES.anchorGpa).toBe(3.75)
    expect(DEFAULT_SPLINES.anchorMcat).toBe(512)
  })

  it('should have global intercept', () => {
    expect(DEFAULT_SPLINES.globalIntercept).toBeGreaterThan(0)
    expect(DEFAULT_SPLINES.globalIntercept).toBeLessThan(2)
  })
})
