/**
 * Scoring Module Exports
 *
 * Central export for the prediction and scoring engine.
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
