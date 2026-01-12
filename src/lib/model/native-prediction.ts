/**
 * Native Prediction Wrapper for MedAdmit v2.0
 *
 * This module provides the main entry point for generating predictions
 * using the native API format, exposing all features of the rigorous
 * probabilistic model.
 */

import type {
  NativePredictionResponse,
  NativePredictionRequest,
  CompetitivenessResponse,
  ExperienceResponse,
  DemographicResponse,
  SchoolPredictionResponse,
  ListMetricsResponse,
  UncertaintyResponse,
  SimulationResponse,
  UncertaintyLevel,
  CredibleInterval,
  PredictionOptions,
} from './api-types';

import type {
  ApplicantProfile,
  SchoolData,
  PublicationRecord,
  GPATrend,
  ConfidenceInterval as InternalConfidenceInterval,
} from './types';

import type {
  SchoolPredictionWithUncertainty,
  ListPredictionWithUncertainty,
} from './uncertainty';

import {
  calculateCompetitivenessFromProfile,
  getCompetitivenessBreakdown,
  classifyCompetitiveness,
} from './competitiveness';

import {
  getExperienceBreakdown,
  checkMinimumThresholds,
  DEFAULT_EXPERIENCE_PARAMS,
} from './experience';

import {
  getDemographicBreakdown,
} from './demographics';

import {
  calculateSchoolProbability,
  categorizeSchool,
  getSchoolParams,
  getAvailableSchoolIds,
} from './two-stage';

import {
  runCorrelatedSimulation,
  estimateInducedCorrelation,
  DEFAULT_RANDOM_EFFECTS,
} from './monte-carlo';

import {
  calculateSchoolPredictionWithUncertainty,
  calculateListPredictionWithUncertainty,
  decomposeUncertainty,
  describeUncertainty,
  DEFAULT_UNCERTAINTY_CONFIG,
} from './uncertainty';

// Import experience parameters JSON for saturation calculation
import experienceParamsJson from '../../../data/model/experience-parameters.json';

// Import school parameters for school info
import schoolParamsJson from '../../../data/model/school-parameters-v1.json';

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert native request format to ApplicantProfile.
 */
export function convertRequestToProfile(request: NativePredictionRequest): ApplicantProfile {
  const publications: PublicationRecord = {
    firstAuthor: 0,
    other: request.publicationCount ?? 0,
    posters: 0,
  };

  return {
    gpa: request.gpa,
    mcat: request.mcat,
    gpaTrend: 'flat' as GPATrend,

    clinicalHours: request.clinicalHours,
    researchHours: request.researchHours,
    volunteerHours: request.volunteerHours ?? 0,
    shadowingHours: request.shadowingHours ?? 0,
    leadershipCount: request.leadershipCount ?? 0,
    publications,

    stateOfResidence: request.state,
    raceEthnicity: request.raceEthnicity ?? null,
    isUrm: isUrmCategory(request.raceEthnicity),
    isFirstGen: request.isFirstGen ?? false,
    isDisadvantaged: request.isDisadvantaged ?? false,
    isRural: request.isRural ?? false,

    primaryCareInterest: false,
    researchInterest: request.researchHours > 500,
    ruralInterest: request.isRural ?? false,
  };
}

/**
 * Check if a race/ethnicity category is URM.
 */
function isUrmCategory(raceEthnicity: string | null | undefined): boolean {
  if (!raceEthnicity) return false;
  const urmCategories = [
    'black_african_american',
    'hispanic_latino',
    'native_american_alaska_native',
    'native_hawaiian_pacific_islander',
  ];
  return urmCategories.includes(raceEthnicity.toLowerCase());
}

/**
 * Calculate saturation percentage for a given hours value and domain parameters.
 * Saturation function: g(h) = alpha * (1 - e^(-h/tau))
 * Saturation percent = (1 - e^(-h/tau)) * 100
 */
function calculateSaturationPct(hours: number, tau: number): number {
  if (hours <= 0 || tau <= 0) return 0;
  return (1 - Math.exp(-hours / tau)) * 100;
}

/**
 * Get school data from parameters.
 */
function getSchoolData(schoolId: string, applicantState: string): SchoolData | null {
  const params = (schoolParamsJson.schools as Record<string, any>)[schoolId];
  if (!params) return null;

  const isPublic = params.isPublic ?? false;

  return {
    id: schoolId,
    name: params.schoolName ?? schoolId,
    state: params.state ?? 'CA',
    isPublic,
    tier: params.tier ?? 3,
    medianGPA: 3.75,
    medianMCAT: 515,
    gpaPercentiles: { p10: 3.5, p25: 3.6, p50: 3.75, p75: 3.9, p90: 3.95 },
    mcatPercentiles: { p10: 508, p25: 511, p50: 515, p75: 519, p90: 522 },
    totalApplicants: 5000,
    totalInterviewed: 500,
    totalAccepted: 200,
    interviewRate: 0.1,
    interviewToAcceptRate: 0.4,
    inStateInterviewRate: isPublic ? 0.3 : null,
    oosInterviewRate: isPublic ? 0.05 : null,
    pctInStateMatriculants: isPublic ? 70 : 30,
    pctOutOfStateMatriculants: isPublic ? 30 : 70,
    oosFriendliness: isPublic ? 'unfriendly' as const : 'friendly' as const,
    missionFeatures: {
      primaryCareFocus: false,
      researchIntensive: params.tier <= 2,
      ruralMission: false,
      diversityFocus: false,
      hbcu: false,
    },
  };
}

// ============================================================================
// Main Prediction Function
// ============================================================================

/**
 * Generate a complete prediction using the native format.
 */
export function generateNativePrediction(
  request: NativePredictionRequest,
  options: PredictionOptions = {}
): NativePredictionResponse {
  const applicant = convertRequestToProfile(request);

  // Get school IDs
  const schoolIds = options.schoolIds ?? request.schoolIds ?? getAvailableSchoolIds().slice(0, 20);

  // Build school data array
  const schools: SchoolData[] = [];
  for (const id of schoolIds) {
    const school = getSchoolData(id, applicant.stateOfResidence);
    if (school) {
      schools.push(school);
    }
  }

  // ========================================================================
  // 1. Competitiveness
  // ========================================================================
  const C = calculateCompetitivenessFromProfile(applicant);
  const compBreakdown = getCompetitivenessBreakdown(applicant.gpa, applicant.mcat);
  const classification = classifyCompetitiveness(C);

  // Approximate percentile from C score
  // C = 0 is 50th percentile, each unit of C is ~15-20 percentile points
  const percentile = Math.min(99, Math.max(1, Math.round(50 + C * 17)));

  const competitiveness: CompetitivenessResponse = {
    C,
    percentile,
    classification,
    breakdown: {
      gpaContribution: compBreakdown.gpaContribution,
      mcatContribution: compBreakdown.mcatContribution,
    },
  };

  // ========================================================================
  // 2. Experience
  // ========================================================================
  const expBreakdown = getExperienceBreakdown(applicant);
  const thresholds = checkMinimumThresholds(applicant);

  const expParams = experienceParamsJson.domains as Record<string, { tau: number; alpha: number }>;

  const experience: ExperienceResponse = {
    totalContribution: expBreakdown.total,
    domains: {
      clinical: {
        hours: applicant.clinicalHours,
        contribution: expBreakdown.clinical,
        saturationPct: calculateSaturationPct(applicant.clinicalHours, expParams.clinical?.tau ?? 500),
      },
      research: {
        hours: applicant.researchHours,
        contribution: expBreakdown.research,
        saturationPct: calculateSaturationPct(applicant.researchHours, expParams.research?.tau ?? 800),
      },
      volunteer: {
        hours: applicant.volunteerHours,
        contribution: expBreakdown.volunteer,
        saturationPct: calculateSaturationPct(applicant.volunteerHours, expParams.volunteer?.tau ?? 200),
      },
      shadowing: {
        hours: applicant.shadowingHours,
        contribution: expBreakdown.shadowing,
        saturationPct: calculateSaturationPct(applicant.shadowingHours, expParams.shadowing?.tau ?? 50),
      },
      leadership: {
        count: applicant.leadershipCount,
        contribution: expBreakdown.leadership,
        saturationPct: calculateSaturationPct(applicant.leadershipCount, expParams.leadership?.tau ?? 3),
      },
      publications: {
        count: applicant.publications.firstAuthor + applicant.publications.other + applicant.publications.posters,
        contribution: expBreakdown.publications,
      },
    },
    thresholdsMet: {
      clinical: thresholds.clinical.met,
      overall: thresholds.meetsAll,
    },
  };

  // ========================================================================
  // 3. Demographics (use first school as reference for effects)
  // ========================================================================
  const referenceSchool = schools[0];
  const demoBreakdown = referenceSchool
    ? getDemographicBreakdown(applicant, referenceSchool)
    : { raceEthnicity: 0, firstGen: 0, disadvantaged: 0, rural: 0, missionFit: 0, inState: 0, total: 0 };

  const demographics: DemographicResponse = {
    totalEffect: demoBreakdown.total,
    breakdown: {
      raceEthnicity: demoBreakdown.raceEthnicity,
      firstGen: demoBreakdown.firstGen,
      disadvantaged: demoBreakdown.disadvantaged,
      rural: demoBreakdown.rural,
    },
  };

  // ========================================================================
  // 4. Per-School Predictions with Uncertainty
  // ========================================================================
  const includeSimulation = options.includeSimulation !== false;
  const simulationIterations = options.simulationIterations ?? (includeSimulation ? 5000 : 0);

  // Calculate predictions with uncertainty
  const listPrediction = calculateListPredictionWithUncertainty(
    applicant,
    schools,
    {
      ...DEFAULT_UNCERTAINTY_CONFIG,
      bootstrapIterations: Math.min(200, DEFAULT_UNCERTAINTY_CONFIG.bootstrapIterations),
    }
  );

  // Map school predictions to response format
  const schoolPredictions: SchoolPredictionResponse[] = listPrediction.schools.map((sp) => {
    const school = schools.find((s) => s.id === sp.schoolId);
    const params = (schoolParamsJson.schools as Record<string, any>)[sp.schoolId];
    const isInState = school?.state === applicant.stateOfResidence;

    // Get demographic breakdown for this specific school
    const schoolDemoBreakdown = school
      ? getDemographicBreakdown(applicant, school)
      : { raceEthnicity: 0, firstGen: 0, disadvantaged: 0, rural: 0, missionFit: 0, inState: 0, total: 0 };

    // Determine mission alignment
    const missionAlignment: string[] = [];
    if (school?.missionFeatures?.researchIntensive && applicant.researchInterest) {
      missionAlignment.push('research');
    }
    if (school?.missionFeatures?.primaryCareFocus && applicant.primaryCareInterest) {
      missionAlignment.push('primary_care');
    }
    if (school?.missionFeatures?.ruralMission && applicant.ruralInterest) {
      missionAlignment.push('rural');
    }
    if (school?.missionFeatures?.diversityFocus && applicant.isUrm) {
      missionAlignment.push('diversity');
    }

    return {
      id: sp.schoolId,
      name: params?.schoolName ?? sp.schoolId,
      state: school?.state ?? '',
      tier: params?.tier ?? 3,
      isPublic: school?.isPublic ?? false,

      pInterview: ciToResponse(sp.pInterview),
      pAcceptGivenInterview: ciToResponse(sp.pAcceptGivenInterview),
      pAccept: ciToResponse(sp.pAccept),

      category: sp.category,

      factors: {
        competitivenessEffect: C * (params?.slopeC_interview ?? 1),
        inStateBonus: isInState ? (params?.inStateBonus_interview ?? 0) : 0,
        demographicEffect: schoolDemoBreakdown.total,
        missionFitEffect: schoolDemoBreakdown.missionFit,
      },

      isInState,
      missionAlignment,
    };
  });

  // Sort by acceptance probability (highest first)
  schoolPredictions.sort((a, b) => b.pAccept.mean - a.pAccept.mean);

  // ========================================================================
  // 5. List Metrics
  // ========================================================================
  const listMetrics: ListMetricsResponse = {
    expectedInterviews: ciToResponse(listPrediction.expectedInterviews),
    expectedAcceptances: ciToResponse(listPrediction.expectedAcceptances),
    pAtLeastOne: ciToResponse(listPrediction.pAtLeastOne),
    distributionBuckets: listPrediction.distributionBuckets,
  };

  // ========================================================================
  // 6. Uncertainty Analysis
  // ========================================================================
  // Compute aggregate uncertainty decomposition
  let parameterVariance = 0;
  let randomEffectVariance = 0;
  let totalVariance = 0;

  if (schools.length > 0 && referenceSchool) {
    const decomposition = decomposeUncertainty(applicant, referenceSchool);
    parameterVariance = decomposition.parameterOnly;
    randomEffectVariance = decomposition.randomEffectOnly;
    totalVariance = decomposition.combined;
  }

  // Create a pseudo confidence interval to describe uncertainty
  // Use variance to estimate CI width (approximate ± 2 standard deviations)
  const stdDev = Math.sqrt(totalVariance);
  const pseudoCI: InternalConfidenceInterval = {
    mean: 0.5, // Reference point
    ci80: [0.5 - 1.28 * stdDev, 0.5 + 1.28 * stdDev] as [number, number],
  };
  const uncertaintyLevel = describeUncertainty(pseudoCI) as UncertaintyLevel;

  const uncertainty: UncertaintyResponse = {
    overallLevel: uncertaintyLevel,
    decomposition: {
      parameterVariance,
      randomEffectVariance,
      totalVariance,
    },
  };

  // ========================================================================
  // 7. Simulation
  // ========================================================================
  let simulation: SimulationResponse;

  if (includeSimulation && simulationIterations > 0) {
    // Prepare predictions for simulation
    const simPredictions = schoolPredictions.map((sp) => ({
      schoolId: sp.id,
      pInterview: sp.pInterview.mean,
      pAcceptGivenInterview: sp.pAcceptGivenInterview.mean,
    }));

    const simResult = runCorrelatedSimulation(simPredictions, { iterations: simulationIterations });

    // Estimate correlation using the base acceptance probabilities
    const baseProbabilities = schoolPredictions.map((sp) => sp.pAccept.mean);
    const correlation = estimateInducedCorrelation(baseProbabilities, DEFAULT_RANDOM_EFFECTS);

    simulation = {
      iterations: simulationIterations,
      correlationDiagnostics: {
        meanPairwiseCorrelation: simResult.correlationDiagnostics?.meanPairwiseCorrelation ?? correlation,
        acceptanceVariance: simResult.correlationDiagnostics?.acceptanceVariance ?? 0,
      },
      perSchool: simResult.schoolStats.map((s) => ({
        schoolId: s.schoolId,
        interviewRate: s.simulatedInterviewRate,
        acceptanceRate: s.simulatedAcceptanceRate,
      })),
    };
  } else {
    simulation = {
      iterations: 0,
      correlationDiagnostics: {
        meanPairwiseCorrelation: 0,
        acceptanceVariance: 0,
      },
      perSchool: [],
    };
  }

  // ========================================================================
  // 8. Metadata
  // ========================================================================
  const metadata = {
    modelVersion: '2.0.0',
    computedAt: new Date().toISOString(),
  };

  return {
    competitiveness,
    experience,
    demographics,
    schools: schoolPredictions,
    listMetrics,
    uncertainty,
    simulation,
    metadata,
  };
}

/**
 * Convert internal ConfidenceInterval to API CredibleInterval format.
 */
function ciToResponse(ci: { mean: number; ci80: [number, number] }): CredibleInterval {
  return {
    mean: ci.mean,
    ci80: ci.ci80,
  };
}

// ============================================================================
// Quick Prediction (subset of native response)
// ============================================================================

export interface QuickNativeResult {
  competitiveness: {
    C: number;
    percentile: number;
    classification: string;
  };
  listMetrics: {
    expectedAcceptances: number;
    pAtLeastOne: number;
  };
  topSchools: Array<{
    id: string;
    name: string;
    pAccept: number;
    category: string;
  }>;
}

/**
 * Generate a quick prediction with minimal computation.
 */
export function generateQuickNativePrediction(request: NativePredictionRequest): QuickNativeResult {
  const fullResult = generateNativePrediction(request, {
    includeSimulation: false,
  });

  return {
    competitiveness: {
      C: fullResult.competitiveness.C,
      percentile: fullResult.competitiveness.percentile,
      classification: fullResult.competitiveness.classification,
    },
    listMetrics: {
      expectedAcceptances: fullResult.listMetrics.expectedAcceptances.mean,
      pAtLeastOne: fullResult.listMetrics.pAtLeastOne.mean,
    },
    topSchools: fullResult.schools.slice(0, 5).map((s) => ({
      id: s.id,
      name: s.name,
      pAccept: s.pAccept.mean,
      category: s.category,
    })),
  };
}
