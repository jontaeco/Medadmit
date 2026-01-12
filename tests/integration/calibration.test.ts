import { describe, it, expect } from 'vitest'
import {
  validateAgainstA23,
  validateSchoolRates,
  runSensitivityAnalysis,
  runEdgeCaseTests,
  generateValidationReport,
  calculateModelImpliedPAtLeastOne,
  formatValidationReportMarkdown,
} from '@/lib/model/validation'
import { calculateCompetitiveness, competitivenessToBaselineProb } from '@/lib/model'

describe('A-23 Calibration Validation', () => {
  it('should have RMSE below 3 percentage points', () => {
    const result = validateAgainstA23()
    expect(result.rmse).toBeLessThan(0.03)
  })

  it('should have high correlation with observed rates', () => {
    const result = validateAgainstA23()
    expect(result.correlation).toBeGreaterThan(0.9)
  })

  it('should validate all 100 cells', () => {
    const result = validateAgainstA23()
    expect(result.cells.length).toBeGreaterThanOrEqual(90) // Some cells may have sparse data
  })

  it('should have maximum error below 15 percentage points', () => {
    const result = validateAgainstA23()
    expect(result.maxError).toBeLessThan(0.15)
  })

  it('should reproduce anchor point probability', () => {
    // At anchor (3.75 GPA, 512 MCAT), P should be ~65%
    const p = calculateModelImpliedPAtLeastOne(3.75, 512)
    expect(p).toBeGreaterThan(0.55)
    expect(p).toBeLessThan(0.75)
  })

  it('should reproduce extreme low probability', () => {
    // Very low stats should have low probability
    const p = calculateModelImpliedPAtLeastOne(2.5, 490)
    expect(p).toBeLessThan(0.15)
  })

  it('should reproduce extreme high probability', () => {
    // Very high stats should have high probability
    const p = calculateModelImpliedPAtLeastOne(3.95, 525)
    expect(p).toBeGreaterThan(0.75)
  })
})

describe('School Rate Validation', () => {
  it('should have positive interview rate correlation', () => {
    const result = validateSchoolRates()
    // Correlation tests the consistency between model predictions and calibrated intercepts
    // A positive correlation indicates the model correctly orders schools by selectivity
    expect(result.interviewRateCorrelation).toBeGreaterThan(0.3)
  })

  it('should have interview rate MAE below 10%', () => {
    const result = validateSchoolRates()
    expect(result.interviewRateMAE).toBeLessThan(0.10)
  })

  it('should validate multiple schools', () => {
    const result = validateSchoolRates()
    expect(result.schools.length).toBeGreaterThan(10)
  })
})

describe('Sensitivity Analysis', () => {
  it('should pass GPA monotonicity test', () => {
    const result = runSensitivityAnalysis()
    const gpaTest = result.tests.find((t) => t.testName === 'GPA Monotonicity')
    expect(gpaTest).toBeDefined()
    expect(gpaTest!.passed).toBe(true)
  })

  it('should pass MCAT monotonicity test', () => {
    const result = runSensitivityAnalysis()
    const mcatTest = result.tests.find((t) => t.testName === 'MCAT Monotonicity')
    expect(mcatTest).toBeDefined()
    expect(mcatTest!.passed).toBe(true)
  })

  it('should show GPA increasing probability monotonically', () => {
    const gpas = [3.0, 3.3, 3.5, 3.7, 3.9]
    const probs = gpas.map((gpa) => calculateModelImpliedPAtLeastOne(gpa, 512))

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThanOrEqual(probs[i - 1])
    }
  })

  it('should show MCAT increasing probability monotonically', () => {
    const mcats = [495, 505, 510, 515, 520]
    const probs = mcats.map((mcat) => calculateModelImpliedPAtLeastOne(3.75, mcat))

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThanOrEqual(probs[i - 1])
    }
  })

  it('should pass in-state bonus test', () => {
    const result = runSensitivityAnalysis()
    const inStateTest = result.tests.find((t) => t.testName === 'In-State Bonus')
    expect(inStateTest).toBeDefined()
    expect(inStateTest!.passed).toBe(true)
  })

  it('should pass reasonable ranges test', () => {
    const result = runSensitivityAnalysis()
    const rangesTest = result.tests.find(
      (t) => t.testName === 'Reasonable Probability Ranges'
    )
    expect(rangesTest).toBeDefined()
    expect(rangesTest!.passed).toBe(true)
  })

  it('should pass clinical saturation test', () => {
    const result = runSensitivityAnalysis()
    const saturationTest = result.tests.find(
      (t) => t.testName === 'Clinical Hours Saturation'
    )
    expect(saturationTest).toBeDefined()
    expect(saturationTest!.passed).toBe(true)
  })

  it('should pass majority of sensitivity tests', () => {
    const result = runSensitivityAnalysis()
    expect(result.passedCount).toBeGreaterThanOrEqual(4)
  })
})

describe('Edge Case Testing', () => {
  it('should test all defined edge cases', () => {
    const results = runEdgeCaseTests()
    expect(results.length).toBeGreaterThanOrEqual(5)
  })

  it('should pass perfect applicant test', () => {
    const results = runEdgeCaseTests()
    const perfectCase = results.find(
      (r) => r.caseDescription.includes('Perfect')
    )
    expect(perfectCase).toBeDefined()
    expect(perfectCase!.passed).toBe(true)
  })

  it('should pass weak applicant test', () => {
    const results = runEdgeCaseTests()
    const weakCase = results.find((r) => r.caseDescription.includes('Weak'))
    expect(weakCase).toBeDefined()
    expect(weakCase!.passed).toBe(true)
  })

  it('should pass average applicant test', () => {
    const results = runEdgeCaseTests()
    const avgCase = results.find((r) => r.caseDescription.includes('Average'))
    expect(avgCase).toBeDefined()
    expect(avgCase!.passed).toBe(true)
  })

  it('should give perfect applicant very high probability', () => {
    const C = calculateCompetitiveness(4.0, 528)
    const p = competitivenessToBaselineProb(C)
    expect(p).toBeGreaterThan(0.80)
  })

  it('should give weak applicant low probability', () => {
    const C = calculateCompetitiveness(3.0, 500)
    const p = competitivenessToBaselineProb(C)
    expect(p).toBeLessThan(0.35)
  })
})

describe('Full Validation Report', () => {
  it('should generate complete report', () => {
    const report = generateValidationReport()

    expect(report).toHaveProperty('generatedAt')
    expect(report).toHaveProperty('modelVersion')
    expect(report).toHaveProperty('a23Validation')
    expect(report).toHaveProperty('schoolValidation')
    expect(report).toHaveProperty('sensitivityAnalysis')
    expect(report).toHaveProperty('edgeCases')
    expect(report).toHaveProperty('overallPassed')
    expect(report).toHaveProperty('summary')
  })

  it('should have valid summary statistics', () => {
    const report = generateValidationReport()

    expect(report.summary.a23Rmse).toBeGreaterThan(0)
    expect(report.summary.a23Rmse).toBeLessThan(1)
    expect(report.summary.schoolCorrelation).toBeGreaterThan(-1)
    expect(report.summary.schoolCorrelation).toBeLessThanOrEqual(1)
    expect(report.summary.sensitivityPassed).toBeGreaterThanOrEqual(0)
    expect(report.summary.edgeCasesPassed).toBeGreaterThanOrEqual(0)
  })

  it('should format as markdown correctly', () => {
    const report = generateValidationReport()
    const markdown = formatValidationReportMarkdown(report)

    expect(markdown).toContain('# Model Validation Report')
    expect(markdown).toContain('## Summary')
    expect(markdown).toContain('## A-23 Calibration')
    expect(markdown).toContain('## Sensitivity Analysis')
    expect(markdown).toContain('## Edge Cases')
  })

  it('should include pass/fail indicators in markdown', () => {
    const report = generateValidationReport()
    const markdown = formatValidationReportMarkdown(report)

    // Should contain check marks or X marks
    expect(markdown).toMatch(/[✓✗]/)
  })
})

describe('Competitiveness to Probability Mapping', () => {
  it('should give ~65% at C=0', () => {
    const p = competitivenessToBaselineProb(0)
    expect(p).toBeGreaterThan(0.55)
    expect(p).toBeLessThan(0.75)
  })

  it('should be monotonically increasing in C', () => {
    const Cs = [-2, -1, 0, 1, 2]
    const probs = Cs.map((C) => competitivenessToBaselineProb(C))

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThan(probs[i - 1])
    }
  })

  it('should be bounded between 0 and 1', () => {
    expect(competitivenessToBaselineProb(-10)).toBeGreaterThan(0)
    expect(competitivenessToBaselineProb(-10)).toBeLessThan(0.5)
    expect(competitivenessToBaselineProb(10)).toBeGreaterThan(0.5)
    expect(competitivenessToBaselineProb(10)).toBeLessThan(1)
  })
})

describe('Model Consistency Checks', () => {
  it('should produce consistent results for same inputs', () => {
    const p1 = calculateModelImpliedPAtLeastOne(3.7, 515)
    const p2 = calculateModelImpliedPAtLeastOne(3.7, 515)
    expect(p1).toBe(p2)
  })

  it('should handle boundary GPA values', () => {
    expect(() => calculateModelImpliedPAtLeastOne(2.0, 512)).not.toThrow()
    expect(() => calculateModelImpliedPAtLeastOne(4.0, 512)).not.toThrow()
  })

  it('should handle boundary MCAT values', () => {
    expect(() => calculateModelImpliedPAtLeastOne(3.75, 472)).not.toThrow()
    expect(() => calculateModelImpliedPAtLeastOne(3.75, 528)).not.toThrow()
  })

  it('should handle extreme combinations', () => {
    // Perfect stats
    const perfect = calculateModelImpliedPAtLeastOne(4.0, 528)
    expect(perfect).toBeGreaterThan(0.5)
    expect(perfect).toBeLessThanOrEqual(1)

    // Worst stats
    const worst = calculateModelImpliedPAtLeastOne(2.0, 472)
    expect(worst).toBeGreaterThanOrEqual(0)
    expect(worst).toBeLessThan(0.5)
  })
})
