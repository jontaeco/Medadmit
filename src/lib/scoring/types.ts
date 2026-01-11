/**
 * Scoring System Types
 *
 * Types for the applicant scoring and prediction engine.
 */

import type { RaceEthnicityCategory, StateCode, SchoolProfile } from '@/types/data'

// =============================================================================
// Applicant Profile Input
// =============================================================================

export interface ApplicantInput {
  // Academic Credentials
  cumulativeGPA: number
  scienceGPA: number | null
  mcatTotal: number
  mcatCPBS: number | null // Chemical & Physical Foundations
  mcatCARS: number | null // Critical Analysis & Reasoning
  mcatBBFL: number | null // Biological & Biochemical Foundations
  mcatPSBB: number | null // Psychological, Social, & Biological Foundations

  // Demographics
  stateOfResidence: StateCode
  raceEthnicity: RaceEthnicityCategory | null
  isFirstGeneration: boolean
  isDisadvantaged: boolean
  isRuralBackground: boolean

  // Experiences (in hours unless noted)
  clinicalHoursTotal: number
  clinicalHoursPaid: number
  clinicalHoursVolunteer: number
  researchHoursTotal: number
  hasResearchPublications: boolean
  publicationCount: number
  volunteerHoursNonClinical: number
  shadowingHours: number
  leadershipExperiences: number // count of significant roles
  teachingHours: number

  // Application Details
  applicationYear: number
  isReapplicant: boolean
  hasInstitutionalAction: boolean
  hasCriminalHistory: boolean

  // WARS-specific fields (optional)
  undergraduateSchoolTier?: 1 | 2 | 3
  gpaTrend?: 'upward' | 'flat' | 'downward'
  miscellaneousLevel?: 1 | 2 | 3 | 4
}

// =============================================================================
// Score Components
// =============================================================================

export interface ScoreBreakdown {
  // Base score from GPA/MCAT (0-720 points)
  academicScore: number
  academicDetails: {
    gpaContribution: number // 0-360
    mcatContribution: number // 0-360
    gpaPercentile: number
    mcatPercentile: number
  }

  // Experience score (0-330 points)
  experienceScore: number
  experienceDetails: {
    clinicalContribution: number // 0-90
    researchContribution: number // 0-90
    volunteerContribution: number // 0-60
    leadershipContribution: number // 0-35
    shadowingContribution: number // 0-25
    teachingContribution: number // 0-30 (NEW)
  }

  // Demographic adjustments (can be positive or negative, -100 to +150)
  demographicAdjustment: number
  demographicDetails: {
    raceEthnicityAdjustment: number
    firstGenAdjustment: number
    disadvantagedAdjustment: number
    ruralAdjustment: number
  }

  // Red flags (negative adjustments, 0 to -100)
  redFlagPenalty: number
  redFlagDetails: {
    institutionalActionPenalty: number
    criminalHistoryPenalty: number
    reapplicantAdjustment: number
    lowExperiencePenalty: number
  }

  // Final score (legacy 0-1000 system)
  totalScore: number // 0-1000
  percentile: number // 0-100
  tier: 'exceptional' | 'strong' | 'competitive' | 'below-average' | 'low'

  // WARS score (new WedgeDawg system, 0-121)
  warsScore?: number
  warsLevel?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
  warsBreakdown?: {
    stats: number
    research: number
    clinical: number
    shadowing: number
    volunteering: number
    leadership: number
    miscellaneous: number
    undergraduate: number
    urm: number
    trend: number
  }
}

// =============================================================================
// School Match Results
// =============================================================================

export interface SchoolProbability {
  school: SchoolProfile
  probability: number // 0-1
  probabilityLower: number // 95% CI lower bound
  probabilityUpper: number // 95% CI upper bound
  category: 'reach' | 'target' | 'safety'

  // Factors affecting probability
  factors: {
    baselineProbability: number
    stateAdjustment: number
    demographicAdjustment: number
    missionFitBonus: number
    finalProbability: number
  }

  // Fit analysis
  fit: {
    gpaPercentile: number
    mcatPercentile: number
    isInState: boolean
    missionAlignment: string[]
  }
}

export interface SchoolList {
  reach: SchoolProbability[]
  target: SchoolProbability[]
  safety: SchoolProbability[]

  summary: {
    totalSchools: number
    expectedInterviews: number
    expectedAcceptances: number
    probabilityOfAtLeastOne: number
  }
}

// =============================================================================
// Monte Carlo Simulation
// =============================================================================

export interface SimulationConfig {
  iterations: number // typically 10,000
  schoolList: SchoolProbability[]
  interviewToAcceptanceRate: number // typically 0.40-0.50
}

export interface SimulationResult {
  // Core outcomes
  expectedInterviews: number
  expectedAcceptances: number
  probabilityOfAtLeastOneAcceptance: number

  // Distribution
  interviewDistribution: {
    percentile10: number
    percentile25: number
    median: number
    percentile75: number
    percentile90: number
  }

  acceptanceDistribution: {
    percentile10: number
    percentile25: number
    median: number
    percentile75: number
    percentile90: number
  }

  // Probability buckets
  probabilityBuckets: {
    zeroAcceptances: number
    oneAcceptance: number
    twoToThreeAcceptances: number
    fourPlusAcceptances: number
  }

  // Raw simulation data (for charts)
  iterations: number
  rawInterviewCounts: number[]
  rawAcceptanceCounts: number[]

  // Per-school outcomes for Sankey visualization
  perSchoolOutcomes: PerSchoolOutcome[]
  modalOutcome: ModalOutcome
}

// Per-school outcome tracking for Sankey diagram
export interface PerSchoolOutcome {
  schoolId: string
  schoolName: string
  category: 'reach' | 'target' | 'safety'
  interviewRate: number // % of simulations where this school gave interview
  acceptanceRate: number // % of simulations where this school gave acceptance
  modalInterview: boolean // Whether school gave interview in modal outcome
  modalAcceptance: boolean // Whether school gave acceptance in modal outcome
}

// Modal (most common) outcome from simulation
export interface ModalOutcome {
  totalInterviews: number
  totalAcceptances: number
  schoolsWithInterview: string[] // School IDs
  schoolsWithAcceptance: string[] // School IDs
  frequency: number // How often this exact outcome occurred
}

// Sankey diagram data structures
export interface SankeyNode {
  name: string
  category?: 'school' | 'interview' | 'outcome'
  schoolCategory?: 'reach' | 'target' | 'safety'
}

export interface SankeyLink {
  source: number // Index in nodes array
  target: number // Index in nodes array
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

// =============================================================================
// Prediction Result (Full Output)
// =============================================================================

export interface PredictionResult {
  // Applicant score
  applicantScore: ScoreBreakdown

  // Global probability (across all schools)
  globalAcceptanceProbability: number
  globalProbabilityRange: {
    lower: number
    upper: number
  }

  // School-specific results
  schoolList: SchoolList

  // Monte Carlo simulation
  simulation: SimulationResult

  // Metadata
  computedAt: string
  modelVersion: string
  dataVersion: string
  warnings: string[]
  caveats: string[]
}

// =============================================================================
// Experience Thresholds & Weights
// =============================================================================

export interface ExperienceThresholds {
  clinical: {
    minimum: number // below this is a red flag
    competitive: number // typical accepted applicant
    strong: number // above average
    exceptional: number // top tier
  }
  research: {
    minimum: number
    competitive: number
    strong: number
    exceptional: number
  }
  volunteer: {
    minimum: number
    competitive: number
    strong: number
  }
  shadowing: {
    minimum: number
    recommended: number
  }
}

export const DEFAULT_EXPERIENCE_THRESHOLDS: ExperienceThresholds = {
  clinical: {
    minimum: 100,
    competitive: 300,
    strong: 500,
    exceptional: 1000,
  },
  research: {
    minimum: 0, // not required but helpful
    competitive: 200,
    strong: 500,
    exceptional: 1000,
  },
  volunteer: {
    minimum: 50,
    competitive: 150,
    strong: 300,
  },
  shadowing: {
    minimum: 20,
    recommended: 50,
  },
}
