/**
 * Script to merge admit.org statistics into md-schools.json
 *
 * Usage: npx ts-node scripts/merge-admit-org-data.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Types
interface AdmitOrgSchool {
  rank: number
  name: string
  totalApplications: number | null
  totalInterviewed: number | null
  interviewRate: number | null
  totalAccepted: number | null
  interviewToAcceptanceRate: number | null
  medianMCAT: number | null
  medianGPA: number | null
}

interface AdmitOrgData {
  metadata: {
    source: string
    originalSource: string
    retrievedAt: string
    totalSchools: number
    notes: string
  }
  schools: AdmitOrgSchool[]
}

interface NameMapping {
  metadata: {
    description: string
    notes: string
  }
  mapping: Record<string, string | null>
}

interface SchoolProfile {
  id: string
  name: string
  totalApplicants: number
  totalInterviewed: number
  totalAccepted: number
  interviewRate?: number
  interviewToAcceptanceRate?: number
  admitOrgRank?: number
  [key: string]: unknown
}

interface SchoolsData {
  metadata: {
    source: string
    retrievedAt: string
    version: string
    academicYear: string
    totalSchools: number
    citation: string
    notes: string
  }
  schools: SchoolProfile[]
}

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data')
const ADMIT_ORG_PATH = path.join(DATA_DIR, 'admit-org', 'md-schools-stats.json')
const MAPPING_PATH = path.join(DATA_DIR, 'admit-org', 'school-name-mapping.json')
const SCHOOLS_PATH = path.join(DATA_DIR, 'schools', 'md-schools.json')

// Load data
function loadJSON<T>(filepath: string): T {
  const content = fs.readFileSync(filepath, 'utf-8')
  return JSON.parse(content) as T
}

function main() {
  console.log('Loading data files...')

  const admitOrgData = loadJSON<AdmitOrgData>(ADMIT_ORG_PATH)
  const nameMapping = loadJSON<NameMapping>(MAPPING_PATH)
  const schoolsData = loadJSON<SchoolsData>(SCHOOLS_PATH)

  console.log(`Loaded ${admitOrgData.schools.length} admit.org schools`)
  console.log(`Loaded ${Object.keys(nameMapping.mapping).length} name mappings`)
  console.log(`Loaded ${schoolsData.schools.length} existing schools`)

  // Create lookup by ID
  const schoolsById = new Map<string, SchoolProfile>()
  for (const school of schoolsData.schools) {
    schoolsById.set(school.id, school)
  }

  // Track statistics
  let matched = 0
  let skipped = 0
  let noMapping = 0
  let notFound = 0
  const updates: string[] = []

  // Merge data
  for (const admitSchool of admitOrgData.schools) {
    const schoolId = nameMapping.mapping[admitSchool.name]

    if (schoolId === undefined) {
      noMapping++
      console.warn(`No mapping found for: ${admitSchool.name}`)
      continue
    }

    if (schoolId === null) {
      skipped++
      continue
    }

    const school = schoolsById.get(schoolId)
    if (!school) {
      notFound++
      console.warn(`School ID not found in database: ${schoolId} (${admitSchool.name})`)
      continue
    }

    // Update the school record
    matched++

    // Update total counts if admit.org has them
    if (admitSchool.totalApplications !== null) {
      school.totalApplicants = admitSchool.totalApplications
    }
    if (admitSchool.totalInterviewed !== null) {
      school.totalInterviewed = admitSchool.totalInterviewed
    }
    if (admitSchool.totalAccepted !== null) {
      school.totalAccepted = admitSchool.totalAccepted
    }

    // Add new fields
    if (admitSchool.interviewRate !== null) {
      school.interviewRate = admitSchool.interviewRate
    }
    if (admitSchool.interviewToAcceptanceRate !== null) {
      school.interviewToAcceptanceRate = admitSchool.interviewToAcceptanceRate
    }
    school.admitOrgRank = admitSchool.rank

    updates.push(`${school.name}: rank=${admitSchool.rank}, intRate=${admitSchool.interviewRate}, int2acc=${admitSchool.interviewToAcceptanceRate}`)
  }

  // Update metadata
  schoolsData.metadata.notes += ` Interview rates merged from admit.org (MSAR) ${admitOrgData.metadata.retrievedAt}.`

  // Write updated data
  const output = JSON.stringify(schoolsData, null, 2)
  fs.writeFileSync(SCHOOLS_PATH, output, 'utf-8')

  // Summary
  console.log('\n=== Merge Summary ===')
  console.log(`Matched and updated: ${matched}`)
  console.log(`Skipped (null mapping): ${skipped}`)
  console.log(`No mapping found: ${noMapping}`)
  console.log(`ID not in database: ${notFound}`)
  console.log(`\nUpdates made:`)
  updates.forEach(u => console.log(`  - ${u}`))
  console.log(`\nWrote updated data to: ${SCHOOLS_PATH}`)
}

main()
