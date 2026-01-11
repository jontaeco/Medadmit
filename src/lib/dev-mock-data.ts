/**
 * Mock data for development mode when Supabase is not configured
 */

import type { ApplicantProfile, PredictionResult } from '@/types/database'

export const DEV_MODE = process.env.DEV_SKIP_AUTH === 'true'

// Declare global type for TypeScript
declare global {
  var __mockDataStore: MockDataStore | undefined
}

// Singleton to persist mock data across requests
class MockDataStore {
  private profiles: ApplicantProfile[]
  private predictions: PredictionResult[]

  private constructor() {
    this.profiles = [
      {
        id: 'profile-1',
        user_id: 'dev-user-123',
        profile_name: 'My 2024 Application',
        is_primary: true,
        cumulative_gpa: 3.75,
        science_gpa: 3.68,
        year_gpas: null,
        mcat_total: 515,
        mcat_sections: {
          cpbs: 129,
          cars: 128,
          bbfl: 130,
          psbb: 128,
        },
        clinical_hours: 1200,
        volunteer_hours: 500,
        shadowing_hours: 100,
        research_hours: 800,
        publications: { count: 2 },
        presentations: 3,
        national_scholarships: null,
        military_service: null,
        varsity_athletics: null,
        attended_top_university: true,
        top_university_name: 'UC Berkeley',
        gap_years: 1,
        work_experience_years: 0,
        state_of_residence: 'CA',
        race_ethnicity: ['Asian'],
        sex: null,
        lgbtq: null,
        first_generation: false,
        socioeconomically_disadvantaged: false,
        rural_background: false,
        // WARS-specific fields
        undergraduate_school_tier: 2,
        gpa_trend: 'upward',
        miscellaneous_level: 2,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'profile-2',
        user_id: 'dev-user-123',
        profile_name: 'Conservative Profile',
        is_primary: false,
        cumulative_gpa: 3.65,
        science_gpa: 3.60,
        year_gpas: null,
        mcat_total: 510,
        mcat_sections: null,
        clinical_hours: 800,
        volunteer_hours: 300,
        shadowing_hours: 60,
        research_hours: 400,
        publications: null,
        presentations: 0,
        national_scholarships: null,
        military_service: null,
        varsity_athletics: null,
        attended_top_university: false,
        top_university_name: null,
        gap_years: 0,
        work_experience_years: 0,
        state_of_residence: 'CA',
        race_ethnicity: null,
        sex: null,
        lgbtq: null,
        first_generation: false,
        socioeconomically_disadvantaged: false,
        rural_background: false,
        // WARS-specific fields
        undergraduate_school_tier: 3,
        gpa_trend: 'flat',
        miscellaneous_level: 1,
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    this.predictions = [
      {
        id: 'prediction-1',
        profile_id: 'profile-1',
        user_id: 'dev-user-123',
        model_version: '1.0.0',
        data_sources_version: '2024.1.0',
        input_snapshot: {},
        applicant_score: 782,
        score_breakdown: {
          academic: 480,
          academicDetails: {
            gpa: 240,
            mcat: 240,
            gpaPercentile: 75,
            mcatPercentile: 85,
          },
          experience: 185,
          experienceDetails: {
            clinical: 70,
            research: 65,
            volunteer: 30,
            leadership: 15,
            shadowing: 5,
          },
          demographic: 20,
          penalties: -3,
          percentile: 82,
          tier: 'strong',
        },
        global_acceptance_probability: 0.72,
        global_acceptance_ci_lower: 0.65,
        global_acceptance_ci_upper: 0.78,
        school_results: {
          total: 20,
          reach: [],
          target: [],
          safety: [],
          summary: {
            totalSchools: 20,
            expectedInterviews: 8.5,
            expectedAcceptances: 3.2,
            probabilityOfAtLeastOne: 0.92,
          },
        },
        simulation_results: {
          expectedInterviews: 8.5,
          expectedAcceptances: 3.2,
          probabilityOfAtLeastOneAcceptance: 0.92,
          interviewDistribution: Array.from({ length: 20 }, (_, i) => ({
            count: i,
            probability: i === 8 ? 0.15 : i === 9 ? 0.12 : 0.05,
          })),
          acceptanceDistribution: Array.from({ length: 10 }, (_, i) => ({
            count: i,
            probability: i === 3 ? 0.18 : i === 2 ? 0.15 : i === 4 ? 0.12 : 0.05,
          })),
          probabilityBuckets: {
            noAcceptances: 0.08,
            oneAcceptance: 0.15,
            twoToThree: 0.45,
            fourOrMore: 0.32,
          },
        },
        computed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        compute_time_ms: 1247,
      },
    ]
  }

  public static getInstance(): MockDataStore {
    if (!globalThis.__mockDataStore) {
      console.log('[MockDataStore] Creating new singleton instance')
      globalThis.__mockDataStore = new MockDataStore()
    } else {
      console.log('[MockDataStore] Reusing existing singleton instance')
    }
    return globalThis.__mockDataStore
  }

  public getProfiles(): ApplicantProfile[] {
    return this.profiles
  }

  public getPredictions(): PredictionResult[] {
    return this.predictions
  }

  public addProfile(profile: ApplicantProfile): void {
    this.profiles.push(profile)
    console.log(`[MockDataStore] Added profile ${profile.id}. Total profiles: ${this.profiles.length}`)
  }

  public updateProfile(id: string, updates: Partial<ApplicantProfile>): ApplicantProfile | null {
    const index = this.profiles.findIndex((p) => p.id === id)
    if (index === -1) return null
    this.profiles[index] = { ...this.profiles[index], ...updates }
    return this.profiles[index]
  }

  public deleteProfile(id: string): void {
    const index = this.profiles.findIndex((p) => p.id === id)
    if (index !== -1) {
      this.profiles.splice(index, 1)
    }
  }

  public addPrediction(prediction: PredictionResult): void {
    this.predictions.push(prediction)
  }

  public deletePrediction(id: string): void {
    const index = this.predictions.findIndex((p) => p.id === id)
    if (index !== -1) {
      this.predictions.splice(index, 1)
    }
  }
}

// Export for backward compatibility
export const mockProfiles: ApplicantProfile[] = []
export const mockPredictions: PredictionResult[] = []

// Mock Supabase client for dev mode
export function createMockSupabaseClient() {
  const store = MockDataStore.getInstance()

  // Helper to create chainable query builder
  const createQueryBuilder = (table: string, filters: Record<string, any> = {}) => {
    const builder: any = {
      eq: (column: string, value: any) => {
        return createQueryBuilder(table, { ...filters, [column]: value })
      },
      order: (col: string, opts?: any) => {
        builder.limit = (n: number) => {
          let data: any[] = table === 'applicant_profiles' ? [...store.getProfiles()] : table === 'prediction_results' ? [...store.getPredictions()] : []

          // Apply filters
          Object.entries(filters).forEach(([key, val]) => {
            data = data.filter((item: any) => item[key] === val)
          })

          return Promise.resolve({ data: data.slice(0, n), error: null, count: data.length })
        }
        return builder
      },
      single: () => {
        let data: any[] = table === 'applicant_profiles' ? store.getProfiles() : table === 'prediction_results' ? store.getPredictions() : []
        console.log(`[MockQueryBuilder] single() starting with ${data.length} items for table ${table}`)
        console.log(`[MockQueryBuilder] Profile IDs in store:`, data.map((p: any) => p.id))

        // Apply filters
        Object.entries(filters).forEach(([key, val]) => {
          const beforeCount = data.length
          data = data.filter((item: any) => item[key] === val)
          console.log(`[MockQueryBuilder] After filter ${key}=${val}: ${beforeCount} -> ${data.length} items`)
        })

        const result = data[0] || null
        console.log(`[MockQueryBuilder] single() for table ${table} with filters`, filters, 'found:', result ? result.id : 'null')
        return Promise.resolve({ data: result, error: result ? null : { message: 'Not found' } })
      },
      then: (resolve: any) => {
        let data: any[] = table === 'applicant_profiles' ? store.getProfiles() : table === 'prediction_results' ? store.getPredictions() : []

        // Apply filters
        Object.entries(filters).forEach(([key, val]) => {
          data = data.filter((item: any) => item[key] === val)
        })

        return resolve({ data, error: null, count: data.length })
      },
    }
    return builder
  }

  return {
    from: (table: string) => ({
      select: (columns = '*', opts?: any) => {
        const builder = createQueryBuilder(table)

        // Support for count queries
        if (opts?.count === 'exact' && opts?.head) {
          builder.eq = (column: string, value: any) => {
            let data = table === 'applicant_profiles' ? store.getProfiles() : []
            data = data.filter((item: any) => item[column] === value)
            return Promise.resolve({ data: null, error: null, count: data.length })
          }
        }

        return builder
      },
      // Insert operation
      insert: (data: any) => ({
        select: () => ({
          single: () => {
            const newProfile = {
              ...data,
              id: `profile-${Date.now()}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            console.log(`[MockSupabase] insert() called for table ${table}`, newProfile.id)
            if (table === 'applicant_profiles') {
              store.addProfile(newProfile)
            } else if (table === 'prediction_results') {
              store.addPrediction(newProfile)
            }
            return Promise.resolve({
              data: newProfile,
              error: null,
            })
          },
        }),
      }),
      // Update operation
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            single: () => {
              if (table === 'applicant_profiles') {
                const updated = store.updateProfile(value, data)
                if (updated) {
                  return Promise.resolve({
                    data: updated,
                    error: null,
                  })
                }
              }
              return Promise.resolve({ data: null, error: { message: 'Not found' } })
            },
          }),
        }),
      }),
      // Delete operation
      delete: () => ({
        eq: (column: string, value: any) => {
          if (table === 'applicant_profiles') {
            // Delete profiles matching the filter
            const profiles = store.getProfiles()
            const toDelete = profiles.filter((p: any) => p[column] === value)
            toDelete.forEach((p: any) => {
              if (typeof store.deleteProfile === 'function') {
                store.deleteProfile(p.id)
              } else {
                // Fallback: direct manipulation
                const idx = profiles.findIndex((prof: any) => prof.id === p.id)
                if (idx !== -1) profiles.splice(idx, 1)
              }
            })
            console.log(`[MockSupabase] Deleted ${toDelete.length} profiles where ${column}=${value}`)
          } else if (table === 'prediction_results') {
            // Delete predictions matching the filter
            const predictions = store.getPredictions()
            const toDelete = predictions.filter((p: any) => p[column] === value)
            toDelete.forEach((p: any) => {
              if (typeof store.deletePrediction === 'function') {
                store.deletePrediction(p.id)
              } else {
                // Fallback: direct manipulation
                const idx = predictions.findIndex((pred: any) => pred.id === p.id)
                if (idx !== -1) predictions.splice(idx, 1)
              }
            })
            console.log(`[MockSupabase] Deleted ${toDelete.length} predictions where ${column}=${value}`)
          }
          return Promise.resolve({ error: null })
        },
      }),
    }),
  } as any
}
