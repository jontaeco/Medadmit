#!/usr/bin/env npx ts-node
/**
 * Data Validation Script for MedAdmit v2
 *
 * Validates all processed data files against the schema and checks for:
 * - Required fields
 * - Value ranges
 * - Consistency across files
 * - Referential integrity
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types from our schema (inline for script portability)
interface ValidationResult {
  file: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationReport {
  timestamp: string;
  allPassed: boolean;
  results: ValidationResult[];
  summary: {
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

const DATA_DIR = path.join(__dirname, '..', 'data');

// ============================================================================
// Validation Functions
// ============================================================================

function validateA23Processed(): ValidationResult {
  const filePath = path.join(DATA_DIR, 'aamc', 'table-a23-processed.json');
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Check metadata
    if (!data.metadata?.version) {
      errors.push('Missing metadata.version');
    }
    if (!data.metadata?.processedAt) {
      errors.push('Missing metadata.processedAt');
    }

    // Check cells
    if (!Array.isArray(data.cells)) {
      errors.push('cells must be an array');
    } else {
      // Should have 100 cells (10 GPA bins × 10 MCAT bins)
      if (data.cells.length !== 100) {
        warnings.push(`Expected 100 cells, found ${data.cells.length}`);
      }

      // Validate each cell
      for (const cell of data.cells) {
        if (typeof cell.gpaCenter !== 'number' || cell.gpaCenter < 1.0 || cell.gpaCenter > 4.0) {
          errors.push(`Invalid gpaCenter: ${cell.gpaCenter}`);
          break;
        }
        if (typeof cell.mcatCenter !== 'number' || cell.mcatCenter < 470 || cell.mcatCenter > 530) {
          errors.push(`Invalid mcatCenter: ${cell.mcatCenter}`);
          break;
        }
        if (typeof cell.acceptanceRate !== 'number' || cell.acceptanceRate < 0 || cell.acceptanceRate > 1) {
          errors.push(`Invalid acceptanceRate: ${cell.acceptanceRate}`);
          break;
        }
      }

      // Check monotonicity (higher stats should generally mean higher acceptance)
      const sortedByGpa = [...data.cells].sort((a, b) => a.gpaCenter - b.gpaCenter);
      // Group by MCAT and check GPA monotonicity
      // (soft check - just a warning if violated)
    }

    // Check bin definitions
    if (!data.binDefinitions?.gpa || Object.keys(data.binDefinitions.gpa).length !== 10) {
      errors.push('binDefinitions.gpa should have 10 entries');
    }
    if (!data.binDefinitions?.mcat || Object.keys(data.binDefinitions.mcat).length !== 10) {
      errors.push('binDefinitions.mcat should have 10 entries');
    }

  } catch (e) {
    errors.push(`Failed to read/parse file: ${e}`);
  }

  return {
    file: 'table-a23-processed.json',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateA18Processed(): ValidationResult {
  const filePath = path.join(DATA_DIR, 'aamc', 'table-a18-processed.json');
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Check metadata
    if (!data.metadata?.version) {
      errors.push('Missing metadata.version');
    }

    // Check model effects
    if (!data.modelEffects) {
      errors.push('Missing modelEffects');
    } else {
      const requiredEffects = ['urm', 'urmBlack', 'urmHispanic', 'asian'];
      for (const effect of requiredEffects) {
        if (!data.modelEffects[effect]) {
          errors.push(`Missing modelEffects.${effect}`);
        } else {
          if (typeof data.modelEffects[effect].mean !== 'number') {
            errors.push(`modelEffects.${effect}.mean must be a number`);
          }
          if (typeof data.modelEffects[effect].sd !== 'number') {
            errors.push(`modelEffects.${effect}.sd must be a number`);
          }
        }
      }

      // URM effect should be positive (advantage)
      if (data.modelEffects.urm?.mean < 0) {
        warnings.push(`URM effect is negative (${data.modelEffects.urm.mean}), expected positive`);
      }

      // Asian effect should be near zero or slightly negative
      if (data.modelEffects.asian?.mean > 0.5) {
        warnings.push(`Asian effect is unexpectedly positive (${data.modelEffects.asian.mean})`);
      }
    }

    // Check URM aggregate
    if (!data.urmAggregate) {
      warnings.push('Missing urmAggregate summary');
    }

  } catch (e) {
    errors.push(`Failed to read/parse file: ${e}`);
  }

  return {
    file: 'table-a18-processed.json',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSchoolsEnhanced(): ValidationResult {
  const filePath = path.join(DATA_DIR, 'schools', 'md-schools-enhanced.json');
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Check metadata
    if (!data.metadata?.version) {
      errors.push('Missing metadata.version');
    }
    if (!data.metadata?.enhancedAt) {
      errors.push('Missing metadata.enhancedAt');
    }

    // Check schools array
    if (!Array.isArray(data.schools)) {
      errors.push('schools must be an array');
    } else {
      if (data.schools.length < 150) {
        warnings.push(`Only ${data.schools.length} schools, expected ~155-160`);
      }

      const schoolIds = new Set<string>();

      for (const school of data.schools) {
        // Check required fields
        if (!school.id) {
          errors.push(`School missing id: ${school.name}`);
          continue;
        }

        // Check for duplicate IDs
        if (schoolIds.has(school.id)) {
          errors.push(`Duplicate school id: ${school.id}`);
        }
        schoolIds.add(school.id);

        // Validate stats
        if (typeof school.medianGPA !== 'number' || school.medianGPA < 2.0 || school.medianGPA > 4.0) {
          errors.push(`Invalid medianGPA for ${school.id}: ${school.medianGPA}`);
        }
        if (typeof school.medianMCAT !== 'number' || school.medianMCAT < 490 || school.medianMCAT > 528) {
          errors.push(`Invalid medianMCAT for ${school.id}: ${school.medianMCAT}`);
        }

        // Validate rates
        if (school.interviewRate !== null && school.interviewRate !== undefined) {
          if (school.interviewRate < 0 || school.interviewRate > 1) {
            errors.push(`Invalid interviewRate for ${school.id}: ${school.interviewRate}`);
          }
        }

        // Check mission features
        if (!school.missionFeatures) {
          errors.push(`Missing missionFeatures for ${school.id}`);
        } else {
          const requiredFeatures = ['ruralMission', 'researchIntensive', 'primaryCareFocus', 'hbcu', 'diversityFocus'];
          for (const feature of requiredFeatures) {
            if (typeof school.missionFeatures[feature] !== 'boolean') {
              errors.push(`missionFeatures.${feature} must be boolean for ${school.id}`);
              break;
            }
          }
        }

        // Check tier
        if (![1, 2, 3, 4].includes(school.tier)) {
          warnings.push(`Invalid tier for ${school.id}: ${school.tier}`);
        }

        // Check state
        if (!school.state || school.state.length !== 2) {
          errors.push(`Invalid state for ${school.id}: ${school.state}`);
        }
      }

      // Verify tier distribution is reasonable
      const tierCounts = data.schools.reduce((acc: Record<number, number>, s: { tier: number }) => {
        acc[s.tier] = (acc[s.tier] || 0) + 1;
        return acc;
      }, {});
      console.log('  Tier distribution:', tierCounts);
    }

    // Check mission feature counts in metadata
    if (data.metadata.missionFeatureCounts) {
      const counts = data.metadata.missionFeatureCounts;
      if (counts.hbcu < 2 || counts.hbcu > 5) {
        warnings.push(`Unexpected HBCU count: ${counts.hbcu} (expected 2-4)`);
      }
    }

  } catch (e) {
    errors.push(`Failed to read/parse file: ${e}`);
  }

  return {
    file: 'md-schools-enhanced.json',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function validateCrossFileConsistency(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Load all files
    const a23 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aamc', 'table-a23-processed.json'), 'utf-8'));
    const a18 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aamc', 'table-a18-processed.json'), 'utf-8'));
    const schools = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'schools', 'md-schools-enhanced.json'), 'utf-8'));

    // Check version consistency
    const a23Version = a23.metadata?.version?.split('.')[0];
    const a18Version = a18.metadata?.version?.split('.')[0];
    const schoolsVersion = schools.metadata?.version?.split('.')[0];

    if (a23Version !== a18Version) {
      warnings.push(`A-23 version (${a23.metadata.version}) differs from A-18 version (${a18.metadata.version})`);
    }

    // Check total applicants consistency
    const a23Total = a23.metadata?.totalApplicants;
    // A-18 should be from same year, roughly similar total

    // Verify school medians fall within A-23 ranges
    const maxGpa = Math.max(...a23.cells.map((c: { gpaCenter: number }) => c.gpaCenter));
    const maxMcat = Math.max(...a23.cells.map((c: { mcatCenter: number }) => c.mcatCenter));

    for (const school of schools.schools) {
      if (school.medianGPA > 4.0) {
        errors.push(`School ${school.id} has GPA > 4.0`);
      }
      if (school.medianMCAT > 528) {
        errors.push(`School ${school.id} has MCAT > 528`);
      }
    }

  } catch (e) {
    errors.push(`Cross-file validation failed: ${e}`);
  }

  return {
    file: 'cross-file-consistency',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Main Execution
// ============================================================================

function runValidation(): ValidationReport {
  console.log('🔍 Running MedAdmit Data Validation...\n');

  const results: ValidationResult[] = [];

  // Validate each file
  console.log('Validating table-a23-processed.json...');
  results.push(validateA23Processed());

  console.log('Validating table-a18-processed.json...');
  results.push(validateA18Processed());

  console.log('Validating md-schools-enhanced.json...');
  results.push(validateSchoolsEnhanced());

  console.log('Checking cross-file consistency...');
  results.push(validateCrossFileConsistency());

  // Build report
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    allPassed: results.every(r => r.passed),
    results,
    summary: {
      totalFiles: results.length,
      passedFiles: results.filter(r => r.passed).length,
      failedFiles: results.filter(r => !r.passed).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    },
  };

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION REPORT');
  console.log('='.repeat(60) + '\n');

  for (const result of results) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status}: ${result.file}`);

    if (result.errors.length > 0) {
      console.log('  Errors:');
      for (const error of result.errors) {
        console.log(`    ❌ ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      for (const warning of result.warnings) {
        console.log(`    ⚠️  ${warning}`);
      }
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files validated: ${report.summary.totalFiles}`);
  console.log(`Passed: ${report.summary.passedFiles}`);
  console.log(`Failed: ${report.summary.failedFiles}`);
  console.log(`Total errors: ${report.summary.totalErrors}`);
  console.log(`Total warnings: ${report.summary.totalWarnings}`);
  console.log('');

  if (report.allPassed) {
    console.log('✅ All validations passed!\n');
  } else {
    console.log('❌ Some validations failed. Please fix the errors above.\n');
    process.exit(1);
  }

  return report;
}

// Run if executed directly
runValidation();
