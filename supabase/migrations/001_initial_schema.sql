-- MedAdmit Database Schema
-- Version: 1.0.0
-- Description: Initial schema for medical school admissions predictor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'professional')),
    subscription_expires_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- APPLICANT PROFILES TABLE
-- ============================================================================
CREATE TABLE applicant_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_name VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,

    -- Academic Metrics
    cumulative_gpa DECIMAL(3,2) CHECK (cumulative_gpa >= 0 AND cumulative_gpa <= 4.0),
    science_gpa DECIMAL(3,2) CHECK (science_gpa >= 0 AND science_gpa <= 4.0),
    year_gpas JSONB, -- {"year_1": 3.5, "year_2": 3.6, "year_3": 3.7, "year_4": 3.8}
    mcat_total INTEGER CHECK (mcat_total >= 472 AND mcat_total <= 528),
    mcat_sections JSONB, -- {"cars": 127, "cp": 128, "bb": 129, "ps": 127}

    -- Experience
    clinical_hours INTEGER DEFAULT 0 CHECK (clinical_hours >= 0),
    volunteer_hours INTEGER DEFAULT 0 CHECK (volunteer_hours >= 0),
    shadowing_hours INTEGER DEFAULT 0 CHECK (shadowing_hours >= 0),
    research_hours INTEGER DEFAULT 0 CHECK (research_hours >= 0),
    publications JSONB, -- [{"type": "first_author", "count": 1}, {"type": "co_author", "count": 2}]
    presentations INTEGER DEFAULT 0 CHECK (presentations >= 0),

    -- Distinguishing Factors
    national_scholarships JSONB, -- ["goldwater", "fulbright"]
    military_service VARCHAR(50) CHECK (military_service IN ('none', 'rotc', 'active_duty', 'veteran', NULL)),
    varsity_athletics VARCHAR(20) CHECK (varsity_athletics IN ('none', 'club', 'd3', 'd2', 'd1', NULL)),
    attended_top_university BOOLEAN DEFAULT FALSE,
    top_university_name VARCHAR(100),
    gap_years INTEGER DEFAULT 0 CHECK (gap_years >= 0),
    work_experience_years INTEGER DEFAULT 0 CHECK (work_experience_years >= 0),

    -- Demographics
    state_of_residence VARCHAR(2),
    race_ethnicity TEXT[], -- Array of AAMC categories
    sex VARCHAR(20) CHECK (sex IN ('male', 'female', 'non_binary', 'prefer_not_to_say', NULL)),
    lgbtq VARCHAR(30) CHECK (lgbtq IN ('yes', 'no', 'prefer_not_to_say', NULL)),
    first_generation BOOLEAN DEFAULT FALSE,
    socioeconomically_disadvantaged BOOLEAN DEFAULT FALSE,
    rural_background BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_primary_per_user UNIQUE (user_id, is_primary)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_profiles_user ON applicant_profiles(user_id);

-- Function to ensure only one primary profile per user
CREATE OR REPLACE FUNCTION ensure_single_primary_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        UPDATE applicant_profiles
        SET is_primary = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_primary_profile
    BEFORE INSERT OR UPDATE ON applicant_profiles
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_profile();

-- ============================================================================
-- PREDICTION RESULTS TABLE (Immutable Audit Log)
-- ============================================================================
CREATE TABLE prediction_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES applicant_profiles(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Model Version Info
    model_version VARCHAR(20) NOT NULL,
    data_sources_version VARCHAR(20) NOT NULL,

    -- Input Snapshot (frozen at prediction time)
    input_snapshot JSONB NOT NULL,

    -- Global Results
    applicant_score INTEGER CHECK (applicant_score >= 0 AND applicant_score <= 1000),
    score_breakdown JSONB, -- {"gpa_mcat": 650, "experience": 150, "distinguishing": 80}

    global_acceptance_probability DECIMAL(5,4) CHECK (global_acceptance_probability >= 0 AND global_acceptance_probability <= 1),
    global_acceptance_ci_lower DECIMAL(5,4) CHECK (global_acceptance_ci_lower >= 0 AND global_acceptance_ci_lower <= 1),
    global_acceptance_ci_upper DECIMAL(5,4) CHECK (global_acceptance_ci_upper >= 0 AND global_acceptance_ci_upper <= 1),

    -- Per-School Results
    school_results JSONB, -- Array of school-specific predictions

    -- Simulation Results
    simulation_results JSONB, -- Monte Carlo simulation outputs

    -- Audit
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    compute_time_ms INTEGER
);

CREATE INDEX idx_predictions_user ON prediction_results(user_id);
CREATE INDEX idx_predictions_computed ON prediction_results(computed_at);
CREATE INDEX idx_predictions_profile ON prediction_results(profile_id);

-- ============================================================================
-- SCHOOLS TABLE (Reference Data)
-- ============================================================================
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aamc_id VARCHAR(20) UNIQUE,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    state VARCHAR(2),
    city VARCHAR(100),

    -- Admissions Stats
    median_gpa DECIMAL(3,2) CHECK (median_gpa >= 0 AND median_gpa <= 4.0),
    median_mcat INTEGER CHECK (median_mcat >= 472 AND median_mcat <= 528),
    gpa_10th_percentile DECIMAL(3,2),
    gpa_90th_percentile DECIMAL(3,2),
    mcat_10th_percentile INTEGER,
    mcat_90th_percentile INTEGER,

    -- Acceptance Metrics
    total_applicants INTEGER,
    total_interviewed INTEGER,
    total_accepted INTEGER,
    total_matriculated INTEGER,
    class_size INTEGER,

    -- State Preference
    pct_in_state_matriculants DECIMAL(5,2),
    pct_out_of_state_matriculants DECIMAL(5,2),
    oos_friendliness VARCHAR(20) CHECK (oos_friendliness IN ('friendly', 'neutral', 'unfriendly', 'hostile')),

    -- School Characteristics
    is_public BOOLEAN,
    has_md_phd BOOLEAN,
    has_military_program BOOLEAN,
    interview_format VARCHAR(50), -- "mmi", "traditional", "hybrid"
    mission_keywords TEXT[],

    -- Tuition
    tuition_in_state INTEGER,
    tuition_out_of_state INTEGER,

    -- Metadata
    data_source VARCHAR(50),
    data_retrieved_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schools_state ON schools(state);
CREATE INDEX idx_schools_name ON schools(name);

-- ============================================================================
-- DATA SOURCES REGISTRY (Audit Trail)
-- ============================================================================
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- "aamc_table", "msar", "research_paper"
    version VARCHAR(20) NOT NULL,

    url TEXT,
    doi VARCHAR(100),
    retrieval_date DATE NOT NULL,
    valid_until DATE,

    description TEXT,
    citation TEXT,

    file_hash VARCHAR(64), -- SHA-256 of source file
    raw_data JSONB, -- Parsed data

    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(source_name, version)
);

CREATE INDEX idx_data_sources_active ON data_sources(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- USER OUTCOMES TABLE (for calibration)
-- ============================================================================
CREATE TABLE user_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prediction_id UUID REFERENCES prediction_results(id) ON DELETE SET NULL,

    application_cycle_year INTEGER NOT NULL CHECK (application_cycle_year >= 2000 AND application_cycle_year <= 2100),

    -- Aggregated outcomes
    schools_applied INTEGER CHECK (schools_applied >= 0),
    interviews_received INTEGER CHECK (interviews_received >= 0),
    acceptances_received INTEGER CHECK (acceptances_received >= 0),
    waitlists_received INTEGER CHECK (waitlists_received >= 0),

    -- Per-school outcomes (optional detailed)
    detailed_outcomes JSONB, -- [{"school_id": "...", "outcome": "accepted"}, ...]

    -- Consent
    consent_given BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_user ON user_outcomes(user_id);
CREATE INDEX idx_outcomes_cycle ON user_outcomes(application_cycle_year);

-- ============================================================================
-- MODEL METRICS TABLE (for monitoring)
-- ============================================================================
CREATE TABLE model_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_version VARCHAR(20) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- "brier_score", "log_loss", "calibration_error"
    metric_value DECIMAL(10,6) NOT NULL,

    sample_size INTEGER,
    evaluation_period_start DATE,
    evaluation_period_end DATE,

    computed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_metrics_version ON model_metrics(model_version);
CREATE INDEX idx_metrics_type ON model_metrics(metric_type);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON applicant_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
