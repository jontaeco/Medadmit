/**
 * Competitiveness Score Calculation for MedAdmit v2
 *
 * This module computes the latent competitiveness score C_i from GPA and MCAT
 * using calibrated monotone I-splines.
 *
 * Model: C_i = f_GPA(gpa) + f_MCAT(mcat)
 *
 * Where f_GPA and f_MCAT are monotone I-splines calibrated to reproduce
 * AAMC A-23 acceptance rates.
 *
 * Key properties:
 * - C = 0 at anchor point (GPA=3.75, MCAT=512)
 * - Higher C → higher acceptance probability
 * - Monotone in both GPA and MCAT
 */

import type { ApplicantProfile } from './types';

// Import lookup table and spline metadata at runtime
import lookupJson from '../../../data/model/competitiveness-lookup.json';
import splinesJson from '../../../data/model/competitiveness-splines-v1.json';

// ============================================================================
// Types
// ============================================================================

export interface SplineParams {
  coefficients: number[];
  intercept: number;
  n_basis: number;
  degree: number;
  x_min: number;
  x_max: number;
  knots: number[];
}

export interface LookupTable {
  min: number;
  max: number;
  values: number[];
}

export interface CompetitivenessSplines {
  gpaSpline: SplineParams;
  mcatSpline: SplineParams;
  gpaLookup: LookupTable;
  mcatLookup: LookupTable;
  globalIntercept: number;
  anchorGpa: number;
  anchorMcat: number;
}

// ============================================================================
// Default Parameters
// ============================================================================

export const DEFAULT_SPLINES: CompetitivenessSplines = {
  gpaSpline: splinesJson.gpaSpline as SplineParams,
  mcatSpline: splinesJson.mcatSpline as SplineParams,
  gpaLookup: lookupJson.gpa as LookupTable,
  mcatLookup: lookupJson.mcat as LookupTable,
  globalIntercept: lookupJson.globalIntercept,
  anchorGpa: splinesJson.calibration.anchor_gpa,
  anchorMcat: splinesJson.calibration.anchor_mcat,
};

// ============================================================================
// Lookup-based Spline Evaluation
// ============================================================================

/**
 * Linear interpolation in a lookup table.
 */
function interpolateLookup(x: number, lookup: LookupTable): number {
  const { min, max, values } = lookup;
  const n = values.length;

  // Clamp to range
  const xClamped = Math.max(min, Math.min(max, x));

  // Find position in normalized [0, n-1] space
  const t = ((xClamped - min) / (max - min)) * (n - 1);
  const i = Math.floor(t);
  const frac = t - i;

  // Handle edge cases
  if (i >= n - 1) {
    return values[n - 1];
  }
  if (i < 0) {
    return values[0];
  }

  // Linear interpolation
  return values[i] * (1 - frac) + values[i + 1] * frac;
}

/**
 * Evaluate a spline at a point using the pre-computed lookup table.
 * This provides exact match with Python calibration.
 */
export function evaluateSpline(x: number, params: SplineParams): number {
  // Use lookup table based on which spline (GPA vs MCAT)
  if (params.x_min === 2.0 && params.x_max === 4.0) {
    return interpolateLookup(x, DEFAULT_SPLINES.gpaLookup);
  } else {
    return interpolateLookup(x, DEFAULT_SPLINES.mcatLookup);
  }
}

// ============================================================================
// Competitiveness Calculation
// ============================================================================

/**
 * Calculate GPA contribution to competitiveness.
 *
 * @param gpa - Applicant's GPA (0.0 - 4.0)
 * @param splines - Spline parameters
 * @returns GPA contribution in logit units
 */
export function calculateGpaContribution(
  gpa: number,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  return interpolateLookup(gpa, splines.gpaLookup);
}

/**
 * Calculate MCAT contribution to competitiveness.
 *
 * @param mcat - Applicant's MCAT score (472 - 528)
 * @param splines - Spline parameters
 * @returns MCAT contribution in logit units
 */
export function calculateMcatContribution(
  mcat: number,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  return interpolateLookup(mcat, splines.mcatLookup);
}

/**
 * Calculate total competitiveness score C_i.
 *
 * C_i = f_GPA(gpa) + f_MCAT(mcat)
 *
 * Properties:
 * - C = 0 at anchor point (GPA=3.75, MCAT=512)
 * - Higher values indicate stronger academic profile
 * - Typically ranges from about -3 to +3
 *
 * @param gpa - Applicant's GPA
 * @param mcat - Applicant's MCAT score
 * @param splines - Spline parameters
 * @returns Competitiveness score in logit units
 */
export function calculateCompetitiveness(
  gpa: number,
  mcat: number,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  const gpaContrib = calculateGpaContribution(gpa, splines);
  const mcatContrib = calculateMcatContribution(mcat, splines);
  return gpaContrib + mcatContrib;
}

/**
 * Calculate competitiveness from an applicant profile.
 */
export function calculateCompetitivenessFromProfile(
  applicant: ApplicantProfile,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  return calculateCompetitiveness(applicant.gpa, applicant.mcat, splines);
}

/**
 * Get competitiveness breakdown showing GPA and MCAT contributions.
 */
export function getCompetitivenessBreakdown(
  gpa: number,
  mcat: number,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): {
  gpaContribution: number;
  mcatContribution: number;
  total: number;
  globalIntercept: number;
} {
  const gpaContribution = calculateGpaContribution(gpa, splines);
  const mcatContribution = calculateMcatContribution(mcat, splines);

  return {
    gpaContribution,
    mcatContribution,
    total: gpaContribution + mcatContribution,
    globalIntercept: splines.globalIntercept,
  };
}

/**
 * Convert competitiveness to approximate P(>=1 acceptance) using the
 * global intercept from A-23 calibration.
 *
 * This is the marginal probability of receiving at least one acceptance
 * for an applicant with this competitiveness score.
 *
 * @param C - Competitiveness score
 * @param splines - Spline parameters (for global intercept)
 * @returns Approximate P(>=1 acceptance)
 */
export function competitivenessToBaselineProb(
  C: number,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  const logit = splines.globalIntercept + C;
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Get the competitiveness at the anchor point (should be ~0).
 */
export function getAnchorCompetitiveness(
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): number {
  return calculateCompetitiveness(splines.anchorGpa, splines.anchorMcat, splines);
}

/**
 * Classify competitiveness into tiers.
 */
export function classifyCompetitiveness(
  C: number
): 'very_low' | 'low' | 'below_average' | 'average' | 'above_average' | 'high' | 'very_high' {
  if (C < -2.0) return 'very_low';
  if (C < -1.0) return 'low';
  if (C < -0.3) return 'below_average';
  if (C < 0.3) return 'average';
  if (C < 1.0) return 'above_average';
  if (C < 2.0) return 'high';
  return 'very_high';
}
