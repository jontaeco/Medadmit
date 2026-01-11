/**
 * MedAdmit v2 Model Types
 *
 * This file defines the TypeScript interfaces for the rigorous probabilistic model.
 * Based on the specification in RIGOROUS_MODEL_IMPLEMENTATION_PLAN.md
 */

// ============================================================================
// Spline Parameters
// ============================================================================

/**
 * Parameters for monotone I-spline functions.
 * Used for GPA and MCAT → competitiveness mapping.
 */
export interface SplineParameters {
  /** Knot positions for the spline */
  knots: number[];
  /** Non-negative coefficients (for monotonicity) */
  coefficients: number[];
  /** Intercept term */
  intercept: number;
}

// ============================================================================
// Experience Parameters
// ============================================================================

/**
 * Parameters for saturating experience functions.
 * g(h) = alpha * (1 - exp(-h / tau))
 */
export interface ExperienceDomainParams {
  /** Saturation scale (hours at ~63% of max effect) */
  tau: number;
  /** Maximum contribution in logit units */
  alpha: number;
  /** Optional hard minimum threshold */
  minThreshold?: number;
  /** Optional soft minimum (penalty below this) */
  softMinimum?: number;
}

export interface PublicationParams {
  /** Effect of first-author publication */
  firstAuthor: number;
  /** Effect of middle-author or preprint */
  middle: number;
  /** Effect of poster/abstract */
  poster: number;
  /** Diminishing returns factor (e.g., 0.5 = 2nd pub worth 50% of 1st) */
  diminishing: number;
}

export interface ExperienceParams {
  clinical: ExperienceDomainParams;
  research: ExperienceDomainParams;
  volunteer: ExperienceDomainParams;
  shadowing: ExperienceDomainParams;
  leadership: ExperienceDomainParams;
  publications: PublicationParams;
}

// ============================================================================
// Competitiveness Parameters
// ============================================================================

export interface CompetitivenessParams {
  /** GPA → competitiveness spline */
  gpaSpline: SplineParameters;
  /** MCAT → competitiveness spline */
  mcatSpline: SplineParameters;
  /** Effect of upward GPA trend */
  trendEffect: number;
  /** CDF table for percentile conversion */
  cdfTable?: { C: number; percentile: number }[];
}

// ============================================================================
// School Parameters
// ============================================================================

export interface SchoolModelParams {
  /** School-specific intercept for interview probability */
  interceptInterview: number;
  /** School-specific intercept for acceptance given interview */
  interceptAccept: number;
  /** Slope on competitiveness C for interview stage */
  slopeC_interview: number;
  /** Slope on competitiveness C for acceptance stage (typically flatter) */
  slopeC_accept: number;
  /** In-state bonus for interview stage (logit units) */
  inStateBonus_interview: number;
  /** In-state bonus for acceptance stage */
  inStateBonus_accept: number;
}

// ============================================================================
// Demographic Parameters
// ============================================================================

export interface EffectDistribution {
  /** Mean effect in logit units */
  mean: number;
  /** Standard deviation (school-to-school variation) */
  sd: number;
  /** Data source */
  source?: string;
}

export interface DemographicParams {
  /** Aggregate URM effect */
  urm: EffectDistribution;
  /** Black/African American specific effect */
  urmBlack?: EffectDistribution;
  /** Hispanic/Latino specific effect */
  urmHispanic?: EffectDistribution;
  /** Asian effect (typically slight negative) */
  asian?: EffectDistribution;
  /** First-generation college student effect */
  firstGen?: EffectDistribution;
  /** Socioeconomically disadvantaged effect */
  disadvantaged?: EffectDistribution;
  /** Rural background effect */
  rural?: EffectDistribution;
}

// ============================================================================
// Mission Interaction Parameters
// ============================================================================

export interface MissionInteractionParams {
  /** Rural school × rural applicant */
  rural_x_rural: EffectDistribution;
  /** Research-intensive school × research-strong applicant */
  research_x_research: EffectDistribution;
  /** HBCU × Black applicant */
  hbcu_x_urm: EffectDistribution;
  /** Public school × in-state applicant */
  public_x_instate: EffectDistribution;
  /** Primary care school × primary care interest */
  primaryCare_x_interest?: EffectDistribution;
}

// ============================================================================
// Random Effects Parameters
// ============================================================================

export interface RandomEffectParams {
  /** File quality random effect (affects all interview outcomes) */
  fileQuality: { sd: number };
  /** Interview skill random effect (affects all acceptance|interview outcomes) */
  interviewSkill: { sd: number };
}

// ============================================================================
// Full Model Parameters
// ============================================================================

export interface ModelParameters {
  /** Model version identifier */
  version: string;
  /** Data snapshot version (e.g., "2026.1.0") */
  dataSnapshot: string;
  /** Timestamp of parameter generation */
  generatedAt: string;

  /** Competitiveness (C_i) calculation parameters */
  competitiveness: CompetitivenessParams;

  /** Experience saturation function parameters */
  experience: ExperienceParams;

  /** School-specific parameters keyed by school ID */
  schools: Record<string, SchoolModelParams>;

  /** Global demographic effect parameters */
  demographics: DemographicParams;

  /** Mission fit interaction parameters */
  missionInteractions: MissionInteractionParams;

  /** Random effect variance parameters */
  randomEffects: RandomEffectParams;
}

// ============================================================================
// Applicant Profile
// ============================================================================

export type GPATrend = 'upward' | 'flat' | 'downward';

export interface PublicationRecord {
  firstAuthor: number;
  other: number;
  posters: number;
}

export interface ApplicantProfile {
  // Academic
  gpa: number;
  mcat: number;
  gpaTrend: GPATrend;

  // Experience (hours unless otherwise noted)
  clinicalHours: number;
  researchHours: number;
  volunteerHours: number;
  shadowingHours: number;
  leadershipCount: number; // Number of leadership roles
  publications: PublicationRecord;

  // Demographics
  stateOfResidence: string;
  raceEthnicity: string | null;
  isUrm: boolean;
  isFirstGen: boolean;
  isDisadvantaged: boolean;
  isRural: boolean;

  // Optional: specific interests for mission matching
  primaryCareInterest?: boolean;
  researchInterest?: boolean;
  ruralInterest?: boolean;
}

// ============================================================================
// Prediction Results
// ============================================================================

export interface ConfidenceInterval {
  mean: number;
  ci80: [number, number]; // 80% credible interval
}

export interface SchoolFactors {
  /** Baseline probability (from school intercept only) */
  baseline: number;
  /** Effect from competitiveness C */
  competitivenessEffect: number;
  /** Effect from residency (in-state vs OOS) */
  residencyEffect: number;
  /** Effect from demographic factors */
  demographicEffect: number;
  /** Effect from mission fit interactions */
  missionFitEffect: number;
}

export type SchoolCategory = 'reach' | 'target' | 'safety';

export interface SchoolPrediction {
  schoolId: string;
  schoolName: string;

  /** Probability of receiving interview */
  pInterview: ConfidenceInterval;
  /** Probability of acceptance given interview */
  pAcceptGivenInterview: ConfidenceInterval;
  /** Overall probability of acceptance */
  pAccept: ConfidenceInterval;

  /** Classification based on probability */
  category: SchoolCategory;

  /** Breakdown of contributing factors */
  factors: SchoolFactors;
}

export interface DistributionBuckets {
  /** P(0 acceptances) */
  zero: number;
  /** P(exactly 1 acceptance) */
  one: number;
  /** P(2-3 acceptances) */
  twoThree: number;
  /** P(4+ acceptances) */
  fourPlus: number;
}

export interface ListMetrics {
  /** Expected number of interviews */
  expectedInterviews: ConfidenceInterval;
  /** Expected number of acceptances */
  expectedAcceptances: ConfidenceInterval;
  /** Probability of at least one acceptance */
  pAtLeastOne: ConfidenceInterval;
  /** Distribution of acceptance counts */
  distributionBuckets: DistributionBuckets;
}

export interface CompetitivenessResult {
  /** Raw competitiveness score (logit scale) */
  C: number;
  /** Percentile rank among accepted applicants */
  percentile: number;
}

export interface PredictionResult {
  /** Per-school predictions */
  schools: SchoolPrediction[];

  /** List-level aggregate metrics */
  listMetrics: ListMetrics;

  /** Applicant competitiveness assessment */
  competitiveness: CompetitivenessResult;

  /** Model version used */
  modelVersion: string;

  /** Timestamp of prediction */
  computedAt: string;
}

// ============================================================================
// School Data Types
// ============================================================================

export interface MissionFeatures {
  ruralMission: boolean;
  researchIntensive: boolean;
  primaryCareFocus: boolean;
  hbcu: boolean;
  diversityFocus: boolean;
}

export interface PercentileDistribution {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export type OOSFriendliness = 'friendly' | 'neutral' | 'unfriendly';

export interface SchoolData {
  id: string;
  aamcId?: string;
  name: string;
  shortName?: string;
  state: string;
  city?: string;

  // Admission statistics
  medianGPA: number;
  medianMCAT: number;
  gpaPercentiles: PercentileDistribution;
  mcatPercentiles: PercentileDistribution;

  // Funnel metrics
  totalApplicants: number;
  totalInterviewed: number;
  totalAccepted: number;
  totalMatriculated?: number;
  classSize?: number;

  // Rates
  interviewRate: number;
  interviewToAcceptRate: number;
  inStateInterviewRate: number | null;
  oosInterviewRate: number | null;

  // Residency
  pctInStateMatriculants: number;
  pctOutOfStateMatriculants: number;
  oosAcceptanceRate?: number;
  oosFriendliness: OOSFriendliness;

  // School characteristics
  isPublic: boolean;
  hasMDPhD?: boolean;
  missionKeywords?: string[];
  missionFeatures: MissionFeatures;

  // Rankings/Tier
  tier: 1 | 2 | 3 | 4;
  warsTier?: number;
  usNewsRankResearch?: number;
  admitOrgRank?: number;
}

// ============================================================================
// Data File Types
// ============================================================================

export interface A23Cell {
  gpaBin: string;
  gpaCenter: number;
  gpaLower: number;
  gpaUpper: number;
  mcatBin: string;
  mcatCenter: number;
  mcatLower: number;
  mcatUpper: number;
  applicants: number;
  acceptees: number;
  acceptanceRate: number;
  weight: number;
}

export interface A23ProcessedData {
  metadata: {
    source: string;
    version: string;
    processedAt: string;
    totalCells: number;
    weightedAverageAcceptanceRate: number;
  };
  binDefinitions: {
    gpa: Record<string, { center: number; lower: number; upper: number }>;
    mcat: Record<string, { center: number; lower: number; upper: number }>;
  };
  cells: A23Cell[];
}

export interface A18ModelEffects {
  urm: EffectDistribution;
  urmBlack: EffectDistribution;
  urmHispanic: EffectDistribution;
  asian: EffectDistribution;
}

export interface A18ProcessedData {
  metadata: {
    source: string;
    version: string;
    processedAt: string;
    urmDefinition: string[];
  };
  modelEffects: A18ModelEffects;
}

export interface SchoolsEnhancedData {
  metadata: {
    source: string;
    version: string;
    enhancedAt: string;
    totalSchools: number;
    missionFeatureCounts: Record<string, number>;
  };
  schools: SchoolData[];
}
