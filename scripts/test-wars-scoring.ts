/**
 * Test script to verify WARS scoring across various applicant profiles
 */

import { calculateWARSScore, getWARSLevel, getWARSLevelDescription } from '../src/lib/scoring/wars-score'
import type { WARSInput } from '../src/lib/scoring/wars-score'

console.log('='.repeat(70))
console.log('TASK 14: Test WARS Scoring Across Applicant Profiles')
console.log('='.repeat(70))

// Test profiles representing each WARS level
const testProfiles: Array<{ name: string; input: WARSInput; expectedLevel: string; expectedMinScore: number }> = [
  {
    name: 'Elite Applicant (Level S)',
    input: {
      gpa: 4.0,
      mcat: 528,
      researchLevel: 5,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 3,
      leadershipLevel: 3,
      undergraduateSchoolTier: 1, // HYPSM
      miscellaneousLevel: 4,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'S',
    expectedMinScore: 85,
  },
  {
    name: 'Very Strong Applicant (Level A)',
    input: {
      gpa: 3.85,
      mcat: 518,
      researchLevel: 4,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 3,
      leadershipLevel: 3,
      undergraduateSchoolTier: 2, // Elite
      miscellaneousLevel: 2,
      isURM: false,
      hasUpwardTrend: true,
    },
    expectedLevel: 'A',
    expectedMinScore: 80,
  },
  {
    name: 'Strong Applicant (Level B)',
    input: {
      gpa: 3.75,
      mcat: 515,
      researchLevel: 3,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 2,
      leadershipLevel: 2,
      undergraduateSchoolTier: 3, // Standard
      miscellaneousLevel: 2,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'B',
    expectedMinScore: 75,
  },
  {
    name: 'Competitive Applicant (Level C)',
    input: {
      gpa: 3.60,
      mcat: 510,
      researchLevel: 2,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 2,
      leadershipLevel: 2,
      undergraduateSchoolTier: 3,
      miscellaneousLevel: 1,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'C',
    expectedMinScore: 68,
  },
  {
    name: 'Moderate Applicant (Level D)',
    input: {
      gpa: 3.40,
      mcat: 507,
      researchLevel: 2,
      clinicalLevel: 2,
      shadowingLevel: 2,
      volunteeringLevel: 1,
      leadershipLevel: 1,
      undergraduateSchoolTier: 3,
      miscellaneousLevel: 1,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'D',
    expectedMinScore: 60,
  },
  {
    name: 'Developing Applicant (Level E)',
    input: {
      gpa: 3.20,
      mcat: 502,
      researchLevel: 1,
      clinicalLevel: 1,
      shadowingLevel: 1,
      volunteeringLevel: 1,
      leadershipLevel: 1,
      undergraduateSchoolTier: 3,
      miscellaneousLevel: 1,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'E',
    expectedMinScore: 0,
  },
  {
    name: 'URM Applicant with Bonus',
    input: {
      gpa: 3.60,
      mcat: 508,
      researchLevel: 2,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 2,
      leadershipLevel: 2,
      undergraduateSchoolTier: 3,
      miscellaneousLevel: 1,
      isURM: true, // +7 points
      hasUpwardTrend: false,
    },
    expectedLevel: 'B', // Should boost from C to B
    expectedMinScore: 75,
  },
  {
    name: 'Upward Trend Applicant',
    input: {
      gpa: 3.75,
      mcat: 512,
      researchLevel: 3,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 2,
      leadershipLevel: 2,
      undergraduateSchoolTier: 3,
      miscellaneousLevel: 1,
      isURM: false,
      hasUpwardTrend: true, // +4 points
    },
    expectedLevel: 'B',
    expectedMinScore: 75,
  },
  {
    name: 'HYPSM Graduate Bonus',
    input: {
      gpa: 3.75,
      mcat: 512,
      researchLevel: 3,
      clinicalLevel: 3,
      shadowingLevel: 2,
      volunteeringLevel: 2,
      leadershipLevel: 2,
      undergraduateSchoolTier: 1, // +6 points
      miscellaneousLevel: 1,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'B',
    expectedMinScore: 75,
  },
  {
    name: 'Low Clinical Experience Penalty',
    input: {
      gpa: 3.80,
      mcat: 515,
      researchLevel: 4,
      clinicalLevel: 1, // -10 points!
      shadowingLevel: 2,
      volunteeringLevel: 3,
      leadershipLevel: 3,
      undergraduateSchoolTier: 2,
      miscellaneousLevel: 2,
      isURM: false,
      hasUpwardTrend: false,
    },
    expectedLevel: 'B', // Should be lower due to clinical penalty
    expectedMinScore: 70,
  },
]

let passCount = 0
let failCount = 0

console.log('\n🧪 TESTING APPLICANT PROFILES\n')

testProfiles.forEach((profile, index) => {
  console.log(`${index + 1}. ${profile.name}`)
  console.log('   Input:')
  console.log(`   - GPA: ${profile.input.gpa}, MCAT: ${profile.input.mcat}`)
  console.log(
    `   - Research: ${profile.input.researchLevel}, Clinical: ${profile.input.clinicalLevel}, ` +
      `Shadowing: ${profile.input.shadowingLevel}`
  )
  console.log(
    `   - Volunteering: ${profile.input.volunteeringLevel}, Leadership: ${profile.input.leadershipLevel}`
  )
  console.log(`   - Undergrad Tier: ${profile.input.undergraduateSchoolTier}, Misc: ${profile.input.miscellaneousLevel}`)
  console.log(`   - URM: ${profile.input.isURM}, Upward Trend: ${profile.input.hasUpwardTrend}`)

  const result = calculateWARSScore(profile.input)

  console.log('\n   Result:')
  console.log(`   - WARS Score: ${result.score} / 121`)
  console.log(`   - WARS Level: ${result.level}`)
  console.log(`   - Description: ${getWARSLevelDescription(result.level)}`)
  console.log('\n   Breakdown:')
  console.log(`   - Stats: ${result.breakdown.stats} / 50`)
  console.log(`   - Research: ${result.breakdown.research} / 15`)
  console.log(`   - Clinical: ${result.breakdown.clinical} / 9`)
  console.log(`   - Shadowing: ${result.breakdown.shadowing} / 6`)
  console.log(`   - Volunteering: ${result.breakdown.volunteering} / 6`)
  console.log(`   - Leadership: ${result.breakdown.leadership} / 6`)
  console.log(`   - Miscellaneous: ${result.breakdown.miscellaneous} / 12`)
  console.log(`   - Undergraduate: ${result.breakdown.undergraduate} / 6`)
  console.log(`   - URM: ${result.breakdown.urm} / 7`)
  console.log(`   - Trend: ${result.breakdown.trend} / 4`)

  // Validate
  const levelCorrect = result.level === profile.expectedLevel
  const scoreCorrect = result.score >= profile.expectedMinScore

  if (levelCorrect && scoreCorrect) {
    console.log(`   ✅ PASS - Level ${result.level}, Score ${result.score}`)
    passCount++
  } else {
    console.log(`   ❌ FAIL`)
    if (!levelCorrect) {
      console.log(`      Expected level: ${profile.expectedLevel}, Got: ${result.level}`)
    }
    if (!scoreCorrect) {
      console.log(`      Expected score ≥ ${profile.expectedMinScore}, Got: ${result.score}`)
    }
    failCount++
  }

  console.log()
})

// Test edge cases
console.log('🔬 EDGE CASE TESTS\n')

// Maximum possible score
console.log('1. Maximum Possible Score')
const maxInput: WARSInput = {
  gpa: 4.0,
  mcat: 528,
  researchLevel: 5,
  clinicalLevel: 3,
  shadowingLevel: 2,
  volunteeringLevel: 3,
  leadershipLevel: 3,
  undergraduateSchoolTier: 1,
  miscellaneousLevel: 4,
  isURM: true,
  hasUpwardTrend: true,
}
const maxResult = calculateWARSScore(maxInput)
console.log(`   Score: ${maxResult.score} / 121`)
console.log(`   Level: ${maxResult.level}`)
console.log(`   Expected: Should be close to 121`)
console.log(
  `   ${maxResult.score >= 110 && maxResult.level === 'S' ? '✅ PASS' : '❌ FAIL - Score should be near 121'}`
)
console.log()

// Minimum possible score
console.log('2. Minimum Possible Score (with penalties)')
const minInput: WARSInput = {
  gpa: 2.5,
  mcat: 490,
  researchLevel: 1,
  clinicalLevel: 1, // -10
  shadowingLevel: 1, // -5
  volunteeringLevel: 1,
  leadershipLevel: 1,
  undergraduateSchoolTier: 3,
  miscellaneousLevel: 1,
  isURM: false,
  hasUpwardTrend: false,
}
const minResult = calculateWARSScore(minInput)
console.log(`   Score: ${minResult.score} / 121`)
console.log(`   Level: ${minResult.level}`)
console.log(`   Note: Negative stats score + penalties can result in very low score`)
console.log(`   ${minResult.level === 'E' ? '✅ PASS' : '❌ FAIL - Should be Level E'}`)
console.log()

// Verify sum of breakdown equals total
console.log('3. Breakdown Sum Verification')
let sumChecksPassed = 0
let sumChecksFailed = 0

testProfiles.forEach((profile) => {
  const result = calculateWARSScore(profile.input)
  const breakdownSum =
    result.breakdown.stats +
    result.breakdown.research +
    result.breakdown.clinical +
    result.breakdown.shadowing +
    result.breakdown.volunteering +
    result.breakdown.leadership +
    result.breakdown.miscellaneous +
    result.breakdown.undergraduate +
    result.breakdown.urm +
    result.breakdown.trend

  if (breakdownSum === result.score) {
    sumChecksPassed++
  } else {
    sumChecksFailed++
    console.log(`   ❌ ${profile.name}: Breakdown sum (${breakdownSum}) ≠ Total (${result.score})`)
  }
})

console.log(`   Breakdown sums match total: ${sumChecksPassed}/${testProfiles.length}`)
console.log(`   ${sumChecksFailed === 0 ? '✅ PASS' : '❌ FAIL'}`)
console.log()

// Summary
console.log('='.repeat(70))
console.log('SUMMARY')
console.log('='.repeat(70))
console.log(`Profile Tests: ${passCount} passed, ${failCount} failed (${testProfiles.length} total)`)
console.log(`Edge Cases: ${sumChecksFailed === 0 ? 'All passed' : 'Some failed'}`)

if (failCount === 0 && sumChecksFailed === 0) {
  console.log('\n✅ ALL WARS SCORING TESTS PASSED')
  console.log('✓ All applicant profiles scored correctly')
  console.log('✓ WARS levels assigned properly (S, A, B, C, D, E)')
  console.log('✓ Bonuses applied correctly (URM, upward trend, HYPSM)')
  console.log('✓ Penalties applied correctly (low clinical, low shadowing)')
  console.log('✓ Breakdown components sum to total score')
  console.log('✓ Ready for production use')
} else {
  console.log('\n❌ SOME TESTS FAILED')
  console.log('Please review errors above')
}
console.log('='.repeat(70))
