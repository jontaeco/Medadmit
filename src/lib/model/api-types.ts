/**
 * Native API Response Types for MedAdmit v2.0
 *
 * These types expose the full capabilities of the rigorous probabilistic model,
 * replacing the legacy format with proper two-stage probabilities, 80% credible
 * intervals, competitiveness scores, and uncertainty quantification.
 */

// ============================================================================
// Competitiveness Types
// ============================================================================

export interface CompetitivenessResponse {
  /** Competitiveness score on -3 to +3 scale */
  C: number;
  /** Percentile among applicants (0-100) */
  percentile: number;
  /** Classification category */
  classification: 'very_low' | 'low' | 'below_average' | 'average' | 'above_average' | 'high' | 'very_high';
  /** Breakdown of contributions */
  breakdown: {
    gpaContribution: number;
    mcatContribution: number;
  };
}

// ============================================================================
// Experience Types
// ============================================================================

export interface ExperienceDomainResponse {
  hours: number;
  contribution: number;
  /** Percentage of saturation reached (0-100) */
  saturationPct: number;
}

export interface ExperienceCountResponse {
  count: number;
  contribution: number;
  /** Percentage of saturation reached (0-100), if applicable */
  saturationPct?: number;
}

export interface ExperienceResponse {
  /** Total experience contribution in logit units */
  totalContribution: number;
  /** Per-domain breakdown */
  domains: {
    clinical: ExperienceDomainResponse;
    research: ExperienceDomainResponse;
    volunteer: ExperienceDomainResponse;
    shadowing: ExperienceDomainResponse;
    leadership: ExperienceCountResponse;
    publications: ExperienceCountResponse;
  };
  /** Threshold status */
  thresholdsMet: {
    clinical: boolean;
    overall: boolean;
  };
}

// ============================================================================
// Demographic Types
// ============================================================================

export interface DemographicResponse {
  /** Total demographic effect in logit units */
  totalEffect: number;
  /** Breakdown by factor */
  breakdown: {
    raceEthnicity: number;
    firstGen: number;
    disadvantaged: number;
    rural: number;
  };
}

// ============================================================================
// School Prediction Types
// ============================================================================

export interface CredibleInterval {
  mean: number;
  ci80: [number, number];
}

export interface SchoolFactors {
  competitivenessEffect: number;
  inStateBonus: number;
  demographicEffect: number;
  missionFitEffect: number;
}

export interface SchoolPredictionResponse {
  id: string;
  name: string;
  state: string;
  tier: number;
  isPublic: boolean;

  /** Two-stage probabilities with 80% credible intervals */
  pInterview: CredibleInterval;
  pAcceptGivenInterview: CredibleInterval;
  pAccept: CredibleInterval;

  /** School category based on acceptance probability */
  category: 'reach' | 'target' | 'likely' | 'safety';

  /** Factor breakdown showing what contributes to probability */
  factors: SchoolFactors;

  /** Whether applicant is in-state for this school */
  isInState: boolean;
  /** Mission alignment indicators */
  missionAlignment: string[];
}

// ============================================================================
// List-Level Metrics Types
// ============================================================================

export interface DistributionBuckets {
  zero: number;
  one: number;
  twoThree: number;
  fourPlus: number;
}

export interface ListMetricsResponse {
  expectedInterviews: CredibleInterval;
  expectedAcceptances: CredibleInterval;
  pAtLeastOne: CredibleInterval;
  distributionBuckets: DistributionBuckets;
}

// ============================================================================
// Uncertainty Types
// ============================================================================

export type UncertaintyLevel = 'very_precise' | 'precise' | 'moderate' | 'uncertain' | 'highly_uncertain';

export interface UncertaintyDecomposition {
  parameterVariance: number;
  randomEffectVariance: number;
  totalVariance: number;
}

export interface UncertaintyResponse {
  overallLevel: UncertaintyLevel;
  decomposition: UncertaintyDecomposition;
}

// ============================================================================
// Simulation Types
// ============================================================================

export interface SchoolSimulationResult {
  schoolId: string;
  interviewRate: number;
  acceptanceRate: number;
}

export interface CorrelationDiagnostics {
  meanPairwiseCorrelation: number;
  acceptanceVariance: number;
}

export interface SimulationResponse {
  iterations: number;
  correlationDiagnostics: CorrelationDiagnostics;
  perSchool: SchoolSimulationResult[];
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface PredictionMetadata {
  modelVersion: string;
  computedAt: string;
}

// ============================================================================
// Main Response Type
// ============================================================================

export interface NativePredictionResponse {
  /** Competitiveness analysis */
  competitiveness: CompetitivenessResponse;

  /** Experience analysis with saturation */
  experience: ExperienceResponse;

  /** Demographic effects */
  demographics: DemographicResponse;

  /** Per-school predictions with two-stage probabilities */
  schools: SchoolPredictionResponse[];

  /** List-level aggregate metrics */
  listMetrics: ListMetricsResponse;

  /** Uncertainty quantification */
  uncertainty: UncertaintyResponse;

  /** Monte Carlo simulation results */
  simulation: SimulationResponse;

  /** Metadata */
  metadata: PredictionMetadata;
}

// ============================================================================
// Input Types (for API requests)
// ============================================================================

export interface NativePredictionRequest {
  // Academic
  gpa: number;
  scienceGpa?: number | null;
  mcat: number;
  mcatSections?: {
    cpbs?: number | null;
    cars?: number | null;
    bbfl?: number | null;
    psbb?: number | null;
  };

  // Demographics
  state: string;
  raceEthnicity?: string | null;
  isFirstGen?: boolean;
  isDisadvantaged?: boolean;
  isRural?: boolean;

  // Experience
  clinicalHours: number;
  clinicalHoursPaid?: number;
  researchHours: number;
  volunteerHours?: number;
  shadowingHours?: number;
  leadershipCount?: number;
  publicationCount?: number;
  teachingHours?: number;

  // Application context
  applicationYear?: number;
  isReapplicant?: boolean;

  // Red flags
  hasInstitutionalAction?: boolean;
  hasCriminalHistory?: boolean;

  // School selection (optional - if not provided, uses default list)
  schoolIds?: string[];
}

// ============================================================================
// Helper type for API format selection
// ============================================================================

export type PredictionFormat = 'native' | 'legacy';

export interface PredictionOptions {
  format?: PredictionFormat;
  includeSimulation?: boolean;
  simulationIterations?: number;
  schoolIds?: string[];
}
