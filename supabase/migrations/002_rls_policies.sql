-- MedAdmit Row Level Security Policies
-- Version: 1.0.0

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can only read their own data
CREATE POLICY "Users can view own data"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- New users are created via auth trigger (see below)
CREATE POLICY "Service role can insert users"
    ON users FOR INSERT
    WITH CHECK (true); -- Controlled via service role

-- ============================================================================
-- APPLICANT PROFILES TABLE POLICIES
-- ============================================================================

-- Users can only view their own profiles
CREATE POLICY "Users can view own profiles"
    ON applicant_profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert profiles for themselves
CREATE POLICY "Users can create own profiles"
    ON applicant_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles"
    ON applicant_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profiles
CREATE POLICY "Users can delete own profiles"
    ON applicant_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- PREDICTION RESULTS TABLE POLICIES
-- ============================================================================

-- Users can only view their own predictions
CREATE POLICY "Users can view own predictions"
    ON prediction_results FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert predictions for themselves (via API)
CREATE POLICY "Users can create own predictions"
    ON prediction_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Predictions are immutable (no update policy)
-- Users cannot delete predictions (audit trail)

-- ============================================================================
-- SCHOOLS TABLE POLICIES
-- ============================================================================

-- Schools are public reference data - anyone can read
CREATE POLICY "Schools are publicly readable"
    ON schools FOR SELECT
    USING (true);

-- Only service role can modify schools (admin only)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ============================================================================
-- DATA SOURCES TABLE POLICIES
-- ============================================================================

-- Data sources are public reference data - anyone can read
CREATE POLICY "Data sources are publicly readable"
    ON data_sources FOR SELECT
    USING (true);

-- Only service role can modify data sources (admin only)

-- ============================================================================
-- USER OUTCOMES TABLE POLICIES
-- ============================================================================

-- Users can only view their own outcomes
CREATE POLICY "Users can view own outcomes"
    ON user_outcomes FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert outcomes for themselves
CREATE POLICY "Users can create own outcomes"
    ON user_outcomes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own outcomes
CREATE POLICY "Users can update own outcomes"
    ON user_outcomes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own outcomes
CREATE POLICY "Users can delete own outcomes"
    ON user_outcomes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- MODEL METRICS TABLE POLICIES
-- ============================================================================

-- Model metrics are public reference data - anyone can read
CREATE POLICY "Model metrics are publicly readable"
    ON model_metrics FOR SELECT
    USING (true);

-- Only service role can modify model metrics (admin only)

-- ============================================================================
-- AUTH TRIGGER: Auto-create user record on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, email_verified, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.email_confirmed_at IS NOT NULL,
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- AUTH TRIGGER: Update email_verified on confirmation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        UPDATE public.users
        SET email_verified = TRUE, updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_email_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_email_confirmed();

-- ============================================================================
-- AUTH TRIGGER: Update last_login_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger would need to be on auth.sessions or handled differently
-- depending on Supabase version. For now, we'll update last_login_at in app code.
