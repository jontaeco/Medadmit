#!/usr/bin/env npx ts-node
/**
 * Validation Report Generator
 *
 * Generates a comprehensive validation report for the MedAdmit v2 model.
 * Outputs both JSON and Markdown formats.
 *
 * Usage:
 *   npx ts-node scripts/generate-validation-report.ts
 *
 * Output:
 *   - data/validation/validation-report-{timestamp}.json
 *   - data/validation/validation-report-{timestamp}.md
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateValidationReport,
  formatValidationReportMarkdown,
} from '../src/lib/model/validation';

async function main() {
  console.log('🔍 Generating MedAdmit v2 Validation Report...\n');

  // Generate the report
  const startTime = Date.now();
  const report = generateValidationReport();
  const elapsedMs = Date.now() - startTime;

  console.log(`Report generated in ${elapsedMs}ms\n`);

  // Print summary to console
  console.log('='.repeat(60));
  console.log('                    VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log(
    `Overall Status: ${report.overallPassed ? '✓ PASSED' : '✗ FAILED'}`
  );
  console.log('');
  console.log('Metrics:');
  console.log(`  A-23 RMSE:             ${(report.summary.a23Rmse * 100).toFixed(2)}%`);
  console.log(
    `  A-23 Correlation:      ${report.a23Validation.correlation.toFixed(3)}`
  );
  console.log(
    `  School Rate Corr:      ${report.summary.schoolCorrelation.toFixed(3)}`
  );
  console.log(
    `  Sensitivity Tests:     ${report.summary.sensitivityPassed}/${report.sensitivityAnalysis.totalCount}`
  );
  console.log(
    `  Edge Cases Passed:     ${report.summary.edgeCasesPassed}/${report.edgeCases.length}`
  );
  console.log('');

  // Print sensitivity test details
  console.log('Sensitivity Tests:');
  for (const test of report.sensitivityAnalysis.tests) {
    console.log(`  ${test.passed ? '✓' : '✗'} ${test.testName}`);
  }
  console.log('');

  // Print edge case details
  console.log('Edge Cases:');
  for (const edge of report.edgeCases) {
    console.log(
      `  ${edge.passed ? '✓' : '✗'} ${edge.caseDescription}: ${(edge.result.pAtLeastOne * 100).toFixed(1)}%`
    );
  }
  console.log('');

  // Create output directory
  const outputDir = path.join(process.cwd(), 'data', 'validation');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate timestamp for filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Write JSON report
  const jsonPath = path.join(outputDir, `validation-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report saved to: ${jsonPath}`);

  // Write Markdown report
  const markdown = formatValidationReportMarkdown(report);
  const mdPath = path.join(outputDir, `validation-report-${timestamp}.md`);
  fs.writeFileSync(mdPath, markdown);
  console.log(`Markdown report saved to: ${mdPath}`);

  // Also save as latest
  const latestJsonPath = path.join(outputDir, 'validation-report-latest.json');
  const latestMdPath = path.join(outputDir, 'validation-report-latest.md');
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestMdPath, markdown);
  console.log('');
  console.log('Latest report links updated.');

  console.log('');
  console.log('='.repeat(60));

  // Exit with appropriate code
  process.exit(report.overallPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Error generating validation report:', err);
  process.exit(1);
});
