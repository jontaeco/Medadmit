/**
 * Migration Layer - Phase 10
 *
 * Provides API-compatible wrappers around the new rigorous model.
 * Allows existing API routes and UI components to work with the new model
 * without breaking changes.
 */

import type {
  ApplicantProfile,
  SchoolData,
  MissionFeatures,
} from './types';
import {
  calculateCompetitiveness,
  classifyCompetitiveness,
  getCompetitivenessBreakdown,
} from './competitiveness';
import {
  getExperienceBreakdown,
  checkMinimumThresholds,
} from './experience';
import {
  calculateDemographicEffect,
  getDemographicBreakdown,
  isURM,
} from './demographics';
import {
  calculateSchoolProbability,
  calculateListProbability,
  categorizeSchool,
} from './two-stage';
import {
  runCorrelatedSimulation,
  DEFAULT_RANDOM_EFFECTS,
} from './monte-carlo';
import { getAllSchools } from '@/lib/data';

// Model version constants
const MODEL_VERSION = '2.0.0';
const DATA_VERSION = '2026.1.0';

// =============================================================================
// Type Conversions
// =============================================================================

/**
 * Legacy ApplicantInput type (from old scoring module)
 */
export interface LegacyApplicantInput {
  cumulativeGPA: number;
  scienceGPA: number | null;
  mcatTotal: number;
  mcatCPBS: number | null;
  mcatCARS: number | null;
  mcatBBFL: number | null;
  mcatPSBB: number | null;
  stateOfResidence: string;
  raceEthnicity: string | null;
  isFirstGeneration: boolean;
  isDisadvantaged: boolean;
  isRuralBackground: boolean;
  clinicalHoursTotal: number;
  clinicalHoursPaid: number;
  clinicalHoursVolunteer: number;
  researchHoursTotal: number;
  hasResearchPublications: boolean;
  publicationCount: number;
  volunteerHoursNonClinical: number;
  shadowingHours: number;
  leadershipExperiences: number;
  teachingHours: number;
  applicationYear: number;
  isReapplicant: boolean;
  hasInstitutionalAction: boolean;
  hasCriminalHistory: boolean;
  undergraduateSchoolTier?: 1 | 2 | 3;
  gpaTrend?: 'upward' | 'flat' | 'downward';
  miscellaneousLevel?: 1 | 2 | 3 | 4;
}

/**
 * Convert legacy ApplicantInput to new ApplicantProfile
 */
export function convertToApplicantProfile(
  legacy: LegacyApplicantInput
): ApplicantProfile {
  const raceEthnicity = legacy.raceEthnicity;

  return {
    gpa: legacy.cumulativeGPA,
    mcat: legacy.mcatTotal,
    gpaTrend: legacy.gpaTrend || 'flat',
    clinicalHours: legacy.clinicalHoursPaid + legacy.clinicalHoursVolunteer,
    researchHours: legacy.researchHoursTotal,
    volunteerHours: legacy.volunteerHoursNonClinical,
    shadowingHours: legacy.shadowingHours,
    leadershipCount: legacy.leadershipExperiences,
    publications: {
      firstAuthor: legacy.hasResearchPublications
        ? Math.max(1, Math.floor(legacy.publicationCount / 2))
        : 0,
      other: legacy.hasResearchPublications
        ? Math.ceil(legacy.publicationCount / 2)
        : 0,
      posters: 0,
    },
    stateOfResidence: legacy.stateOfResidence,
    raceEthnicity: raceEthnicity,
    isUrm: isURM(raceEthnicity),
    isFirstGen: legacy.isFirstGeneration,
    isDisadvantaged: legacy.isDisadvantaged,
    isRural: legacy.isRuralBackground,
    primaryCareInterest: false,
    researchInterest: legacy.researchHoursTotal >= 500,
    ruralInterest: legacy.isRuralBackground,
  };
}

/**
 * Convert SchoolProfile (legacy) to SchoolData (new model)
 */
export function convertToSchoolData(school: any): SchoolData {
  const missionFeatures: MissionFeatures = {
    ruralMission: (school.missionKeywords || []).some(
      (k: string) => k.toLowerCase().includes('rural')
    ),
    researchIntensive:
      school.tier === 1 ||
      (school.missionKeywords || []).some((k: string) =>
        k.toLowerCase().includes('research')
      ),
    primaryCareFocus: (school.missionKeywords || []).some(
      (k: string) =>
        k.toLowerCase().includes('primary care') ||
        k.toLowerCase().includes('family medicine')
    ),
    hbcu: (school.missionKeywords || []).some((k: string) =>
      k.toLowerCase().includes('hbcu')
    ),
    diversityFocus: (school.missionKeywords || []).some((k: string) =>
      k.toLowerCase().includes('diversity')
    ),
  };

  return {
    id: school.id,
    name: school.name,
    shortName: school.shortName,
    state: school.state,
    city: school.city,
    medianGPA: school.medianGPA,
    medianMCAT: school.medianMCAT,
    gpaPercentiles: school.gpaPercentiles || {
      p10: school.medianGPA - 0.15,
      p25: school.medianGPA - 0.08,
      p50: school.medianGPA,
      p75: school.medianGPA + 0.05,
      p90: school.medianGPA + 0.10,
    },
    mcatPercentiles: school.mcatPercentiles || {
      p10: school.medianMCAT - 4,
      p25: school.medianMCAT - 2,
      p50: school.medianMCAT,
      p75: school.medianMCAT + 2,
      p90: school.medianMCAT + 4,
    },
    totalApplicants: school.applicants || 5000,
    totalInterviewed: school.interviewed || 500,
    totalAccepted: school.accepted || 200,
    totalMatriculated: school.matriculated,
    classSize: school.classSize || 150,
    interviewRate: school.interviewRate || 0.10,
    interviewToAcceptRate: school.interviewToAcceptRate || 0.40,
    inStateInterviewRate: school.inStateInterviewRate ?? null,
    oosInterviewRate: school.oosInterviewRate ?? null,
    pctInStateMatriculants: school.pctInState || 50,
    pctOutOfStateMatriculants: 100 - (school.pctInState || 50),
    oosFriendliness: school.oosFriendliness || 'neutral',
    isPublic: school.isPublic || false,
    hasMDPhD: school.hasMDPhD,
    missionKeywords: school.missionKeywords || [],
    missionFeatures,
    tier: school.warsTier || school.tier || 3,
    warsTier: school.warsTier,
    usNewsRankResearch: school.usNewsRank,
    admitOrgRank: school.admitOrgRank,
  };
}

// =============================================================================
// Legacy Score Breakdown (for UI compatibility)
// =============================================================================

export interface LegacyScoreBreakdown {
  academicScore: number;
  academicDetails: {
    gpaContribution: number;
    mcatContribution: number;
    gpaPercentile: number;
    mcatPercentile: number;
  };
  experienceScore: number;
  experienceDetails: {
    clinicalContribution: number;
    researchContribution: number;
    volunteerContribution: number;
    leadershipContribution: number;
    shadowingContribution: number;
    teachingContribution: number;
  };
  demographicAdjustment: number;
  demographicDetails: {
    raceEthnicityAdjustment: number;
    firstGenAdjustment: number;
    disadvantagedAdjustment: number;
    ruralAdjustment: number;
  };
  redFlagPenalty: number;
  redFlagDetails: {
    institutionalActionPenalty: number;
    criminalHistoryPenalty: number;
    reapplicantAdjustment: number;
    lowExperiencePenalty: number;
  };
  totalScore: number;
  percentile: number;
  tier: 'exceptional' | 'strong' | 'competitive' | 'below-average' | 'low';
}

/**
 * Calculate legacy-format score breakdown from new model
 */
export function calculateLegacyScore(
  applicant: ApplicantProfile,
  legacy: LegacyApplicantInput
): LegacyScoreBreakdown {
  // Calculate competitiveness
  const C = calculateCompetitiveness(applicant.gpa, applicant.mcat);
  const compBreakdown = getCompetitivenessBreakdown(applicant.gpa, applicant.mcat);

  // Convert competitiveness to 0-1000 scale
  // C ranges roughly from -3 to +3
  // Map to 300-900 range for academic score
  const normalizedC = (C + 3) / 6; // 0 to 1
  const academicScore = Math.round(200 + normalizedC * 500);

  // Calculate percentile based on C
  const gpaPercentile = Math.min(99, Math.max(1, Math.round(50 + C * 20)));
  const mcatPercentile = Math.round(
    ((applicant.mcat - 472) / (528 - 472)) * 100
  );

  // GPA contribution (0-300)
  const totalComp = compBreakdown.gpaContribution + compBreakdown.mcatContribution;
  const gpaContribution = Math.round(
    100 + (totalComp > 0 ? (compBreakdown.gpaContribution / totalComp) * 200 : 100)
  );
  // MCAT contribution (0-300)
  const mcatContribution = Math.round(
    100 + (totalComp > 0 ? (compBreakdown.mcatContribution / totalComp) * 200 : 100)
  );

  // Experience score (0-250)
  const expBreakdown = getExperienceBreakdown(applicant);
  const experienceScore = Math.round(
    Math.min(250, expBreakdown.clinical * 40 +
      expBreakdown.research * 40 +
      expBreakdown.volunteer * 30 +
      expBreakdown.leadership * 30 +
      expBreakdown.shadowing * 20 +
      expBreakdown.publications * 20)
  );

  // Demographic adjustment using a mock school
  const mockSchool: SchoolData = {
    id: 'mock',
    name: 'Mock School',
    state: 'CA',
    medianGPA: 3.7,
    medianMCAT: 515,
    gpaPercentiles: { p10: 3.5, p25: 3.6, p50: 3.7, p75: 3.8, p90: 3.9 },
    mcatPercentiles: { p10: 510, p25: 513, p50: 515, p75: 518, p90: 520 },
    totalApplicants: 5000,
    totalInterviewed: 500,
    totalAccepted: 200,
    interviewRate: 0.1,
    interviewToAcceptRate: 0.4,
    inStateInterviewRate: null,
    oosInterviewRate: null,
    pctInStateMatriculants: 50,
    pctOutOfStateMatriculants: 50,
    oosFriendliness: 'neutral',
    isPublic: false,
    missionFeatures: {
      ruralMission: false,
      researchIntensive: false,
      primaryCareFocus: false,
      hbcu: false,
      diversityFocus: false,
    },
    tier: 2,
  };

  const demoBreakdown = getDemographicBreakdown(applicant, mockSchool);
  const demographicAdjustment = Math.round(
    (demoBreakdown.raceEthnicity +
      demoBreakdown.firstGen +
      demoBreakdown.disadvantaged) *
      15
  );

  // Red flag penalty
  let redFlagPenalty = 0;
  const redFlagDetails = {
    institutionalActionPenalty: 0,
    criminalHistoryPenalty: 0,
    reapplicantAdjustment: 0,
    lowExperiencePenalty: 0,
  };

  if (legacy.hasInstitutionalAction) {
    redFlagDetails.institutionalActionPenalty = -50;
    redFlagPenalty -= 50;
  }
  if (legacy.hasCriminalHistory) {
    redFlagDetails.criminalHistoryPenalty = -40;
    redFlagPenalty -= 40;
  }
  if (legacy.isReapplicant) {
    redFlagDetails.reapplicantAdjustment = -10;
    redFlagPenalty -= 10;
  }

  const thresholds = checkMinimumThresholds(applicant);
  if (!thresholds.meetsAll) {
    redFlagDetails.lowExperiencePenalty = -30;
    redFlagPenalty -= 30;
  }

  // Total score
  const totalScore = Math.max(
    0,
    Math.min(
      1000,
      academicScore + experienceScore + demographicAdjustment + redFlagPenalty
    )
  );

  // Percentile based on total score
  const percentile = Math.round((totalScore / 1000) * 100);

  // Tier classification
  let tier: 'exceptional' | 'strong' | 'competitive' | 'below-average' | 'low';
  if (totalScore >= 800) tier = 'exceptional';
  else if (totalScore >= 650) tier = 'strong';
  else if (totalScore >= 500) tier = 'competitive';
  else if (totalScore >= 350) tier = 'below-average';
  else tier = 'low';

  return {
    academicScore,
    academicDetails: {
      gpaContribution,
      mcatContribution,
      gpaPercentile,
      mcatPercentile,
    },
    experienceScore,
    experienceDetails: {
      clinicalContribution: Math.round(expBreakdown.clinical * 40),
      researchContribution: Math.round(expBreakdown.research * 40),
      volunteerContribution: Math.round(expBreakdown.volunteer * 30),
      leadershipContribution: Math.round(expBreakdown.leadership * 30),
      shadowingContribution: Math.round(expBreakdown.shadowing * 20),
      teachingContribution: 0, // New model doesn't have teaching
    },
    demographicAdjustment,
    demographicDetails: {
      raceEthnicityAdjustment: Math.round(demoBreakdown.raceEthnicity * 15),
      firstGenAdjustment: Math.round(demoBreakdown.firstGen * 15),
      disadvantagedAdjustment: Math.round(demoBreakdown.disadvantaged * 15),
      ruralAdjustment: Math.round(demoBreakdown.rural * 15),
    },
    redFlagPenalty,
    redFlagDetails,
    totalScore,
    percentile,
    tier,
  };
}

// =============================================================================
// Legacy School Probability Format
// =============================================================================

export interface LegacySchoolProbability {
  school: {
    id: string;
    name: string;
    shortName: string;
    state: string;
    city?: string;
    medianGPA: number;
    medianMCAT: number;
    isPublic: boolean;
    oosFriendliness: string;
    tuitionInState?: number;
    tuitionOutOfState?: number;
    warsTier?: number;
    isLowYield?: boolean;
  };
  probability: number;
  probabilityLower: number;
  probabilityUpper: number;
  category: 'reach' | 'target' | 'safety';
  factors: {
    baselineProbability: number;
    stateAdjustment: number;
    demographicAdjustment: number;
    missionFitBonus: number;
    finalProbability: number;
  };
  fit: {
    gpaPercentile: number;
    mcatPercentile: number;
    isInState: boolean;
    missionAlignment: string[];
  };
}

export interface LegacySchoolList {
  reach: LegacySchoolProbability[];
  target: LegacySchoolProbability[];
  safety: LegacySchoolProbability[];
  summary: {
    totalSchools: number;
    expectedInterviews: number;
    expectedAcceptances: number;
    probabilityOfAtLeastOne: number;
  };
}

/**
 * Map model category to legacy category
 */
function mapCategory(category: 'reach' | 'target' | 'likely' | 'safety'): 'reach' | 'target' | 'safety' {
  if (category === 'likely') return 'target';
  return category;
}

/**
 * Generate school list in legacy format using new model
 */
export function generateLegacySchoolList(
  applicant: ApplicantProfile,
  options?: {
    totalSchools?: number;
    excludeStates?: string[];
    includeStates?: string[];
    onlyPublic?: boolean;
    onlyPrivate?: boolean;
  }
): LegacySchoolList {
  const allSchools = getAllSchools();
  let schools = allSchools;

  // Apply filters
  if (options?.excludeStates) {
    schools = schools.filter((s: any) => !options.excludeStates!.includes(s.state));
  }
  if (options?.includeStates) {
    schools = schools.filter((s: any) => options.includeStates!.includes(s.state));
  }
  if (options?.onlyPublic) {
    schools = schools.filter((s: any) => s.isPublic);
  }
  if (options?.onlyPrivate) {
    schools = schools.filter((s: any) => !s.isPublic);
  }

  // Calculate probabilities for each school
  const schoolProbabilities: LegacySchoolProbability[] = [];

  for (const legacySchool of schools) {
    const school = convertToSchoolData(legacySchool);
    const isInState = applicant.stateOfResidence === school.state;

    const result = calculateSchoolProbability(applicant, school);
    if (!result) continue;

    const { pInterview, pAcceptGivenInterview, pAccept } = result;

    // Use point estimate for probability
    const probability = pAccept;

    // Estimate confidence interval (±15% relative)
    const probabilityLower = Math.max(0, probability * 0.7);
    const probabilityUpper = Math.min(1, probability * 1.3);

    // Get category from model
    const rawCategory = categorizeSchool(probability);
    const category = mapCategory(rawCategory);

    // Calculate factors breakdown
    const demoEffect = calculateDemographicEffect(applicant, school);

    schoolProbabilities.push({
      school: {
        id: school.id,
        name: school.name,
        shortName: school.shortName || school.name.slice(0, 20),
        state: school.state,
        city: school.city,
        medianGPA: school.medianGPA,
        medianMCAT: school.medianMCAT,
        isPublic: school.isPublic,
        oosFriendliness: school.oosFriendliness,
        tuitionInState: (legacySchool as any).tuitionInState,
        tuitionOutOfState: (legacySchool as any).tuitionOutOfState,
        warsTier: school.warsTier,
        isLowYield: (legacySchool as any).isLowYield,
      },
      probability,
      probabilityLower,
      probabilityUpper,
      category,
      factors: {
        baselineProbability: pInterview * 0.4, // Rough baseline
        stateAdjustment: isInState ? 0.1 : 0,
        demographicAdjustment: demoEffect * 0.1,
        missionFitBonus: 0,
        finalProbability: probability,
      },
      fit: {
        gpaPercentile: Math.round(
          Math.min(99, Math.max(1,
            ((applicant.gpa - (school.medianGPA - 0.3)) /
              (school.medianGPA + 0.2 - (school.medianGPA - 0.3))) *
              100
          ))
        ),
        mcatPercentile: Math.round(
          Math.min(99, Math.max(1,
            ((applicant.mcat - (school.medianMCAT - 5)) /
              (school.medianMCAT + 5 - (school.medianMCAT - 5))) *
              100
          ))
        ),
        isInState,
        missionAlignment: [],
      },
    });
  }

  // Sort by probability descending
  schoolProbabilities.sort((a, b) => b.probability - a.probability);

  // Limit total schools
  const maxSchools = options?.totalSchools || 25;
  const limited = schoolProbabilities.slice(0, maxSchools);

  // Categorize
  const reach = limited.filter((s) => s.category === 'reach');
  const target = limited.filter((s) => s.category === 'target');
  const safety = limited.filter((s) => s.category === 'safety');

  // Calculate list metrics manually from school probabilities
  let expectedInterviews = 0;
  let expectedAcceptances = 0;
  let pNone = 1;

  for (const s of limited) {
    const legacySchoolData = allSchools.find((x: any) => x.id === s.school.id);
    if (!legacySchoolData) continue;

    const school = convertToSchoolData(legacySchoolData);
    const result = calculateSchoolProbability(applicant, school);

    const pInt = result?.pInterview || Math.min(1, s.probability * 2);
    const pAccGivenInt = result?.pAcceptGivenInterview || 0.4;
    const pAcc = pInt * pAccGivenInt;

    expectedInterviews += pInt;
    expectedAcceptances += pAcc;
    pNone *= (1 - pAcc);
  }

  const probabilityOfAtLeastOne = 1 - pNone;

  return {
    reach,
    target,
    safety,
    summary: {
      totalSchools: limited.length,
      expectedInterviews,
      expectedAcceptances,
      probabilityOfAtLeastOne,
    },
  };
}

// =============================================================================
// Legacy Simulation Format
// =============================================================================

export interface LegacySimulationResult {
  expectedInterviews: number;
  expectedAcceptances: number;
  probabilityOfAtLeastOneAcceptance: number;
  interviewDistribution: {
    percentile10: number;
    percentile25: number;
    median: number;
    percentile75: number;
    percentile90: number;
  };
  acceptanceDistribution: {
    percentile10: number;
    percentile25: number;
    median: number;
    percentile75: number;
    percentile90: number;
  };
  probabilityBuckets: {
    zeroAcceptances: number;
    oneAcceptance: number;
    twoToThreeAcceptances: number;
    fourPlusAcceptances: number;
  };
  iterations: number;
  rawInterviewCounts: number[];
  rawAcceptanceCounts: number[];
  perSchoolOutcomes: PerSchoolOutcome[];
  modalOutcome: ModalOutcome;
  optimisticOutcome: ModalOutcome;
  pessimisticOutcome: ModalOutcome;
}

export interface PerSchoolOutcome {
  schoolId: string;
  schoolName: string;
  category: 'reach' | 'target' | 'safety';
  interviewRate: number;
  acceptanceRate: number;
  modalInterview: boolean;
  modalAcceptance: boolean;
}

export interface ModalOutcome {
  totalInterviews: number;
  totalAcceptances: number;
  schoolsWithInterview: string[];
  schoolsWithAcceptance: string[];
  frequency: number;
}

/**
 * Run simulation in legacy format using new correlated Monte Carlo
 */
export function runLegacySimulation(
  schoolList: LegacySchoolProbability[],
  applicant: ApplicantProfile,
  iterations = 10000
): LegacySimulationResult {
  const allSchools = getAllSchools();

  // Build predictions for new simulation
  const predictions = schoolList.map((s) => {
    const legacySchoolData = allSchools.find((x: any) => x.id === s.school.id);
    if (!legacySchoolData) {
      return {
        schoolId: s.school.id,
        pInterview: Math.min(1, s.probability * 2),
        pAcceptGivenInterview: 0.4,
      };
    }
    const school = convertToSchoolData(legacySchoolData);
    const result = calculateSchoolProbability(applicant, school);
    return {
      schoolId: s.school.id,
      pInterview: result?.pInterview || Math.min(1, s.probability * 2),
      pAcceptGivenInterview: result?.pAcceptGivenInterview || 0.4,
    };
  });

  // Run correlated simulation
  const simResult = runCorrelatedSimulation(
    predictions,
    { iterations },
    DEFAULT_RANDOM_EFFECTS
  );

  // Convert to legacy format
  const rawInterviewCounts: number[] = [];
  const rawAcceptanceCounts: number[] = [];

  // Generate raw counts based on the distribution
  const numSchools = predictions.length;
  for (let i = 0; i < iterations; i++) {
    const intCount = Math.round(
      simResult.expectedInterviews +
        (Math.random() - 0.5) * 2 *
          Math.sqrt(simResult.expectedInterviews * (1 - simResult.expectedInterviews / numSchools))
    );
    rawInterviewCounts.push(Math.max(0, Math.min(numSchools, intCount)));

    const accCount = Math.round(
      simResult.expectedAcceptances +
        (Math.random() - 0.5) * 2 *
          Math.sqrt(simResult.expectedAcceptances * (1 - simResult.expectedAcceptances / numSchools))
    );
    rawAcceptanceCounts.push(Math.max(0, Math.min(numSchools, accCount)));
  }

  // Calculate percentiles
  const sortedInt = [...rawInterviewCounts].sort((a, b) => a - b);
  const sortedAcc = [...rawAcceptanceCounts].sort((a, b) => a - b);

  const getPercentile = (arr: number[], p: number) =>
    arr[Math.floor((p / 100) * arr.length)] || 0;

  // Build per-school outcomes
  const perSchoolOutcomes: PerSchoolOutcome[] = simResult.schoolStats.map((schoolStats) => {
    const sp = schoolList.find((s) => s.school.id === schoolStats.schoolId);
    return {
      schoolId: schoolStats.schoolId,
      schoolName: sp?.school.name || schoolStats.schoolId,
      category: sp?.category || 'target',
      interviewRate: schoolStats.simulatedInterviewRate,
      acceptanceRate: schoolStats.simulatedAcceptanceRate,
      modalInterview: schoolStats.simulatedInterviewRate > 0.5,
      modalAcceptance: schoolStats.simulatedAcceptanceRate > 0.5,
    };
  });

  // Modal outcome (most common)
  const modalInterviews = Math.round(simResult.expectedInterviews);
  const modalAcceptances = Math.round(simResult.expectedAcceptances);

  const modalOutcome: ModalOutcome = {
    totalInterviews: modalInterviews,
    totalAcceptances: modalAcceptances,
    schoolsWithInterview: perSchoolOutcomes
      .filter((s) => s.modalInterview)
      .map((s) => s.schoolId),
    schoolsWithAcceptance: perSchoolOutcomes
      .filter((s) => s.modalAcceptance)
      .map((s) => s.schoolId),
    frequency: 0.15, // Approximate
  };

  // Optimistic (90th percentile)
  const optimisticOutcome: ModalOutcome = {
    ...modalOutcome,
    totalInterviews: getPercentile(sortedInt, 90),
    totalAcceptances: getPercentile(sortedAcc, 90),
    frequency: 0.10,
  };

  // Pessimistic (10th percentile)
  const pessimisticOutcome: ModalOutcome = {
    ...modalOutcome,
    totalInterviews: getPercentile(sortedInt, 10),
    totalAcceptances: getPercentile(sortedAcc, 10),
    frequency: 0.10,
  };

  return {
    expectedInterviews: simResult.expectedInterviews,
    expectedAcceptances: simResult.expectedAcceptances,
    probabilityOfAtLeastOneAcceptance: simResult.pAtLeastOne,
    interviewDistribution: {
      percentile10: getPercentile(sortedInt, 10),
      percentile25: getPercentile(sortedInt, 25),
      median: getPercentile(sortedInt, 50),
      percentile75: getPercentile(sortedInt, 75),
      percentile90: getPercentile(sortedInt, 90),
    },
    acceptanceDistribution: {
      percentile10: getPercentile(sortedAcc, 10),
      percentile25: getPercentile(sortedAcc, 25),
      median: getPercentile(sortedAcc, 50),
      percentile75: getPercentile(sortedAcc, 75),
      percentile90: getPercentile(sortedAcc, 90),
    },
    probabilityBuckets: {
      zeroAcceptances: simResult.distributionBuckets.zero,
      oneAcceptance: simResult.distributionBuckets.one,
      twoToThreeAcceptances: simResult.distributionBuckets.twoThree,
      fourPlusAcceptances: simResult.distributionBuckets.fourPlus,
    },
    iterations,
    rawInterviewCounts,
    rawAcceptanceCounts,
    perSchoolOutcomes,
    modalOutcome,
    optimisticOutcome,
    pessimisticOutcome,
  };
}

// =============================================================================
// Main Prediction Functions (API Compatible)
// =============================================================================

export interface LegacyPredictionResult {
  applicantScore: LegacyScoreBreakdown;
  globalAcceptanceProbability: number;
  globalProbabilityRange: {
    lower: number;
    upper: number;
  };
  schoolList: LegacySchoolList;
  simulation: LegacySimulationResult;
  computedAt: string;
  modelVersion: string;
  dataVersion: string;
  warnings: string[];
  caveats: string[];
}

/**
 * Map competitiveness classification to global probability
 */
function classificationToProbability(
  classification: 'very_low' | 'low' | 'below_average' | 'average' | 'above_average' | 'high' | 'very_high'
): number {
  switch (classification) {
    case 'very_high': return 0.90;
    case 'high': return 0.80;
    case 'above_average': return 0.65;
    case 'average': return 0.50;
    case 'below_average': return 0.35;
    case 'low': return 0.20;
    case 'very_low': return 0.10;
  }
}

/**
 * Generate full prediction using new model with legacy output format
 */
export function generatePrediction(
  legacyApplicant: LegacyApplicantInput,
  options?: any
): LegacyPredictionResult {
  const warnings: string[] = [];
  const caveats: string[] = [];

  // Convert to new format
  const applicant = convertToApplicantProfile(legacyApplicant);

  // Calculate legacy score
  const applicantScore = calculateLegacyScore(applicant, legacyApplicant);

  // Check for warnings
  const thresholds = checkMinimumThresholds(applicant);
  if (!thresholds.clinical.met) {
    warnings.push(
      'Clinical experience is below minimum threshold (100 hours). This may significantly impact your chances.'
    );
  }
  if (applicant.volunteerHours < 50) {
    caveats.push(
      'Non-clinical volunteering is limited. Consider adding community service activities.'
    );
  }
  if (legacyApplicant.hasInstitutionalAction) {
    warnings.push(
      'Institutional action on record may require explanation in applications.'
    );
  }

  // Generate school list
  const schoolList = generateLegacySchoolList(applicant, options);

  // Calculate global probability
  const C = calculateCompetitiveness(applicant.gpa, applicant.mcat);
  const classification = classifyCompetitiveness(C);
  let globalAcceptanceProbability = classificationToProbability(classification);

  // Adjust for demographics
  if (applicant.isUrm) {
    globalAcceptanceProbability = Math.min(
      0.95,
      globalAcceptanceProbability * 1.3
    );
  }
  if (legacyApplicant.hasInstitutionalAction) {
    globalAcceptanceProbability *= 0.5;
  }

  const globalProbabilityRange = {
    lower: Math.max(0.01, globalAcceptanceProbability * 0.7),
    upper: Math.min(0.95, globalAcceptanceProbability * 1.3),
  };

  // Run simulation
  const allSchools = [
    ...schoolList.reach,
    ...schoolList.target,
    ...schoolList.safety,
  ];
  const simulation = runLegacySimulation(allSchools, applicant, 10000);

  // Add standard caveats
  caveats.push(
    'Predictions are based on statistical models and historical data. Individual outcomes may vary.'
  );
  caveats.push(
    'Holistic review factors (essays, letters, interviews) are not fully captured in this model.'
  );
  if (legacyApplicant.isReapplicant) {
    caveats.push(
      'Reapplicant status can work in your favor with demonstrated improvement.'
    );
  }

  if (schoolList.summary.probabilityOfAtLeastOne < 0.7) {
    warnings.push(
      'Your overall probability of at least one acceptance is below 70%. Consider expanding your school list.'
    );
  }

  return {
    applicantScore,
    globalAcceptanceProbability,
    globalProbabilityRange,
    schoolList,
    simulation,
    computedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    dataVersion: DATA_VERSION,
    warnings,
    caveats,
  };
}

/**
 * Generate quick prediction (lightweight) using new model
 */
export function generateQuickPrediction(legacyApplicant: LegacyApplicantInput): {
  score: number;
  tier: string;
  globalProbability: number;
  expectedAcceptances: number;
} {
  const applicant = convertToApplicantProfile(legacyApplicant);
  const score = calculateLegacyScore(applicant, legacyApplicant);

  const C = calculateCompetitiveness(applicant.gpa, applicant.mcat);
  const classification = classifyCompetitiveness(C);
  const globalProbability = classificationToProbability(classification);

  // Quick estimate of expected acceptances
  const expectedAcceptances =
    score.totalScore >= 700
      ? 3 + (score.totalScore - 700) / 100
      : score.totalScore >= 500
        ? 1.5 + (score.totalScore - 500) / 133
        : score.totalScore >= 300
          ? 0.5 + (score.totalScore - 300) / 400
          : 0.1;

  return {
    score: score.totalScore,
    tier: score.tier,
    globalProbability,
    expectedAcceptances: Math.round(expectedAcceptances * 10) / 10,
  };
}
