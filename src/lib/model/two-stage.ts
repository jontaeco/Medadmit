/**
 * Two-Stage Probability Model for MedAdmit v2
 *
 * This module implements the core two-stage hierarchical model:
 *
 * P(accept) = P(interview) × P(accept | interview)
 *
 * Stage 1 (Interview):
 *   logit(P_int) = β₀ˢ + βᶜˢ·C + β_IS·I[in-state] + demographic effects + mission effects
 *
 * Stage 2 (Accept | Interview):
 *   logit(P_acc|int) = β₀ˢ' + βᶜˢ'·C + β_IS'·I[in-state]
 *
 * Key features:
 * - School-specific intercepts and slopes from calibration
 * - Demographic effects (URM, first-gen, etc.) primarily affect interview stage
 * - Mission interactions (rural×rural, etc.) for school-applicant fit
 * - In-state bonuses for public schools
 */

import type {
  ApplicantProfile,
  SchoolData,
  SchoolModelParams,
} from './types';

import {
  calculateCompetitiveness,
  DEFAULT_SPLINES,
  type CompetitivenessSplines,
} from './competitiveness';

import { calculateExperienceContribution, DEFAULT_EXPERIENCE_PARAMS } from './experience';
import { calculateDemographicEffect, DEFAULT_DEMOGRAPHIC_PARAMS } from './demographics';

// Import school parameters at runtime
import schoolParamsJson from '../../../data/model/school-parameters-v1.json';

// ============================================================================
// Types
// ============================================================================

export interface SchoolPrediction {
  schoolId: string;
  pInterview: number;
  pAcceptGivenInterview: number;
  pAccept: number;
  category: 'reach' | 'target' | 'likely' | 'safety';
  breakdown: PredictionBreakdown;
}

export interface PredictionBreakdown {
  competitiveness: number;
  experienceEffect: number;
  demographicEffect: number;
  inStateEffect: number;
  etaInterview: number;
  etaAccept: number;
}

export interface ListPrediction {
  schools: SchoolPrediction[];
  expectedInterviews: number;
  expectedAcceptances: number;
  pAtLeastOne: number;
}

// ============================================================================
// School Parameters
// ============================================================================

/**
 * Get school model parameters by ID.
 */
export function getSchoolParams(schoolId: string): SchoolModelParams | null {
  const params = (schoolParamsJson.schools as Record<string, SchoolModelParams>)[schoolId];
  return params ?? null;
}

/**
 * Get all available school IDs.
 */
export function getAvailableSchoolIds(): string[] {
  return Object.keys(schoolParamsJson.schools);
}

// ============================================================================
// Core Probability Functions
// ============================================================================

/**
 * Sigmoid function: σ(x) = 1 / (1 + e^(-x))
 */
export function sigmoid(x: number): number {
  // Use asymptotic approximation for extreme values to avoid overflow
  if (x > 700) return 1 - 1e-300;
  if (x < -700) return 1e-300;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Logit function: logit(p) = log(p / (1-p))
 */
export function logit(p: number): number {
  if (p <= 0) return -20;
  if (p >= 1) return 20;
  return Math.log(p / (1 - p));
}

/**
 * Calculate Stage 1: Interview Probability
 *
 * η_int = β₀ + βᶜ·C + experience + demographics + mission + in-state
 * P(interview) = σ(η_int)
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param schoolParams - Calibrated school parameters
 * @param C - Competitiveness score
 * @param experienceEffect - Experience contribution
 * @param demographicEffect - Demographic + mission effect
 * @returns Object with probability and linear predictor
 */
export function calculateInterviewProbability(
  applicant: ApplicantProfile,
  school: SchoolData,
  schoolParams: SchoolModelParams,
  C: number,
  experienceEffect: number,
  demographicEffect: number
): { probability: number; eta: number } {
  let eta = schoolParams.interceptInterview;

  // Competitiveness effect
  eta += schoolParams.slopeC_interview * C;

  // Experience effect (scaled down - experiences affect interview more than academics)
  eta += experienceEffect * 0.5;

  // Demographic and mission effects (primarily affect interview stage)
  eta += demographicEffect;

  // In-state bonus
  const isInState = school.state === applicant.stateOfResidence;
  if (isInState) {
    eta += schoolParams.inStateBonus_interview;
  }

  return {
    probability: sigmoid(eta),
    eta,
  };
}

/**
 * Calculate Stage 2: Accept | Interview Probability
 *
 * η_acc = β₀' + βᶜ'·C + in-state
 * P(accept|interview) = σ(η_acc)
 *
 * Note: Demographics affect Stage 2 less (interview performance matters more)
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param schoolParams - Calibrated school parameters
 * @param C - Competitiveness score
 * @returns Object with probability and linear predictor
 */
export function calculateAcceptGivenInterviewProbability(
  applicant: ApplicantProfile,
  school: SchoolData,
  schoolParams: SchoolModelParams,
  C: number
): { probability: number; eta: number } {
  let eta = schoolParams.interceptAccept;

  // Competitiveness effect (flatter than interview stage)
  eta += schoolParams.slopeC_accept * C;

  // In-state bonus (smaller for acceptance stage)
  const isInState = school.state === applicant.stateOfResidence;
  if (isInState) {
    eta += schoolParams.inStateBonus_accept;
  }

  return {
    probability: sigmoid(eta),
    eta,
  };
}

/**
 * Categorize school based on acceptance probability.
 */
export function categorizeSchool(
  pAccept: number
): 'reach' | 'target' | 'likely' | 'safety' {
  if (pAccept < 0.15) return 'reach';
  if (pAccept < 0.35) return 'target';
  if (pAccept < 0.60) return 'likely';
  return 'safety';
}

// ============================================================================
// Main Prediction Functions
// ============================================================================

/**
 * Calculate acceptance probability for an applicant at a school.
 *
 * This is the main entry point for single-school predictions.
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param splines - Competitiveness spline parameters
 * @returns School prediction with breakdown
 */
export function calculateSchoolProbability(
  applicant: ApplicantProfile,
  school: SchoolData,
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): SchoolPrediction | null {
  // Get school parameters
  const schoolParams = getSchoolParams(school.id);
  if (!schoolParams) {
    return null;
  }

  // Calculate competitiveness from GPA/MCAT
  const C = calculateCompetitiveness(applicant.gpa, applicant.mcat, splines);

  // Calculate experience contribution
  const experienceEffect = calculateExperienceContribution(
    applicant,
    DEFAULT_EXPERIENCE_PARAMS
  );

  // Calculate demographic + mission effects
  const demographicEffect = calculateDemographicEffect(
    applicant,
    school,
    DEFAULT_DEMOGRAPHIC_PARAMS
  );

  // Stage 1: Interview
  const interview = calculateInterviewProbability(
    applicant,
    school,
    schoolParams,
    C,
    experienceEffect,
    demographicEffect
  );

  // Stage 2: Accept | Interview
  const acceptGivenInterview = calculateAcceptGivenInterviewProbability(
    applicant,
    school,
    schoolParams,
    C
  );

  // Combined probability
  const pAccept = interview.probability * acceptGivenInterview.probability;

  // In-state effect for breakdown
  const isInState = school.state === applicant.stateOfResidence;
  const inStateEffect = isInState
    ? schoolParams.inStateBonus_interview + schoolParams.inStateBonus_accept
    : 0;

  return {
    schoolId: school.id,
    pInterview: interview.probability,
    pAcceptGivenInterview: acceptGivenInterview.probability,
    pAccept,
    category: categorizeSchool(pAccept),
    breakdown: {
      competitiveness: C,
      experienceEffect,
      demographicEffect,
      inStateEffect,
      etaInterview: interview.eta,
      etaAccept: acceptGivenInterview.eta,
    },
  };
}

/**
 * Calculate predictions for a list of schools.
 *
 * Also computes aggregate metrics like expected acceptances.
 *
 * @param applicant - Applicant profile
 * @param schools - Array of school data
 * @param splines - Competitiveness spline parameters
 * @returns List prediction with aggregate metrics
 */
export function calculateListProbability(
  applicant: ApplicantProfile,
  schools: SchoolData[],
  splines: CompetitivenessSplines = DEFAULT_SPLINES
): ListPrediction {
  const predictions: SchoolPrediction[] = [];

  let expectedInterviews = 0;
  let expectedAcceptances = 0;
  let pNone = 1; // Probability of no acceptances

  for (const school of schools) {
    const prediction = calculateSchoolProbability(applicant, school, splines);
    if (prediction) {
      predictions.push(prediction);
      expectedInterviews += prediction.pInterview;
      expectedAcceptances += prediction.pAccept;
      pNone *= 1 - prediction.pAccept;
    }
  }

  // Sort by acceptance probability descending
  predictions.sort((a, b) => b.pAccept - a.pAccept);

  return {
    schools: predictions,
    expectedInterviews,
    expectedAcceptances,
    pAtLeastOne: 1 - pNone,
  };
}

/**
 * Quick prediction using just GPA/MCAT and school ID.
 *
 * Creates a minimal applicant profile with no demographic advantages.
 */
export function quickPredict(
  gpa: number,
  mcat: number,
  schoolId: string,
  state: string = 'CA'
): { pAccept: number; pInterview: number; category: string } | null {
  // Create minimal applicant
  const applicant: ApplicantProfile = {
    gpa,
    mcat,
    clinicalHours: 300, // Average
    researchHours: 500, // Average
    volunteerHours: 150,
    shadowingHours: 50,
    leadershipCount: 2,
    publications: { firstAuthor: 0, other: 0, posters: 0 },
    stateOfResidence: state,
    raceEthnicity: null,
    isUrm: false,
    isFirstGen: false,
    isDisadvantaged: false,
    isRural: false,
  };

  // Create minimal school data
  const school: SchoolData = {
    id: schoolId,
    name: schoolId,
    state: schoolParamsJson.schools[schoolId]?.state ?? 'CA',
    isPublic: schoolParamsJson.schools[schoolId]?.isPublic ?? false,
    medianGPA: 3.75,
    medianMCAT: 515,
    gpaPercentiles: { p10: 3.5, p25: 3.6, p75: 3.9, p90: 3.95 },
    mcatPercentiles: { p10: 508, p25: 512, p75: 520, p90: 524 },
    totalApplicants: 10000,
    totalInterviewed: 1000,
    totalAccepted: 500,
    interviewRate: 0.1,
    interviewToAcceptRate: 0.5,
    inStateInterviewRate: null,
    oosInterviewRate: null,
    missionFeatures: {
      ruralMission: false,
      researchIntensive: false,
      primaryCareFocus: false,
      hbcu: false,
      diversityFocus: false,
    },
    tier: 2,
  };

  const prediction = calculateSchoolProbability(applicant, school);
  if (!prediction) return null;

  return {
    pAccept: prediction.pAccept,
    pInterview: prediction.pInterview,
    category: prediction.category,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get prediction factors summary for display.
 */
export function getPredictionSummary(prediction: SchoolPrediction): string {
  const { pInterview, pAcceptGivenInterview, pAccept, category, breakdown } = prediction;

  return [
    `P(Interview): ${(pInterview * 100).toFixed(1)}%`,
    `P(Accept|Interview): ${(pAcceptGivenInterview * 100).toFixed(1)}%`,
    `P(Accept): ${(pAccept * 100).toFixed(1)}%`,
    `Category: ${category}`,
    `Competitiveness: ${breakdown.competitiveness.toFixed(2)}`,
  ].join('\n');
}

/**
 * Compare predictions for the same applicant across schools.
 */
export function comparePredictions(
  predictions: SchoolPrediction[]
): {
  highest: SchoolPrediction;
  lowest: SchoolPrediction;
  median: number;
  range: [number, number];
} {
  const sorted = [...predictions].sort((a, b) => a.pAccept - b.pAccept);
  const probs = sorted.map((p) => p.pAccept);

  return {
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
    median: probs[Math.floor(probs.length / 2)],
    range: [probs[0], probs[probs.length - 1]],
  };
}

/**
 * Calculate how much each factor contributes to the difference
 * between two applicants at the same school.
 */
export function analyzePredictionDifference(
  pred1: SchoolPrediction,
  pred2: SchoolPrediction
): {
  competitivenessDiff: number;
  experienceDiff: number;
  demographicDiff: number;
  inStateDiff: number;
  totalProbDiff: number;
} {
  return {
    competitivenessDiff: pred2.breakdown.competitiveness - pred1.breakdown.competitiveness,
    experienceDiff: pred2.breakdown.experienceEffect - pred1.breakdown.experienceEffect,
    demographicDiff: pred2.breakdown.demographicEffect - pred1.breakdown.demographicEffect,
    inStateDiff: pred2.breakdown.inStateEffect - pred1.breakdown.inStateEffect,
    totalProbDiff: pred2.pAccept - pred1.pAccept,
  };
}
