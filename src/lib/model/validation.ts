/**
 * Model Validation Framework for MedAdmit v2
 *
 * This module provides comprehensive validation without microdata:
 * 1. Internal consistency - Model reproduces calibration targets
 * 2. Sensitivity analysis - Outputs respond appropriately to inputs
 * 3. Aggregate constraint satisfaction - Model respects known marginals
 *
 * Key validation targets:
 * - A-23 reproduction: Model-implied P(≥1) matches AAMC data
 * - School rate reproduction: Interview/accept rates match MSAR
 * - Demographic effects: ORs match literature
 */

import type {
  ApplicantProfile,
  SchoolData,
  A23Cell,
} from './types';

import { calculateCompetitiveness, competitivenessToBaselineProb } from './competitiveness';
import { calculateSchoolProbability, getSchoolParams, getAvailableSchoolIds } from './two-stage';
import { calculateDemographicEffect, DEFAULT_DEMOGRAPHIC_PARAMS } from './demographics';
import { calculateExperienceContribution } from './experience';

// Import A-23 data
import a23Data from '../../../data/aamc/table-a23-processed.json';

// ============================================================================
// Types
// ============================================================================

export interface A23ValidationResult {
  /** Root mean squared error across all cells */
  rmse: number;
  /** Mean absolute error */
  mae: number;
  /** Maximum absolute error */
  maxError: number;
  /** Cell with maximum error */
  worstCell: { gpa: number; mcat: number; predicted: number; observed: number };
  /** Correlation between predicted and observed */
  correlation: number;
  /** Per-cell results */
  cells: Array<{
    gpa: number;
    mcat: number;
    observed: number;
    predicted: number;
    error: number;
    weight: number;
  }>;
  /** Pass/fail based on target RMSE < 0.03 */
  passed: boolean;
}

export interface SchoolRateValidation {
  schoolId: string;
  observedInterviewRate: number;
  predictedInterviewRate: number;
  interviewRateError: number;
  observedAcceptRate: number;
  predictedAcceptRate: number;
  acceptRateError: number;
}

export interface SchoolValidationResult {
  /** Correlation of predicted vs observed interview rates */
  interviewRateCorrelation: number;
  /** Mean absolute error for interview rates */
  interviewRateMAE: number;
  /** Correlation of predicted vs observed accept rates */
  acceptRateCorrelation: number;
  /** Mean absolute error for accept rates */
  acceptRateMAE: number;
  /** Per-school results */
  schools: SchoolRateValidation[];
  /** Pass/fail based on r > 0.9, MAE < 0.05 */
  passed: boolean;
}

export interface SensitivityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  values?: number[];
}

export interface SensitivityAnalysisResult {
  /** All sensitivity tests */
  tests: SensitivityTestResult[];
  /** Number of tests passed */
  passedCount: number;
  /** Total number of tests */
  totalCount: number;
  /** Overall pass (all tests passed) */
  allPassed: boolean;
}

export interface EdgeCaseResult {
  caseDescription: string;
  applicant: Partial<ApplicantProfile>;
  result: {
    competitiveness: number;
    pAtLeastOne: number;
  };
  expectedRange: { min: number; max: number };
  passed: boolean;
}

export interface ValidationReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Model version */
  modelVersion: string;
  /** A-23 calibration results */
  a23Validation: A23ValidationResult;
  /** School rate validation results */
  schoolValidation: SchoolValidationResult;
  /** Sensitivity analysis results */
  sensitivityAnalysis: SensitivityAnalysisResult;
  /** Edge case results */
  edgeCases: EdgeCaseResult[];
  /** Overall pass/fail */
  overallPassed: boolean;
  /** Summary statistics */
  summary: {
    a23Rmse: number;
    schoolCorrelation: number;
    sensitivityPassed: number;
    edgeCasesPassed: number;
  };
}

// ============================================================================
// A-23 Validation
// ============================================================================

/**
 * Create a "typical" applicant for validation purposes.
 * Uses average experience values with no demographic advantages.
 */
function createTypicalApplicant(gpa: number, mcat: number): ApplicantProfile {
  return {
    gpa,
    mcat,
    gpaTrend: 'flat',
    clinicalHours: 300,
    researchHours: 400,
    volunteerHours: 150,
    shadowingHours: 50,
    leadershipCount: 2,
    publications: { firstAuthor: 0, other: 0, posters: 0 },
    stateOfResidence: 'CA',
    raceEthnicity: null,
    isUrm: false,
    isFirstGen: false,
    isDisadvantaged: false,
    isRural: false,
  };
}

/**
 * Calculate model-implied P(≥1 acceptance) for a GPA/MCAT combination.
 *
 * Uses competitiveness-to-baseline-prob conversion which was calibrated
 * to reproduce A-23 rates.
 */
export function calculateModelImpliedPAtLeastOne(
  gpa: number,
  mcat: number
): number {
  const C = calculateCompetitiveness(gpa, mcat);
  return competitivenessToBaselineProb(C);
}

/**
 * Validate model against A-23 acceptance rate data.
 *
 * Compares model-implied P(≥1) with observed AAMC acceptance rates
 * for each GPA/MCAT bin.
 */
export function validateAgainstA23(): A23ValidationResult {
  const cells = a23Data.cells as A23Cell[];
  const results: A23ValidationResult['cells'] = [];

  let sumSquaredError = 0;
  let sumAbsError = 0;
  let maxError = 0;
  let worstCell = { gpa: 0, mcat: 0, predicted: 0, observed: 0 };
  let totalWeight = 0;

  const observedRates: number[] = [];
  const predictedRates: number[] = [];

  for (const cell of cells) {
    const predicted = calculateModelImpliedPAtLeastOne(
      cell.gpaCenter,
      cell.mcatCenter
    );
    const observed = cell.acceptanceRate;
    const error = predicted - observed;
    const absError = Math.abs(error);

    results.push({
      gpa: cell.gpaCenter,
      mcat: cell.mcatCenter,
      observed,
      predicted,
      error,
      weight: cell.weight,
    });

    sumSquaredError += error * error * cell.weight;
    sumAbsError += absError * cell.weight;
    totalWeight += cell.weight;

    if (absError > maxError) {
      maxError = absError;
      worstCell = { gpa: cell.gpaCenter, mcat: cell.mcatCenter, predicted, observed };
    }

    observedRates.push(observed);
    predictedRates.push(predicted);
  }

  const rmse = Math.sqrt(sumSquaredError / totalWeight);
  const mae = sumAbsError / totalWeight;
  const correlation = computeCorrelation(observedRates, predictedRates);

  return {
    rmse,
    mae,
    maxError,
    worstCell,
    correlation,
    cells: results,
    passed: rmse < 0.03, // Target: RMSE < 3 percentage points
  };
}

// ============================================================================
// School Rate Validation
// ============================================================================

/**
 * Get school data by ID from available data sources.
 */
function getSchoolData(schoolId: string): SchoolData | null {
  // Import school data
  const schoolParamsJson = require('../../../data/model/school-parameters-v1.json');
  const params = schoolParamsJson.schools[schoolId];
  if (!params) return null;

  // Create minimal school data for validation
  return {
    id: schoolId,
    name: params.schoolName || schoolId,
    state: params.state || 'CA',
    isPublic: params.isPublic || false,
    medianGPA: 3.75,
    medianMCAT: 515,
    gpaPercentiles: { p10: 3.5, p25: 3.6, p50: 3.75, p75: 3.9, p90: 3.95 },
    mcatPercentiles: { p10: 508, p25: 512, p50: 515, p75: 520, p90: 524 },
    totalApplicants: 10000,
    totalInterviewed: 1000,
    totalAccepted: 500,
    interviewRate: 0.1,
    interviewToAcceptRate: 0.5,
    inStateInterviewRate: null,
    oosInterviewRate: null,
    pctInStateMatriculants: 50,
    pctOutOfStateMatriculants: 50,
    oosFriendliness: 'neutral',
    missionFeatures: {
      ruralMission: false,
      researchIntensive: false,
      primaryCareFocus: false,
      hbcu: false,
      diversityFocus: false,
    },
    tier: 2,
  };
}

/**
 * Validate model predictions against observed school rates.
 *
 * Compares predicted interview and acceptance rates for an "average"
 * applicant against MSAR-derived rates.
 */
export function validateSchoolRates(): SchoolValidationResult {
  const schoolIds = getAvailableSchoolIds();
  const results: SchoolRateValidation[] = [];

  const observedIntRates: number[] = [];
  const predictedIntRates: number[] = [];
  const observedAccRates: number[] = [];
  const predictedAccRates: number[] = [];

  // Create average applicant (C ≈ 0)
  const avgApplicant = createTypicalApplicant(3.75, 512);

  for (const schoolId of schoolIds) {
    const params = getSchoolParams(schoolId);
    if (!params) continue;

    const schoolData = getSchoolData(schoolId);
    if (!schoolData) continue;

    // Calculate predicted rates
    const prediction = calculateSchoolProbability(avgApplicant, schoolData);
    if (!prediction) continue;

    // Get observed rates from parameters (derived from MSAR during calibration)
    const observedIntRate = sigmoid(params.interceptInterview);
    const observedAccRate = sigmoid(params.interceptAccept);

    results.push({
      schoolId,
      observedInterviewRate: observedIntRate,
      predictedInterviewRate: prediction.pInterview,
      interviewRateError: prediction.pInterview - observedIntRate,
      observedAcceptRate: observedIntRate * observedAccRate,
      predictedAcceptRate: prediction.pAccept,
      acceptRateError: prediction.pAccept - observedIntRate * observedAccRate,
    });

    observedIntRates.push(observedIntRate);
    predictedIntRates.push(prediction.pInterview);
    observedAccRates.push(observedIntRate * observedAccRate);
    predictedAccRates.push(prediction.pAccept);
  }

  const interviewRateCorrelation = computeCorrelation(
    observedIntRates,
    predictedIntRates
  );
  const interviewRateMAE = computeMAE(observedIntRates, predictedIntRates);
  const acceptRateCorrelation = computeCorrelation(
    observedAccRates,
    predictedAccRates
  );
  const acceptRateMAE = computeMAE(observedAccRates, predictedAccRates);

  return {
    interviewRateCorrelation,
    interviewRateMAE,
    acceptRateCorrelation,
    acceptRateMAE,
    schools: results,
    passed: interviewRateCorrelation > 0.9 && interviewRateMAE < 0.05,
  };
}

// ============================================================================
// Sensitivity Analysis
// ============================================================================

/**
 * Test monotonicity in GPA.
 */
function testGPAMonotonicity(): SensitivityTestResult {
  const gpas = [2.5, 3.0, 3.3, 3.5, 3.7, 3.85, 4.0];
  const probs = gpas.map((gpa) => calculateModelImpliedPAtLeastOne(gpa, 512));

  let monotonic = true;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] < probs[i - 1] - 0.001) {
      // Allow tiny tolerance
      monotonic = false;
      break;
    }
  }

  return {
    testName: 'GPA Monotonicity',
    passed: monotonic,
    details: monotonic
      ? 'Higher GPA always leads to higher probability'
      : `Non-monotonic at GPAs: ${gpas.join(', ')}`,
    values: probs,
  };
}

/**
 * Test monotonicity in MCAT.
 */
function testMCATMonotonicity(): SensitivityTestResult {
  const mcats = [490, 500, 505, 510, 515, 520, 525];
  const probs = mcats.map((mcat) => calculateModelImpliedPAtLeastOne(3.75, mcat));

  let monotonic = true;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] < probs[i - 1] - 0.001) {
      monotonic = false;
      break;
    }
  }

  return {
    testName: 'MCAT Monotonicity',
    passed: monotonic,
    details: monotonic
      ? 'Higher MCAT always leads to higher probability'
      : `Non-monotonic at MCATs: ${mcats.join(', ')}`,
    values: probs,
  };
}

/**
 * Test tier ordering: top schools should be harder than lower tiers.
 */
function testTierOrdering(): SensitivityTestResult {
  const avgApplicant = createTypicalApplicant(3.75, 512);

  // Sample schools from different tiers
  const tierSchools: Record<number, string[]> = {
    1: ['harvard-med', 'stanford-med', 'johns-hopkins'],
    2: ['ucsf', 'duke-med', 'michigan-med'],
    3: ['usc-keck', 'ohio-state-med', 'indiana-med'],
    4: ['marshall-jcesom', 'mercer-med', 'east-tennessee-quillen'],
  };

  const tierProbs: Record<number, number[]> = {};

  for (const [tier, schools] of Object.entries(tierSchools)) {
    tierProbs[Number(tier)] = [];
    for (const schoolId of schools) {
      const schoolData = getSchoolData(schoolId);
      if (!schoolData) continue;

      const prediction = calculateSchoolProbability(avgApplicant, schoolData);
      if (prediction) {
        tierProbs[Number(tier)].push(prediction.pAccept);
      }
    }
  }

  // Check that tier 1 < tier 2 < tier 3 < tier 4 (on average)
  const avgByTier: Record<number, number> = {};
  for (const [tier, probs] of Object.entries(tierProbs)) {
    if (probs.length > 0) {
      avgByTier[Number(tier)] = probs.reduce((a, b) => a + b, 0) / probs.length;
    }
  }

  let ordered = true;
  const tiers = Object.keys(avgByTier).map(Number).sort();
  for (let i = 1; i < tiers.length; i++) {
    if (avgByTier[tiers[i]] < avgByTier[tiers[i - 1]]) {
      ordered = false;
      break;
    }
  }

  return {
    testName: 'Tier Ordering',
    passed: ordered,
    details: ordered
      ? `Tier probabilities correctly ordered: ${tiers.map((t) => `T${t}=${(avgByTier[t] * 100).toFixed(1)}%`).join(' < ')}`
      : `Tier ordering violated`,
    values: tiers.map((t) => avgByTier[t]),
  };
}

/**
 * Test in-state bonus at public schools.
 */
function testInStateBonus(): SensitivityTestResult {
  const inStateApplicant = createTypicalApplicant(3.75, 512);
  inStateApplicant.stateOfResidence = 'CA';

  const oosApplicant = createTypicalApplicant(3.75, 512);
  oosApplicant.stateOfResidence = 'TX';

  const publicSchool = getSchoolData('ucsf');
  if (!publicSchool) {
    return {
      testName: 'In-State Bonus',
      passed: false,
      details: 'Could not find public school for testing',
    };
  }

  const inStatePred = calculateSchoolProbability(inStateApplicant, publicSchool);
  const oosPred = calculateSchoolProbability(oosApplicant, publicSchool);

  if (!inStatePred || !oosPred) {
    return {
      testName: 'In-State Bonus',
      passed: false,
      details: 'Could not calculate predictions',
    };
  }

  const bonusExists = inStatePred.pAccept > oosPred.pAccept;

  return {
    testName: 'In-State Bonus',
    passed: bonusExists,
    details: bonusExists
      ? `In-state: ${(inStatePred.pAccept * 100).toFixed(1)}%, OOS: ${(oosPred.pAccept * 100).toFixed(1)}%`
      : 'In-state bonus not observed',
    values: [inStatePred.pAccept, oosPred.pAccept],
  };
}

/**
 * Test reasonable probability ranges.
 */
function testReasonableRanges(): SensitivityTestResult {
  const avgApplicant = createTypicalApplicant(3.75, 512);
  const schoolIds = getAvailableSchoolIds().slice(0, 20); // Sample first 20

  let allInRange = true;
  let outOfRangeCount = 0;
  const probs: number[] = [];

  for (const schoolId of schoolIds) {
    const schoolData = getSchoolData(schoolId);
    if (!schoolData) continue;

    const prediction = calculateSchoolProbability(avgApplicant, schoolData);
    if (!prediction) continue;

    probs.push(prediction.pAccept);

    // Check bounds: 0.005 < P < 0.80
    if (prediction.pAccept < 0.005 || prediction.pAccept > 0.80) {
      allInRange = false;
      outOfRangeCount++;
    }
  }

  return {
    testName: 'Reasonable Probability Ranges',
    passed: allInRange,
    details: allInRange
      ? `All ${probs.length} schools in range [0.5%, 80%]`
      : `${outOfRangeCount} schools out of range`,
    values: probs,
  };
}

/**
 * Test clinical hours saturation effect.
 */
function testClinicalSaturation(): SensitivityTestResult {
  const hours = [0, 100, 300, 500, 1000, 2000, 3000];
  const effects = hours.map((h) => {
    const applicant = createTypicalApplicant(3.75, 512);
    applicant.clinicalHours = h;
    return calculateExperienceContribution(applicant);
  });

  // Check saturation: diminishing returns
  const increments = [];
  for (let i = 1; i < effects.length; i++) {
    increments.push(effects[i] - effects[i - 1]);
  }

  // Later increments should be smaller (saturation)
  let saturating = true;
  for (let i = 1; i < increments.length; i++) {
    if (increments[i] > increments[i - 1] + 0.01) {
      // Allow small tolerance
      saturating = false;
      break;
    }
  }

  return {
    testName: 'Clinical Hours Saturation',
    passed: saturating,
    details: saturating
      ? 'Clinical hours show diminishing returns'
      : 'Clinical hours do not saturate properly',
    values: effects,
  };
}

/**
 * Run all sensitivity analysis tests.
 */
export function runSensitivityAnalysis(): SensitivityAnalysisResult {
  const tests = [
    testGPAMonotonicity(),
    testMCATMonotonicity(),
    testTierOrdering(),
    testInStateBonus(),
    testReasonableRanges(),
    testClinicalSaturation(),
  ];

  const passedCount = tests.filter((t) => t.passed).length;

  return {
    tests,
    passedCount,
    totalCount: tests.length,
    allPassed: passedCount === tests.length,
  };
}

// ============================================================================
// Edge Case Testing
// ============================================================================

/**
 * Test extreme applicant profiles.
 */
export function runEdgeCaseTests(): EdgeCaseResult[] {
  const edgeCases: Array<{
    description: string;
    applicant: Partial<ApplicantProfile>;
    expectedRange: { min: number; max: number };
  }> = [
    {
      description: 'Perfect applicant (4.0/528)',
      applicant: { gpa: 4.0, mcat: 528 },
      expectedRange: { min: 0.85, max: 1.0 },
    },
    {
      description: 'Weak applicant (3.0/500)',
      applicant: { gpa: 3.0, mcat: 500 },
      expectedRange: { min: 0.0, max: 0.30 },
    },
    {
      description: 'High GPA, low MCAT (3.9/495)',
      applicant: { gpa: 3.9, mcat: 495 },
      expectedRange: { min: 0.10, max: 0.50 },
    },
    {
      description: 'Low GPA, high MCAT (3.2/525)',
      applicant: { gpa: 3.2, mcat: 525 },
      expectedRange: { min: 0.15, max: 0.55 },
    },
    {
      description: 'Average applicant (3.7/512)',
      applicant: { gpa: 3.7, mcat: 512 },
      expectedRange: { min: 0.40, max: 0.75 },
    },
    {
      description: 'Very low stats (2.8/490)',
      applicant: { gpa: 2.8, mcat: 490 },
      expectedRange: { min: 0.0, max: 0.10 },
    },
  ];

  const results: EdgeCaseResult[] = [];

  for (const testCase of edgeCases) {
    const applicant = {
      ...createTypicalApplicant(3.75, 512),
      ...testCase.applicant,
    };

    const C = calculateCompetitiveness(applicant.gpa, applicant.mcat);
    const pAtLeastOne = competitivenessToBaselineProb(C);

    const passed =
      pAtLeastOne >= testCase.expectedRange.min &&
      pAtLeastOne <= testCase.expectedRange.max;

    results.push({
      caseDescription: testCase.description,
      applicant: testCase.applicant,
      result: { competitiveness: C, pAtLeastOne },
      expectedRange: testCase.expectedRange,
      passed,
    });
  }

  return results;
}

// ============================================================================
// Full Validation Report
// ============================================================================

/**
 * Generate a comprehensive validation report.
 */
export function generateValidationReport(): ValidationReport {
  const a23Validation = validateAgainstA23();
  const schoolValidation = validateSchoolRates();
  const sensitivityAnalysis = runSensitivityAnalysis();
  const edgeCases = runEdgeCaseTests();

  const edgeCasesPassed = edgeCases.filter((e) => e.passed).length;

  const overallPassed =
    a23Validation.passed &&
    schoolValidation.passed &&
    sensitivityAnalysis.allPassed &&
    edgeCasesPassed === edgeCases.length;

  return {
    generatedAt: new Date().toISOString(),
    modelVersion: '2.0.0',
    a23Validation,
    schoolValidation,
    sensitivityAnalysis,
    edgeCases,
    overallPassed,
    summary: {
      a23Rmse: a23Validation.rmse,
      schoolCorrelation: schoolValidation.interviewRateCorrelation,
      sensitivityPassed: sensitivityAnalysis.passedCount,
      edgeCasesPassed,
    },
  };
}

/**
 * Format validation report as markdown string.
 */
export function formatValidationReportMarkdown(
  report: ValidationReport
): string {
  const lines: string[] = [];

  lines.push('# Model Validation Report');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Model Version:** ${report.modelVersion}`);
  lines.push(`**Overall Status:** ${report.overallPassed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value | Status |`);
  lines.push(`|--------|-------|--------|`);
  lines.push(
    `| A-23 RMSE | ${(report.summary.a23Rmse * 100).toFixed(2)}% | ${report.a23Validation.passed ? '✓' : '✗'} |`
  );
  lines.push(
    `| School Rate Correlation | ${report.summary.schoolCorrelation.toFixed(3)} | ${report.schoolValidation.passed ? '✓' : '✗'} |`
  );
  lines.push(
    `| Sensitivity Tests | ${report.summary.sensitivityPassed}/${report.sensitivityAnalysis.totalCount} | ${report.sensitivityAnalysis.allPassed ? '✓' : '✗'} |`
  );
  lines.push(
    `| Edge Cases | ${report.summary.edgeCasesPassed}/${report.edgeCases.length} | ${report.summary.edgeCasesPassed === report.edgeCases.length ? '✓' : '✗'} |`
  );
  lines.push('');

  // A-23 Validation
  lines.push('## A-23 Calibration');
  lines.push('');
  lines.push(`- **RMSE:** ${(report.a23Validation.rmse * 100).toFixed(2)}% (target: <3%)`);
  lines.push(`- **MAE:** ${(report.a23Validation.mae * 100).toFixed(2)}%`);
  lines.push(`- **Max Error:** ${(report.a23Validation.maxError * 100).toFixed(2)}%`);
  lines.push(`- **Correlation:** ${report.a23Validation.correlation.toFixed(3)}`);
  lines.push('');
  lines.push(
    `Worst cell: GPA=${report.a23Validation.worstCell.gpa}, MCAT=${report.a23Validation.worstCell.mcat} ` +
      `(predicted: ${(report.a23Validation.worstCell.predicted * 100).toFixed(1)}%, ` +
      `observed: ${(report.a23Validation.worstCell.observed * 100).toFixed(1)}%)`
  );
  lines.push('');

  // Sensitivity Analysis
  lines.push('## Sensitivity Analysis');
  lines.push('');
  for (const test of report.sensitivityAnalysis.tests) {
    lines.push(`- **${test.testName}:** ${test.passed ? '✓' : '✗'} ${test.details}`);
  }
  lines.push('');

  // Edge Cases
  lines.push('## Edge Cases');
  lines.push('');
  lines.push(`| Case | P(≥1) | Expected Range | Status |`);
  lines.push(`|------|-------|----------------|--------|`);
  for (const edge of report.edgeCases) {
    lines.push(
      `| ${edge.caseDescription} | ${(edge.result.pAtLeastOne * 100).toFixed(1)}% | ` +
        `${(edge.expectedRange.min * 100).toFixed(0)}%-${(edge.expectedRange.max * 100).toFixed(0)}% | ${edge.passed ? '✓' : '✗'} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

function sigmoid(x: number): number {
  if (x > 700) return 1 - 1e-300;
  if (x < -700) return 1e-300;
  return 1 / (1 + Math.exp(-x));
}

function computeCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
}

function computeMAE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    sum += Math.abs(actual[i] - predicted[i]);
  }
  return sum / actual.length;
}
