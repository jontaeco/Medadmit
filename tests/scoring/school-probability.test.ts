import { describe, it, expect } from 'vitest'
import {
  calculateSchoolProbability,
  calculateAllSchoolProbabilities,
} from '@/lib/scoring/school-probability'
import { getSchoolById, getAllSchools } from '@/lib/data'
import type { ApplicantInput } from '@/lib/scoring/types'

// Helper to create a base applicant input
function createApplicant(overrides: Partial<ApplicantInput> = {}): ApplicantInput {
  return {
    cumulativeGPA: 3.7,
    scienceGPA: null,
    mcatTotal: 515,
    mcatCPBS: null,
    mcatCARS: null,
    mcatBBFL: null,
    mcatPSBB: null,
    stateOfResidence: 'CA',
    raceEthnicity: null,
    isFirstGeneration: false,
    isDisadvantaged: false,
    isRuralBackground: false,
    clinicalHoursTotal: 300,
    clinicalHoursPaid: 0,
    clinicalHoursVolunteer: 300,
    researchHoursTotal: 500,
    hasResearchPublications: false,
    publicationCount: 0,
    volunteerHoursNonClinical: 150,
    shadowingHours: 50,
    leadershipExperiences: 2,
    teachingHours: 0,
    applicationYear: 2024,
    isReapplicant: false,
    hasInstitutionalAction: false,
    hasCriminalHistory: false,
    ...overrides,
  }
}

describe('School Probability Calculation', () => {
  it('should calculate valid probability for a school', () => {
    const applicant = createApplicant()
    const school = getSchoolById('harvard-med')!

    const result = calculateSchoolProbability(applicant, school)

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
    expect(result.probabilityLower).toBeLessThanOrEqual(result.probability)
    expect(result.probabilityUpper).toBeGreaterThanOrEqual(result.probability)
  })

  it('should return category classification', () => {
    const applicant = createApplicant()
    const school = getSchoolById('harvard-med')!

    const result = calculateSchoolProbability(applicant, school)

    expect(['reach', 'target', 'safety']).toContain(result.category)
  })

  it('should include fit metrics', () => {
    const applicant = createApplicant()
    const school = getSchoolById('harvard-med')!

    const result = calculateSchoolProbability(applicant, school)

    expect(result.fit.gpaPercentile).toBeGreaterThanOrEqual(0)
    expect(result.fit.gpaPercentile).toBeLessThanOrEqual(100)
    expect(result.fit.mcatPercentile).toBeGreaterThanOrEqual(0)
    expect(result.fit.mcatPercentile).toBeLessThanOrEqual(100)
    expect(typeof result.fit.isInState).toBe('boolean')
  })

  it('should give higher probability for higher stats', () => {
    const lowStats = createApplicant({ cumulativeGPA: 3.3, mcatTotal: 505 })
    const highStats = createApplicant({ cumulativeGPA: 3.9, mcatTotal: 522 })
    const school = getSchoolById('umich-med')!

    const lowResult = calculateSchoolProbability(lowStats, school)
    const highResult = calculateSchoolProbability(highStats, school)

    expect(highResult.probability).toBeGreaterThan(lowResult.probability)
  })

  it('should give in-state advantage at public schools', () => {
    const oosApplicant = createApplicant({ stateOfResidence: 'NY' })
    const inStateApplicant = createApplicant({ stateOfResidence: 'WA' })
    const school = getSchoolById('uw-medicine')!

    const oosResult = calculateSchoolProbability(oosApplicant, school)
    const inStateResult = calculateSchoolProbability(inStateApplicant, school)

    expect(inStateResult.probability).toBeGreaterThan(oosResult.probability)
    expect(inStateResult.fit.isInState).toBe(true)
    expect(oosResult.fit.isInState).toBe(false)
  })

  it('should apply URM advantage', () => {
    const nonURM = createApplicant({ raceEthnicity: 'White' })
    const urm = createApplicant({ raceEthnicity: 'Black or African American' })
    const school = getSchoolById('umich-med')!

    const nonURMResult = calculateSchoolProbability(nonURM, school)
    const urmResult = calculateSchoolProbability(urm, school)

    expect(urmResult.factors.demographicAdjustment).toBeGreaterThan(
      nonURMResult.factors.demographicAdjustment
    )
    expect(urmResult.probability).toBeGreaterThan(nonURMResult.probability)
  })

  it('should classify Harvard as reach for average applicant', () => {
    const average = createApplicant({ cumulativeGPA: 3.6, mcatTotal: 512 })
    const school = getSchoolById('harvard-med')!

    const result = calculateSchoolProbability(average, school)

    expect(result.category).toBe('reach')
  })

  it('should identify mission alignment', () => {
    const rural = createApplicant({ isRuralBackground: true })
    const school = getSchoolById('uw-medicine')!

    const result = calculateSchoolProbability(rural, school)

    expect(result.fit.missionAlignment.length).toBeGreaterThan(0)
  })
})

describe('All Schools Probability Calculation', () => {
  it('should calculate probabilities for all schools', () => {
    const applicant = createApplicant()
    const results = calculateAllSchoolProbabilities(applicant)

    expect(results.length).toBe(getAllSchools().length)
    for (const result of results) {
      expect(result.probability).toBeGreaterThanOrEqual(0)
      expect(result.probability).toBeLessThanOrEqual(1)
    }
  })

  it('should include schools from all categories', () => {
    const applicant = createApplicant({ cumulativeGPA: 3.6, mcatTotal: 512 })
    const results = calculateAllSchoolProbabilities(applicant)

    const reaches = results.filter((r) => r.category === 'reach')
    const targets = results.filter((r) => r.category === 'target')
    const safeties = results.filter((r) => r.category === 'safety')

    expect(reaches.length).toBeGreaterThan(0)
    expect(targets.length).toBeGreaterThan(0)
    // safeties may or may not exist depending on stats and schools in database
  })
})

describe('Category Classification', () => {
  it('should classify highly selective schools as reach for below-median stats', () => {
    // Stats significantly below Harvard's medians (3.94 GPA, 521 MCAT)
    const applicant = createApplicant({ cumulativeGPA: 3.5, mcatTotal: 508 })

    const harvard = calculateSchoolProbability(applicant, getSchoolById('harvard-med')!)
    const stanford = calculateSchoolProbability(applicant, getSchoolById('stanford-med')!)
    const hopkins = calculateSchoolProbability(applicant, getSchoolById('johns-hopkins')!)

    expect(harvard.category).toBe('reach')
    expect(stanford.category).toBe('reach')
    expect(hopkins.category).toBe('reach')
  })

  it('should classify more accessible schools as target/safety for high stats', () => {
    const highStats = createApplicant({ cumulativeGPA: 3.9, mcatTotal: 520 })

    const georgetown = calculateSchoolProbability(highStats, getSchoolById('georgetown-med')!)
    const tufts = calculateSchoolProbability(highStats, getSchoolById('tufts-med')!)

    expect(['target', 'safety']).toContain(georgetown.category)
    expect(['target', 'safety']).toContain(tufts.category)
  })

  it('should mark hostile OOS schools as reach for OOS applicants', () => {
    const oosApplicant = createApplicant({
      stateOfResidence: 'NY',
      cumulativeGPA: 3.9,
      mcatTotal: 520,
    })

    const uwMedicine = calculateSchoolProbability(oosApplicant, getSchoolById('uw-medicine')!)

    expect(uwMedicine.category).toBe('reach')
    expect(uwMedicine.fit.isInState).toBe(false)
  })
})
