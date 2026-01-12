/**
 * Experience Level Conversion for WARS
 * Maps hours-based experience data to WARS levels (1-5 or 1-3)
 */

import type { ApplicantProfile } from '@/types/database'
import type { ApplicantInput } from './types'
import type { WARSInput } from './wars-score'
import type { UndergraduateSchoolTier, MiscellaneousLevel } from '@/types/data'
import { getUndergraduateSchoolTier } from '@/lib/data/elite-schools'

/**
 * Determine research level from profile data
 * Level 5: 1000+ hours AND (first-author pub OR high-impact pub OR major conference)
 * Level 4: 500+ hours AND (any publication OR poster OR thesis)
 * Level 3: 200+ hours OR completed project
 * Level 2: <200 hours, limited activity
 * Level 1: No research
 */
export function convertResearchLevel(profile: ApplicantProfile): 1 | 2 | 3 | 4 | 5 {
  const hours = profile.research_hours || 0
  const publications = profile.publications as { count?: number; firstAuthor?: boolean } | null
  const presentations = profile.presentations || 0
  const pubCount = publications?.count || 0
  const hasFirstAuthor = publications?.firstAuthor || false

  // Level 5: 1000+ hours AND (first-author pub OR 2+ pubs OR presentations)
  if (hours >= 1000 && (hasFirstAuthor || pubCount >= 2 || presentations >= 2)) {
    return 5
  }

  // Level 4: 500+ hours AND (any publication OR poster/presentation OR significant project)
  if (hours >= 500 && (pubCount >= 1 || presentations >= 1)) {
    return 4
  }

  // Level 3: 200+ hours OR completed project (presentations suggest completion)
  if (hours >= 200 || presentations >= 1) {
    return 3
  }

  // Level 2: <200 hours, limited activity
  if (hours > 0 && hours < 200) {
    return 2
  }

  // Level 1: No research
  return 1
}

/**
 * Determine clinical level from profile data
 * Level 3: 500+ hours sustained clinical experience
 * Level 2: 100-500 hours adequate exposure
 * Level 1: <100 hours or none
 */
export function convertClinicalLevel(profile: ApplicantProfile): 1 | 2 | 3 {
  const hours = profile.clinical_hours || 0

  if (hours >= 500) return 3
  if (hours >= 100) return 2
  return 1
}

/**
 * Determine shadowing level from profile data
 * Level 2: 40+ hours adequate shadowing
 * Level 1: <40 hours
 */
export function convertShadowingLevel(profile: ApplicantProfile): 1 | 2 {
  const hours = profile.shadowing_hours || 0
  return hours >= 40 ? 2 : 1
}

/**
 * Determine volunteering level from profile data
 * Level 3: 300+ hours sustained, diverse volunteering
 * Level 2: 100-300 hours moderate volunteering
 * Level 1: <100 hours
 */
export function convertVolunteeringLevel(profile: ApplicantProfile): 1 | 2 | 3 {
  const hours = profile.volunteer_hours || 0

  if (hours >= 300) return 3
  if (hours >= 100) return 2
  return 1
}

/**
 * Determine leadership level from profile data
 * Level 3: Major leadership role (organization president, sustained teaching)
 * Level 2: Some leadership (officer, TA, tutor)
 * Level 1: Minimal/none
 *
 * Note: This is a heuristic based on available data
 * In a real implementation, we'd want explicit leadership tracking
 */
export function convertLeadershipLevel(profile: ApplicantProfile): 1 | 2 | 3 {
  // Check if they have varsity athletics (often indicates team captain/leadership)
  const hasVarsityAthletics = !!profile.varsity_athletics

  // Check if they have teaching experience (implicit in some fields)
  // This is a simplified heuristic - ideally we'd have explicit leadership tracking
  const publications = profile.publications as { count?: number } | null
  const presentations = profile.presentations || 0
  const pubCount = publications?.count || 0

  // Level 3: Major indicators of leadership
  // - Varsity athletics often means captain/leadership
  // - Multiple presentations suggests PI/senior researcher role
  if (hasVarsityAthletics || presentations >= 3) {
    return 3
  }

  // Level 2: Some indicators of leadership
  // - Any publications or presentations suggest some leadership in research
  // - Work experience suggests some professional responsibility
  if (pubCount >= 1 || presentations >= 1 || profile.work_experience_years > 0) {
    return 2
  }

  // Level 1: Minimal or no leadership indicators
  return 1
}

/**
 * Determine miscellaneous level from profile data
 * Level 4: Outstanding (Rhodes, Olympics, professional sports, etc.)
 * Level 3: Significant (PhD, JD, Peace Corps, military)
 * Level 2: Moderate (notable hobbies, work experience)
 * Level 1: None/minimal
 *
 * Note: This requires the new miscellaneous_level field
 * For now, we infer from available data
 */
export function convertMiscellaneousLevel(profile: ApplicantProfile): MiscellaneousLevel {
  // If the profile has the new field, use it
  if (profile.miscellaneous_level) {
    return profile.miscellaneous_level
  }

  // Otherwise, infer from available data
  const hasNationalScholarships = !!profile.national_scholarships
  const hasMilitaryService = !!profile.military_service
  const hasVarsityAthletics = !!profile.varsity_athletics
  const hasSignificantWorkExperience = profile.work_experience_years >= 2
  const hasGapYears = profile.gap_years >= 1

  // Level 4: Outstanding achievements (national scholarships)
  if (hasNationalScholarships) {
    return 4
  }

  // Level 3: Significant achievements (military, varsity athletics)
  if (hasMilitaryService || hasVarsityAthletics) {
    return 3
  }

  // Level 2: Moderate achievements (work experience, gap years with purpose)
  if (hasSignificantWorkExperience || (hasGapYears && profile.work_experience_years > 0)) {
    return 2
  }

  // Level 1: None or minimal
  return 1
}

/**
 * Determine if applicant is URM
 * Based on AAMC definition: underrepresented in medicine
 */
export function isURM(profile: ApplicantProfile): boolean {
  const raceEthnicity = profile.race_ethnicity || []

  // AAMC defines URM as:
  // - American Indian or Alaska Native
  // - Black or African American
  // - Hispanic, Latino, or of Spanish Origin
  // - Native Hawaiian or Other Pacific Islander

  const urmCategories = [
    'American Indian or Alaska Native',
    'Black or African American',
    'Hispanic, Latino, or of Spanish Origin',
    'Native Hawaiian or Other Pacific Islander',
  ]

  return raceEthnicity.some((race) => urmCategories.includes(race))
}

/**
 * Determine if applicant has upward GPA trend
 * This requires the new gpa_trend field
 */
export function hasUpwardTrend(profile: ApplicantProfile): boolean {
  // If the profile has the new field, use it
  if (profile.gpa_trend) {
    return profile.gpa_trend === 'upward'
  }

  // Otherwise, we can't determine it from available data
  // Default to false (neutral)
  return false
}

/**
 * Get undergraduate school tier from profile
 */
export function getProfileUndergraduateSchoolTier(profile: ApplicantProfile): UndergraduateSchoolTier {
  // If the profile has the new field, use it
  if (profile.undergraduate_school_tier) {
    return profile.undergraduate_school_tier
  }

  // Otherwise, try to infer from top_university_name
  if (profile.attended_top_university && profile.top_university_name) {
    return getUndergraduateSchoolTier(profile.top_university_name)
  }

  // Default to tier 3 (standard)
  return 3
}

/**
 * Convert ApplicantProfile to WARSInput
 * This is the main function that brings it all together
 */
export function profileToWARSInput(profile: ApplicantProfile): WARSInput {
  return {
    gpa: profile.cumulative_gpa || 0,
    mcat: profile.mcat_total || 0,
    researchLevel: convertResearchLevel(profile),
    clinicalLevel: convertClinicalLevel(profile),
    shadowingLevel: convertShadowingLevel(profile),
    volunteeringLevel: convertVolunteeringLevel(profile),
    leadershipLevel: convertLeadershipLevel(profile),
    undergraduateSchoolTier: getProfileUndergraduateSchoolTier(profile),
    miscellaneousLevel: convertMiscellaneousLevel(profile),
    isURM: isURM(profile),
    hasUpwardTrend: hasUpwardTrend(profile),
  }
}

/**
 * Convert ApplicantInput to WARSInput
 * Used in the scoring flow where we have ApplicantInput instead of ApplicantProfile
 */
export function applicantInputToWARSInput(input: ApplicantInput): WARSInput {
  // Determine research level from hours and publications
  const researchLevel = convertResearchLevelFromHours(
    input.researchHoursTotal,
    input.hasResearchPublications,
    input.publicationCount
  )

  // Determine clinical level from total hours
  const clinicalLevel = convertClinicalLevelFromHours(input.clinicalHoursTotal)

  // Determine shadowing level
  const shadowingLevel = convertShadowingLevelFromHours(input.shadowingHours)

  // Determine volunteering level
  const volunteeringLevel = convertVolunteeringLevelFromHours(input.volunteerHoursNonClinical)

  // Determine leadership level (simplified - based on count)
  const leadershipLevel = convertLeadershipLevelFromCount(input.leadershipExperiences)

  // Use provided WARS fields or defaults
  const undergraduateSchoolTier = input.undergraduateSchoolTier ?? 3 // Default to standard
  const miscellaneousLevel = input.miscellaneousLevel ?? 1 // Default to minimal
  const hasUpwardTrend = input.gpaTrend === 'upward'

  // Determine URM status from race/ethnicity
  const isURM = isURMFromRaceEthnicity(input.raceEthnicity)

  return {
    gpa: input.cumulativeGPA,
    mcat: input.mcatTotal,
    researchLevel,
    clinicalLevel,
    shadowingLevel,
    volunteeringLevel,
    leadershipLevel,
    undergraduateSchoolTier,
    miscellaneousLevel,
    isURM,
    hasUpwardTrend,
  }
}

/**
 * Helper: Convert research hours to WARS level
 */
function convertResearchLevelFromHours(
  hours: number,
  hasPublications: boolean,
  publicationCount: number
): 1 | 2 | 3 | 4 | 5 {
  if (hours >= 1000 && (publicationCount >= 2 || hasPublications)) return 5
  if (hours >= 500 && hasPublications) return 4
  if (hours >= 200) return 3
  if (hours > 0 && hours < 200) return 2
  return 1
}

/**
 * Helper: Convert clinical hours to WARS level
 */
function convertClinicalLevelFromHours(hours: number): 1 | 2 | 3 {
  if (hours >= 500) return 3
  if (hours >= 100) return 2
  return 1
}

/**
 * Helper: Convert shadowing hours to WARS level
 */
function convertShadowingLevelFromHours(hours: number): 1 | 2 {
  return hours >= 40 ? 2 : 1
}

/**
 * Helper: Convert volunteer hours to WARS level
 */
function convertVolunteeringLevelFromHours(hours: number): 1 | 2 | 3 {
  if (hours >= 300) return 3
  if (hours >= 100) return 2
  return 1
}

/**
 * Helper: Convert leadership count to WARS level
 */
function convertLeadershipLevelFromCount(count: number): 1 | 2 | 3 {
  if (count >= 3) return 3
  if (count >= 1) return 2
  return 1
}

/**
 * Helper: Determine if race/ethnicity is URM
 */
function isURMFromRaceEthnicity(raceEthnicity: string | null): boolean {
  if (!raceEthnicity) return false

  const urmCategories = [
    'American Indian or Alaska Native',
    'Black or African American',
    'Hispanic, Latino, or of Spanish Origin',
    'Native Hawaiian or Other Pacific Islander',
  ]

  return urmCategories.includes(raceEthnicity)
}
