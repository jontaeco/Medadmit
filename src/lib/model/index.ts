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

// Future exports (to be implemented in subsequent phases):
// export { calculateCompetitiveness } from './competitiveness';
// export { calculateSchoolProbability } from './two-stage';
// export { runCorrelatedSimulation } from './monte-carlo';
