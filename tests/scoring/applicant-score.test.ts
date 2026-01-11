import { describe, it, expect } from 'vitest'
import { calculateApplicantScore, getScoreInterpretation } from '@/lib/scoring/applicant-score'
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

describe('Applicant Score Calculation', () => {
  it('should calculate a valid score between 0-1000', () => {
    const applicant = createApplicant()
    const score = calculateApplicantScore(applicant)

    expect(score.totalScore).toBeGreaterThanOrEqual(0)
    expect(score.totalScore).toBeLessThanOrEqual(1000)
  })

  it('should return all score components', () => {
    const applicant = createApplicant()
    const score = calculateApplicantScore(applicant)

    expect(score.academicScore).toBeDefined()
    expect(score.experienceScore).toBeDefined()
    expect(score.demographicAdjustment).toBeDefined()
    expect(score.redFlagPenalty).toBeDefined()
    expect(score.percentile).toBeDefined()
    expect(score.tier).toBeDefined()
  })

  it('should give higher scores for higher GPA', () => {
    const lowGPA = createApplicant({ cumulativeGPA: 3.2 })
    const highGPA = createApplicant({ cumulativeGPA: 3.9 })

    const lowScore = calculateApplicantScore(lowGPA)
    const highScore = calculateApplicantScore(highGPA)

    expect(highScore.academicScore).toBeGreaterThan(lowScore.academicScore)
    expect(highScore.totalScore).toBeGreaterThan(lowScore.totalScore)
  })

  it('should give higher scores for higher MCAT', () => {
    const lowMCAT = createApplicant({ mcatTotal: 505 })
    const highMCAT = createApplicant({ mcatTotal: 520 })

    const lowScore = calculateApplicantScore(lowMCAT)
    const highScore = calculateApplicantScore(highMCAT)

    expect(highScore.academicScore).toBeGreaterThan(lowScore.academicScore)
    expect(highScore.totalScore).toBeGreaterThan(lowScore.totalScore)
  })

  it('should give higher scores for more clinical experience', () => {
    const lowClinical = createApplicant({ clinicalHoursTotal: 100 })
    const highClinical = createApplicant({ clinicalHoursTotal: 1000 })

    const lowScore = calculateApplicantScore(lowClinical)
    const highScore = calculateApplicantScore(highClinical)

    expect(highScore.experienceScore).toBeGreaterThan(lowScore.experienceScore)
  })

  it('should give higher scores for research with publications', () => {
    const noResearch = createApplicant({ researchHoursTotal: 0, hasResearchPublications: false })
    const withResearch = createApplicant({
      researchHoursTotal: 1000,
      hasResearchPublications: true,
      publicationCount: 2,
    })

    const noResearchScore = calculateApplicantScore(noResearch)
    const withResearchScore = calculateApplicantScore(withResearch)

    expect(withResearchScore.experienceDetails.researchContribution).toBeGreaterThan(
      noResearchScore.experienceDetails.researchContribution
    )
  })
})

describe('Demographic Adjustments', () => {
  it('should give positive adjustment for URM applicants', () => {
    const nonURM = createApplicant({ raceEthnicity: 'White' })
    const urm = createApplicant({ raceEthnicity: 'Black or African American' })

    const nonURMScore = calculateApplicantScore(nonURM)
    const urmScore = calculateApplicantScore(urm)

    expect(urmScore.demographicDetails.raceEthnicityAdjustment).toBeGreaterThan(
      nonURMScore.demographicDetails.raceEthnicityAdjustment
    )
  })

  it('should give positive adjustment for first-generation students', () => {
    const notFirstGen = createApplicant({ isFirstGeneration: false })
    const firstGen = createApplicant({ isFirstGeneration: true })

    const notFirstGenScore = calculateApplicantScore(notFirstGen)
    const firstGenScore = calculateApplicantScore(firstGen)

    expect(firstGenScore.demographicDetails.firstGenAdjustment).toBeGreaterThan(
      notFirstGenScore.demographicDetails.firstGenAdjustment
    )
  })

  it('should give positive adjustment for disadvantaged background', () => {
    const notDisadvantaged = createApplicant({ isDisadvantaged: false })
    const disadvantaged = createApplicant({ isDisadvantaged: true })

    const notDisScore = calculateApplicantScore(notDisadvantaged)
    const disScore = calculateApplicantScore(disadvantaged)

    expect(disScore.demographicDetails.disadvantagedAdjustment).toBeGreaterThan(
      notDisScore.demographicDetails.disadvantagedAdjustment
    )
  })

  it('should give positive adjustment for rural background', () => {
    const urban = createApplicant({ isRuralBackground: false })
    const rural = createApplicant({ isRuralBackground: true })

    const urbanScore = calculateApplicantScore(urban)
    const ruralScore = calculateApplicantScore(rural)

    expect(ruralScore.demographicDetails.ruralAdjustment).toBeGreaterThan(
      urbanScore.demographicDetails.ruralAdjustment
    )
  })
})

describe('Red Flag Penalties', () => {
  it('should penalize institutional action', () => {
    const clean = createApplicant({ hasInstitutionalAction: false })
    const withIA = createApplicant({ hasInstitutionalAction: true })

    const cleanScore = calculateApplicantScore(clean)
    const iaScore = calculateApplicantScore(withIA)

    expect(iaScore.redFlagDetails.institutionalActionPenalty).toBeLessThan(0)
    expect(iaScore.totalScore).toBeLessThan(cleanScore.totalScore)
  })

  it('should penalize criminal history', () => {
    const clean = createApplicant({ hasCriminalHistory: false })
    const withCriminal = createApplicant({ hasCriminalHistory: true })

    const cleanScore = calculateApplicantScore(clean)
    const criminalScore = calculateApplicantScore(withCriminal)

    expect(criminalScore.redFlagDetails.criminalHistoryPenalty).toBeLessThan(0)
    expect(criminalScore.totalScore).toBeLessThan(cleanScore.totalScore)
  })

  it('should slightly penalize reapplicant status', () => {
    const firstTime = createApplicant({ isReapplicant: false })
    const reapplicant = createApplicant({ isReapplicant: true })

    const firstTimeScore = calculateApplicantScore(firstTime)
    const reapplicantScore = calculateApplicantScore(reapplicant)

    expect(reapplicantScore.redFlagDetails.reapplicantAdjustment).toBeLessThan(0)
    expect(reapplicantScore.totalScore).toBeLessThan(firstTimeScore.totalScore)
  })

  it('should penalize very low clinical experience', () => {
    const adequate = createApplicant({ clinicalHoursTotal: 200 })
    const veryLow = createApplicant({ clinicalHoursTotal: 30 })

    const adequateScore = calculateApplicantScore(adequate)
    const veryLowScore = calculateApplicantScore(veryLow)

    expect(veryLowScore.redFlagDetails.lowExperiencePenalty).toBeLessThan(0)
    expect(adequateScore.redFlagDetails.lowExperiencePenalty).toBe(0)
  })
})

describe('Score Tiers', () => {
  it('should classify exceptional applicants correctly', () => {
    const exceptional = createApplicant({
      cumulativeGPA: 3.98,
      mcatTotal: 524,
      clinicalHoursTotal: 1500,
      researchHoursTotal: 2000,
      hasResearchPublications: true,
      publicationCount: 5,
      leadershipExperiences: 4,
      volunteerHoursNonClinical: 400,
    })

    const score = calculateApplicantScore(exceptional)
    expect(['exceptional', 'strong']).toContain(score.tier)
    expect(score.totalScore).toBeGreaterThan(650)
  })

  it('should classify low applicants correctly', () => {
    const low = createApplicant({
      cumulativeGPA: 2.8,
      mcatTotal: 495,
      clinicalHoursTotal: 50,
      researchHoursTotal: 0,
    })

    const score = calculateApplicantScore(low)
    expect(['low', 'below-average']).toContain(score.tier)
  })
})

describe('Score Interpretation', () => {
  it('should return non-empty interpretation', () => {
    const applicant = createApplicant()
    const score = calculateApplicantScore(applicant)
    const interpretation = getScoreInterpretation(score)

    expect(interpretation).toBeDefined()
    expect(interpretation.length).toBeGreaterThan(50)
    expect(interpretation).toContain(score.totalScore.toString())
  })
})
