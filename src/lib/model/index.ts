/**
 * MedAdmit v2.0 Prediction Model
 *
 * A rigorous probabilistic model for medical school admissions predictions.
 *
 * Key features:
 * - Competitiveness Score (C) on -3 to +3 scale, calibrated to AAMC A-23 data
 * - Two-stage probability: P(accept) = P(interview) × P(accept|interview)
 * - Experience saturation with diminishing returns
 * - Demographic effects from AAMC A-18 data
 * - 80% credible intervals via parametric bootstrap
 * - Correlated Monte Carlo simulation with random effects
 */

// Export all types
export * from './types';

// =============================================================================
// PREDICTION API
// Main entry points for generating predictions
// =============================================================================

export {
  generateNativePrediction,
  generateQuickNativePrediction,
  convertRequestToProfile,
} from './native-prediction';

// Re-export types from API
export type {
  NativePredictionResponse,
  NativePredictionRequest,
  CompetitivenessResponse,
  ExperienceResponse,
  DemographicResponse,
  SchoolPredictionResponse,
  ListMetricsResponse,
  UncertaintyResponse,
  SimulationResponse,
  PredictionOptions,
  PredictionFormat,
  CredibleInterval,
  UncertaintyLevel,
} from './api-types';

// =============================================================================
// COMPETITIVENESS
// Core competitiveness calculation using I-splines calibrated to A-23
// =============================================================================

export {
  calculateCompetitiveness,
  calculateCompetitivenessFromProfile,
  calculateGpaContribution,
  calculateMcatContribution,
  getCompetitivenessBreakdown,
  competitivenessToBaselineProb,
  getAnchorCompetitiveness,
  classifyCompetitiveness,
  evaluateSpline,
  DEFAULT_SPLINES,
} from './competitiveness';

// =============================================================================
// TWO-STAGE PROBABILITY MODEL
// School-specific P(interview) and P(accept|interview)
// =============================================================================

export {
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
  comparePredictions,
  analyzePredictionDifference,
} from './two-stage';

// =============================================================================
// EXPERIENCE SATURATION
// Diminishing returns: g(h) = α(1 - e^(-h/τ))
// =============================================================================

export {
  saturatingContribution,
  contributionWithThreshold,
  publicationContribution,
  calculateExperienceContribution,
  getExperienceBreakdown,
  checkMinimumThresholds,
  DEFAULT_EXPERIENCE_PARAMS,
} from './experience';

// =============================================================================
// DEMOGRAPHIC EFFECTS
// URM from A-18, SES factors, mission interactions
// =============================================================================

export {
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
} from './demographics';

// =============================================================================
// MONTE CARLO SIMULATION
// Correlated random effects creating realistic "all-or-nothing" cycles
// =============================================================================

export {
  runCorrelatedSimulation,
  runSimulationFromPredictions,
  runSingleIteration,
  sampleNormal,
  sampleRandomEffects,
  adjustProbability,
  randomEffectVariance,
  aggregateResults,
  createSeededRandom,
  estimateInducedCorrelation,
  computeAllOrNothingScore,
  DEFAULT_RANDOM_EFFECTS,
} from './monte-carlo';

export type {
  SimulationConfig,
  SimulationResult,
  RandomEffectSample,
  IterationResult,
  SchoolIterationResult,
  SchoolSimulationStats,
} from './monte-carlo';

// =============================================================================
// UNCERTAINTY QUANTIFICATION
// Parametric bootstrap for 80% credible intervals
// =============================================================================

export {
  sampleSchoolParams,
  sampleCompetitiveness,
  sampleExperienceEffect,
  calculatePredictionSample,
  bootstrapSchoolPrediction,
  computeCredibleInterval,
  computeVariance,
  aggregateBootstrapSamples,
  calculateSchoolPredictionWithUncertainty,
  calculateListPredictionWithUncertainty,
  decomposeUncertainty,
  quickUncertaintyEstimate,
  describeUncertainty,
  formatConfidenceInterval,
  DEFAULT_UNCERTAINTY_PARAMS,
  DEFAULT_UNCERTAINTY_CONFIG,
} from './uncertainty';

export type {
  ParameterUncertainty,
  SchoolParameterUncertainty,
  ModelUncertaintyParams,
  UncertaintyConfig,
  BootstrapSample,
  SchoolPredictionWithUncertainty,
  ListPredictionWithUncertainty,
} from './uncertainty';

// =============================================================================
// VALIDATION FRAMEWORK
// A-23 reproduction, sensitivity analysis, edge case testing
// =============================================================================

export {
  validateAgainstA23,
  validateSchoolRates,
  runSensitivityAnalysis,
  runEdgeCaseTests,
  generateValidationReport,
  formatValidationReportMarkdown,
  calculateModelImpliedPAtLeastOne,
} from './validation';

export type {
  A23ValidationResult,
  SchoolRateValidation,
  SchoolValidationResult,
  SensitivityTestResult,
  SensitivityAnalysisResult,
  EdgeCaseResult,
  ValidationReport,
} from './validation';
