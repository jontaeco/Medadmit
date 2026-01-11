import { describe, it, expect } from 'vitest'
import {
  getTableA18,
  getRaceEthnicityStats,
  getRaceEthnicityOddsRatio,
  isURM,
  calculateDemographicAdjustment,
  getURMStatistics,
  getAllRaceEthnicityCategories,
} from '@/lib/data/demographics'
import { RACE_ETHNICITY_CATEGORIES } from '@/types/data'

describe('Table A-18 Data Integrity', () => {
  it('should load Table A-18 data successfully', () => {
    const data = getTableA18()
    expect(data).toBeDefined()
    expect(data.metadata).toBeDefined()
    expect(data.byRaceEthnicity).toBeDefined()
  })

  it('should have valid metadata', () => {
    const data = getTableA18()
    expect(data.metadata.source).toBe('AAMC FACTS Table A-18')
    expect(data.metadata.academicYear).toBeDefined()
  })

  it('should have data for all race/ethnicity categories', () => {
    const data = getTableA18()
    for (const category of RACE_ETHNICITY_CATEGORIES) {
      const stats = data.byRaceEthnicity[category]
      expect(stats).toBeDefined()
    }
  })

  it('should have valid statistics for each category', () => {
    const data = getTableA18()
    for (const category of RACE_ETHNICITY_CATEGORIES) {
      const stats = data.byRaceEthnicity[category]

      expect(stats.applicants).toBeGreaterThan(0)
      expect(stats.matriculants).toBeGreaterThan(0)
      expect(stats.matriculants).toBeLessThanOrEqual(stats.applicants)

      expect(stats.acceptanceRate).toBeGreaterThan(0)
      expect(stats.acceptanceRate).toBeLessThanOrEqual(1)

      expect(stats.avgGPA).toBeGreaterThan(2.0)
      expect(stats.avgGPA).toBeLessThanOrEqual(4.0)

      expect(stats.avgMCAT).toBeGreaterThan(490)
      expect(stats.avgMCAT).toBeLessThan(528)

      expect(stats.avgGPAStdDev).toBeGreaterThan(0)
      expect(stats.avgMCATStdDev).toBeGreaterThan(0)
    }
  })
})

describe('Race/Ethnicity Stats Lookup', () => {
  it('should return stats for valid category', () => {
    const stats = getRaceEthnicityStats('Asian')
    expect(stats).toBeDefined()
    expect(stats?.applicants).toBeGreaterThan(0)
  })

  it('should return null for invalid category', () => {
    const stats = getRaceEthnicityStats('Invalid' as any)
    expect(stats).toBeNull()
  })
})

describe('URM Classification', () => {
  it('should correctly identify URM categories', () => {
    expect(isURM('Black or African American')).toBe(true)
    expect(isURM('Hispanic, Latino, or of Spanish Origin')).toBe(true)
    expect(isURM('American Indian or Alaska Native')).toBe(true)
    expect(isURM('Native Hawaiian or Other Pacific Islander')).toBe(true)
  })

  it('should correctly identify non-URM categories', () => {
    expect(isURM('White')).toBe(false)
    expect(isURM('Asian')).toBe(false)
    expect(isURM('Multiple Race/Ethnicity')).toBe(false)
    expect(isURM('Unknown')).toBe(false)
  })

  it('should handle null', () => {
    expect(isURM(null)).toBe(false)
  })
})

describe('Odds Ratio Lookup', () => {
  it('should return valid odds ratios for all categories', () => {
    for (const category of RACE_ETHNICITY_CATEGORIES) {
      const result = getRaceEthnicityOddsRatio(category)
      expect(result.oddsRatio).toBeGreaterThan(0)
      expect(result.ciLower).toBeLessThanOrEqual(result.oddsRatio)
      expect(result.ciUpper).toBeGreaterThanOrEqual(result.oddsRatio)
    }
  })

  it('should have OR = 1 for White (reference group)', () => {
    const result = getRaceEthnicityOddsRatio('White')
    expect(result.oddsRatio).toBe(1.0)
  })

  it('should have OR > 1 for URM categories', () => {
    expect(getRaceEthnicityOddsRatio('Black or African American').oddsRatio).toBeGreaterThan(
      1
    )
    expect(
      getRaceEthnicityOddsRatio('Hispanic, Latino, or of Spanish Origin').oddsRatio
    ).toBeGreaterThan(1)
    expect(
      getRaceEthnicityOddsRatio('American Indian or Alaska Native').oddsRatio
    ).toBeGreaterThan(1)
  })

  it('should have OR slightly < 1 for Asian', () => {
    const result = getRaceEthnicityOddsRatio('Asian')
    expect(result.oddsRatio).toBeLessThan(1)
    expect(result.oddsRatio).toBeGreaterThan(0.5) // Not drastically lower
  })

  it('should handle null category', () => {
    const result = getRaceEthnicityOddsRatio(null)
    expect(result.oddsRatio).toBe(1.0)
  })
})

describe('Demographic Adjustment Calculation', () => {
  it('should calculate adjustment with race/ethnicity only', () => {
    const result = calculateDemographicAdjustment(0.5, {
      raceEthnicity: 'Black or African American',
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })

    expect(result.probability).toBeGreaterThan(0.5) // Should increase for URM
    expect(result.probability).toBeLessThan(1)
    expect(result.oddsRatio).toBeGreaterThan(1)
    expect(result.factors.length).toBe(1)
  })

  it('should calculate adjustment with multiple factors', () => {
    const result = calculateDemographicAdjustment(0.3, {
      raceEthnicity: 'Hispanic, Latino, or of Spanish Origin',
      isFirstGen: true,
      isDisadvantaged: true,
      isRural: false,
    })

    expect(result.probability).toBeGreaterThan(0.3)
    expect(result.factors.length).toBe(3) // Race + first-gen + disadvantaged
    expect(result.warnings.length).toBeGreaterThan(0) // Should have warnings about estimates
  })

  it('should cap probability at 99%', () => {
    const result = calculateDemographicAdjustment(0.8, {
      raceEthnicity: 'Black or African American',
      isFirstGen: true,
      isDisadvantaged: true,
      isRural: true,
    })

    expect(result.probability).toBeLessThanOrEqual(0.99)
  })

  it('should return baseline when no adjustments apply', () => {
    const result = calculateDemographicAdjustment(0.4, {
      raceEthnicity: null,
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })

    expect(result.probability).toBeCloseTo(0.4, 2)
    expect(result.oddsRatio).toBeCloseTo(1.0, 2)
    expect(result.factors.length).toBe(0)
  })

  it('should handle Asian applicants (slight disadvantage at same stats)', () => {
    const result = calculateDemographicAdjustment(0.5, {
      raceEthnicity: 'Asian',
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })

    expect(result.probability).toBeLessThan(0.5)
    expect(result.oddsRatio).toBeLessThan(1)
  })
})

describe('URM Statistics', () => {
  it('should calculate aggregate URM vs non-URM statistics', () => {
    const stats = getURMStatistics()

    expect(stats.urm.applicants).toBeGreaterThan(0)
    expect(stats.urm.matriculants).toBeGreaterThan(0)
    expect(stats.nonUrm.applicants).toBeGreaterThan(0)
    expect(stats.nonUrm.matriculants).toBeGreaterThan(0)

    // Non-URM applicants typically outnumber URM applicants
    expect(stats.nonUrm.applicants).toBeGreaterThan(stats.urm.applicants)

    // Average stats should be in valid ranges
    expect(stats.urm.avgGPA).toBeGreaterThan(3.0)
    expect(stats.urm.avgGPA).toBeLessThan(4.0)
    expect(stats.urm.avgMCAT).toBeGreaterThan(490)
    expect(stats.urm.avgMCAT).toBeLessThan(528)

    expect(stats.nonUrm.avgGPA).toBeGreaterThan(3.0)
    expect(stats.nonUrm.avgGPA).toBeLessThan(4.0)
    expect(stats.nonUrm.avgMCAT).toBeGreaterThan(490)
    expect(stats.nonUrm.avgMCAT).toBeLessThan(528)
  })
})

describe('Race/Ethnicity Categories', () => {
  it('should return all categories', () => {
    const categories = getAllRaceEthnicityCategories()
    expect(categories.length).toBe(RACE_ETHNICITY_CATEGORIES.length)
    for (const category of RACE_ETHNICITY_CATEGORIES) {
      expect(categories).toContain(category)
    }
  })
})
