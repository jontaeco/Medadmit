import { NextRequest, NextResponse } from 'next/server'
import { getAllSchools, getSchoolsStatistics, filterSchools } from '@/lib/data'

/**
 * GET /api/schools
 * Get all schools or filter by query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse filter parameters
    const state = searchParams.get('state')
    const isPublic = searchParams.get('public')
    const oosFriendly = searchParams.get('oos_friendly')
    const minMCAT = searchParams.get('min_mcat')
    const maxMCAT = searchParams.get('max_mcat')
    const minGPA = searchParams.get('min_gpa')
    const maxGPA = searchParams.get('max_gpa')
    const mission = searchParams.get('mission')
    const stats = searchParams.get('stats')

    // If stats=true, return aggregate statistics
    if (stats === 'true') {
      const statistics = getSchoolsStatistics()
      return NextResponse.json({ success: true, statistics })
    }

    // Build filters
    const filters: any = {}
    if (state) filters.states = [state]
    if (isPublic === 'true') filters.isPublic = true
    if (isPublic === 'false') filters.isPublic = false
    if (oosFriendly === 'true') filters.oosFriendly = true
    if (minMCAT) filters.minMedianMCAT = parseInt(minMCAT)
    if (maxMCAT) filters.maxMedianMCAT = parseInt(maxMCAT)
    if (minGPA) filters.minMedianGPA = parseFloat(minGPA)
    if (maxGPA) filters.maxMedianGPA = parseFloat(maxGPA)
    if (mission) filters.missionKeywords = mission.split(',')

    // Get schools
    const schools = Object.keys(filters).length > 0
      ? filterSchools(filters)
      : getAllSchools()

    // Format response
    const formattedSchools = schools.map((school) => ({
      id: school.id,
      name: school.name,
      shortName: school.shortName,
      state: school.state,
      city: school.city,
      medianGPA: school.medianGPA,
      medianMCAT: school.medianMCAT,
      isPublic: school.isPublic,
      oosFriendliness: school.oosFriendliness,
      acceptanceRate: school.totalAccepted / school.totalApplicants,
      classSize: school.classSize,
      tuitionInState: school.tuitionInState,
      tuitionOutOfState: school.tuitionOutOfState,
      missionKeywords: school.missionKeywords,
      interviewFormat: school.interviewFormat,
      usNewsRankResearch: school.usNewsRankResearch,
      usNewsRankPrimaryCare: school.usNewsRankPrimaryCare,
    }))

    return NextResponse.json({
      success: true,
      count: formattedSchools.length,
      schools: formattedSchools,
    })
  } catch (error) {
    console.error('Schools API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schools' },
      { status: 500 }
    )
  }
}
