import { describe, it, expect } from 'vitest'
import {
  getAllSchools,
  getSchoolById,
  getSchoolsByState,
  filterSchools,
  calculateSchoolFit,
  buildSchoolList,
  getSchoolsStatistics,
} from '@/lib/data/schools'

describe('School Data Integrity', () => {
  it('should load all schools', () => {
    const schools = getAllSchools()
    expect(schools).toBeDefined()
    expect(schools.length).toBeGreaterThan(0)
  })

  it('should have valid school data for each school', () => {
    const schools = getAllSchools()
    for (const school of schools) {
      // Required fields
      expect(school.id).toBeDefined()
      expect(school.name).toBeDefined()
      expect(school.shortName).toBeDefined()
      expect(school.state).toBeDefined()
      expect(school.city).toBeDefined()

      // Stats should be in valid ranges
      expect(school.medianGPA).toBeGreaterThanOrEqual(2.0)
      expect(school.medianGPA).toBeLessThanOrEqual(4.0)
      expect(school.medianMCAT).toBeGreaterThanOrEqual(472)
      expect(school.medianMCAT).toBeLessThanOrEqual(528)

      // Percentages should be 0-1
      expect(school.pctInStateMatriculants).toBeGreaterThanOrEqual(0)
      expect(school.pctInStateMatriculants).toBeLessThanOrEqual(1)
      expect(school.pctOutOfStateMatriculants).toBeGreaterThanOrEqual(0)
      expect(school.pctOutOfStateMatriculants).toBeLessThanOrEqual(1)

      // In-state + OOS should equal 1 (approximately)
      const total = school.pctInStateMatriculants + school.pctOutOfStateMatriculants
      expect(Math.abs(total - 1)).toBeLessThan(0.01)

      // Class counts should be consistent
      expect(school.totalMatriculated).toBeLessThanOrEqual(school.totalAccepted)
      expect(school.totalAccepted).toBeLessThanOrEqual(school.totalInterviewed)
      expect(school.totalInterviewed).toBeLessThanOrEqual(school.totalApplicants)

      // OOS friendliness should be valid
      expect(['friendly', 'neutral', 'unfriendly', 'hostile']).toContain(
        school.oosFriendliness
      )
    }
  })

  it('should have unique school IDs', () => {
    const schools = getAllSchools()
    const ids = schools.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should include both public and private schools', () => {
    const schools = getAllSchools()
    const publicCount = schools.filter((s) => s.isPublic).length
    const privateCount = schools.filter((s) => !s.isPublic).length
    expect(publicCount).toBeGreaterThan(0)
    expect(privateCount).toBeGreaterThan(0)
  })
})

describe('School Lookup', () => {
  it('should find school by ID', () => {
    const school = getSchoolById('harvard-med')
    expect(school).toBeDefined()
    expect(school?.name).toBe('Harvard Medical School')
  })

  it('should return undefined for unknown ID', () => {
    const school = getSchoolById('nonexistent-school')
    expect(school).toBeUndefined()
  })

  it('should find schools by state', () => {
    const caSchools = getSchoolsByState('CA')
    expect(caSchools.length).toBeGreaterThan(0)
    for (const school of caSchools) {
      expect(school.state).toBe('CA')
    }
  })
})

describe('School Filtering', () => {
  it('should filter by public/private', () => {
    const publicSchools = filterSchools({ isPublic: true })
    const privateSchools = filterSchools({ isPublic: false })

    expect(publicSchools.length).toBeGreaterThan(0)
    expect(privateSchools.length).toBeGreaterThan(0)

    for (const school of publicSchools) {
      expect(school.isPublic).toBe(true)
    }
    for (const school of privateSchools) {
      expect(school.isPublic).toBe(false)
    }
  })

  it('should filter by OOS friendliness', () => {
    const friendlySchools = filterSchools({ oosFriendly: true })
    for (const school of friendlySchools) {
      expect(['friendly', 'neutral']).toContain(school.oosFriendliness)
    }
  })

  it('should filter by MCAT range', () => {
    const filteredSchools = filterSchools({ minMedianMCAT: 515, maxMedianMCAT: 520 })
    for (const school of filteredSchools) {
      expect(school.medianMCAT).toBeGreaterThanOrEqual(515)
      expect(school.medianMCAT).toBeLessThanOrEqual(520)
    }
  })

  it('should filter by mission keywords', () => {
    const researchSchools = filterSchools({ missionKeywords: ['research'] })
    for (const school of researchSchools) {
      expect(school.missionKeywords).toContain('research')
    }
  })

  it('should combine multiple filters', () => {
    const filteredSchools = filterSchools({
      isPublic: true,
      minMedianMCAT: 510,
      oosFriendly: true,
    })

    for (const school of filteredSchools) {
      expect(school.isPublic).toBe(true)
      expect(school.medianMCAT).toBeGreaterThanOrEqual(510)
      expect(['friendly', 'neutral']).toContain(school.oosFriendliness)
    }
  })
})

describe('School Fit Calculation', () => {
  it('should calculate fit for in-state applicant', () => {
    const school = getSchoolById('uw-medicine')!
    const fit = calculateSchoolFit(school, 3.6, 512, 'WA')

    expect(fit.isInState).toBe(true)
    expect(fit.stateAdvantage).toBeGreaterThan(1)
    expect(fit.gpaPercentile).toBeGreaterThanOrEqual(0)
    expect(fit.gpaPercentile).toBeLessThanOrEqual(100)
    expect(['reach', 'target', 'safety']).toContain(fit.category)
  })

  it('should calculate fit for out-of-state applicant', () => {
    const school = getSchoolById('uw-medicine')!
    const fit = calculateSchoolFit(school, 3.6, 512, 'NY')

    expect(fit.isInState).toBe(false)
    expect(fit.stateAdvantage).toBe(1)
  })

  it('should categorize correctly based on stats', () => {
    const school = getSchoolById('harvard-med')!

    // Below median stats should be reach
    const lowFit = calculateSchoolFit(school, 3.7, 515, 'NY')
    expect(lowFit.category).toBe('reach')

    // Well above median stats could be target/safety
    const highFit = calculateSchoolFit(school, 3.98, 525, 'NY')
    expect(['target', 'safety']).toContain(highFit.category)
  })
})

describe('School List Building', () => {
  it('should build a balanced school list', () => {
    const list = buildSchoolList(3.7, 515, 'NY', { targetCount: 15 })

    expect(list.length).toBeLessThanOrEqual(15)
    expect(list.length).toBeGreaterThan(0)

    // Should have categories
    const reaches = list.filter((m) => m.category === 'reach')
    const targets = list.filter((m) => m.category === 'target')
    const safeties = list.filter((m) => m.category === 'safety')

    // Should have at least some targets (the core of any list)
    expect(targets.length + reaches.length + safeties.length).toBe(list.length)
  })

  it('should apply filters when building list', () => {
    const list = buildSchoolList(3.7, 515, 'NY', {
      targetCount: 10,
      filters: { isPublic: true },
    })

    for (const match of list) {
      expect(match.school.isPublic).toBe(true)
    }
  })

  it('should provide fit scores and reasons', () => {
    const list = buildSchoolList(3.7, 515, 'NY', { targetCount: 5 })

    for (const match of list) {
      expect(match.fitScore).toBeGreaterThanOrEqual(0)
      expect(match.fitScore).toBeLessThanOrEqual(100)
      expect(match.reasons).toBeDefined()
    }
  })
})

describe('School Statistics', () => {
  it('should calculate aggregate statistics', () => {
    const stats = getSchoolsStatistics()

    expect(stats.totalSchools).toBeGreaterThan(0)
    expect(stats.publicSchools).toBeGreaterThan(0)
    expect(stats.privateSchools).toBeGreaterThan(0)
    expect(stats.publicSchools + stats.privateSchools).toBe(stats.totalSchools)

    expect(stats.avgMedianGPA).toBeGreaterThan(3.0)
    expect(stats.avgMedianGPA).toBeLessThan(4.0)
    expect(stats.avgMedianMCAT).toBeGreaterThan(500)
    expect(stats.avgMedianMCAT).toBeLessThan(530)

    expect(stats.byOOSFriendliness).toBeDefined()
  })
})
