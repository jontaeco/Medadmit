/**
 * Data Loading Utilities
 *
 * Central export for all data loading and processing functions.
 * Used throughout the application to access AAMC data, school profiles,
 * and demographic adjustments.
 */

// Table A-23: GPA/MCAT Acceptance Grid
export {
  getTableA23,
  getGPABin,
  getMCATBin,
  getAcceptanceRate,
  getGridCell,
  getAcceptanceRateWithConfidence,
  getAcceptanceRatesByGPA,
  getAcceptanceRatesByMCAT,
  getExpectedAcceptances,
  getApplicantPercentile,
  getTableA23Metadata,
} from './table-a23'

// School Profiles
export {
  getAllSchools,
  getSchoolById,
  getSchoolsByState,
  filterSchools,
  calculateSchoolFit,
  buildSchoolList,
  getSchoolsStatistics,
  getSchoolsMetadata,
  type SchoolMatch,
  type SchoolFilters,
} from './schools'

// Demographics and Race/Ethnicity
export {
  getTableA18,
  getRaceEthnicityStats,
  getRaceEthnicityOddsRatio,
  isURM,
  calculateDemographicAdjustment,
  getURMStatistics,
  getAllRaceEthnicityCategories,
  getTableA18Metadata,
  type DemographicAdjustment,
  type AdjustmentResult,
} from './demographics'

// Re-export types
export type {
  TableA23Data,
  TableA23Cell,
  GPABin,
  MCATBin,
  TableA18Data,
  RaceEthnicityStats,
  RaceEthnicityCategory,
  SchoolProfile,
  StateCode,
  DataSourceEntry,
  AdjustmentFactor,
} from '@/types/data'

export { GPA_BINS, MCAT_BINS, RACE_ETHNICITY_CATEGORIES, US_STATES } from '@/types/data'
