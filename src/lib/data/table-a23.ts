/**
 * AAMC Table A-23 Data Utilities
 *
 * GPA/MCAT acceptance grid data loading and lookup functions.
 * Based on AAMC FACTS Table A-23: MCAT and GPA Grid for Applicants and Acceptees.
 */

import type { TableA23Data, TableA23Cell, GPABin, MCATBin } from '@/types/data'
import { GPA_BINS, MCAT_BINS } from '@/types/data'

// Import the JSON data
import tableA23Data from '../../../data/aamc/table-a23.json'

/**
 * Get the full Table A-23 dataset
 */
export function getTableA23(): TableA23Data {
  return tableA23Data as TableA23Data
}

/**
 * Convert a numeric GPA to the appropriate bin
 */
export function getGPABin(gpa: number): GPABin {
  if (gpa < 2.2) return '<2.20'
  if (gpa < 2.4) return '2.20-2.39'
  if (gpa < 2.6) return '2.40-2.59'
  if (gpa < 2.8) return '2.60-2.79'
  if (gpa < 3.0) return '2.80-2.99'
  if (gpa < 3.2) return '3.00-3.19'
  if (gpa < 3.4) return '3.20-3.39'
  if (gpa < 3.6) return '3.40-3.59'
  if (gpa < 3.8) return '3.60-3.79'
  return '≥3.80'
}

/**
 * Convert a numeric MCAT score to the appropriate bin
 */
export function getMCATBin(mcat: number): MCATBin {
  if (mcat < 486) return '<486'
  if (mcat < 490) return '486-489'
  if (mcat < 494) return '490-493'
  if (mcat < 498) return '494-497'
  if (mcat < 502) return '498-501'
  if (mcat < 506) return '502-505'
  if (mcat < 510) return '506-509'
  if (mcat < 514) return '510-513'
  if (mcat < 518) return '514-517'
  return '>517'
}

/**
 * Get acceptance rate for a specific GPA/MCAT combination
 */
export function getAcceptanceRate(gpa: number, mcat: number): number {
  const gpaBin = getGPABin(gpa)
  const mcatBin = getMCATBin(mcat)

  const data = getTableA23()
  const cell = data.grid[gpaBin]?.[mcatBin]

  if (!cell) {
    console.warn(`No data found for GPA bin ${gpaBin} and MCAT bin ${mcatBin}`)
    return 0
  }

  return cell.acceptanceRate
}

/**
 * Get the full cell data (applicants, acceptees, rate) for a GPA/MCAT combination
 */
export function getGridCell(gpa: number, mcat: number): TableA23Cell | null {
  const gpaBin = getGPABin(gpa)
  const mcatBin = getMCATBin(mcat)

  const data = getTableA23()
  return data.grid[gpaBin]?.[mcatBin] ?? null
}

/**
 * Calculate Wilson score confidence interval for acceptance rate
 * Provides more accurate confidence intervals for binomial proportions
 */
export function getAcceptanceRateWithConfidence(
  gpa: number,
  mcat: number,
  confidenceLevel: number = 0.95
): {
  rate: number
  lower: number
  upper: number
  sampleSize: number
} {
  const cell = getGridCell(gpa, mcat)

  if (!cell) {
    return { rate: 0, lower: 0, upper: 0, sampleSize: 0 }
  }

  const n = cell.applicants
  const p = cell.acceptanceRate

  // Z-score for confidence level (95% = 1.96)
  const z = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.576 : 1.645

  // Wilson score interval
  const denominator = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denominator
  const spread = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))

  return {
    rate: p,
    lower: Math.max(0, center - spread),
    upper: Math.min(1, center + spread),
    sampleSize: n,
  }
}

/**
 * Get acceptance rates for all GPA bins at a given MCAT score
 */
export function getAcceptanceRatesByGPA(mcat: number): Map<GPABin, number> {
  const mcatBin = getMCATBin(mcat)
  const data = getTableA23()
  const result = new Map<GPABin, number>()

  for (const gpaBin of GPA_BINS) {
    const cell = data.grid[gpaBin]?.[mcatBin]
    if (cell) {
      result.set(gpaBin, cell.acceptanceRate)
    }
  }

  return result
}

/**
 * Get acceptance rates for all MCAT bins at a given GPA
 */
export function getAcceptanceRatesByMCAT(gpa: number): Map<MCATBin, number> {
  const gpaBin = getGPABin(gpa)
  const data = getTableA23()
  const result = new Map<MCATBin, number>()

  for (const mcatBin of MCAT_BINS) {
    const cell = data.grid[gpaBin]?.[mcatBin]
    if (cell) {
      result.set(mcatBin, cell.acceptanceRate)
    }
  }

  return result
}

/**
 * Get the expected number of acceptances for a given number of applications
 * at a specific GPA/MCAT combination
 */
export function getExpectedAcceptances(
  gpa: number,
  mcat: number,
  numApplications: number
): {
  expected: number
  lower: number
  upper: number
} {
  const { rate, lower, upper } = getAcceptanceRateWithConfidence(gpa, mcat)

  return {
    expected: rate * numApplications,
    lower: lower * numApplications,
    upper: upper * numApplications,
  }
}

/**
 * Get percentile rank based on GPA/MCAT combination
 * Returns what percentage of applicants have worse credentials
 */
export function getApplicantPercentile(gpa: number, mcat: number): number {
  const gpaBin = getGPABin(gpa)
  const mcatBin = getMCATBin(mcat)
  const data = getTableA23()

  const gpaIndex = GPA_BINS.indexOf(gpaBin)
  const mcatIndex = MCAT_BINS.indexOf(mcatBin)

  let applicantsBelowOrEqual = 0
  let totalApplicants = 0

  // Count applicants in all bins
  for (let i = 0; i < GPA_BINS.length; i++) {
    for (let j = 0; j < MCAT_BINS.length; j++) {
      const cell = data.grid[GPA_BINS[i]]?.[MCAT_BINS[j]]
      if (cell) {
        totalApplicants += cell.applicants
        // Count if this bin is "below" or equal to the target
        if (i < gpaIndex || (i === gpaIndex && j <= mcatIndex)) {
          applicantsBelowOrEqual += cell.applicants
        }
      }
    }
  }

  return totalApplicants > 0 ? applicantsBelowOrEqual / totalApplicants : 0
}

/**
 * Get metadata about the Table A-23 data source
 */
export function getTableA23Metadata(): TableA23Data['metadata'] {
  return getTableA23().metadata
}
