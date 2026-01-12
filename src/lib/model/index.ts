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

// Future exports (to be implemented in subsequent phases):
// export { runCorrelatedSimulation } from './monte-carlo';
