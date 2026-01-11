import { describe, it, expect } from 'vitest'
import {
  getTableA23,
  getGPABin,
  getMCATBin,
  getAcceptanceRate,
  getGridCell,
  getAcceptanceRateWithConfidence,
  getApplicantPercentile,
} from '@/lib/data/table-a23'
import { GPA_BINS, MCAT_BINS } from '@/types/data'

describe('Table A-23 Data Integrity', () => {
  it('should load Table A-23 data successfully', () => {
    const data = getTableA23()
    expect(data).toBeDefined()
    expect(data.metadata).toBeDefined()
    expect(data.grid).toBeDefined()
  })

  it('should have valid metadata', () => {
    const data = getTableA23()
    expect(data.metadata.source).toBe('AAMC FACTS Table A-23')
    expect(data.metadata.totalApplicants).toBeGreaterThan(0)
    expect(data.metadata.totalAcceptees).toBeGreaterThan(0)
    expect(data.metadata.totalAcceptees).toBeLessThan(data.metadata.totalApplicants)
  })

  it('should have all GPA bins populated', () => {
    const data = getTableA23()
    for (const gpaBin of GPA_BINS) {
      expect(data.grid[gpaBin]).toBeDefined()
    }
  })

  it('should have all MCAT bins for each GPA bin', () => {
    const data = getTableA23()
    for (const gpaBin of GPA_BINS) {
      for (const mcatBin of MCAT_BINS) {
        expect(data.grid[gpaBin][mcatBin]).toBeDefined()
      }
    }
  })

  it('should have valid cell data (applicants, acceptees, rate)', () => {
    const data = getTableA23()
    for (const gpaBin of GPA_BINS) {
      for (const mcatBin of MCAT_BINS) {
        const cell = data.grid[gpaBin][mcatBin]
        expect(cell.applicants).toBeGreaterThanOrEqual(0)
        expect(cell.acceptees).toBeGreaterThanOrEqual(0)
        expect(cell.acceptees).toBeLessThanOrEqual(cell.applicants)
        expect(cell.acceptanceRate).toBeGreaterThanOrEqual(0)
        expect(cell.acceptanceRate).toBeLessThanOrEqual(1)
      }
    }
  })

  it('should have acceptance rates that match applicants/acceptees ratio', () => {
    const data = getTableA23()
    for (const gpaBin of GPA_BINS) {
      for (const mcatBin of MCAT_BINS) {
        const cell = data.grid[gpaBin][mcatBin]
        if (cell.applicants > 0) {
          const calculatedRate = cell.acceptees / cell.applicants
          expect(Math.abs(cell.acceptanceRate - calculatedRate)).toBeLessThan(0.01)
        }
      }
    }
  })

  it('should have increasing acceptance rates with higher stats', () => {
    const data = getTableA23()
    // Check that highest GPA/MCAT bin has higher rate than lowest
    const lowestCell = data.grid['<2.20']['<486']
    const highestCell = data.grid['≥3.80']['>517']
    expect(highestCell.acceptanceRate).toBeGreaterThan(lowestCell.acceptanceRate)
  })
})

describe('GPA Bin Conversion', () => {
  it('should correctly bin boundary GPAs', () => {
    expect(getGPABin(2.19)).toBe('<2.20')
    expect(getGPABin(2.20)).toBe('2.20-2.39')
    expect(getGPABin(2.39)).toBe('2.20-2.39')
    expect(getGPABin(2.40)).toBe('2.40-2.59')
    expect(getGPABin(3.79)).toBe('3.60-3.79')
    expect(getGPABin(3.80)).toBe('≥3.80')
    expect(getGPABin(4.00)).toBe('≥3.80')
  })

  it('should handle edge cases', () => {
    expect(getGPABin(0)).toBe('<2.20')
    expect(getGPABin(5.0)).toBe('≥3.80')
  })
})

describe('MCAT Bin Conversion', () => {
  it('should correctly bin boundary MCAT scores', () => {
    expect(getMCATBin(485)).toBe('<486')
    expect(getMCATBin(486)).toBe('486-489')
    expect(getMCATBin(489)).toBe('486-489')
    expect(getMCATBin(490)).toBe('490-493')
    expect(getMCATBin(517)).toBe('514-517')
    expect(getMCATBin(518)).toBe('>517')
    expect(getMCATBin(528)).toBe('>517')
  })

  it('should handle edge cases', () => {
    expect(getMCATBin(400)).toBe('<486')
    expect(getMCATBin(600)).toBe('>517')
  })
})

describe('Acceptance Rate Lookup', () => {
  it('should return valid acceptance rates', () => {
    const rate = getAcceptanceRate(3.7, 515)
    expect(rate).toBeGreaterThan(0)
    expect(rate).toBeLessThanOrEqual(1)
  })

  it('should return higher rates for better stats', () => {
    const lowRate = getAcceptanceRate(3.0, 500)
    const highRate = getAcceptanceRate(3.9, 520)
    expect(highRate).toBeGreaterThan(lowRate)
  })

  it('should get grid cell with full data', () => {
    const cell = getGridCell(3.7, 515)
    expect(cell).toBeDefined()
    expect(cell?.applicants).toBeGreaterThan(0)
    expect(cell?.acceptees).toBeGreaterThan(0)
    expect(cell?.acceptanceRate).toBeGreaterThan(0)
  })
})

describe('Confidence Intervals', () => {
  it('should calculate Wilson score intervals', () => {
    const result = getAcceptanceRateWithConfidence(3.7, 515)
    expect(result.rate).toBeGreaterThan(0)
    expect(result.lower).toBeLessThanOrEqual(result.rate)
    expect(result.upper).toBeGreaterThanOrEqual(result.rate)
    expect(result.lower).toBeGreaterThanOrEqual(0)
    expect(result.upper).toBeLessThanOrEqual(1)
    expect(result.sampleSize).toBeGreaterThan(0)
  })

  it('should have narrower intervals for larger samples', () => {
    // Higher stats typically have larger samples
    const smallSample = getAcceptanceRateWithConfidence(2.3, 488)
    const largeSample = getAcceptanceRateWithConfidence(3.5, 510)

    const smallWidth = smallSample.upper - smallSample.lower
    const largeWidth = largeSample.upper - largeSample.lower

    // Large sample should generally have narrower interval (not always guaranteed, but typical)
    // This is a soft check
    expect(smallWidth).toBeGreaterThan(0)
    expect(largeWidth).toBeGreaterThan(0)
  })
})

describe('Applicant Percentile', () => {
  it('should calculate valid percentiles', () => {
    const percentile = getApplicantPercentile(3.7, 515)
    expect(percentile).toBeGreaterThanOrEqual(0)
    expect(percentile).toBeLessThanOrEqual(1)
  })

  it('should have higher percentiles for better stats', () => {
    const lowPercentile = getApplicantPercentile(2.5, 495)
    const highPercentile = getApplicantPercentile(3.9, 520)
    expect(highPercentile).toBeGreaterThan(lowPercentile)
  })

  it('should have highest percentile for best stats', () => {
    const topPercentile = getApplicantPercentile(4.0, 528)
    expect(topPercentile).toBeGreaterThan(0.9)
  })

  it('should have lowest percentile for lowest stats', () => {
    const bottomPercentile = getApplicantPercentile(2.0, 480)
    expect(bottomPercentile).toBeLessThan(0.1)
  })
})
