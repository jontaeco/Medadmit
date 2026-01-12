/**
 * Demographic and Mission Effect Functions for MedAdmit v2
 *
 * This module implements demographic effects and mission fit interactions
 * for the two-stage admissions model.
 *
 * All effects are on the logit scale:
 *   logit(P) = ... + β_demo * I(demographic)
 *
 * Effects are calibrated from:
 * - AAMC Table A-18: Race/ethnicity acceptance rates
 * - BMC Medical Education 2023: Demographic ORs controlling for stats
 * - WWAMI studies: Rural mission effectiveness
 * - Holistic review literature: First-gen, disadvantaged effects
 */

import type {
  ApplicantProfile,
  SchoolData,
  MissionFeatures,
  EffectDistribution,
} from './types';

// Import parameters at runtime
import demographicParamsJson from '../../../data/model/demographic-parameters-v1.json';

// ============================================================================
// Types for Demographic Parameters
// ============================================================================

export interface RaceEthnicityEffect {
  mean: number;
  sd: number;
  oddsRatio: number;
  isURM: boolean;
  source: string;
}

export interface MissionInteraction {
  mean: number;
  sd: number;
  oddsRatio: number;
  schoolFeature: string;
  applicantFeature: string;
  source: string;
}

export interface DemographicParameters {
  raceEthnicity: Record<string, RaceEthnicityEffect>;
  socioeconomic: Record<string, EffectDistribution>;
  missionInteractions: Record<string, MissionInteraction>;
  schoolLevelVariance: Record<string, { sd: number }>;
}

// ============================================================================
// Default Parameters
// ============================================================================

/**
 * Default demographic parameters loaded from calibration JSON
 */
export const DEFAULT_DEMOGRAPHIC_PARAMS: DemographicParameters = {
  raceEthnicity: demographicParamsJson.raceEthnicity as Record<string, RaceEthnicityEffect>,
  socioeconomic: demographicParamsJson.socioeconomic as Record<string, EffectDistribution>,
  missionInteractions: demographicParamsJson.missionInteractions as Record<string, MissionInteraction>,
  schoolLevelVariance: demographicParamsJson.schoolLevelVariance as Record<string, { sd: number }>,
};

// ============================================================================
// Race/Ethnicity Effects
// ============================================================================

/**
 * Normalize race/ethnicity string to match parameter keys.
 */
function normalizeRaceKey(race: string): string {
  return race
    .toLowerCase()
    .replace(/[,\/]/g, '')  // Remove commas and slashes
    .replace(/\s+/g, '_')   // Replace spaces with underscores
    .replace(/_+/g, '_');   // Collapse multiple underscores
}

/**
 * Calculate race/ethnicity demographic effect.
 *
 * @param raceEthnicity - Applicant's race/ethnicity
 * @param params - Demographic parameters
 * @returns Effect in logit units
 */
export function calculateRaceEthnicityEffect(
  raceEthnicity: string | null,
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): number {
  if (!raceEthnicity) {
    return 0;
  }

  const key = normalizeRaceKey(raceEthnicity);
  const effect = params.raceEthnicity[key];

  if (effect) {
    return effect.mean;
  }

  // Check for URM aggregate if specific race not found
  if (raceEthnicity.toLowerCase().includes('urm')) {
    const urmAgg = params.raceEthnicity['urm_aggregate'];
    return urmAgg?.mean ?? 0;
  }

  return 0;
}

/**
 * Check if a race/ethnicity is considered URM.
 */
export function isURM(raceEthnicity: string | null): boolean {
  if (!raceEthnicity) {
    return false;
  }

  const urmCategories = [
    'american indian',
    'alaska native',
    'black',
    'african american',
    'hispanic',
    'latino',
    'native hawaiian',
    'pacific islander',
  ];

  const lower = raceEthnicity.toLowerCase();
  return urmCategories.some((cat) => lower.includes(cat));
}

// ============================================================================
// Socioeconomic Effects
// ============================================================================

/**
 * Calculate socioeconomic status effects.
 *
 * @param applicant - Applicant profile
 * @param params - Demographic parameters
 * @returns Total SES effect in logit units
 */
export function calculateSESEffect(
  applicant: ApplicantProfile,
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): number {
  let total = 0;

  if (applicant.isFirstGen) {
    total += params.socioeconomic.first_generation?.mean ?? 0;
  }

  if (applicant.isDisadvantaged) {
    total += params.socioeconomic.disadvantaged_ses?.mean ?? 0;
  }

  if (applicant.isRural) {
    total += params.socioeconomic.rural_background?.mean ?? 0;
  }

  return total;
}

// ============================================================================
// Mission Fit Interactions
// ============================================================================

/**
 * Calculate mission fit interaction effects between applicant and school.
 *
 * Interactions provide additional benefit when applicant features
 * match school mission features.
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param params - Demographic parameters
 * @returns Total mission interaction effect in logit units
 */
export function calculateMissionInteraction(
  applicant: ApplicantProfile,
  school: SchoolData,
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): number {
  let total = 0;
  const mission = school.missionFeatures;
  const interactions = params.missionInteractions;

  // Rural × Rural interaction
  if (mission.ruralMission && applicant.isRural) {
    total += interactions.rural_x_rural?.mean ?? 0;
  }

  // Research × Research interaction
  const hasStrongResearch = (applicant.researchHours ?? 0) >= 1000 || applicant.researchInterest;
  if (mission.researchIntensive && hasStrongResearch) {
    total += interactions.research_x_research?.mean ?? 0;
  }

  // HBCU × Black URM interaction
  const isBlack = applicant.raceEthnicity?.toLowerCase().includes('black') ||
                  applicant.raceEthnicity?.toLowerCase().includes('african american');
  if (mission.hbcu && isBlack) {
    total += interactions.hbcu_x_urm_black?.mean ?? 0;
  }

  // Diversity focus × URM interaction
  if (mission.diversityFocus && applicant.isUrm) {
    total += interactions.diversity_x_urm?.mean ?? 0;
  }

  // Public × In-state interaction
  const isInState = school.state === applicant.stateOfResidence;
  if (school.isPublic && isInState) {
    total += interactions.public_x_instate?.mean ?? 0;
  }

  // Primary care × Primary care interest interaction
  if (mission.primaryCareFocus && applicant.primaryCareInterest) {
    total += interactions.primary_care_x_pc_interest?.mean ?? 0;
  }

  return total;
}

// ============================================================================
// Combined Demographic Effect
// ============================================================================

/**
 * Calculate total demographic effect for an applicant at a school.
 *
 * Combines:
 * 1. Race/ethnicity effect (global)
 * 2. SES effects (global)
 * 3. Mission fit interactions (school-specific)
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param params - Demographic parameters
 * @returns Total demographic effect in logit units
 */
export function calculateDemographicEffect(
  applicant: ApplicantProfile,
  school: SchoolData,
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): number {
  const raceEffect = calculateRaceEthnicityEffect(applicant.raceEthnicity, params);
  const sesEffect = calculateSESEffect(applicant, params);
  const missionEffect = calculateMissionInteraction(applicant, school, params);

  return raceEffect + sesEffect + missionEffect;
}

/**
 * Get breakdown of demographic effects by category.
 *
 * Useful for displaying to users which factors are contributing
 * to their demographic adjustment.
 *
 * @param applicant - Applicant profile
 * @param school - School data
 * @param params - Demographic parameters
 * @returns Object with effect for each category
 */
export function getDemographicBreakdown(
  applicant: ApplicantProfile,
  school: SchoolData,
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): {
  raceEthnicity: number;
  firstGen: number;
  disadvantaged: number;
  rural: number;
  missionFit: number;
  inState: number;
  total: number;
} {
  const raceEthnicity = calculateRaceEthnicityEffect(applicant.raceEthnicity, params);

  const firstGen = applicant.isFirstGen
    ? (params.socioeconomic.first_generation?.mean ?? 0)
    : 0;

  const disadvantaged = applicant.isDisadvantaged
    ? (params.socioeconomic.disadvantaged_ses?.mean ?? 0)
    : 0;

  const rural = applicant.isRural
    ? (params.socioeconomic.rural_background?.mean ?? 0)
    : 0;

  // Calculate mission fit without in-state (we want to show separately)
  let missionFit = 0;
  const mission = school.missionFeatures;
  const interactions = params.missionInteractions;

  if (mission.ruralMission && applicant.isRural) {
    missionFit += interactions.rural_x_rural?.mean ?? 0;
  }

  const hasStrongResearch = (applicant.researchHours ?? 0) >= 1000 || applicant.researchInterest;
  if (mission.researchIntensive && hasStrongResearch) {
    missionFit += interactions.research_x_research?.mean ?? 0;
  }

  const isBlack = applicant.raceEthnicity?.toLowerCase().includes('black') ||
                  applicant.raceEthnicity?.toLowerCase().includes('african american');
  if (mission.hbcu && isBlack) {
    missionFit += interactions.hbcu_x_urm_black?.mean ?? 0;
  }

  if (mission.diversityFocus && applicant.isUrm) {
    missionFit += interactions.diversity_x_urm?.mean ?? 0;
  }

  if (mission.primaryCareFocus && applicant.primaryCareInterest) {
    missionFit += interactions.primary_care_x_pc_interest?.mean ?? 0;
  }

  // In-state effect for public schools
  const isInState = school.state === applicant.stateOfResidence;
  const inState = (school.isPublic && isInState)
    ? (interactions.public_x_instate?.mean ?? 0)
    : 0;

  return {
    raceEthnicity,
    firstGen,
    disadvantaged,
    rural,
    missionFit,
    inState,
    total: raceEthnicity + firstGen + disadvantaged + rural + missionFit + inState,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert logit effect to odds ratio.
 */
export function logitToOddsRatio(logit: number): number {
  return Math.exp(logit);
}

/**
 * Convert odds ratio to logit effect.
 */
export function oddsRatioToLogit(or: number): number {
  return Math.log(or);
}

/**
 * Get available race/ethnicity categories from parameters.
 */
export function getAvailableRaceCategories(
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): string[] {
  return Object.keys(params.raceEthnicity).filter(
    (key) => key !== 'urm_aggregate'
  );
}

/**
 * Get the uncertainty (SD) for a demographic effect at a specific school.
 *
 * This combines:
 * 1. Parameter uncertainty (from calibration)
 * 2. School-level variance (how much schools differ)
 *
 * @param effectType - Type of effect ('urm', 'ses', 'instate', 'mission')
 * @param params - Demographic parameters
 * @returns Standard deviation of effect
 */
export function getDemographicUncertainty(
  effectType: 'urm' | 'ses' | 'instate' | 'mission',
  params: DemographicParameters = DEFAULT_DEMOGRAPHIC_PARAMS
): number {
  const varianceKey = `${effectType}_effect`;
  const schoolVariance = params.schoolLevelVariance[varianceKey]?.sd ?? 0.2;

  // Get parameter uncertainty
  let paramSD = 0.2;
  switch (effectType) {
    case 'urm':
      paramSD = params.raceEthnicity['urm_aggregate']?.sd ?? 0.4;
      break;
    case 'ses':
      paramSD = params.socioeconomic['first_generation']?.sd ?? 0.1;
      break;
    case 'instate':
      paramSD = params.missionInteractions['public_x_instate']?.sd ?? 0.3;
      break;
    case 'mission':
      paramSD = params.missionInteractions['rural_x_rural']?.sd ?? 0.2;
      break;
  }

  // Combine uncertainties (approximate)
  return Math.sqrt(paramSD ** 2 + schoolVariance ** 2);
}
