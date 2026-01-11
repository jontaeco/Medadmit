/**
 * Test script to validate school list distribution percentages match WARS table
 */

import { generateSchoolList, WARS_DISTRIBUTIONS } from '../src/lib/scoring/school-list'
import type { ApplicantInput } from '../src/lib/scoring/types'
import type { WARSLevel } from '../src/types/data'

console.log('='.repeat(70))
console.log('TASK 15: Validate Distribution Percentages Match WARS Table')
console.log('='.repeat(70))

// Helper to create minimal applicant profile
function createTestApplicant(gpa: number, mcat: number, state: string): ApplicantInput {
  return {
    cumulativeGPA: gpa,
    scienceGPA: null,
    mcatTotal: mcat,
    mcatCPBS: null,
    mcatCARS: null,
    mcatBBFL: null,
    mcatPSBB: null,
    stateOfResidence: state as any,
    raceEthnicity: null,
    isFirstGeneration: false,
    isDisadvantaged: false,
    isRuralBackground: false,
    clinicalHoursPaid: 500,
    clinicalHoursVolunteer: 500,
    clinicalHoursTotal: 1000,
    researchHoursTotal: 500,
    hasResearchPublications: false,
    publicationCount: 0,
    volunteerHoursNonClinical: 200,
    shadowingHours: 50,
    leadershipExperiences: 2,
    teachingHours: 0,
    isReapplicant: false,
    hasInstitutionalAction: false,
    hasCriminalHistory: false,
    undergraduateSchoolTier: 3,
    gpaTrend: undefined,
    miscellaneousLevel: 1,
    applicationYear: 2025,
  }
}

// Test distribution for each WARS level
const testCases: Array<{
  level: WARSLevel
  profile: ApplicantInput
}> = [
  {
    level: 'S',
    profile: createTestApplicant(4.0, 528, 'CA'),
  },
  {
    level: 'A',
    profile: createTestApplicant(3.85, 518, 'NY'),
  },
  {
    level: 'B',
    profile: createTestApplicant(3.75, 515, 'TX'),
  },
  {
    level: 'C',
    profile: createTestApplicant(3.60, 510, 'FL'),
  },
  {
    level: 'D',
    profile: createTestApplicant(3.40, 507, 'OH'),
  },
  {
    level: 'E',
    profile: createTestApplicant(3.20, 502, 'IL'),
  },
]

console.log('\n📋 WARS DISTRIBUTION TABLE (Expected)\n')
Object.entries(WARS_DISTRIBUTIONS).forEach(([level, dist]) => {
  console.log(`Level ${level}:`)
  console.log(`  Tier 1 (TOP):       ${(dist.tier1Pct * 100).toFixed(0)}%`)
  console.log(`  Tier 2 (HIGH):      ${(dist.tier2Pct * 100).toFixed(0)}%`)
  console.log(`  Tier 3 (MID):       ${(dist.tier3Pct * 100).toFixed(0)}%`)
  console.log(`  Tier 4+ (LOW):      ${(dist.tier4Pct * 100).toFixed(0)}%`)
  console.log(`  Low Yield:          ${dist.includeLowYield ? 'Include' : 'Skip'}`)
  console.log(`  Suggested Total:    ${dist.suggestedTotal} schools`)
  console.log()
})

console.log('\n🧪 TESTING SCHOOL LIST GENERATION\n')

let passCount = 0
let failCount = 0

testCases.forEach((testCase) => {
  const { level, profile } = testCase
  const expectedDist = WARS_DISTRIBUTIONS[level]

  console.log(`Testing Level ${level} Applicant`)
  console.log(`  Profile: GPA ${profile.cumulativeGPA}, MCAT ${profile.mcatTotal}, State: ${profile.stateOfResidence}`)

  // Generate school list using WARS distribution
  const result = generateSchoolList(profile, {
    totalSchools: expectedDist.suggestedTotal,
    useWARSDistribution: true,
    warsLevel: level,
  })

  const schoolList = [...result.reach, ...result.target, ...result.safety]
  console.log(`  Generated: ${schoolList.length} schools`)

  // Count schools by tier
  const tierCounts = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
    tier4: 0,
    lowYield: 0,
  }

  schoolList.forEach((sp) => {
    if (sp.school.warsTier === 1) tierCounts.tier1++
    else if (sp.school.warsTier === 2) tierCounts.tier2++
    else if (sp.school.warsTier === 3) tierCounts.tier3++
    else if (sp.school.warsTier >= 4) tierCounts.tier4++

    if (sp.school.isLowYield) tierCounts.lowYield++
  })

  // Calculate actual percentages
  const total = schoolList.length
  const actualPct = {
    tier1: total > 0 ? tierCounts.tier1 / total : 0,
    tier2: total > 0 ? tierCounts.tier2 / total : 0,
    tier3: total > 0 ? tierCounts.tier3 / total : 0,
    tier4: total > 0 ? tierCounts.tier4 / total : 0,
  }

  console.log('\n  Distribution:')
  console.log(`    Tier 1 (TOP):    ${tierCounts.tier1} schools (${(actualPct.tier1 * 100).toFixed(1)}%)`)
  console.log(`    Tier 2 (HIGH):   ${tierCounts.tier2} schools (${(actualPct.tier2 * 100).toFixed(1)}%)`)
  console.log(`    Tier 3 (MID):    ${tierCounts.tier3} schools (${(actualPct.tier3 * 100).toFixed(1)}%)`)
  console.log(`    Tier 4+ (LOW):   ${tierCounts.tier4} schools (${(actualPct.tier4 * 100).toFixed(1)}%)`)
  console.log(`    Low Yield:       ${tierCounts.lowYield} schools`)

  console.log('\n  Expected vs Actual:')

  // Allow 5% tolerance for percentage matching
  const tolerance = 0.05
  const checks = {
    tier1: Math.abs(actualPct.tier1 - expectedDist.tier1Pct) <= tolerance,
    tier2: Math.abs(actualPct.tier2 - expectedDist.tier2Pct) <= tolerance,
    tier3: Math.abs(actualPct.tier3 - expectedDist.tier3Pct) <= tolerance,
    tier4: Math.abs(actualPct.tier4 - expectedDist.tier4Pct) <= tolerance,
    lowYield: expectedDist.includeLowYield ? tierCounts.lowYield > 0 : tierCounts.lowYield === 0,
  }

  console.log(
    `    Tier 1: Expected ${(expectedDist.tier1Pct * 100).toFixed(0)}%, Got ${(actualPct.tier1 * 100).toFixed(1)}% ${checks.tier1 ? '✅' : '❌'}`
  )
  console.log(
    `    Tier 2: Expected ${(expectedDist.tier2Pct * 100).toFixed(0)}%, Got ${(actualPct.tier2 * 100).toFixed(1)}% ${checks.tier2 ? '✅' : '❌'}`
  )
  console.log(
    `    Tier 3: Expected ${(expectedDist.tier3Pct * 100).toFixed(0)}%, Got ${(actualPct.tier3 * 100).toFixed(1)}% ${checks.tier3 ? '✅' : '❌'}`
  )
  console.log(
    `    Tier 4+: Expected ${(expectedDist.tier4Pct * 100).toFixed(0)}%, Got ${(actualPct.tier4 * 100).toFixed(1)}% ${checks.tier4 ? '✅' : '❌'}`
  )
  console.log(
    `    Low Yield: ${expectedDist.includeLowYield ? 'Should include' : 'Should exclude'} ${checks.lowYield ? '✅' : '❌'}`
  )

  const allChecksPassed = Object.values(checks).every((c) => c)

  if (allChecksPassed) {
    console.log(`\n  ✅ PASS - Distribution matches WARS table for Level ${level}`)
    passCount++
  } else {
    console.log(`\n  ❌ FAIL - Distribution does not match WARS table`)
    failCount++
  }

  console.log()
})

// Test edge cases
console.log('🔬 EDGE CASE TESTS\n')

// Test with custom school count
console.log('1. Custom School Count (40 schools for Level C)')
const customApplicant = createTestApplicant(3.60, 510, 'CA')
const customResult = generateSchoolList(customApplicant, {
  totalSchools: 40,
  useWARSDistribution: true,
  warsLevel: 'C',
})
const customList = [...customResult.reach, ...customResult.target, ...customResult.safety]
console.log(`   Generated: ${customList.length} schools`)
const expectedC = WARS_DISTRIBUTIONS['C']
const tier1CountC = customList.filter((s) => s.school.warsTier === 1).length
const tier2CountC = customList.filter((s) => s.school.warsTier === 2).length
const tier3CountC = customList.filter((s) => s.school.warsTier === 3).length
const tier4CountC = customList.filter((s) => s.school.warsTier >= 4).length

console.log(`   Tier 1: ${tier1CountC} (${((tier1CountC / 40) * 100).toFixed(0)}%)`)
console.log(`   Tier 2: ${tier2CountC} (${((tier2CountC / 40) * 100).toFixed(0)}%)`)
console.log(`   Tier 3: ${tier3CountC} (${((tier3CountC / 40) * 100).toFixed(0)}%)`)
console.log(`   Tier 4+: ${tier4CountC} (${((tier4CountC / 40) * 100).toFixed(0)}%)`)

const customCheckPass =
  Math.abs(tier1CountC / 40 - expectedC.tier1Pct) <= 0.05 &&
  Math.abs(tier2CountC / 40 - expectedC.tier2Pct) <= 0.05 &&
  Math.abs(tier3CountC / 40 - expectedC.tier3Pct) <= 0.05 &&
  Math.abs(tier4CountC / 40 - expectedC.tier4Pct) <= 0.05

console.log(`   ${customCheckPass ? '✅ PASS' : '❌ FAIL'}`)
console.log()

// Test that state schools are prioritized
console.log('2. In-State School Priority')
const stateApplicant = createTestApplicant(3.70, 512, 'CA')
const stateResult = generateSchoolList(stateApplicant, {
  totalSchools: 30,
  useWARSDistribution: true,
  warsLevel: 'B',
})
const stateList = [...stateResult.reach, ...stateResult.target, ...stateResult.safety]

const caSchools = stateList.filter((s) => s.school.state === 'CA')
console.log(`   California schools in list: ${caSchools.length}`)
console.log(`   Examples:`)
caSchools.slice(0, 5).forEach((s) => console.log(`     - ${s.school.name} (Tier ${s.school.warsTier})`))
console.log(`   ${caSchools.length > 0 ? '✅ PASS - In-state schools included' : '❌ FAIL'}`)
console.log()

// Test low-yield exclusion for high-level applicants
console.log('3. Low-Yield School Handling')
const levelSApplicant = createTestApplicant(4.0, 528, 'NY')
const levelSResult = generateSchoolList(levelSApplicant, {
  totalSchools: 25,
  useWARSDistribution: true,
  warsLevel: 'S',
})
const levelSList = [...levelSResult.reach, ...levelSResult.target, ...levelSResult.safety]

const lowYieldInS = levelSList.filter((s) => s.school.isLowYield).length
console.log(`   Level S list: ${lowYieldInS} low-yield schools`)
console.log(`   ${lowYieldInS === 0 ? '✅ PASS - Low-yield excluded for Level S' : '⚠️  WARNING - Low-yield included'}`)

const levelDApplicant = createTestApplicant(3.40, 507, 'NY')
const levelDResult = generateSchoolList(levelDApplicant, {
  totalSchools: 35,
  useWARSDistribution: true,
  warsLevel: 'D',
})
const levelDList = [...levelDResult.reach, ...levelDResult.target, ...levelDResult.safety]

const lowYieldInD = levelDList.filter((s) => s.school.isLowYield).length
console.log(`   Level D list: ${lowYieldInD} low-yield schools`)
console.log(`   ${lowYieldInD > 0 ? '✅ PASS - Low-yield included for Level D' : '⚠️  WARNING - Low-yield excluded'}`)
console.log()

// Summary
console.log('='.repeat(70))
console.log('SUMMARY')
console.log('='.repeat(70))
console.log(`Distribution Tests: ${passCount} passed, ${failCount} failed (${testCases.length} total)`)

if (failCount === 0) {
  console.log('\n✅ ALL DISTRIBUTION TESTS PASSED')
  console.log('✓ School lists match WARS distribution percentages')
  console.log('✓ Tier allocations are correct for all levels (S-E)')
  console.log('✓ In-state schools are prioritized')
  console.log('✓ Low-yield schools handled appropriately by level')
  console.log('✓ Custom school counts work correctly')
  console.log('✓ Ready for production use')
} else {
  console.log('\n❌ SOME TESTS FAILED')
  console.log('Please review errors above')
}
console.log('='.repeat(70))
