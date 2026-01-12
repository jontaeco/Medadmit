/**
 * @deprecated Legacy Scoring Module
 *
 * This module contains the legacy v1.0 scoring system including:
 * - 0-1000 applicant score
 * - WARS (WedgeDawg Applicant Rating System)
 * - Simple probability calculations
 *
 * For new code, use the v2.0 model from '@/lib/model' instead:
 * - Competitiveness Score (C) on -3 to +3 scale
 * - Two-stage probability model (P(interview) × P(accept|interview))
 * - Experience saturation functions
 * - Correlated Monte Carlo simulation
 * - 80% credible intervals
 *
 * This module is maintained for backward compatibility only.
 */

// Types
export type {
  ApplicantInput,
  ScoreBreakdown,
  SchoolProbability,
  SchoolList,
  SimulationConfig,
  SimulationResult,
  PredictionResult,
  ExperienceThresholds,
} from './types'

export { DEFAULT_EXPERIENCE_THRESHOLDS } from './types'

// Applicant Score
export {
  calculateApplicantScore,
  getScoreInterpretation,
} from './applicant-score'

// School Probability
export {
  calculateSchoolProbability,
  calculateAllSchoolProbabilities,
  getProbabilityInterpretation,
} from './school-probability'

// Monte Carlo Simulation
export {
  runSimulation,
  runQuickSimulation,
  calculateTheoreticalProbability,
  calculateExpectedAcceptances,
  calculateExpectedInterviews,
  getHistogramData,
  getSimulationSummary,
  runSensitivityAnalysis,
  DEFAULT_SIMULATION_CONFIG,
} from './monte-carlo'

// School List Generation
export {
  generateSchoolList,
  optimizeSchoolList,
  getSchoolListSummary,
  compareSchoolLists,
  getWARSTierName,
  getWARSTierDescription,
  type SchoolListOptions,
} from './school-list'

// Full Prediction
export {
  generatePrediction,
  generatePredictionReport,
  generateQuickPrediction,
} from './prediction'

// WARS Score (WedgeDawg Applicant Rating System)
export {
  calculateWARSScore,
  getWARSLevel,
  getWARSLevelDescription,
  type WARSInput,
  type WARSResult,
} from './wars-score'

export {
  applicantInputToWARSInput,
  profileToWARSInput,
} from './wars-conversion'
