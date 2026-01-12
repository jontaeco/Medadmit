import { describe, it, expect } from 'vitest'
import {
  calculateRaceEthnicityEffect,
  calculateSESEffect,
  calculateMissionInteraction,
  calculateDemographicEffect,
  getDemographicBreakdown,
  isURM,
  logitToOddsRatio,
  oddsRatioToLogit,
  getAvailableRaceCategories,
  getDemographicUncertainty,
  DEFAULT_DEMOGRAPHIC_PARAMS,
} from '@/lib/model/demographics'
import type { ApplicantProfile, SchoolData, MissionFeatures } from '@/lib/model/types'

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
    publications: { firstAuthor: 0, other: 0, posters: 0 },
    stateOfResidence: 'CA',
    raceEthnicity: 'White',
    isUrm: false,
    isFirstGen: false,
    isDisadvantaged: false,
    isRural: false,
    ...overrides,
  }
}

// Helper to create a base school
function createSchool(overrides: Partial<SchoolData> = {}): SchoolData {
  return {
    id: 'test-school',
    name: 'Test Medical School',
    state: 'CA',
    isPublic: false,
    tier: 2,
    medianGPA: 3.75,
    medianMCAT: 515,
    missionFeatures: {
      ruralMission: false,
      researchIntensive: false,
      primaryCareFocus: false,
      hbcu: false,
      diversityFocus: false,
    },
    ...overrides,
  } as SchoolData
}

describe('Race/Ethnicity Effects', () => {
  it('should return 0 for null race/ethnicity', () => {
    expect(calculateRaceEthnicityEffect(null)).toBe(0)
  })

  it('should return 0 for White (reference group)', () => {
    expect(calculateRaceEthnicityEffect('White')).toBe(0)
  })

  it('should return positive effect for Black/African American', () => {
    const effect = calculateRaceEthnicityEffect('Black or African American')
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(1.95, 1) // ~OR 7.0
  })

  it('should return positive effect for Hispanic/Latino', () => {
    const effect = calculateRaceEthnicityEffect('Hispanic, Latino, or of Spanish Origin')
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(1.39, 1) // ~OR 4.0
  })

  it('should return slight negative effect for Asian', () => {
    const effect = calculateRaceEthnicityEffect('Asian')
    expect(effect).toBeLessThan(0)
    expect(effect).toBeCloseTo(-0.16, 1) // ~OR 0.85
  })

  it('should handle case-insensitive matching', () => {
    const effect1 = calculateRaceEthnicityEffect('BLACK OR AFRICAN AMERICAN')
    const effect2 = calculateRaceEthnicityEffect('black or african american')
    expect(effect1).toBe(effect2)
  })

  it('should translate to expected odds ratios', () => {
    const blackEffect = calculateRaceEthnicityEffect('Black or African American')
    const or = logitToOddsRatio(blackEffect)
    expect(or).toBeGreaterThan(5)
    expect(or).toBeLessThan(10)
  })
})

describe('URM Classification', () => {
  it('should classify Black as URM', () => {
    expect(isURM('Black or African American')).toBe(true)
  })

  it('should classify Hispanic as URM', () => {
    expect(isURM('Hispanic, Latino, or of Spanish Origin')).toBe(true)
  })

  it('should classify American Indian as URM', () => {
    expect(isURM('American Indian or Alaska Native')).toBe(true)
  })

  it('should classify Native Hawaiian as URM', () => {
    expect(isURM('Native Hawaiian or Other Pacific Islander')).toBe(true)
  })

  it('should not classify White as URM', () => {
    expect(isURM('White')).toBe(false)
  })

  it('should not classify Asian as URM', () => {
    expect(isURM('Asian')).toBe(false)
  })

  it('should handle null', () => {
    expect(isURM(null)).toBe(false)
  })
})

describe('SES Effects', () => {
  it('should return 0 for no SES factors', () => {
    const applicant = createApplicant({
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })
    expect(calculateSESEffect(applicant)).toBe(0)
  })

  it('should add effect for first-gen status', () => {
    const applicant = createApplicant({ isFirstGen: true })
    const effect = calculateSESEffect(applicant)
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(0.15, 1)
  })

  it('should add effect for disadvantaged status', () => {
    const applicant = createApplicant({ isDisadvantaged: true })
    const effect = calculateSESEffect(applicant)
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(0.22, 1)
  })

  it('should add effect for rural background', () => {
    const applicant = createApplicant({ isRural: true })
    const effect = calculateSESEffect(applicant)
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(0.20, 1)
  })

  it('should stack multiple SES effects', () => {
    const applicant = createApplicant({
      isFirstGen: true,
      isDisadvantaged: true,
      isRural: true,
    })
    const effect = calculateSESEffect(applicant)
    expect(effect).toBeGreaterThan(0.5)
  })
})

describe('Mission Fit Interactions', () => {
  it('should return 0 when no features match', () => {
    const applicant = createApplicant()
    const school = createSchool()
    expect(calculateMissionInteraction(applicant, school)).toBe(0)
  })

  it('should add bonus for rural applicant at rural school', () => {
    const applicant = createApplicant({ isRural: true })
    const school = createSchool({
      missionFeatures: { ...createSchool().missionFeatures, ruralMission: true },
    })
    const effect = calculateMissionInteraction(applicant, school)
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(0.4, 1)
  })

  it('should add bonus for research applicant at research school', () => {
    const applicant = createApplicant({ researchHours: 1500, researchInterest: true })
    const school = createSchool({
      missionFeatures: { ...createSchool().missionFeatures, researchIntensive: true },
    })
    const effect = calculateMissionInteraction(applicant, school)
    expect(effect).toBeGreaterThan(0)
  })

  it('should add strong bonus for in-state at public school', () => {
    const applicant = createApplicant({ stateOfResidence: 'TX' })
    const school = createSchool({ state: 'TX', isPublic: true })
    const effect = calculateMissionInteraction(applicant, school)
    expect(effect).toBeGreaterThan(0.5)
    expect(effect).toBeCloseTo(0.8, 1)
  })

  it('should not add in-state bonus for private school', () => {
    const applicant = createApplicant({ stateOfResidence: 'TX' })
    const school = createSchool({ state: 'TX', isPublic: false })
    expect(calculateMissionInteraction(applicant, school)).toBe(0)
  })

  it('should not add in-state bonus for out-of-state at public school', () => {
    const applicant = createApplicant({ stateOfResidence: 'CA' })
    const school = createSchool({ state: 'TX', isPublic: true })
    expect(calculateMissionInteraction(applicant, school)).toBe(0)
  })

  it('should add bonus for URM at diversity-focused school', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Black or African American',
      isUrm: true,
    })
    const school = createSchool({
      missionFeatures: { ...createSchool().missionFeatures, diversityFocus: true },
    })
    const effect = calculateMissionInteraction(applicant, school)
    expect(effect).toBeGreaterThan(0)
  })

  it('should add bonus for Black applicant at HBCU', () => {
    const applicant = createApplicant({ raceEthnicity: 'Black or African American' })
    const school = createSchool({
      missionFeatures: { ...createSchool().missionFeatures, hbcu: true },
    })
    const effect = calculateMissionInteraction(applicant, school)
    expect(effect).toBeGreaterThan(0)
    expect(effect).toBeCloseTo(0.5, 1)
  })

  it('should stack multiple interactions', () => {
    const applicant = createApplicant({
      stateOfResidence: 'TX',
      isRural: true,
      isUrm: true,
      raceEthnicity: 'Hispanic, Latino, or of Spanish Origin',
    })
    const school = createSchool({
      state: 'TX',
      isPublic: true,
      missionFeatures: {
        ruralMission: true,
        researchIntensive: false,
        primaryCareFocus: false,
        hbcu: false,
        diversityFocus: true,
      },
    })
    const effect = calculateMissionInteraction(applicant, school)
    // Should have: rural_x_rural + public_x_instate + diversity_x_urm
    expect(effect).toBeGreaterThan(1.0)
  })
})

describe('Combined Demographic Effect', () => {
  it('should combine all effect types', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Black or African American',
      isUrm: true,
      isFirstGen: true,
      stateOfResidence: 'TX',
    })
    const school = createSchool({
      state: 'TX',
      isPublic: true,
      missionFeatures: { ...createSchool().missionFeatures, diversityFocus: true },
    })

    const total = calculateDemographicEffect(applicant, school)

    // Should include: race effect + firstGen + inState + diversity
    expect(total).toBeGreaterThan(2.5)
  })

  it('should return only race effect for minimal applicant', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Black or African American',
      isUrm: true,
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })
    const school = createSchool()

    const raceEffect = calculateRaceEthnicityEffect(applicant.raceEthnicity)
    const totalEffect = calculateDemographicEffect(applicant, school)

    expect(totalEffect).toBe(raceEffect)
  })
})

describe('Demographic Breakdown', () => {
  it('should return all component effects', () => {
    const applicant = createApplicant()
    const school = createSchool()
    const breakdown = getDemographicBreakdown(applicant, school)

    expect(breakdown).toHaveProperty('raceEthnicity')
    expect(breakdown).toHaveProperty('firstGen')
    expect(breakdown).toHaveProperty('disadvantaged')
    expect(breakdown).toHaveProperty('rural')
    expect(breakdown).toHaveProperty('missionFit')
    expect(breakdown).toHaveProperty('inState')
    expect(breakdown).toHaveProperty('total')
  })

  it('should have total equal to sum of components', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Hispanic, Latino, or of Spanish Origin',
      isUrm: true,
      isFirstGen: true,
      isRural: true,
      stateOfResidence: 'TX',
    })
    const school = createSchool({
      state: 'TX',
      isPublic: true,
      missionFeatures: {
        ruralMission: true,
        researchIntensive: false,
        primaryCareFocus: false,
        hbcu: false,
        diversityFocus: true,
      },
    })

    const breakdown = getDemographicBreakdown(applicant, school)
    const calculatedTotal =
      breakdown.raceEthnicity +
      breakdown.firstGen +
      breakdown.disadvantaged +
      breakdown.rural +
      breakdown.missionFit +
      breakdown.inState

    expect(breakdown.total).toBeCloseTo(calculatedTotal, 10)
  })

  it('should match calculateDemographicEffect result', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Asian',
      isFirstGen: true,
      stateOfResidence: 'CA',
    })
    const school = createSchool({ state: 'CA', isPublic: true })

    const breakdown = getDemographicBreakdown(applicant, school)
    const direct = calculateDemographicEffect(applicant, school)

    expect(breakdown.total).toBeCloseTo(direct, 10)
  })
})

describe('Utility Functions', () => {
  it('should convert logit to OR correctly', () => {
    expect(logitToOddsRatio(0)).toBe(1)
    expect(logitToOddsRatio(Math.log(2))).toBeCloseTo(2, 10)
    expect(logitToOddsRatio(Math.log(0.5))).toBeCloseTo(0.5, 10)
  })

  it('should convert OR to logit correctly', () => {
    expect(oddsRatioToLogit(1)).toBe(0)
    expect(oddsRatioToLogit(2)).toBeCloseTo(Math.log(2), 10)
    expect(oddsRatioToLogit(0.5)).toBeCloseTo(Math.log(0.5), 10)
  })

  it('should round-trip logit <-> OR', () => {
    const values = [0, 0.5, 1.0, 1.5, -0.5]
    for (const v of values) {
      expect(oddsRatioToLogit(logitToOddsRatio(v))).toBeCloseTo(v, 10)
    }
  })

  it('should return available race categories', () => {
    const categories = getAvailableRaceCategories()
    expect(categories.length).toBeGreaterThan(5)
    expect(categories).not.toContain('urm_aggregate')
  })

  it('should return uncertainty for effect types', () => {
    const urmSD = getDemographicUncertainty('urm')
    const sesSD = getDemographicUncertainty('ses')
    const instateSD = getDemographicUncertainty('instate')

    expect(urmSD).toBeGreaterThan(0)
    expect(sesSD).toBeGreaterThan(0)
    expect(instateSD).toBeGreaterThan(0)
  })
})

describe('Default Parameters', () => {
  it('should have race ethnicity effects', () => {
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.raceEthnicity).toBeDefined()
    expect(Object.keys(DEFAULT_DEMOGRAPHIC_PARAMS.raceEthnicity).length).toBeGreaterThan(5)
  })

  it('should have socioeconomic effects', () => {
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.socioeconomic).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.socioeconomic.first_generation).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.socioeconomic.disadvantaged_ses).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.socioeconomic.rural_background).toBeDefined()
  })

  it('should have mission interactions', () => {
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.missionInteractions).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.missionInteractions.rural_x_rural).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.missionInteractions.public_x_instate).toBeDefined()
  })

  it('should have school level variance parameters', () => {
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.schoolLevelVariance).toBeDefined()
    expect(DEFAULT_DEMOGRAPHIC_PARAMS.schoolLevelVariance.urm_effect).toBeDefined()
  })
})

describe('Edge Cases', () => {
  it('should handle unknown race/ethnicity gracefully', () => {
    const effect = calculateRaceEthnicityEffect('Unknown Category')
    expect(effect).toBe(0)
  })

  it('should handle applicant with all demographic factors', () => {
    const applicant = createApplicant({
      raceEthnicity: 'Black or African American',
      isUrm: true,
      isFirstGen: true,
      isDisadvantaged: true,
      isRural: true,
      stateOfResidence: 'TX',
      researchHours: 2000,
      researchInterest: true,
      primaryCareInterest: true,
    })

    const school = createSchool({
      state: 'TX',
      isPublic: true,
      missionFeatures: {
        ruralMission: true,
        researchIntensive: true,
        primaryCareFocus: true,
        hbcu: false,
        diversityFocus: true,
      },
    })

    const effect = calculateDemographicEffect(applicant, school)
    expect(Number.isFinite(effect)).toBe(true)
    expect(effect).toBeGreaterThan(3) // Many stacking effects
  })

  it('should handle applicant with no demographic factors', () => {
    const applicant = createApplicant({
      raceEthnicity: null,
      isUrm: false,
      isFirstGen: false,
      isDisadvantaged: false,
      isRural: false,
    })
    const school = createSchool()

    const effect = calculateDemographicEffect(applicant, school)
    expect(effect).toBe(0)
  })
})
