/**
 * Test script to verify all 160 MD schools load correctly
 * with proper WARS tier classifications
 */

import { getAllSchools } from '../src/lib/data/schools'
import { getSchoolsMetadata } from '../src/lib/data/schools'
import type { SchoolProfile } from '../src/types/data'

console.log('='.repeat(60))
console.log('TASK 13: Verify All 160 Schools Load Correctly')
console.log('='.repeat(60))

// Load schools
const schools = getAllSchools()
const metadata = getSchoolsMetadata()

console.log('\n📊 METADATA CHECK')
console.log(`Expected schools: ${metadata.totalSchools}`)
console.log(`Actual schools loaded: ${schools.length}`)
console.log(`✓ Match: ${schools.length === metadata.totalSchools}`)

// Verify required fields
console.log('\n🔍 REQUIRED FIELDS CHECK')
const missingFields: string[] = []
const invalidWarsTiers: string[] = []
const schoolsWithoutWarsTier: string[] = []

schools.forEach((school) => {
  // Check required fields exist
  if (!school.id) missingFields.push(`${school.name}: missing id`)
  if (!school.name) missingFields.push(`${school.id}: missing name`)
  if (!school.state) missingFields.push(`${school.name}: missing state`)
  if (!school.medianGPA) missingFields.push(`${school.name}: missing medianGPA`)
  if (!school.medianMCAT) missingFields.push(`${school.name}: missing medianMCAT`)

  // Check WARS fields
  if (school.warsTier === undefined || school.warsTier === null) {
    schoolsWithoutWarsTier.push(school.name)
  } else if (![1, 2, 3, 4, 5, 6].includes(school.warsTier)) {
    invalidWarsTiers.push(`${school.name}: warsTier=${school.warsTier}`)
  }

  if (school.isLowYield === undefined || school.isLowYield === null) {
    missingFields.push(`${school.name}: missing isLowYield`)
  }
})

if (missingFields.length === 0) {
  console.log('✓ All required fields present')
} else {
  console.log(`✗ Missing fields found (${missingFields.length}):`)
  missingFields.slice(0, 10).forEach(f => console.log(`  - ${f}`))
  if (missingFields.length > 10) {
    console.log(`  ... and ${missingFields.length - 10} more`)
  }
}

if (schoolsWithoutWarsTier.length === 0) {
  console.log('✓ All schools have warsTier')
} else {
  console.log(`✗ Schools without warsTier (${schoolsWithoutWarsTier.length}):`)
  schoolsWithoutWarsTier.slice(0, 10).forEach(s => console.log(`  - ${s}`))
  if (schoolsWithoutWarsTier.length > 10) {
    console.log(`  ... and ${schoolsWithoutWarsTier.length - 10} more`)
  }
}

if (invalidWarsTiers.length === 0) {
  console.log('✓ All warsTier values are valid (1-6)')
} else {
  console.log(`✗ Invalid warsTier values (${invalidWarsTiers.length}):`)
  invalidWarsTiers.forEach(s => console.log(`  - ${s}`))
}

// WARS Tier Distribution
console.log('\n🎯 WARS TIER DISTRIBUTION')
const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
schools.forEach(school => {
  if (school.warsTier) {
    tierCounts[school.warsTier]++
  }
})

console.log('Tier 1 (TOP):       ', tierCounts[1], 'schools')
console.log('Tier 2 (HIGH):      ', tierCounts[2], 'schools')
console.log('Tier 3 (MID):       ', tierCounts[3], 'schools')
console.log('Tier 4 (LOW):       ', tierCounts[4], 'schools')
console.log('Tier 5 (STATE):     ', tierCounts[5], 'schools')
console.log('Tier 6 (LOW YIELD): ', tierCounts[6], 'schools')

// Low Yield Schools
const lowYieldSchools = schools.filter(s => s.isLowYield)
console.log('\n⚠️  LOW YIELD SCHOOLS')
console.log(`Total low-yield schools: ${lowYieldSchools.length}`)
if (lowYieldSchools.length > 0) {
  console.log('Examples:')
  lowYieldSchools.slice(0, 5).forEach(s => {
    console.log(`  - ${s.name} (Tier ${s.warsTier})`)
  })
}

// Top schools verification
console.log('\n⭐ TOP TIER SCHOOLS (Tier 1)')
const topSchools = schools.filter(s => s.warsTier === 1)
console.log(`Total: ${topSchools.length}`)
topSchools.forEach(s => {
  console.log(`  - ${s.name} (GPA: ${s.medianGPA}, MCAT: ${s.medianMCAT})`)
})

// State coverage
console.log('\n🗺️  STATE COVERAGE')
const stateCount = new Set(schools.map(s => s.state)).size
console.log(`States with medical schools: ${stateCount}`)

// Stats range verification
console.log('\n📈 STATS RANGES')
const gpas = schools.map(s => s.medianGPA).filter(g => g > 0)
const mcats = schools.map(s => s.medianMCAT).filter(m => m > 0)
console.log(`GPA range: ${Math.min(...gpas).toFixed(2)} - ${Math.max(...gpas).toFixed(2)}`)
console.log(`MCAT range: ${Math.min(...mcats)} - ${Math.max(...mcats)}`)

// Summary
console.log('\n' + '='.repeat(60))
console.log('SUMMARY')
console.log('='.repeat(60))
const allChecksPass =
  schools.length === metadata.totalSchools &&
  missingFields.length === 0 &&
  schoolsWithoutWarsTier.length === 0 &&
  invalidWarsTiers.length === 0

if (allChecksPass) {
  console.log('✅ ALL CHECKS PASSED')
  console.log(`✓ ${schools.length} schools loaded successfully`)
  console.log('✓ All required fields present')
  console.log('✓ All WARS tiers assigned and valid')
  console.log('✓ Ready for production use')
} else {
  console.log('❌ SOME CHECKS FAILED')
  console.log('Please review errors above')
}
console.log('='.repeat(60))
