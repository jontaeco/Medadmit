/**
 * Elite undergraduate institutions for WARS scoring
 * Used to determine undergraduate_school_tier
 */

import type { UndergraduateSchoolTier } from '@/types/data'

/**
 * HYPSM: The most elite undergraduate institutions
 * Tier 1 in WARS scoring (+6 points)
 */
export const HYPSM_SCHOOLS = [
  'Harvard University',
  'Harvard College',
  'Yale University',
  'Yale College',
  'Princeton University',
  'Stanford University',
  'Massachusetts Institute of Technology',
  'MIT',
] as const

/**
 * Elite undergraduate institutions
 * Tier 2 in WARS scoring (+3 points)
 * Includes Other Ivies, Top Privates, and Top Public Universities (~50 total)
 */
export const ELITE_SCHOOLS = [
  // Other Ivies
  'Columbia University',
  'Columbia College',
  'University of Pennsylvania',
  'Penn',
  'UPenn',
  'Brown University',
  'Dartmouth College',
  'Cornell University',

  // Other Elite Private Universities
  'Duke University',
  'Johns Hopkins University',
  'University of Chicago',
  'UChicago',
  'California Institute of Technology',
  'Caltech',
  'Northwestern University',
  'Washington University in St. Louis',
  'WashU',
  'Vanderbilt University',
  'Rice University',
  'University of Notre Dame',
  'Notre Dame',
  'Emory University',
  'Georgetown University',
  'Carnegie Mellon University',
  'University of Southern California',
  'USC',
  'Tufts University',
  'Wake Forest University',
  'New York University',
  'NYU',
  'Boston College',
  'Brandeis University',
  'Case Western Reserve University',

  // Top Public Universities (Tier 1 publics)
  'University of California, Berkeley',
  'UC Berkeley',
  'Berkeley',
  'University of California, Los Angeles',
  'UCLA',
  'University of Michigan',
  'University of Michigan - Ann Arbor',
  'U-M',
  'University of Virginia',
  'UVA',
  'University of North Carolina at Chapel Hill',
  'UNC Chapel Hill',
  'UNC',
  'University of California, San Diego',
  'UCSD',
  'UC San Diego',
  'University of California, Santa Barbara',
  'UCSB',
  'UC Santa Barbara',
  'University of California, Irvine',
  'UCI',
  'UC Irvine',
  'University of California, Davis',
  'UC Davis',
  'University of Florida',
  'UF',
  'University of Texas at Austin',
  'UT Austin',
  'University of Washington',
  'UW',
  'University of Wisconsin-Madison',
  'UW-Madison',
  'University of Illinois Urbana-Champaign',
  'UIUC',
  'Georgia Institute of Technology',
  'Georgia Tech',
  'College of William & Mary',
  'William & Mary',
] as const

/**
 * Determine undergraduate school tier based on school name
 * Returns 1 (HYPSM), 2 (Elite), or 3 (Standard)
 */
export function getUndergraduateSchoolTier(schoolName: string | null | undefined): UndergraduateSchoolTier {
  if (!schoolName) return 3

  const normalizedName = schoolName.trim().toLowerCase()

  // Check HYPSM first
  for (const hypsm of HYPSM_SCHOOLS) {
    if (normalizedName.includes(hypsm.toLowerCase())) {
      return 1
    }
  }

  // Check Elite schools
  for (const elite of ELITE_SCHOOLS) {
    if (normalizedName.includes(elite.toLowerCase())) {
      return 2
    }
  }

  // Default to standard tier
  return 3
}

/**
 * Get display name for undergraduate school tier
 */
export function getUndergraduateSchoolTierName(tier: UndergraduateSchoolTier): string {
  switch (tier) {
    case 1:
      return 'HYPSM'
    case 2:
      return 'Elite'
    case 3:
      return 'Standard'
  }
}

/**
 * Get description for undergraduate school tier
 */
export function getUndergraduateSchoolTierDescription(tier: UndergraduateSchoolTier): string {
  switch (tier) {
    case 1:
      return 'Harvard, Yale, Princeton, Stanford, MIT'
    case 2:
      return 'Other Ivies, top privates (Duke, Hopkins, etc.), top publics (Berkeley, Michigan, etc.)'
    case 3:
      return 'All other undergraduate institutions'
  }
}
