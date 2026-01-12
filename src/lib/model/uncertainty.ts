/**
 * Uncertainty Quantification for MedAdmit v2
 *
 * This module implements parametric bootstrap for propagating parameter
 * uncertainty through the prediction pipeline. It captures two distinct
 * sources of uncertainty:
 *
 * 1. **Parameter Uncertainty**: We don't know the exact values of model
 *    parameters (intercepts, slopes, demographic effects) due to limited
 *    calibration data. This is handled by sampling from parameter distributions.
 *
 * 2. **Applicant Random Effects**: Captured by Phase 7 Monte Carlo simulation.
 *    This represents variation in unmeasured applicant qualities.
 *
 * Together, these produce realistic credible intervals that reflect honest
 * uncertainty about predictions.
 */

import type {
  ApplicantProfile,
  SchoolData,
  SchoolModelParams,
  RandomEffectParams,
  ConfidenceInterval,
  DistributionBuckets,
} from './types';

import { calculateCompetitiveness, DEFAULT_SPLINES } from './competitiveness';
import { calculateExperienceContribution, DEFAULT_EXPERIENCE_PARAMS } from './experience';
import { calculateDemographicEffect, DEFAULT_DEMOGRAPHIC_PARAMS } from './demographics';
import { sigmoid, getSchoolParams } from './two-stage';
import {
  sampleNormal,
  createSeededRandom,
  adjustProbability,
  DEFAULT_RANDOM_EFFECTS,
} from './monte-carlo';

// ============================================================================
// Types
// ============================================================================

/**
 * Uncertainty specification for a single parameter.
 */
export interface ParameterUncertainty {
  /** Point estimate (mean) */
  mean: number;
  /** Standard deviation of uncertainty */
  sd: number;
}

/**
 * Uncertainty specifications for school-level parameters.
 */
export interface SchoolParameterUncertainty {
  interceptInterview: ParameterUncertainty;
  interceptAccept: ParameterUncertainty;
  slopeC_interview: ParameterUncertainty;
  slopeC_accept: ParameterUncertainty;
  inStateBonus_interview: ParameterUncertainty;
  inStateBonus_accept: ParameterUncertainty;
}

/**
 * Global uncertainty parameters for the model.
 */
export interface ModelUncertaintyParams {
  /** Default uncertainty for school intercepts (logit scale) */
  interceptSd: number;
  /** Default uncertainty for competitiveness slopes */
  slopeSd: number;
  /** Default uncertainty for in-state bonuses */
  inStateBonusSd: number;
  /** Uncertainty in competitiveness calculation */
  competitivenessSd: number;
  /** Uncertainty in experience contribution */
  experienceSd: number;
}

/**
 * Configuration for uncertainty quantification.
 */
export interface UncertaintyConfig {
  /** Number of bootstrap iterations */
  bootstrapIterations: number;
  /** Number of Monte Carlo iterations per bootstrap sample */
  monteCarloIterations: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Include parameter uncertainty */
  includeParameterUncertainty: boolean;
  /** Include random effects */
  includeRandomEffects: boolean;
}

/**
 * Result from a single bootstrap iteration.
 */
export interface BootstrapSample {
  pInterview: number;
  pAcceptGivenInterview: number;
  pAccept: number;
}

/**
 * Full uncertainty-aware prediction for a school.
 */
export interface SchoolPredictionWithUncertainty {
  schoolId: string;
  pInterview: ConfidenceInterval;
  pAcceptGivenInterview: ConfidenceInterval;
  pAccept: ConfidenceInterval;
  category: 'reach' | 'target' | 'likely' | 'safety';
  /** Breakdown of uncertainty sources */
  uncertaintyBreakdown: {
    parameterContribution: number;
    randomEffectContribution: number;
    totalVariance: number;
  };
}

/**
 * Full uncertainty-aware prediction for a list of schools.
 */
export interface ListPredictionWithUncertainty {
  schools: SchoolPredictionWithUncertainty[];
  expectedInterviews: ConfidenceInterval;
  expectedAcceptances: ConfidenceInterval;
  pAtLeastOne: ConfidenceInterval;
  distributionBuckets: DistributionBuckets;
}

// ============================================================================
// Default Parameters
// ============================================================================

/**
 * Default uncertainty parameters based on calibration methodology.
 *
 * These values reflect uncertainty from:
 * - Limited calibration data (MSAR aggregate stats)
 * - Hierarchical shrinkage toward tier means
 * - Inherent variability in admissions processes
 */
export const DEFAULT_UNCERTAINTY_PARAMS: ModelUncertaintyParams = {
  // School intercepts are fairly well-identified from MSAR rates
  // but have ~0.2 logit uncertainty (≈5% probability at baseline)
  interceptSd: 0.2,

  // Slopes on competitiveness have moderate uncertainty
  // Range roughly ±15% of slope value
  slopeSd: 0.15,

  // In-state bonuses are more uncertain, especially for privates
  inStateBonusSd: 0.25,

  // Competitiveness has small uncertainty from spline fitting
  competitivenessSd: 0.1,

  // Experience contribution has moderate uncertainty
  experienceSd: 0.15,
};

/**
 * Default configuration for uncertainty quantification.
 */
export const DEFAULT_UNCERTAINTY_CONFIG: UncertaintyConfig = {
  bootstrapIterations: 200,
  monteCarloIterations: 50,
  seed: undefined,
  includeParameterUncertainty: true,
  includeRandomEffects: true,
};

// ============================================================================
// Parameter Sampling
// ============================================================================

/**
 * Sample perturbed school parameters for bootstrap.
 */
export function sampleSchoolParams(
  baseParams: SchoolModelParams,
  uncertainty: ModelUncertaintyParams,
  random: () => number
): SchoolModelParams {
  return {
    interceptInterview:
      baseParams.interceptInterview +
      sampleNormal(0, uncertainty.interceptSd, random),
    interceptAccept:
      baseParams.interceptAccept +
      sampleNormal(0, uncertainty.interceptSd, random),
    slopeC_interview:
      baseParams.slopeC_interview *
      (1 + sampleNormal(0, uncertainty.slopeSd, random)),
    slopeC_accept:
      baseParams.slopeC_accept *
      (1 + sampleNormal(0, uncertainty.slopeSd, random)),
    inStateBonus_interview:
      baseParams.inStateBonus_interview +
      sampleNormal(0, uncertainty.inStateBonusSd, random),
    inStateBonus_accept:
      baseParams.inStateBonus_accept +
      sampleNormal(0, uncertainty.inStateBonusSd * 0.5, random),
  };
}

/**
 * Sample perturbed competitiveness for bootstrap.
 */
export function sampleCompetitiveness(
  baseC: number,
  uncertainty: ModelUncertaintyParams,
  random: () => number
): number {
  return baseC + sampleNormal(0, uncertainty.competitivenessSd, random);
}

/**
 * Sample perturbed experience contribution for bootstrap.
 */
export function sampleExperienceEffect(
  baseEffect: number,
  uncertainty: ModelUncertaintyParams,
  random: () => number
): number {
  return baseEffect * (1 + sampleNormal(0, uncertainty.experienceSd, random));
}

// ============================================================================
// Core Prediction with Uncertainty
// ============================================================================

/**
 * Calculate single prediction with sampled parameters.
 *
 * This is the inner loop of parametric bootstrap - it computes one
 * prediction using perturbed parameters.
 */
export function calculatePredictionSample(
  applicant: ApplicantProfile,
  school: SchoolData,
  schoolParams: SchoolModelParams,
  C: number,
  experienceEffect: number,
  demographicEffect: number,
  randomEffects: { uFile: number; uInterview: number }
): BootstrapSample {
  // Stage 1: Interview probability
  let etaInterview = schoolParams.interceptInterview;
  etaInterview += schoolParams.slopeC_interview * C;
  etaInterview += experienceEffect * 0.5;
  etaInterview += demographicEffect;

  const isInState = school.state === applicant.stateOfResidence;
  if (isInState) {
    etaInterview += schoolParams.inStateBonus_interview;
  }

  // Apply file quality random effect
  etaInterview += randomEffects.uFile;

  const pInterview = sigmoid(etaInterview);

  // Stage 2: Accept | Interview probability
  let etaAccept = schoolParams.interceptAccept;
  etaAccept += schoolParams.slopeC_accept * C;
  if (isInState) {
    etaAccept += schoolParams.inStateBonus_accept;
  }

  // Apply interview skill random effect
  etaAccept += randomEffects.uInterview;

  const pAcceptGivenInterview = sigmoid(etaAccept);

  // Combined probability
  const pAccept = pInterview * pAcceptGivenInterview;

  return { pInterview, pAcceptGivenInterview, pAccept };
}

/**
 * Run parametric bootstrap for a single school.
 *
 * This samples from parameter distributions and random effects to
 * generate a distribution of predictions.
 */
export function bootstrapSchoolPrediction(
  applicant: ApplicantProfile,
  school: SchoolData,
  config: UncertaintyConfig = DEFAULT_UNCERTAINTY_CONFIG,
  uncertaintyParams: ModelUncertaintyParams = DEFAULT_UNCERTAINTY_PARAMS,
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): BootstrapSample[] {
  const random = config.seed !== undefined
    ? createSeededRandom(config.seed)
    : Math.random;

  // Get base parameters
  const baseSchoolParams = getSchoolParams(school.id);
  if (!baseSchoolParams) {
    return [];
  }

  // Calculate base values
  const baseC = calculateCompetitiveness(applicant.gpa, applicant.mcat, DEFAULT_SPLINES);
  const baseExperience = calculateExperienceContribution(applicant, DEFAULT_EXPERIENCE_PARAMS);
  const baseDemographic = calculateDemographicEffect(applicant, school, DEFAULT_DEMOGRAPHIC_PARAMS);

  const samples: BootstrapSample[] = [];

  for (let i = 0; i < config.bootstrapIterations; i++) {
    // Sample parameters (if enabled)
    const schoolParams = config.includeParameterUncertainty
      ? sampleSchoolParams(baseSchoolParams, uncertaintyParams, random)
      : baseSchoolParams;

    const C = config.includeParameterUncertainty
      ? sampleCompetitiveness(baseC, uncertaintyParams, random)
      : baseC;

    const experienceEffect = config.includeParameterUncertainty
      ? sampleExperienceEffect(baseExperience, uncertaintyParams, random)
      : baseExperience;

    // Sample random effects (if enabled)
    const randomEffects = config.includeRandomEffects
      ? {
          uFile: sampleNormal(0, randomEffectParams.fileQuality.sd, random),
          uInterview: sampleNormal(0, randomEffectParams.interviewSkill.sd, random),
        }
      : { uFile: 0, uInterview: 0 };

    // Calculate prediction
    const sample = calculatePredictionSample(
      applicant,
      school,
      schoolParams,
      C,
      experienceEffect,
      baseDemographic, // Demographic effect already has uncertainty built in
      randomEffects
    );

    samples.push(sample);
  }

  return samples;
}

// ============================================================================
// Result Aggregation
// ============================================================================

/**
 * Compute percentile from sorted array.
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedArr[lower];
  const frac = index - lower;
  return sortedArr[lower] * (1 - frac) + sortedArr[upper] * frac;
}

/**
 * Compute confidence interval from samples.
 */
export function computeCredibleInterval(
  samples: number[],
  level: number = 80
): ConfidenceInterval {
  if (samples.length === 0) {
    return { mean: 0, ci80: [0, 0] };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;

  const lowerP = (100 - level) / 2;
  const upperP = 100 - lowerP;

  return {
    mean,
    ci80: [percentile(sorted, lowerP), percentile(sorted, upperP)],
  };
}

/**
 * Compute variance from samples.
 */
export function computeVariance(samples: number[]): number {
  if (samples.length === 0) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
}

/**
 * Categorize school based on acceptance probability.
 */
function categorizeSchool(
  pAccept: number
): 'reach' | 'target' | 'likely' | 'safety' {
  if (pAccept < 0.15) return 'reach';
  if (pAccept < 0.35) return 'target';
  if (pAccept < 0.60) return 'likely';
  return 'safety';
}

/**
 * Aggregate bootstrap samples into prediction with uncertainty.
 */
export function aggregateBootstrapSamples(
  schoolId: string,
  samples: BootstrapSample[]
): SchoolPredictionWithUncertainty {
  const pInterviewSamples = samples.map((s) => s.pInterview);
  const pAcceptGivenInterviewSamples = samples.map((s) => s.pAcceptGivenInterview);
  const pAcceptSamples = samples.map((s) => s.pAccept);

  const pInterview = computeCredibleInterval(pInterviewSamples);
  const pAcceptGivenInterview = computeCredibleInterval(pAcceptGivenInterviewSamples);
  const pAccept = computeCredibleInterval(pAcceptSamples);

  // Estimate uncertainty breakdown (rough approximation)
  const totalVariance = computeVariance(pAcceptSamples);

  return {
    schoolId,
    pInterview,
    pAcceptGivenInterview,
    pAccept,
    category: categorizeSchool(pAccept.mean),
    uncertaintyBreakdown: {
      parameterContribution: totalVariance * 0.4, // Rough estimate
      randomEffectContribution: totalVariance * 0.6,
      totalVariance,
    },
  };
}

// ============================================================================
// Full Prediction Functions
// ============================================================================

/**
 * Calculate school prediction with full uncertainty quantification.
 */
export function calculateSchoolPredictionWithUncertainty(
  applicant: ApplicantProfile,
  school: SchoolData,
  config: UncertaintyConfig = DEFAULT_UNCERTAINTY_CONFIG,
  uncertaintyParams: ModelUncertaintyParams = DEFAULT_UNCERTAINTY_PARAMS,
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): SchoolPredictionWithUncertainty | null {
  const samples = bootstrapSchoolPrediction(
    applicant,
    school,
    config,
    uncertaintyParams,
    randomEffectParams
  );

  if (samples.length === 0) {
    return null;
  }

  return aggregateBootstrapSamples(school.id, samples);
}

/**
 * Calculate list prediction with full uncertainty quantification.
 */
export function calculateListPredictionWithUncertainty(
  applicant: ApplicantProfile,
  schools: SchoolData[],
  config: UncertaintyConfig = DEFAULT_UNCERTAINTY_CONFIG,
  uncertaintyParams: ModelUncertaintyParams = DEFAULT_UNCERTAINTY_PARAMS,
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): ListPredictionWithUncertainty {
  const random = config.seed !== undefined
    ? createSeededRandom(config.seed)
    : Math.random;

  // Pre-calculate base values that are shared across schools
  const baseC = calculateCompetitiveness(applicant.gpa, applicant.mcat, DEFAULT_SPLINES);
  const baseExperience = calculateExperienceContribution(applicant, DEFAULT_EXPERIENCE_PARAMS);

  // Track per-iteration aggregates for list-level metrics
  const iterationInterviews: number[] = [];
  const iterationAcceptances: number[] = [];
  const iterationAtLeastOne: number[] = [];
  const acceptanceCounts: number[] = [];

  // Per-school samples
  const schoolSamples: Map<string, BootstrapSample[]> = new Map();
  for (const school of schools) {
    schoolSamples.set(school.id, []);
  }

  // Run bootstrap iterations
  for (let iter = 0; iter < config.bootstrapIterations; iter++) {
    // Sample shared parameters for this iteration
    const C = config.includeParameterUncertainty
      ? sampleCompetitiveness(baseC, uncertaintyParams, random)
      : baseC;

    const experienceEffect = config.includeParameterUncertainty
      ? sampleExperienceEffect(baseExperience, uncertaintyParams, random)
      : baseExperience;

    // Sample shared random effects for this iteration
    const randomEffects = config.includeRandomEffects
      ? {
          uFile: sampleNormal(0, randomEffectParams.fileQuality.sd, random),
          uInterview: sampleNormal(0, randomEffectParams.interviewSkill.sd, random),
        }
      : { uFile: 0, uInterview: 0 };

    let totalInterviews = 0;
    let totalAcceptances = 0;
    let acceptanceCount = 0;

    // Calculate predictions for all schools in this iteration
    for (const school of schools) {
      const baseSchoolParams = getSchoolParams(school.id);
      if (!baseSchoolParams) continue;

      const schoolParams = config.includeParameterUncertainty
        ? sampleSchoolParams(baseSchoolParams, uncertaintyParams, random)
        : baseSchoolParams;

      const baseDemographic = calculateDemographicEffect(
        applicant,
        school,
        DEFAULT_DEMOGRAPHIC_PARAMS
      );

      const sample = calculatePredictionSample(
        applicant,
        school,
        schoolParams,
        C,
        experienceEffect,
        baseDemographic,
        randomEffects
      );

      schoolSamples.get(school.id)?.push(sample);

      totalInterviews += sample.pInterview;
      totalAcceptances += sample.pAccept;

      // Simulate acceptance outcome for this iteration
      if (random() < sample.pAccept) {
        acceptanceCount++;
      }
    }

    iterationInterviews.push(totalInterviews);
    iterationAcceptances.push(totalAcceptances);
    iterationAtLeastOne.push(acceptanceCount > 0 ? 1 : 0);
    acceptanceCounts.push(acceptanceCount);
  }

  // Aggregate school-level results
  const schoolPredictions: SchoolPredictionWithUncertainty[] = [];
  for (const school of schools) {
    const samples = schoolSamples.get(school.id);
    if (samples && samples.length > 0) {
      schoolPredictions.push(aggregateBootstrapSamples(school.id, samples));
    }
  }

  // Sort by acceptance probability
  schoolPredictions.sort((a, b) => b.pAccept.mean - a.pAccept.mean);

  // Compute list-level metrics
  const expectedInterviews = computeCredibleInterval(iterationInterviews);
  const expectedAcceptances = computeCredibleInterval(iterationAcceptances);

  const pAtLeastOneMean =
    iterationAtLeastOne.reduce((a, b) => a + b, 0) / iterationAtLeastOne.length;
  const pAtLeastOne: ConfidenceInterval = {
    mean: pAtLeastOneMean,
    ci80: computeWilsonCI(pAtLeastOneMean, iterationAtLeastOne.length, 80),
  };

  // Distribution buckets
  const n = acceptanceCounts.length;
  const distributionBuckets: DistributionBuckets = {
    zero: acceptanceCounts.filter((c) => c === 0).length / n,
    one: acceptanceCounts.filter((c) => c === 1).length / n,
    twoThree: acceptanceCounts.filter((c) => c >= 2 && c <= 3).length / n,
    fourPlus: acceptanceCounts.filter((c) => c >= 4).length / n,
  };

  return {
    schools: schoolPredictions,
    expectedInterviews,
    expectedAcceptances,
    pAtLeastOne,
    distributionBuckets,
  };
}

/**
 * Compute Wilson score confidence interval for a proportion.
 */
function computeWilsonCI(p: number, n: number, level: number): [number, number] {
  // z-score for confidence level
  const z = level === 80 ? 1.28 : level === 90 ? 1.645 : level === 95 ? 1.96 : 1.28;

  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const halfWidth =
    (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;

  return [Math.max(0, center - halfWidth), Math.min(1, center + halfWidth)];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate the contribution of each uncertainty source.
 *
 * Runs bootstrap with and without each source to decompose variance.
 */
export function decomposeUncertainty(
  applicant: ApplicantProfile,
  school: SchoolData,
  baseConfig: UncertaintyConfig = DEFAULT_UNCERTAINTY_CONFIG
): {
  parameterOnly: number;
  randomEffectOnly: number;
  combined: number;
  interaction: number;
} {
  // Parameter uncertainty only
  const paramOnlySamples = bootstrapSchoolPrediction(applicant, school, {
    ...baseConfig,
    includeParameterUncertainty: true,
    includeRandomEffects: false,
  });
  const paramOnlyVar = computeVariance(paramOnlySamples.map((s) => s.pAccept));

  // Random effect uncertainty only
  const reOnlySamples = bootstrapSchoolPrediction(applicant, school, {
    ...baseConfig,
    includeParameterUncertainty: false,
    includeRandomEffects: true,
  });
  const reOnlyVar = computeVariance(reOnlySamples.map((s) => s.pAccept));

  // Combined uncertainty
  const combinedSamples = bootstrapSchoolPrediction(applicant, school, {
    ...baseConfig,
    includeParameterUncertainty: true,
    includeRandomEffects: true,
  });
  const combinedVar = computeVariance(combinedSamples.map((s) => s.pAccept));

  // Interaction term (non-additive component)
  const interaction = combinedVar - paramOnlyVar - reOnlyVar;

  return {
    parameterOnly: paramOnlyVar,
    randomEffectOnly: reOnlyVar,
    combined: combinedVar,
    interaction: Math.max(0, interaction), // Clamp to non-negative
  };
}

/**
 * Quick uncertainty estimate using analytical approximation.
 *
 * This is faster than full bootstrap but less accurate.
 * Good for UI responsiveness before full calculation completes.
 */
export function quickUncertaintyEstimate(
  pAccept: number,
  uncertaintyParams: ModelUncertaintyParams = DEFAULT_UNCERTAINTY_PARAMS,
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): ConfidenceInterval {
  // Approximate variance using delta method
  // Var(σ(η)) ≈ σ'(η)² × Var(η)
  // where σ'(η) = p(1-p)

  const derivativeSquared = Math.pow(pAccept * (1 - pAccept), 2);

  // Total eta variance from parameters and random effects
  const paramVar =
    Math.pow(uncertaintyParams.interceptSd, 2) +
    Math.pow(uncertaintyParams.slopeSd, 2) +
    Math.pow(uncertaintyParams.competitivenessSd, 2);

  const reVar =
    Math.pow(randomEffectParams.fileQuality.sd, 2) +
    Math.pow(randomEffectParams.interviewSkill.sd, 2);

  const totalEtaVar = paramVar + reVar;
  const probVar = derivativeSquared * totalEtaVar;
  const probSd = Math.sqrt(probVar);

  // 80% CI (±1.28 SD)
  const z = 1.28;

  return {
    mean: pAccept,
    ci80: [
      Math.max(0, pAccept - z * probSd),
      Math.min(1, pAccept + z * probSd),
    ],
  };
}

/**
 * Get human-readable description of uncertainty level.
 */
export function describeUncertainty(ci: ConfidenceInterval): string {
  const width = ci.ci80[1] - ci.ci80[0];
  const relativeWidth = width / Math.max(ci.mean, 0.01);

  if (width < 0.05) return 'very_precise';
  if (width < 0.10) return 'precise';
  if (width < 0.20) return 'moderate';
  if (width < 0.30) return 'uncertain';
  return 'highly_uncertain';
}

/**
 * Format confidence interval for display.
 */
export function formatConfidenceInterval(
  ci: ConfidenceInterval,
  asPercent: boolean = true
): string {
  if (asPercent) {
    const mean = (ci.mean * 100).toFixed(1);
    const lower = (ci.ci80[0] * 100).toFixed(1);
    const upper = (ci.ci80[1] * 100).toFixed(1);
    return `${mean}% (${lower}% - ${upper}%)`;
  } else {
    return `${ci.mean.toFixed(3)} (${ci.ci80[0].toFixed(3)} - ${ci.ci80[1].toFixed(3)})`;
  }
}
