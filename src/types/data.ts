/**
 * Data types for AAMC tables and school data
 */

// =============================================================================
// AAMC Table A-23: GPA/MCAT Acceptance Grid
// =============================================================================

export interface TableA23Cell {
  applicants: number
  acceptees: number
  acceptanceRate: number
}

export interface TableA23Data {
  metadata: {
    source: string
    url: string
    retrievedAt: string
    version: string
    aggregationPeriod: string // e.g., "2021-2024"
    totalApplicants: number
    totalAcceptees: number
  }
  grid: {
    [gpaBin: string]: {
      [mcatBin: string]: TableA23Cell
    }
  }
}

export const GPA_BINS = [
  '<2.20',
  '2.20-2.39',
  '2.40-2.59',
  '2.60-2.79',
  '2.80-2.99',
  '3.00-3.19',
  '3.20-3.39',
  '3.40-3.59',
  '3.60-3.79',
  '≥3.80',
] as const

export const MCAT_BINS = [
  '<486',
  '486-489',
  '490-493',
  '494-497',
  '498-501',
  '502-505',
  '506-509',
  '510-513',
  '514-517',
  '>517',
] as const

export type GPABin = (typeof GPA_BINS)[number]
export type MCATBin = (typeof MCAT_BINS)[number]

// =============================================================================
// AAMC Table A-18: Demographics Data
// =============================================================================

export interface RaceEthnicityStats {
  applicants: number
  matriculants: number
  acceptanceRate: number
  avgMCAT: number
  avgMCATStdDev: number
  avgGPA: number
  avgGPAStdDev: number
}

export interface TableA18Data {
  metadata: {
    source: string
    url: string
    retrievedAt: string
    version: string
    academicYear: string
  }
  byRaceEthnicity: {
    [group: string]: RaceEthnicityStats
  }
}

export const RACE_ETHNICITY_CATEGORIES = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic, Latino, or of Spanish Origin',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'Multiple Race/Ethnicity',
  'Other',
  'Unknown',
] as const

export type RaceEthnicityCategory = (typeof RACE_ETHNICITY_CATEGORIES)[number]

// =============================================================================
// School Data
// =============================================================================

export interface SchoolProfile {
  id: string
  aamcId: string | null
  name: string
  shortName: string
  state: string
  city: string

  // Admissions Statistics
  medianGPA: number
  medianMCAT: number
  gpa10thPercentile: number | null
  gpa25thPercentile: number | null
  gpa75thPercentile: number | null
  gpa90thPercentile: number | null
  mcat10thPercentile: number | null
  mcat25thPercentile: number | null
  mcat75thPercentile: number | null
  mcat90thPercentile: number | null

  // Application Metrics
  totalApplicants: number
  totalInterviewed: number
  totalAccepted: number
  totalMatriculated: number
  classSize: number

  // Admission Funnel Rates (from admit.org/MSAR)
  interviewRate?: number  // totalInterviewed / totalApplicants (application → interview)
  interviewToAcceptanceRate?: number  // totalAccepted / totalInterviewed (interview → acceptance)
  admitOrgRank?: number  // Ranking from admit.org (based on selectivity)

  // State Preference
  pctInStateMatriculants: number
  pctOutOfStateMatriculants: number
  oosAcceptanceRate: number | null
  inStateAcceptanceRate: number | null
  oosFriendliness: 'friendly' | 'neutral' | 'unfriendly' | 'hostile'

  // School Characteristics
  isPublic: boolean
  hasMDPhD: boolean
  hasMilitaryProgram: boolean
  interviewFormat: 'mmi' | 'traditional' | 'hybrid' | 'unknown'
  missionKeywords: string[]

  // Tuition
  tuitionInState: number
  tuitionOutOfState: number

  // Rankings & Reputation (optional)
  usNewsRankResearch: number | null
  usNewsRankPrimaryCare: number | null

  // WARS Classification
  warsTier: WARSSchoolTier
  isLowYield: boolean

  // Metadata
  dataSource: string
  dataRetrievedAt: string
}

// =============================================================================
// Data Source Registry
// =============================================================================

export interface DataSourceEntry {
  id: string
  sourceName: string
  sourceType: 'aamc_table' | 'msar' | 'research_paper' | 'school_website' | 'secondary'
  version: string
  url: string | null
  doi: string | null
  retrievalDate: string
  validUntil: string | null
  description: string
  citation: string
  fileHash: string | null
  isActive: boolean
}

// =============================================================================
// Research-Based Adjustment Factors
// =============================================================================

export interface AdjustmentFactor {
  factor: string
  oddsRatio: number
  ciLower: number
  ciUpper: number
  evidenceLevel: 'strong' | 'moderate' | 'weak' | 'heuristic'
  source: string
  notes: string | null
}

export interface RaceEthnicityAdjustment extends AdjustmentFactor {
  raceEthnicity: RaceEthnicityCategory
  dataYears: string
}

// =============================================================================
// US States
// =============================================================================

export const US_STATES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  PR: 'Puerto Rico',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
} as const

export type StateCode = keyof typeof US_STATES

// =============================================================================
// WARS (WedgeDawg Applicant Rating System) Types
// =============================================================================

/**
 * Undergraduate school prestige tier for WARS scoring
 * Tier 1: HYPSM (Harvard, Yale, Princeton, Stanford, MIT)
 * Tier 2: Elite (Other Ivies, top privates, top publics - ~50 schools total)
 * Tier 3: All other schools
 */
export const UNDERGRADUATE_SCHOOL_TIERS = [1, 2, 3] as const
export type UndergraduateSchoolTier = (typeof UNDERGRADUATE_SCHOOL_TIERS)[number]

/**
 * GPA trend pattern for WARS scoring
 */
export const GPA_TRENDS = ['upward', 'flat', 'downward'] as const
export type GPATrend = (typeof GPA_TRENDS)[number]

/**
 * Miscellaneous achievements level for WARS scoring
 * Level 4: Outstanding (Rhodes Scholar, Olympics, professional sports, patents, startups)
 * Level 3: Significant (PhD, JD, MBA, Peace Corps, military service, Fulbright)
 * Level 2: Moderate (Notable hobbies, substantial work experience, unique skills)
 * Level 1: None or minimal
 */
export const MISCELLANEOUS_LEVELS = [1, 2, 3, 4] as const
export type MiscellaneousLevel = (typeof MISCELLANEOUS_LEVELS)[number]

/**
 * WARS applicant competitiveness levels
 * Based on total WARS score (0-121 scale)
 */
export const WARS_LEVELS = ['S', 'A', 'B', 'C', 'D', 'E'] as const
export type WARSLevel = (typeof WARS_LEVELS)[number]

/**
 * WARS score thresholds
 */
export const WARS_LEVEL_THRESHOLDS = {
  S: 85,  // 85+
  A: 80,  // 80-84
  B: 75,  // 75-79
  C: 68,  // 68-74
  D: 60,  // 60-67
  E: 0,   // <60
} as const

/**
 * Medical school tiers for WARS distribution
 * Tier 1: TOP (Harvard, Stanford, Hopkins, etc. - 11 schools)
 * Tier 2: HIGH (Michigan, UCLA, Vanderbilt, etc. - ~15 schools)
 * Tier 3: MID (UVA, Ohio State, USC-Keck, etc. - ~20 schools)
 * Tier 4: LOW (All remaining schools - ~115 schools)
 * Tier 5: STATE (Dynamically determined based on applicant's state)
 * Tier 6: LOW_YIELD (High-volume private schools to approach cautiously)
 */
export const WARS_SCHOOL_TIERS = [1, 2, 3, 4, 5, 6] as const
export type WARSSchoolTier = (typeof WARS_SCHOOL_TIERS)[number]
