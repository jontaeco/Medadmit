/**
 * MedAdmit v2 Model
 *
 * This module exports types and functions for the
 * rigorous probabilistic admissions model.
 */

// Export all types
export * from './types';

// Phase 4: Experience saturation functions
export {
  saturatingContribution,
  contributionWithThreshold,
  publicationContribution,
  calculateExperienceContribution,
  getExperienceBreakdown,
  checkMinimumThresholds,
  DEFAULT_EXPERIENCE_PARAMS,
} from './experience';

// Phase 5: Demographic and mission effects
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

// Phase 6: Competitiveness calculation
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

// Phase 6: Two-stage probability model
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

// Phase 7: Monte Carlo simulation with correlated random effects
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

// Re-export types from monte-carlo
export type {
  SimulationConfig,
  SimulationResult,
  RandomEffectSample,
  IterationResult,
  SchoolIterationResult,
  SchoolSimulationStats,
} from './monte-carlo';

// Phase 8: Uncertainty quantification
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

// Re-export types from uncertainty
export type {
  ParameterUncertainty,
  SchoolParameterUncertainty,
  ModelUncertaintyParams,
  UncertaintyConfig,
  BootstrapSample,
  SchoolPredictionWithUncertainty,
  ListPredictionWithUncertainty,
} from './uncertainty';

// Phase 9: Validation framework
export {
  validateAgainstA23,
  validateSchoolRates,
  runSensitivityAnalysis,
  runEdgeCaseTests,
  generateValidationReport,
  formatValidationReportMarkdown,
  calculateModelImpliedPAtLeastOne,
} from './validation';

// Re-export types from validation
export type {
  A23ValidationResult,
  SchoolRateValidation,
  SchoolValidationResult,
  SensitivityTestResult,
  SensitivityAnalysisResult,
  EdgeCaseResult,
  ValidationReport,
} from './validation';

// Phase 10: Migration utilities (API compatibility layer)
export {
  generatePrediction,
  generateQuickPrediction,
  generateLegacySchoolList,
  runLegacySimulation,
  calculateLegacyScore,
  convertToApplicantProfile,
  convertToSchoolData,
} from './migration';

// Re-export types from migration
export type {
  LegacyApplicantInput,
  LegacyScoreBreakdown,
  LegacySchoolProbability,
  LegacySchoolList,
  LegacySimulationResult,
  LegacyPredictionResult,
  PerSchoolOutcome,
  ModalOutcome,
} from './migration';
