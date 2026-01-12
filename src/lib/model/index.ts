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

// Future exports (to be implemented in subsequent phases):
// export { calculateCompetitiveness } from './competitiveness';
// export { calculateSchoolProbability } from './two-stage';
// export { runCorrelatedSimulation } from './monte-carlo';
