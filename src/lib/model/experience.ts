/**
 * Experience Saturation Functions for MedAdmit v2
 *
 * This module implements saturating experience contribution functions that
 * replace linear hour-based scoring with principled diminishing returns.
 *
 * Model: g(h) = α * (1 - e^(-h/τ))
 *
 * Where:
 * - h = hours (or count for leadership)
 * - τ = saturation scale (hours at ~63% of max effect)
 * - α = maximum contribution in logit units
 */

import type {
  ExperienceParams,
  ExperienceDomainParams,
  PublicationParams,
  ApplicantProfile,
  PublicationRecord,
} from './types';

// Import parameters at runtime
import experienceParamsJson from '../../../data/model/experience-parameters.json';

/**
 * Default experience parameters loaded from JSON
 */
export const DEFAULT_EXPERIENCE_PARAMS: ExperienceParams = {
  clinical: {
    tau: experienceParamsJson.domains.clinical.tau,
    alpha: experienceParamsJson.domains.clinical.alpha,
    minThreshold: experienceParamsJson.domains.clinical.minThreshold ?? undefined,
  },
  research: {
    tau: experienceParamsJson.domains.research.tau,
    alpha: experienceParamsJson.domains.research.alpha,
  },
  volunteer: {
    tau: experienceParamsJson.domains.volunteer.tau,
    alpha: experienceParamsJson.domains.volunteer.alpha,
    softMinimum: experienceParamsJson.domains.volunteer.minThreshold ?? undefined,
  },
  shadowing: {
    tau: experienceParamsJson.domains.shadowing.tau,
    alpha: experienceParamsJson.domains.shadowing.alpha,
    softMinimum: experienceParamsJson.domains.shadowing.minThreshold ?? undefined,
  },
  leadership: {
    tau: experienceParamsJson.domains.leadership.tau,
    alpha: experienceParamsJson.domains.leadership.alpha,
  },
  publications: {
    firstAuthor: experienceParamsJson.publications.firstAuthor,
    middle: experienceParamsJson.publications.middleAuthor,
    poster: experienceParamsJson.publications.poster,
    diminishing: experienceParamsJson.publications.diminishingFactor,
  },
};

/**
 * Compute saturating contribution for a single experience domain.
 *
 * g(h) = α * (1 - e^(-h/τ))
 *
 * Properties:
 * - g(0) = 0
 * - g(τ) ≈ 0.63 * α
 * - g(∞) → α
 * - Monotonically increasing
 * - Concave (diminishing returns)
 *
 * @param hours - Hours of experience (or count for leadership)
 * @param params - Domain-specific parameters (tau, alpha)
 * @returns Contribution in logit units
 */
export function saturatingContribution(
  hours: number,
  params: ExperienceDomainParams
): number {
  const { tau, alpha } = params;

  if (hours <= 0 || tau <= 0) {
    return 0;
  }

  // Core saturation function
  const contribution = alpha * (1 - Math.exp(-hours / tau));

  return contribution;
}

/**
 * Compute contribution with minimum threshold handling.
 *
 * Handles both hard and soft minimums:
 * - Hard minimum: Returns 0 (or negative) if below threshold
 * - Soft minimum: Applies a penalty if below threshold
 *
 * @param hours - Hours of experience
 * @param params - Domain parameters
 * @param thresholdType - 'hard' | 'soft' | 'none'
 * @param softPenalty - Penalty to apply if below soft minimum (negative value)
 * @returns Contribution in logit units
 */
export function contributionWithThreshold(
  hours: number,
  params: ExperienceDomainParams,
  thresholdType: 'hard' | 'soft' | 'none' = 'none',
  softPenalty: number = 0
): number {
  const minThreshold = params.minThreshold ?? params.softMinimum ?? 0;

  // Handle hard minimum
  if (thresholdType === 'hard' && hours < minThreshold) {
    // Hard filter - this would typically disqualify the applicant
    // Return a large negative value to signal this
    return -2.0; // Strong negative signal
  }

  // Compute base contribution
  let contribution = saturatingContribution(hours, params);

  // Handle soft minimum
  if (thresholdType === 'soft' && hours < minThreshold && minThreshold > 0) {
    // Apply penalty proportional to how far below threshold
    const deficit = (minThreshold - hours) / minThreshold;
    contribution += softPenalty * deficit;
  }

  return contribution;
}

/**
 * Compute publication contribution with diminishing returns.
 *
 * Each subsequent publication is worth diminishingFactor of the previous:
 * - 1st pub: full value
 * - 2nd pub: value * diminishingFactor
 * - 3rd pub: value * diminishingFactor^2
 * - etc.
 *
 * @param pubs - Publication record
 * @param params - Publication parameters
 * @returns Total publication contribution in logit units
 */
export function publicationContribution(
  pubs: PublicationRecord,
  params: PublicationParams
): number {
  const { firstAuthor, middle, poster, diminishing } = params;

  let total = 0;

  // Process first-author publications
  for (let i = 0; i < pubs.firstAuthor; i++) {
    total += firstAuthor * Math.pow(diminishing, i);
  }

  // Process middle-author publications (start diminishing from where first-author left off)
  const firstAuthorCount = pubs.firstAuthor;
  for (let i = 0; i < pubs.other; i++) {
    total += middle * Math.pow(diminishing, firstAuthorCount + i);
  }

  // Process posters/abstracts
  const priorCount = pubs.firstAuthor + pubs.other;
  for (let i = 0; i < pubs.posters; i++) {
    total += poster * Math.pow(diminishing, priorCount + i);
  }

  return total;
}

/**
 * Domain-specific soft penalties from JSON config
 */
const SOFT_PENALTIES: Record<string, number> = {
  clinical: 0,
  research: 0,
  volunteer: experienceParamsJson.domains.volunteer.softPenalty ?? -0.05,
  shadowing: experienceParamsJson.domains.shadowing.softPenalty ?? -0.03,
  leadership: 0,
};

/**
 * Domain-specific threshold types from JSON config
 */
const THRESHOLD_TYPES: Record<string, 'hard' | 'soft' | 'none'> = {
  clinical: experienceParamsJson.domains.clinical.minThresholdType as 'hard',
  research: 'none',
  volunteer: experienceParamsJson.domains.volunteer.minThresholdType as 'soft',
  shadowing: experienceParamsJson.domains.shadowing.minThresholdType as 'soft',
  leadership: 'none',
};

/**
 * Calculate total experience contribution for an applicant.
 *
 * E_i = sum_d(g_d(h_{i,d})) + g_pubs(publications)
 *
 * @param applicant - Applicant profile with experience data
 * @param params - Experience parameters (optional, uses defaults)
 * @returns Total experience contribution in logit units
 */
export function calculateExperienceContribution(
  applicant: ApplicantProfile,
  params: ExperienceParams = DEFAULT_EXPERIENCE_PARAMS
): number {
  let total = 0;

  // Clinical hours
  total += contributionWithThreshold(
    applicant.clinicalHours,
    params.clinical,
    THRESHOLD_TYPES.clinical,
    SOFT_PENALTIES.clinical
  );

  // Research hours
  total += contributionWithThreshold(
    applicant.researchHours,
    params.research,
    THRESHOLD_TYPES.research,
    SOFT_PENALTIES.research
  );

  // Volunteer hours
  total += contributionWithThreshold(
    applicant.volunteerHours,
    params.volunteer,
    THRESHOLD_TYPES.volunteer,
    SOFT_PENALTIES.volunteer
  );

  // Shadowing hours
  total += contributionWithThreshold(
    applicant.shadowingHours,
    params.shadowing,
    THRESHOLD_TYPES.shadowing,
    SOFT_PENALTIES.shadowing
  );

  // Leadership (count, not hours)
  total += saturatingContribution(applicant.leadershipCount, params.leadership);

  // Publications
  total += publicationContribution(applicant.publications, params.publications);

  return total;
}

/**
 * Get breakdown of experience contributions by domain.
 *
 * Useful for displaying to users which areas are contributing
 * to their overall experience score.
 *
 * @param applicant - Applicant profile
 * @param params - Experience parameters
 * @returns Object with contribution for each domain
 */
export function getExperienceBreakdown(
  applicant: ApplicantProfile,
  params: ExperienceParams = DEFAULT_EXPERIENCE_PARAMS
): {
  clinical: number;
  research: number;
  volunteer: number;
  shadowing: number;
  leadership: number;
  publications: number;
  total: number;
} {
  const clinical = contributionWithThreshold(
    applicant.clinicalHours,
    params.clinical,
    THRESHOLD_TYPES.clinical,
    SOFT_PENALTIES.clinical
  );

  const research = contributionWithThreshold(
    applicant.researchHours,
    params.research,
    THRESHOLD_TYPES.research,
    SOFT_PENALTIES.research
  );

  const volunteer = contributionWithThreshold(
    applicant.volunteerHours,
    params.volunteer,
    THRESHOLD_TYPES.volunteer,
    SOFT_PENALTIES.volunteer
  );

  const shadowing = contributionWithThreshold(
    applicant.shadowingHours,
    params.shadowing,
    THRESHOLD_TYPES.shadowing,
    SOFT_PENALTIES.shadowing
  );

  const leadership = saturatingContribution(
    applicant.leadershipCount,
    params.leadership
  );

  const publications = publicationContribution(
    applicant.publications,
    params.publications
  );

  return {
    clinical,
    research,
    volunteer,
    shadowing,
    leadership,
    publications,
    total: clinical + research + volunteer + shadowing + leadership + publications,
  };
}

/**
 * Check if applicant meets hard minimum thresholds.
 *
 * @param applicant - Applicant profile
 * @returns Object indicating which minimums are met
 */
export function checkMinimumThresholds(applicant: ApplicantProfile): {
  meetsAll: boolean;
  clinical: { required: number; actual: number; met: boolean };
} {
  const clinicalMin = experienceParamsJson.domains.clinical.minThreshold ?? 0;

  const clinicalMet = applicant.clinicalHours >= clinicalMin;

  return {
    meetsAll: clinicalMet,
    clinical: {
      required: clinicalMin,
      actual: applicant.clinicalHours,
      met: clinicalMet,
    },
  };
}
