/**
 * Prediction Components Module (v2.0)
 *
 * Components for displaying the rigorous probabilistic model results:
 * - Competitiveness Score (C) on -3 to +3 scale
 * - Two-stage probability model: P(interview) × P(accept|interview)
 * - 80% credible intervals via parametric bootstrap
 * - Experience saturation visualization
 * - Demographic effects breakdown
 * - Uncertainty decomposition
 */

/** Display 80% credible intervals with visual bar */
export { CredibleInterval, CredibleIntervalCompact } from './CredibleInterval'

/** Competitiveness Score (C) gauge from -3 to +3 */
export { CompetitivenessGauge, CompetitivenessCompact } from './CompetitivenessGauge'

/** Two-stage probability: P(interview) × P(accept|interview) */
export { TwoStageProbability, TwoStageProbabilityCompact } from './TwoStageProbability'

/** Experience saturation visualization with diminishing returns */
export { ExperienceSaturation, ExperienceCompact } from './ExperienceSaturation'

/** Uncertainty decomposition: parameter vs random effect variance */
export { UncertaintyBreakdown, UncertaintyBadge } from './UncertaintyBreakdown'

/** Demographic effects breakdown: URM, SES, mission fit */
export { DemographicEffects, DemographicCompact } from './DemographicEffects'

/** Main results display for predictions */
export { NativeResultsDisplay } from './NativeResultsDisplay'

/** School list with two-stage probabilities */
export { SchoolList } from './SchoolList'

/** Simulation results with correlation diagnostics */
export { SimulationResults } from './SimulationResults'
