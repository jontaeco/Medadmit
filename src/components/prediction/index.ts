/**
 * Prediction Components Module
 *
 * This module exports both legacy (v1.0) and new (v2.0) prediction display components.
 *
 * For new code, prefer the v2.0 components which support:
 * - Competitiveness Score (C) on -3 to +3 scale
 * - Two-stage probability model with P(interview) × P(accept|interview)
 * - 80% credible intervals
 * - Experience saturation visualization
 * - Demographic effects breakdown
 * - Uncertainty decomposition
 */

// =============================================================================
// LEGACY COMPONENTS (v1.0) - @deprecated
// These use the 0-1000 scoring system, WARS tiers, and simple probabilities.
// Maintained for backward compatibility only.
// =============================================================================

/** @deprecated Use NativeResultsDisplay with TwoStageProbability instead */
export { SchoolList } from './SchoolList'

/** @deprecated Use CompetitivenessGauge instead */
export { ScoreDisplay } from './ScoreDisplay'

/** @deprecated Use NativeResultsDisplay simulation tab instead */
export { SimulationResults } from './SimulationResults'

/** @deprecated Sankey diagram for legacy simulation flow */
export { SankeyDiagram } from './SankeyDiagram'

// =============================================================================
// NEW COMPONENTS (v2.0) - Preferred
// These support the rigorous probabilistic model with two-stage probabilities,
// competitiveness scores, and proper uncertainty quantification.
// =============================================================================

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

/** Main results display for native v2.0 format */
export { NativeResultsDisplay } from './NativeResultsDisplay'
