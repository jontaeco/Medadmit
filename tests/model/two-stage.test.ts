import { describe, it, expect } from 'vitest'
import {
  calculateSchoolProbability,
  calculateListProbability,
  calculateInterviewProbability,
  calculateAcceptGivenInterviewProbability,
  categorizeSchool,
  sigmoid,
  logit,
  getSchoolParams,
  getAvailableSchoolIds,
  quickPredict,
  getPredictionSummary,
} from '@/lib/model/two-stage'
import type { ApplicantProfile, SchoolData, SchoolModelParams } from '@/lib/model/types'

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
    raceEthnicity: null,
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
    id: 'harvard-med',
    name: 'Harvard Medical School',
    state: 'MA',
    isPublic: false,
    tier: 1,
    medianGPA: 3.9,
    medianMCAT: 520,
    gpaPercentiles: { p10: 3.7, p25: 3.8, p75: 3.95, p90: 4.0 },
    mcatPercentiles: { p10: 515, p25: 518, p75: 523, p90: 526 },
    totalApplicants: 7000,
    totalInterviewed: 800,
    totalAccepted: 350,
    interviewRate: 0.11,
    interviewToAcceptRate: 0.44,
    inStateInterviewRate: null,
    oosInterviewRate: null,
    missionFeatures: {
      ruralMission: false,
      researchIntensive: true,
      primaryCareFocus: false,
      hbcu: false,
      diversityFocus: false,
    },
    ...overrides,
  } as SchoolData
}

describe('Sigmoid and Logit Functions', () => {
  it('sigmoid should return 0.5 for input 0', () => {
    expect(sigmoid(0)).toBe(0.5)
  })

  it('sigmoid should be bounded between 0 and 1', () => {
    expect(sigmoid(-100)).toBeGreaterThanOrEqual(0)
    expect(sigmoid(-100)).toBeLessThan(0.01)
    expect(sigmoid(100)).toBeGreaterThan(0.99)
    expect(sigmoid(100)).toBeLessThanOrEqual(1)
  })

  it('logit should return 0 for input 0.5', () => {
    expect(logit(0.5)).toBe(0)
  })

  it('logit and sigmoid should be inverses', () => {
    const values = [0.1, 0.3, 0.5, 0.7, 0.9]
    for (const p of values) {
      expect(sigmoid(logit(p))).toBeCloseTo(p, 10)
    }
  })
})

describe('School Parameters', () => {
  it('should return params for known school', () => {
    const params = getSchoolParams('harvard-med')
    expect(params).not.toBeNull()
    expect(params?.interceptInterview).toBeDefined()
    expect(params?.slopeC_interview).toBeDefined()
  })

  it('should return null for unknown school', () => {
    const params = getSchoolParams('nonexistent-school')
    expect(params).toBeNull()
  })

  it('should return list of available schools', () => {
    const schools = getAvailableSchoolIds()
    expect(schools.length).toBeGreaterThan(100)
    expect(schools).toContain('harvard-med')
    expect(schools).toContain('stanford-med')
  })
})

describe('Interview Probability', () => {
  const applicant = createApplicant()
  const school = createSchool()
  const params: SchoolModelParams = {
    interceptInterview: -2.5,
    interceptAccept: -0.5,
    slopeC_interview: 1.3,
    slopeC_accept: 0.65,
    inStateBonus_interview: 0.8,
    inStateBonus_accept: 0.3,
  }

  it('should return probability between 0 and 1', () => {
    const result = calculateInterviewProbability(applicant, school, params, 0, 0.3, 0)
    expect(result.probability).toBeGreaterThan(0)
    expect(result.probability).toBeLessThan(1)
  })

  it('should increase with higher competitiveness', () => {
    const lowC = calculateInterviewProbability(applicant, school, params, -1, 0.3, 0)
    const highC = calculateInterviewProbability(applicant, school, params, 1, 0.3, 0)
    expect(highC.probability).toBeGreaterThan(lowC.probability)
  })

  it('should increase with positive demographic effect', () => {
    const noDemo = calculateInterviewProbability(applicant, school, params, 0, 0.3, 0)
    const withDemo = calculateInterviewProbability(applicant, school, params, 0, 0.3, 1.5)
    expect(withDemo.probability).toBeGreaterThan(noDemo.probability)
  })

  it('should add in-state bonus for matching state', () => {
    const inStateApplicant = createApplicant({ stateOfResidence: 'MA' })
    const oosApplicant = createApplicant({ stateOfResidence: 'CA' })

    const inState = calculateInterviewProbability(inStateApplicant, school, params, 0, 0.3, 0)
    const oos = calculateInterviewProbability(oosApplicant, school, params, 0, 0.3, 0)

    expect(inState.probability).toBeGreaterThan(oos.probability)
  })
})

describe('Accept Given Interview Probability', () => {
  const applicant = createApplicant()
  const school = createSchool()
  const params: SchoolModelParams = {
    interceptInterview: -2.5,
    interceptAccept: -0.5,
    slopeC_interview: 1.3,
    slopeC_accept: 0.65,
    inStateBonus_interview: 0.8,
    inStateBonus_accept: 0.3,
  }

  it('should return probability between 0 and 1', () => {
    const result = calculateAcceptGivenInterviewProbability(applicant, school, params, 0)
    expect(result.probability).toBeGreaterThan(0)
    expect(result.probability).toBeLessThan(1)
  })

  it('should increase with higher competitiveness', () => {
    const lowC = calculateAcceptGivenInterviewProbability(applicant, school, params, -1)
    const highC = calculateAcceptGivenInterviewProbability(applicant, school, params, 1)
    expect(highC.probability).toBeGreaterThan(lowC.probability)
  })

  it('should have flatter slope than interview stage', () => {
    // This is a design property - acceptance is less stats-dependent
    expect(params.slopeC_accept).toBeLessThan(params.slopeC_interview)
  })
})

describe('School Category Classification', () => {
  it('should classify very low probability as reach', () => {
    expect(categorizeSchool(0.05)).toBe('reach')
    expect(categorizeSchool(0.14)).toBe('reach')
  })

  it('should classify moderate probability as target', () => {
    expect(categorizeSchool(0.20)).toBe('target')
    expect(categorizeSchool(0.30)).toBe('target')
  })

  it('should classify good probability as likely', () => {
    expect(categorizeSchool(0.40)).toBe('likely')
    expect(categorizeSchool(0.55)).toBe('likely')
  })

  it('should classify high probability as safety', () => {
    expect(categorizeSchool(0.65)).toBe('safety')
    expect(categorizeSchool(0.80)).toBe('safety')
  })
})

describe('Full School Probability Calculation', () => {
  it('should return null for unknown school', () => {
    const applicant = createApplicant()
    const school = createSchool({ id: 'nonexistent-school' })
    const result = calculateSchoolProbability(applicant, school)
    expect(result).toBeNull()
  })

  it('should return valid prediction for known school', () => {
    const applicant = createApplicant()
    const school = createSchool({ id: 'harvard-med' })
    const result = calculateSchoolProbability(applicant, school)

    expect(result).not.toBeNull()
    expect(result?.pInterview).toBeGreaterThan(0)
    expect(result?.pInterview).toBeLessThan(1)
    expect(result?.pAcceptGivenInterview).toBeGreaterThan(0)
    expect(result?.pAcceptGivenInterview).toBeLessThan(1)
    expect(result?.pAccept).toBeGreaterThan(0)
    expect(result?.pAccept).toBeLessThan(1)
  })

  it('should have combined probability equal to product of stages', () => {
    const applicant = createApplicant()
    const school = createSchool({ id: 'harvard-med' })
    const result = calculateSchoolProbability(applicant, school)

    if (result) {
      const expected = result.pInterview * result.pAcceptGivenInterview
      expect(result.pAccept).toBeCloseTo(expected, 10)
    }
  })

  it('should return breakdown information', () => {
    const applicant = createApplicant()
    const school = createSchool({ id: 'harvard-med' })
    const result = calculateSchoolProbability(applicant, school)

    expect(result?.breakdown).toBeDefined()
    expect(result?.breakdown.competitiveness).toBeDefined()
    expect(result?.breakdown.experienceEffect).toBeDefined()
    expect(result?.breakdown.demographicEffect).toBeDefined()
  })

  it('should give higher probability to stronger applicant', () => {
    const school = createSchool({ id: 'harvard-med' })

    const weakApplicant = createApplicant({ gpa: 3.3, mcat: 505 })
    const strongApplicant = createApplicant({ gpa: 3.95, mcat: 524 })

    const weakResult = calculateSchoolProbability(weakApplicant, school)
    const strongResult = calculateSchoolProbability(strongApplicant, school)

    expect(strongResult?.pAccept).toBeGreaterThan(weakResult?.pAccept ?? 0)
  })

  it('should give higher probability to URM applicant', () => {
    const school = createSchool({ id: 'harvard-med' })

    const nonUrm = createApplicant({ isUrm: false, raceEthnicity: 'White' })
    const urm = createApplicant({
      isUrm: true,
      raceEthnicity: 'Black or African American',
    })

    const nonUrmResult = calculateSchoolProbability(nonUrm, school)
    const urmResult = calculateSchoolProbability(urm, school)

    expect(urmResult?.pAccept).toBeGreaterThan(nonUrmResult?.pAccept ?? 0)
  })
})

describe('List Probability Calculation', () => {
  it('should calculate predictions for multiple schools', () => {
    const applicant = createApplicant()
    const schools = [
      createSchool({ id: 'harvard-med' }),
      createSchool({ id: 'stanford-med' }),
      createSchool({ id: 'johns-hopkins' }),
    ]

    const result = calculateListProbability(applicant, schools)

    expect(result.schools.length).toBe(3)
    expect(result.expectedInterviews).toBeGreaterThan(0)
    expect(result.expectedAcceptances).toBeGreaterThan(0)
    expect(result.pAtLeastOne).toBeGreaterThan(0)
    expect(result.pAtLeastOne).toBeLessThanOrEqual(1)
  })

  it('should sort schools by probability descending', () => {
    const applicant = createApplicant()
    const schools = [
      createSchool({ id: 'harvard-med' }),
      createSchool({ id: 'stanford-med' }),
      createSchool({ id: 'johns-hopkins' }),
    ]

    const result = calculateListProbability(applicant, schools)

    for (let i = 1; i < result.schools.length; i++) {
      expect(result.schools[i].pAccept).toBeLessThanOrEqual(
        result.schools[i - 1].pAccept
      )
    }
  })

  it('should calculate pAtLeastOne correctly', () => {
    const applicant = createApplicant()
    const schools = [
      createSchool({ id: 'harvard-med' }),
      createSchool({ id: 'stanford-med' }),
    ]

    const result = calculateListProbability(applicant, schools)

    // P(at least one) = 1 - P(none) = 1 - (1-p1)(1-p2)
    let pNone = 1
    for (const s of result.schools) {
      pNone *= 1 - s.pAccept
    }
    const expected = 1 - pNone

    expect(result.pAtLeastOne).toBeCloseTo(expected, 10)
  })

  it('should skip schools without parameters', () => {
    const applicant = createApplicant()
    const schools = [
      createSchool({ id: 'harvard-med' }),
      createSchool({ id: 'nonexistent-school' }),
    ]

    const result = calculateListProbability(applicant, schools)

    expect(result.schools.length).toBe(1)
  })
})

describe('Quick Predict', () => {
  it('should return prediction for known school', () => {
    const result = quickPredict(3.7, 515, 'harvard-med')

    expect(result).not.toBeNull()
    expect(result?.pAccept).toBeGreaterThan(0)
    expect(result?.pInterview).toBeGreaterThan(0)
    expect(result?.category).toBeDefined()
  })

  it('should return null for unknown school', () => {
    const result = quickPredict(3.7, 515, 'nonexistent-school')
    expect(result).toBeNull()
  })

  it('should respond to stats changes', () => {
    const low = quickPredict(3.3, 505, 'harvard-med')
    const high = quickPredict(3.95, 524, 'harvard-med')

    expect(high?.pAccept).toBeGreaterThan(low?.pAccept ?? 0)
  })
})

describe('Prediction Summary', () => {
  it('should generate readable summary', () => {
    const applicant = createApplicant()
    const school = createSchool({ id: 'harvard-med' })
    const prediction = calculateSchoolProbability(applicant, school)

    if (prediction) {
      const summary = getPredictionSummary(prediction)
      expect(summary).toContain('P(Interview)')
      expect(summary).toContain('P(Accept)')
      expect(summary).toContain('Category')
      expect(summary).toContain('Competitiveness')
    }
  })
})

describe('Realistic Scenarios', () => {
  it('should give reasonable prediction for average applicant at top school', () => {
    const avgApplicant = createApplicant({
      gpa: 3.7,
      mcat: 515,
      clinicalHours: 300,
      researchHours: 500,
    })
    const harvard = createSchool({ id: 'harvard-med' })

    const result = calculateSchoolProbability(avgApplicant, harvard)

    // Average applicant at Harvard should be a reach
    expect(result?.category).toBe('reach')
    expect(result?.pAccept).toBeLessThan(0.15)
  })

  it('should give reasonable prediction for strong applicant', () => {
    const strongApplicant = createApplicant({
      gpa: 3.95,
      mcat: 524,
      clinicalHours: 1000,
      researchHours: 2000,
      publications: { firstAuthor: 2, other: 1, posters: 3 },
    })
    const school = createSchool({ id: 'harvard-med' })

    const result = calculateSchoolProbability(strongApplicant, school)

    // Strong applicant should have better odds
    expect(result?.pAccept).toBeGreaterThan(0.05)
  })

  it('should show URM advantage', () => {
    const baseApplicant = createApplicant({ gpa: 3.6, mcat: 510 })
    const urmApplicant = createApplicant({
      gpa: 3.6,
      mcat: 510,
      isUrm: true,
      raceEthnicity: 'Hispanic, Latino, or of Spanish Origin',
    })
    const school = createSchool({ id: 'harvard-med' })

    const baseResult = calculateSchoolProbability(baseApplicant, school)
    const urmResult = calculateSchoolProbability(urmApplicant, school)

    // URM should have higher probability
    const ratio = (urmResult?.pAccept ?? 0) / (baseResult?.pAccept ?? 1)
    expect(ratio).toBeGreaterThan(1.5) // At least 1.5x higher
  })

  it('should show in-state advantage for public school', () => {
    // Find a public school
    const publicSchoolId = 'ucla-geffen' // UCLA is public

    const oosApplicant = createApplicant({ stateOfResidence: 'TX' })
    const inStateApplicant = createApplicant({ stateOfResidence: 'CA' })

    const publicSchool = createSchool({
      id: publicSchoolId,
      state: 'CA',
      isPublic: true,
    })

    const oosResult = calculateSchoolProbability(oosApplicant, publicSchool)
    const inStateResult = calculateSchoolProbability(inStateApplicant, publicSchool)

    if (oosResult && inStateResult) {
      expect(inStateResult.pAccept).toBeGreaterThan(oosResult.pAccept)
    }
  })
})
