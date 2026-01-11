/**
 * Database types for MedAdmit
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          email_verified: boolean
          created_at: string
          updated_at: string
          last_login_at: string | null
          subscription_tier: 'free' | 'premium' | 'professional'
          subscription_expires_at: string | null
        }
        Insert: {
          id?: string
          email: string
          email_verified?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          subscription_tier?: 'free' | 'premium' | 'professional'
          subscription_expires_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          email_verified?: boolean
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          subscription_tier?: 'free' | 'premium' | 'professional'
          subscription_expires_at?: string | null
        }
      }
      applicant_profiles: {
        Row: {
          id: string
          user_id: string
          profile_name: string
          is_primary: boolean
          // Academic Metrics
          cumulative_gpa: number | null
          science_gpa: number | null
          year_gpas: Json | null
          mcat_total: number | null
          mcat_sections: Json | null
          // Experience
          clinical_hours: number
          volunteer_hours: number
          shadowing_hours: number
          research_hours: number
          publications: Json | null
          presentations: number
          // Distinguishing Factors
          national_scholarships: Json | null
          military_service: string | null
          varsity_athletics: string | null
          attended_top_university: boolean
          top_university_name: string | null
          gap_years: number
          work_experience_years: number
          // Demographics
          state_of_residence: string | null
          race_ethnicity: string[] | null
          sex: string | null
          lgbtq: string | null
          first_generation: boolean
          socioeconomically_disadvantaged: boolean
          rural_background: boolean
          // WARS-specific fields
          undergraduate_school_tier: 1 | 2 | 3 | null
          gpa_trend: 'upward' | 'flat' | 'downward' | null
          miscellaneous_level: 1 | 2 | 3 | 4 | null
          // Metadata
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          profile_name: string
          is_primary?: boolean
          cumulative_gpa?: number | null
          science_gpa?: number | null
          year_gpas?: Json | null
          mcat_total?: number | null
          mcat_sections?: Json | null
          clinical_hours?: number
          volunteer_hours?: number
          shadowing_hours?: number
          research_hours?: number
          publications?: Json | null
          presentations?: number
          national_scholarships?: Json | null
          military_service?: string | null
          varsity_athletics?: string | null
          attended_top_university?: boolean
          top_university_name?: string | null
          gap_years?: number
          work_experience_years?: number
          state_of_residence?: string | null
          race_ethnicity?: string[] | null
          sex?: string | null
          lgbtq?: string | null
          first_generation?: boolean
          socioeconomically_disadvantaged?: boolean
          rural_background?: boolean
          undergraduate_school_tier?: 1 | 2 | 3 | null
          gpa_trend?: 'upward' | 'flat' | 'downward' | null
          miscellaneous_level?: 1 | 2 | 3 | 4 | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profile_name?: string
          is_primary?: boolean
          cumulative_gpa?: number | null
          science_gpa?: number | null
          year_gpas?: Json | null
          mcat_total?: number | null
          mcat_sections?: Json | null
          clinical_hours?: number
          volunteer_hours?: number
          shadowing_hours?: number
          research_hours?: number
          publications?: Json | null
          presentations?: number
          national_scholarships?: Json | null
          military_service?: string | null
          varsity_athletics?: string | null
          attended_top_university?: boolean
          top_university_name?: string | null
          gap_years?: number
          work_experience_years?: number
          state_of_residence?: string | null
          race_ethnicity?: string[] | null
          sex?: string | null
          lgbtq?: string | null
          first_generation?: boolean
          socioeconomically_disadvantaged?: boolean
          rural_background?: boolean
          undergraduate_school_tier?: 1 | 2 | 3 | null
          gpa_trend?: 'upward' | 'flat' | 'downward' | null
          miscellaneous_level?: 1 | 2 | 3 | 4 | null
          created_at?: string
          updated_at?: string
        }
      }
      prediction_results: {
        Row: {
          id: string
          profile_id: string | null
          user_id: string
          model_version: string
          data_sources_version: string
          input_snapshot: Json
          applicant_score: number | null
          score_breakdown: Json | null
          global_acceptance_probability: number | null
          global_acceptance_ci_lower: number | null
          global_acceptance_ci_upper: number | null
          school_results: Json | null
          simulation_results: Json | null
          computed_at: string
          compute_time_ms: number | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          user_id: string
          model_version: string
          data_sources_version: string
          input_snapshot: Json
          applicant_score?: number | null
          score_breakdown?: Json | null
          global_acceptance_probability?: number | null
          global_acceptance_ci_lower?: number | null
          global_acceptance_ci_upper?: number | null
          school_results?: Json | null
          simulation_results?: Json | null
          computed_at?: string
          compute_time_ms?: number | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          user_id?: string
          model_version?: string
          data_sources_version?: string
          input_snapshot?: Json
          applicant_score?: number | null
          score_breakdown?: Json | null
          global_acceptance_probability?: number | null
          global_acceptance_ci_lower?: number | null
          global_acceptance_ci_upper?: number | null
          school_results?: Json | null
          simulation_results?: Json | null
          computed_at?: string
          compute_time_ms?: number | null
        }
      }
      schools: {
        Row: {
          id: string
          aamc_id: string | null
          name: string
          short_name: string | null
          state: string | null
          city: string | null
          median_gpa: number | null
          median_mcat: number | null
          gpa_10th_percentile: number | null
          gpa_90th_percentile: number | null
          mcat_10th_percentile: number | null
          mcat_90th_percentile: number | null
          total_applicants: number | null
          total_interviewed: number | null
          total_accepted: number | null
          total_matriculated: number | null
          class_size: number | null
          pct_in_state_matriculants: number | null
          pct_out_of_state_matriculants: number | null
          oos_friendliness: 'friendly' | 'neutral' | 'unfriendly' | 'hostile' | null
          is_public: boolean | null
          has_md_phd: boolean | null
          has_military_program: boolean | null
          interview_format: string | null
          mission_keywords: string[] | null
          tuition_in_state: number | null
          tuition_out_of_state: number | null
          data_source: string | null
          data_retrieved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          aamc_id?: string | null
          name: string
          short_name?: string | null
          state?: string | null
          city?: string | null
          median_gpa?: number | null
          median_mcat?: number | null
          gpa_10th_percentile?: number | null
          gpa_90th_percentile?: number | null
          mcat_10th_percentile?: number | null
          mcat_90th_percentile?: number | null
          total_applicants?: number | null
          total_interviewed?: number | null
          total_accepted?: number | null
          total_matriculated?: number | null
          class_size?: number | null
          pct_in_state_matriculants?: number | null
          pct_out_of_state_matriculants?: number | null
          oos_friendliness?: 'friendly' | 'neutral' | 'unfriendly' | 'hostile' | null
          is_public?: boolean | null
          has_md_phd?: boolean | null
          has_military_program?: boolean | null
          interview_format?: string | null
          mission_keywords?: string[] | null
          tuition_in_state?: number | null
          tuition_out_of_state?: number | null
          data_source?: string | null
          data_retrieved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          aamc_id?: string | null
          name?: string
          short_name?: string | null
          state?: string | null
          city?: string | null
          median_gpa?: number | null
          median_mcat?: number | null
          gpa_10th_percentile?: number | null
          gpa_90th_percentile?: number | null
          mcat_10th_percentile?: number | null
          mcat_90th_percentile?: number | null
          total_applicants?: number | null
          total_interviewed?: number | null
          total_accepted?: number | null
          total_matriculated?: number | null
          class_size?: number | null
          pct_in_state_matriculants?: number | null
          pct_out_of_state_matriculants?: number | null
          oos_friendliness?: 'friendly' | 'neutral' | 'unfriendly' | 'hostile' | null
          is_public?: boolean | null
          has_md_phd?: boolean | null
          has_military_program?: boolean | null
          interview_format?: string | null
          mission_keywords?: string[] | null
          tuition_in_state?: number | null
          tuition_out_of_state?: number | null
          data_source?: string | null
          data_retrieved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      data_sources: {
        Row: {
          id: string
          source_name: string
          source_type: string
          version: string
          url: string | null
          doi: string | null
          retrieval_date: string
          valid_until: string | null
          description: string | null
          citation: string | null
          file_hash: string | null
          raw_data: Json | null
          created_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          source_name: string
          source_type: string
          version: string
          url?: string | null
          doi?: string | null
          retrieval_date: string
          valid_until?: string | null
          description?: string | null
          citation?: string | null
          file_hash?: string | null
          raw_data?: Json | null
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          source_name?: string
          source_type?: string
          version?: string
          url?: string | null
          doi?: string | null
          retrieval_date?: string
          valid_until?: string | null
          description?: string | null
          citation?: string | null
          file_hash?: string | null
          raw_data?: Json | null
          created_at?: string
          is_active?: boolean
        }
      }
      user_outcomes: {
        Row: {
          id: string
          user_id: string
          prediction_id: string | null
          application_cycle_year: number
          schools_applied: number | null
          interviews_received: number | null
          acceptances_received: number | null
          waitlists_received: number | null
          detailed_outcomes: Json | null
          consent_given: boolean
          consent_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prediction_id?: string | null
          application_cycle_year: number
          schools_applied?: number | null
          interviews_received?: number | null
          acceptances_received?: number | null
          waitlists_received?: number | null
          detailed_outcomes?: Json | null
          consent_given?: boolean
          consent_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prediction_id?: string | null
          application_cycle_year?: number
          schools_applied?: number | null
          interviews_received?: number | null
          acceptances_received?: number | null
          waitlists_received?: number | null
          detailed_outcomes?: Json | null
          consent_given?: boolean
          consent_date?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type ApplicantProfile = Database['public']['Tables']['applicant_profiles']['Row']
export type PredictionResult = Database['public']['Tables']['prediction_results']['Row']
export type School = Database['public']['Tables']['schools']['Row']
export type DataSource = Database['public']['Tables']['data_sources']['Row']
export type UserOutcome = Database['public']['Tables']['user_outcomes']['Row']
