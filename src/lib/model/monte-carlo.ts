/**
 * Monte Carlo Simulation with Correlated Random Effects
 *
 * This module implements correlated Monte Carlo simulation for medical school
 * admissions predictions. The key insight is that unmeasured applicant qualities
 * (essay strength, LOR quality, interview skill) create correlation across schools.
 *
 * Random Effects Model:
 * - u^(file)_i ~ N(0, σ²_file): Affects all interview outcomes
 * - u^(interview)_i ~ N(0, σ²_interview): Affects all acceptance|interview outcomes
 *
 * These are sampled ONCE per applicant per simulation iteration and applied
 * to ALL schools, creating realistic "all-or-nothing" cycle patterns.
 */

import type { SchoolPrediction, RandomEffectParams } from './types';
import { sigmoid, logit } from './two-stage';

// ============================================================================
// Types
// ============================================================================

export interface SimulationConfig {
  /** Number of Monte Carlo iterations */
  iterations: number;
  /** Random seed for reproducibility (optional) */
  seed?: number;
}

export interface RandomEffectSample {
  /** File quality random effect (affects interview probability) */
  uFile: number;
  /** Interview skill random effect (affects accept|interview probability) */
  uInterview: number;
}

export interface SchoolIterationResult {
  schoolId: string;
  interviewed: boolean;
  accepted: boolean;
  /** Adjusted interview probability for this iteration */
  adjustedPInterview: number;
  /** Adjusted accept|interview probability for this iteration */
  adjustedPAcceptGivenInterview: number;
}

export interface IterationResult {
  /** Total interviews received in this iteration */
  interviews: number;
  /** Total acceptances received in this iteration */
  acceptances: number;
  /** Per-school outcomes */
  schoolResults: SchoolIterationResult[];
  /** Random effects used in this iteration */
  randomEffects: RandomEffectSample;
}

export interface SimulationResult {
  /** Number of iterations run */
  iterations: number;

  /** Expected (mean) number of interviews */
  expectedInterviews: number;
  /** Expected (mean) number of acceptances */
  expectedAcceptances: number;

  /** 80% credible interval for interviews */
  interviewsCI80: [number, number];
  /** 80% credible interval for acceptances */
  acceptancesCI80: [number, number];

  /** Probability of at least one acceptance */
  pAtLeastOne: number;
  /** 80% CI for P(at least one) */
  pAtLeastOneCI80: [number, number];

  /** Distribution buckets */
  distributionBuckets: {
    zero: number;    // P(0 acceptances)
    one: number;     // P(exactly 1)
    twoThree: number; // P(2-3)
    fourPlus: number; // P(4+)
  };

  /** Per-school simulation statistics */
  schoolStats: SchoolSimulationStats[];

  /** Correlation diagnostics */
  correlationDiagnostics: {
    /** Observed correlation between schools */
    meanPairwiseCorrelation: number;
    /** Variance of total acceptances (higher = more correlation) */
    acceptanceVariance: number;
    /** Coefficient of variation */
    acceptanceCV: number;
  };
}

export interface SchoolSimulationStats {
  schoolId: string;
  /** Simulated interview rate */
  simulatedInterviewRate: number;
  /** Simulated acceptance rate */
  simulatedAcceptanceRate: number;
  /** Conditional acceptance rate (given interview) */
  simulatedAcceptGivenInterviewRate: number;
}

// ============================================================================
// Default Random Effect Parameters
// ============================================================================

export const DEFAULT_RANDOM_EFFECTS: RandomEffectParams = {
  fileQuality: { sd: 0.5 },      // ~60% of variation explained by C
  interviewSkill: { sd: 0.7 },   // Interview skill matters more
};

// ============================================================================
// Random Number Generation
// ============================================================================

/**
 * Simple seeded pseudo-random number generator (Mulberry32).
 * Returns a function that generates numbers in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for generating normally distributed random numbers.
 *
 * @param mean - Mean of the distribution
 * @param sd - Standard deviation
 * @param random - Random number generator returning values in [0, 1)
 * @returns A normally distributed random number
 */
export function sampleNormal(
  mean: number,
  sd: number,
  random: () => number = Math.random
): number {
  // Box-Muller transform
  const u1 = random();
  const u2 = random();

  // Avoid log(0)
  const safeU1 = Math.max(u1, 1e-10);

  const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

/**
 * Sample applicant random effects for one simulation iteration.
 */
export function sampleRandomEffects(
  params: RandomEffectParams = DEFAULT_RANDOM_EFFECTS,
  random: () => number = Math.random
): RandomEffectSample {
  return {
    uFile: sampleNormal(0, params.fileQuality.sd, random),
    uInterview: sampleNormal(0, params.interviewSkill.sd, random),
  };
}

// ============================================================================
// Probability Adjustment
// ============================================================================

/**
 * Adjust a probability by adding a random effect on the logit scale.
 *
 * This transforms the probability to logit space, adds the random effect,
 * then transforms back. This ensures the result stays in (0, 1).
 *
 * @param baseProbability - Original probability
 * @param randomEffect - Random effect to add (in logit units)
 * @returns Adjusted probability
 */
export function adjustProbability(
  baseProbability: number,
  randomEffect: number
): number {
  // Handle edge cases
  if (baseProbability <= 0) return 0;
  if (baseProbability >= 1) return 1;

  // Convert to logit, add random effect, convert back
  const baseLogit = logit(baseProbability);
  const adjustedLogit = baseLogit + randomEffect;
  return sigmoid(adjustedLogit);
}

/**
 * Compute the variance of the random effect's impact on probability.
 *
 * This helps understand how much the random effects spread out outcomes.
 *
 * @param baseProbability - Base probability
 * @param sd - Standard deviation of random effect
 * @returns Approximate variance of adjusted probability
 */
export function randomEffectVariance(
  baseProbability: number,
  sd: number
): number {
  // At logit scale, the variance is σ²
  // The variance of the probability depends on where we are on the sigmoid
  // Approximate using delta method: Var(σ(η)) ≈ σ'(η)² × σ²_RE
  // where σ'(η) = p(1-p)
  const p = baseProbability;
  const sigmoidDerivative = p * (1 - p);
  return sigmoidDerivative * sigmoidDerivative * sd * sd;
}

// ============================================================================
// Single Iteration Simulation
// ============================================================================

/**
 * Run a single iteration of the Monte Carlo simulation.
 *
 * @param predictions - School predictions (with base probabilities)
 * @param randomEffects - Sampled random effects for this iteration
 * @param random - Random number generator
 * @returns Results for this iteration
 */
export function runSingleIteration(
  predictions: Array<{ schoolId: string; pInterview: number; pAcceptGivenInterview: number }>,
  randomEffects: RandomEffectSample,
  random: () => number = Math.random
): IterationResult {
  let interviews = 0;
  let acceptances = 0;
  const schoolResults: SchoolIterationResult[] = [];

  for (const pred of predictions) {
    // Adjust probabilities with random effects
    const adjustedPInt = adjustProbability(pred.pInterview, randomEffects.uFile);
    const adjustedPAcc = adjustProbability(
      pred.pAcceptGivenInterview,
      randomEffects.uInterview
    );

    // Simulate interview outcome
    const interviewed = random() < adjustedPInt;
    let accepted = false;

    if (interviewed) {
      interviews++;
      // Simulate acceptance outcome (conditional on interview)
      accepted = random() < adjustedPAcc;
      if (accepted) {
        acceptances++;
      }
    }

    schoolResults.push({
      schoolId: pred.schoolId,
      interviewed,
      accepted,
      adjustedPInterview: adjustedPInt,
      adjustedPAcceptGivenInterview: adjustedPAcc,
    });
  }

  return {
    interviews,
    acceptances,
    schoolResults,
    randomEffects,
  };
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
 * Aggregate results from all iterations into summary statistics.
 */
export function aggregateResults(
  iterations: IterationResult[],
  predictions: Array<{ schoolId: string }>
): SimulationResult {
  const n = iterations.length;
  if (n === 0) {
    throw new Error('No iterations to aggregate');
  }

  // Extract counts
  const interviewCounts = iterations.map((it) => it.interviews);
  const acceptanceCounts = iterations.map((it) => it.acceptances);

  // Sort for percentile calculation
  const sortedInterviews = [...interviewCounts].sort((a, b) => a - b);
  const sortedAcceptances = [...acceptanceCounts].sort((a, b) => a - b);

  // Calculate means
  const expectedInterviews =
    interviewCounts.reduce((a, b) => a + b, 0) / n;
  const expectedAcceptances =
    acceptanceCounts.reduce((a, b) => a + b, 0) / n;

  // Calculate 80% CIs (10th to 90th percentile)
  const interviewsCI80: [number, number] = [
    percentile(sortedInterviews, 10),
    percentile(sortedInterviews, 90),
  ];
  const acceptancesCI80: [number, number] = [
    percentile(sortedAcceptances, 10),
    percentile(sortedAcceptances, 90),
  ];

  // P(at least one acceptance)
  const atLeastOneCount = acceptanceCounts.filter((c) => c >= 1).length;
  const pAtLeastOne = atLeastOneCount / n;

  // Bootstrap CI for P(at least one) using Wilson score interval approximation
  const z = 1.28; // 80% CI
  const pHat = pAtLeastOne;
  const denominator = 1 + (z * z) / n;
  const center = (pHat + (z * z) / (2 * n)) / denominator;
  const halfWidth =
    (z * Math.sqrt((pHat * (1 - pHat) + (z * z) / (4 * n)) / n)) / denominator;
  const pAtLeastOneCI80: [number, number] = [
    Math.max(0, center - halfWidth),
    Math.min(1, center + halfWidth),
  ];

  // Distribution buckets
  const zeroCount = acceptanceCounts.filter((c) => c === 0).length;
  const oneCount = acceptanceCounts.filter((c) => c === 1).length;
  const twoThreeCount = acceptanceCounts.filter((c) => c >= 2 && c <= 3).length;
  const fourPlusCount = acceptanceCounts.filter((c) => c >= 4).length;

  const distributionBuckets = {
    zero: zeroCount / n,
    one: oneCount / n,
    twoThree: twoThreeCount / n,
    fourPlus: fourPlusCount / n,
  };

  // Per-school statistics
  const schoolStats: SchoolSimulationStats[] = predictions.map((pred, idx) => {
    let interviewCount = 0;
    let acceptCount = 0;
    let acceptGivenInterviewCount = 0;

    for (const it of iterations) {
      const schoolResult = it.schoolResults[idx];
      if (schoolResult.interviewed) {
        interviewCount++;
        if (schoolResult.accepted) {
          acceptCount++;
          acceptGivenInterviewCount++;
        }
      }
    }

    return {
      schoolId: pred.schoolId,
      simulatedInterviewRate: interviewCount / n,
      simulatedAcceptanceRate: acceptCount / n,
      simulatedAcceptGivenInterviewRate:
        interviewCount > 0 ? acceptGivenInterviewCount / interviewCount : 0,
    };
  });

  // Correlation diagnostics
  const acceptanceVariance =
    acceptanceCounts.reduce(
      (sum, c) => sum + Math.pow(c - expectedAcceptances, 2),
      0
    ) / n;
  const acceptanceCV =
    expectedAcceptances > 0
      ? Math.sqrt(acceptanceVariance) / expectedAcceptances
      : 0;

  // Mean pairwise correlation (sample a few pairs for efficiency)
  let correlationSum = 0;
  let correlationCount = 0;
  const numSchools = predictions.length;

  if (numSchools >= 2) {
    // Sample up to 100 pairs
    const maxPairs = Math.min(100, (numSchools * (numSchools - 1)) / 2);
    const step = Math.max(1, Math.floor((numSchools * (numSchools - 1)) / 2 / maxPairs));

    for (let i = 0; i < numSchools && correlationCount < maxPairs; i++) {
      for (let j = i + 1; j < numSchools && correlationCount < maxPairs; j += step) {
        // Compute correlation between school i and school j acceptance outcomes
        const outcomes_i = iterations.map((it) =>
          it.schoolResults[i].accepted ? 1 : 0
        );
        const outcomes_j = iterations.map((it) =>
          it.schoolResults[j].accepted ? 1 : 0
        );

        const mean_i = outcomes_i.reduce((a, b) => a + b, 0) / n;
        const mean_j = outcomes_j.reduce((a, b) => a + b, 0) / n;

        if (mean_i > 0 && mean_i < 1 && mean_j > 0 && mean_j < 1) {
          let cov = 0;
          let var_i = 0;
          let var_j = 0;

          for (let k = 0; k < n; k++) {
            const di = outcomes_i[k] - mean_i;
            const dj = outcomes_j[k] - mean_j;
            cov += di * dj;
            var_i += di * di;
            var_j += dj * dj;
          }

          if (var_i > 0 && var_j > 0) {
            const corr = cov / Math.sqrt(var_i * var_j);
            correlationSum += corr;
            correlationCount++;
          }
        }
      }
    }
  }

  const meanPairwiseCorrelation =
    correlationCount > 0 ? correlationSum / correlationCount : 0;

  return {
    iterations: n,
    expectedInterviews,
    expectedAcceptances,
    interviewsCI80,
    acceptancesCI80,
    pAtLeastOne,
    pAtLeastOneCI80,
    distributionBuckets,
    schoolStats,
    correlationDiagnostics: {
      meanPairwiseCorrelation,
      acceptanceVariance,
      acceptanceCV,
    },
  };
}

// ============================================================================
// Main Simulation Function
// ============================================================================

/**
 * Run correlated Monte Carlo simulation for a list of school predictions.
 *
 * This is the main entry point for simulation. It:
 * 1. Samples applicant random effects ONCE per iteration (shared across schools)
 * 2. Adjusts each school's probabilities using those random effects
 * 3. Simulates outcomes for all schools
 * 4. Aggregates results across iterations
 *
 * The correlation arises because the same u_file and u_interview affect
 * all schools for a given applicant in a given iteration.
 *
 * @param predictions - School predictions with base probabilities
 * @param config - Simulation configuration
 * @param randomEffectParams - Random effect variance parameters
 * @returns Aggregated simulation results
 */
export function runCorrelatedSimulation(
  predictions: Array<{ schoolId: string; pInterview: number; pAcceptGivenInterview: number }>,
  config: SimulationConfig = { iterations: 10000 },
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): SimulationResult {
  const { iterations, seed } = config;

  // Create random number generator
  const random = seed !== undefined ? createSeededRandom(seed) : Math.random;

  // Run all iterations
  const results: IterationResult[] = [];

  for (let i = 0; i < iterations; i++) {
    // Sample random effects ONCE for this iteration (shared across all schools)
    const randomEffects = sampleRandomEffects(randomEffectParams, random);

    // Run the iteration
    const iterationResult = runSingleIteration(predictions, randomEffects, random);
    results.push(iterationResult);
  }

  // Aggregate results
  return aggregateResults(results, predictions);
}

/**
 * Run simulation from SchoolPrediction objects (convenience wrapper).
 *
 * Extracts the mean probabilities from SchoolPrediction objects and runs simulation.
 */
export function runSimulationFromPredictions(
  schoolPredictions: SchoolPrediction[],
  config: SimulationConfig = { iterations: 10000 },
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): SimulationResult {
  // Extract simple prediction objects
  const predictions = schoolPredictions.map((sp) => ({
    schoolId: sp.schoolId,
    pInterview: sp.pInterview.mean,
    pAcceptGivenInterview: sp.pAcceptGivenInterview.mean,
  }));

  return runCorrelatedSimulation(predictions, config, randomEffectParams);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate how much correlation the random effects introduce.
 *
 * Higher random effect SDs lead to higher correlation across schools.
 * This can be used to tune parameters for realistic cycle patterns.
 *
 * @param baseProbabilities - Array of base acceptance probabilities
 * @param randomEffectParams - Random effect parameters
 * @returns Estimated correlation coefficient
 */
export function estimateInducedCorrelation(
  baseProbabilities: number[],
  randomEffectParams: RandomEffectParams = DEFAULT_RANDOM_EFFECTS
): number {
  // The correlation between two schools' outcomes depends on:
  // 1. The variance from random effects (shared)
  // 2. The variance from Bernoulli sampling (independent)
  //
  // For two schools with same base probability p:
  // Var(accept) ≈ p(1-p) + RE_variance
  // Cov(accept_i, accept_j) ≈ RE_variance (through shared RE)
  // Corr ≈ RE_variance / (p(1-p) + RE_variance)

  const avgP =
    baseProbabilities.reduce((a, b) => a + b, 0) / baseProbabilities.length;

  // Total RE variance on logit scale
  const totalSd = Math.sqrt(
    Math.pow(randomEffectParams.fileQuality.sd, 2) +
      Math.pow(randomEffectParams.interviewSkill.sd, 2)
  );

  // Approximate variance contribution from RE on probability scale
  const derivativeAtAvg = avgP * (1 - avgP);
  const reVariance = Math.pow(derivativeAtAvg * totalSd, 2);

  // Bernoulli variance
  const bernoulliVariance = avgP * (1 - avgP);

  // Approximate correlation
  const correlation = reVariance / (bernoulliVariance + reVariance);

  return Math.min(1, Math.max(0, correlation));
}

/**
 * Compute the "all-or-nothing" score from simulation results.
 *
 * This measures how often applicants get extreme outcomes (0 or many acceptances)
 * compared to what would be expected under independence.
 *
 * Higher values indicate more "all-or-nothing" patterns (realistic for med school).
 *
 * @param result - Simulation result
 * @returns All-or-nothing score (0-1, higher = more extreme outcomes)
 */
export function computeAllOrNothingScore(result: SimulationResult): number {
  // Compare observed variance to expected under independence
  // Under independence: Var(sum) = sum of Var(individual) = sum of p(1-p)
  //
  // If there's positive correlation, observed variance will be higher

  const observedVariance = result.correlationDiagnostics.acceptanceVariance;
  const expectedMean = result.expectedAcceptances;

  // Under independence, for Bernoulli sum, variance ≈ n * p_avg * (1 - p_avg)
  // But we have different p's, so use expected acceptances as proxy
  const numSchools = result.schoolStats.length;
  const avgP = numSchools > 0 ? expectedMean / numSchools : 0;
  const independenceVariance = numSchools * avgP * (1 - avgP);

  if (independenceVariance <= 0) return 0;

  // Ratio of observed to expected variance
  const varianceRatio = observedVariance / independenceVariance;

  // Convert to 0-1 score (1 = high variance = all-or-nothing)
  // varianceRatio = 1 means independence, >1 means correlation
  return Math.min(1, Math.max(0, 1 - 1 / varianceRatio));
}
