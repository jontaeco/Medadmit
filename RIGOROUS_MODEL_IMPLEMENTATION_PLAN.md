# MedAdmit: Mathematically Rigorous Model Implementation Plan

**Author**: Claude (Opus 4.5)
**Date**: January 2026
**Version**: 1.0.0

## Executive Summary

This document specifies a complete redesign of the MedAdmit prediction engine, transforming it from a heuristic scoring system into a principled probabilistic model. The design satisfies three constraints:

1. **No microdata required** - All parameters derived from aggregate data + literature priors
2. **Honest uncertainty** - Wide intervals where identification is weak
3. **Extensible architecture** - Can incorporate outcome data later without restructuring

---

## Table of Contents

1. [Mathematical Model Specification](#1-mathematical-model-specification)
2. [Data Architecture](#2-data-architecture)
3. [Parameter Estimation Strategy](#3-parameter-estimation-strategy)
4. [Implementation Phases](#4-implementation-phases)
5. [Validation Framework](#5-validation-framework)
6. [Code Architecture](#6-code-architecture)
7. [Migration Strategy](#7-migration-strategy)
8. [Appendices](#appendices)

---

## 1. Mathematical Model Specification

### 1.1 Overview: Two-Stage Hierarchical Model with Applicant Random Effects

The core model predicts acceptance probability for applicant $i$ at school $s$ through two stages:

$$P(\text{accept}_{i,s}) = P(\text{interview}_{i,s}) \cdot P(\text{accept}_{i,s} \mid \text{interview}_{i,s})$$

Each stage is a hierarchical logistic model with:
- **Latent applicant competitiveness** $C_i$ (outcome-fitted, not hand-scored)
- **School-specific coefficients** with partial pooling
- **Applicant random effect** $u_i$ inducing correlation across schools
- **Structured uncertainty** that propagates to outputs

### 1.2 Stage 1: Interview Probability

$$\text{logit}(P(\text{interview}_{i,s})) = \eta^{(\text{int})}_{i,s}$$

Where the linear predictor is:

$$\eta^{(\text{int})}_{i,s} = \beta^{(\text{int})}_{0,s} + \beta^{(\text{int})}_{C,s} \cdot C_i + \beta^{(\text{int})}_{X,s} \cdot X_i + \gamma^{(\text{int})} \cdot (Z_s \odot X_i) + u^{(\text{file})}_i$$

**Components:**

| Symbol | Description | Dimension |
|--------|-------------|-----------|
| $\beta^{(\text{int})}_{0,s}$ | School intercept (baseline interview rate) | Scalar per school |
| $\beta^{(\text{int})}_{C,s}$ | School-specific slope on competitiveness | Scalar per school |
| $C_i$ | Latent applicant competitiveness | Scalar per applicant |
| $X_i$ | Applicant features (demographics, residency) | Vector |
| $Z_s$ | School features (mission, public/private) | Vector |
| $\gamma^{(\text{int})}$ | Interaction coefficients | Matrix |
| $u^{(\text{file})}_i$ | Applicant "file quality" random effect | Scalar per applicant |

### 1.3 Stage 2: Acceptance Given Interview

$$\text{logit}(P(\text{accept}_{i,s} \mid \text{interview})) = \eta^{(\text{acc})}_{i,s}$$

$$\eta^{(\text{acc})}_{i,s} = \beta^{(\text{acc})}_{0,s} + \beta^{(\text{acc})}_{C,s} \cdot C_i + \beta^{(\text{acc})}_{X,s} \cdot X_i + u^{(\text{interview})}_i$$

**Key difference from Stage 1:**
- Interview-to-acceptance is driven more by $u^{(\text{interview})}_i$ (interview performance latent)
- School slopes $\beta^{(\text{acc})}_{C,s}$ are typically flatter (post-interview, stats matter less)

### 1.4 Latent Competitiveness $C_i$

**Definition:** $C_i$ is NOT a hand-built score. It is the latent variable that, when fed through the model, reproduces observed aggregate acceptance patterns.

**Construction via monotone GAM:**

$$C_i = f_{\text{GPA}}(\text{GPA}_i) + f_{\text{MCAT}}(\text{MCAT}_i) + f_{\text{trend}}(\text{trend}_i) + \epsilon_C$$

Where:
- $f_{\text{GPA}}$, $f_{\text{MCAT}}$ are monotonically increasing spline functions
- Monotonicity is enforced via constrained B-splines (I-splines)
- $\epsilon_C \sim N(0, \sigma_C^2)$ captures noise in academic metrics

**Fitting $C_i$ without microdata:**

We use AAMC Table A-23 as a calibration target:
1. For each GPA/MCAT bin, A-23 gives $P(\text{at least one acceptance} \mid \text{GPA bin}, \text{MCAT bin})$
2. Define: $P(\geq 1) = 1 - \prod_s (1 - P(\text{accept}_{i,s}))$ assuming ~16 average applications
3. Fit $f_{\text{GPA}}, f_{\text{MCAT}}$ such that model-implied $P(\geq 1)$ matches A-23 rates

**Interpretation:**
- $C_i = 0$ corresponds to median accepted applicant (~3.75 GPA, ~512 MCAT)
- $C_i$ is on logit scale; a 1-unit increase corresponds to ~2.7x odds multiplier
- Outputting $C_i$ directly is meaningless to users; instead report **percentile rank**

### 1.5 Experience Modeling: Saturating Functions

**Problem with current approach:** Linear hours → points implies fake resolution.

**Solution:** Piecewise saturating functions with domain-specific thresholds.

For each experience domain $d \in \{\text{clinical}, \text{research}, \text{volunteer}, \text{shadowing}, \text{leadership}\}$:

$$g_d(h) = \alpha_d \cdot (1 - e^{-h / \tau_d})$$

**Parameters:**

| Domain | $\tau_d$ (saturation scale) | $\alpha_d$ (max contribution) | Hard minimum |
|--------|---------------------------|------------------------------|--------------|
| Clinical | 400h | 0.3 logit units | 100h (filter) |
| Research | 500h | 0.25 logit units | None |
| Volunteer | 200h | 0.15 logit units | 50h (soft) |
| Shadowing | 50h | 0.10 logit units | 20h (soft) |
| Leadership | 2 roles | 0.15 logit units | None |

**Research productivity channel (separate from hours):**

$$g_{\text{pubs}}(n, \text{type}) = \begin{cases}
0.15 & \text{if 1st-author peer-reviewed} \\
0.08 & \text{if middle-author or preprint} \\
0.04 & \text{if poster/abstract only} \\
0 & \text{otherwise}
\end{cases}$$

With diminishing returns: 2nd publication adds 50% of 1st, 3rd adds 25%, etc.

**Total experience contribution:**

$$E_i = \sum_d g_d(h_{i,d}) + g_{\text{pubs}}(n_i, \text{type}_i)$$

This enters the model as part of $C_i$ or as a separate term in $\eta_{i,s}$.

### 1.6 Hierarchical School-Specific Coefficients

**Key insight:** We don't have enough data to estimate school-specific demographic effects reliably. Use partial pooling.

**For school intercepts:**

$$\beta_{0,s} \sim N(\mu_{\beta_0} + \delta_{\text{tier}(s)}, \sigma_{\beta_0}^2)$$

Where $\delta_{\text{tier}}$ is a tier-level adjustment (Top/High/Mid/Low).

**For demographic effects (e.g., URM):**

$$\beta_{\text{URM},s} \sim N(\mu_{\text{URM}}, \sigma_{\text{URM}}^2)$$

- $\mu_{\text{URM}}$ is estimated from AAMC aggregate data (e.g., A-18)
- $\sigma_{\text{URM}}$ captures school-to-school variation
- Without school-specific outcome data, we shrink heavily toward $\mu_{\text{URM}}$

**Residency effects:**

$$\beta_{\text{IS},s} \sim N(\mu_{\text{IS}}, \sigma_{\text{IS}}^2) \quad \text{(in-state bonus)}$$

- For public schools: $\mu_{\text{IS}}$ calibrated from MSAR in-state vs OOS acceptance rates
- For private schools: $\mu_{\text{IS}} \approx 0$ (weak regional preference)

### 1.7 Applicant Random Effects (Correlation Structure)

**Problem:** Current Monte Carlo assumes independence. Reality: unmeasured factors (essays, LORs, interview skill) create correlation.

**Solution:** Applicant-level random effects.

$$u^{(\text{file})}_i \sim N(0, \sigma^2_{\text{file}})$$
$$u^{(\text{interview})}_i \sim N(0, \sigma^2_{\text{interview}})$$

**Interpretation:**
- $u^{(\text{file})}_i$ captures "how good is this applicant's written application?" (affects all Stage 1 outcomes)
- $u^{(\text{interview})}_i$ captures "how well does this applicant interview?" (affects all Stage 2 outcomes)
- These are **unobserved** - we integrate over them during inference

**Variance priors (weakly informative):**

$$\sigma_{\text{file}} \sim \text{HalfNormal}(0.5)$$
$$\sigma_{\text{interview}} \sim \text{HalfNormal}(0.7)$$

These values imply:
- 68% of applicants have file quality within ±0.5 logit units of expected
- Which translates to roughly ±12% probability swing at baseline 50%

### 1.8 Mission Fit Interactions

**Problem:** Keyword matching is gameable and imprecise.

**Solution:** Structural feature interactions only.

Define school features $Z_s$:
- `rural_mission`: 1 if school has explicit rural track/program
- `research_intensive`: 1 if NIH funding > median, or MD/PhD program > 10 slots
- `primary_care_focus`: 1 if PC match rate > 40%
- `hbcu`: 1 if historically Black institution
- `public`: 1 if public school

Define applicant features $X_i^{(\text{mission})}$:
- `rural_background`: 1 if applicant from rural area
- `research_strong`: 1 if $g_{\text{research}}(h) > 0.2$
- `urm`: 1 if underrepresented minority
- `in_state`: 1 if applicant state = school state

**Interaction terms:**

$$\gamma \cdot (Z_s \odot X_i) = \gamma_1 \cdot (\text{rural\_mission}_s \times \text{rural\_background}_i) + \gamma_2 \cdot (\text{research\_intensive}_s \times \text{research\_strong}_i) + \ldots$$

**Priors on $\gamma$:**

| Interaction | Prior mean | Prior SD | Rationale |
|-------------|-----------|----------|-----------|
| rural × rural | 0.4 | 0.2 | WWAMI studies |
| research × research | 0.2 | 0.15 | Weak but plausible |
| hbcu × urm_black | 0.5 | 0.25 | Historical mission |
| public × in_state | 0.8 | 0.3 | MSAR data |

### 1.9 Full Model Summary

**Stage 1 (Interview):**
$$\eta^{(\text{int})}_{i,s} = \underbrace{\beta^{(\text{int})}_{0,s}}_{\text{school baseline}} + \underbrace{\beta^{(\text{int})}_{C,s} \cdot C_i}_{\text{competitiveness}} + \underbrace{\beta^{(\text{int})}_{\text{IS},s} \cdot \mathbf{1}[\text{in-state}]}_{\text{residency}} + \underbrace{\beta^{(\text{int})}_{\text{URM},s} \cdot \mathbf{1}[\text{URM}]}_{\text{demographics}} + \underbrace{\sum_k \gamma_k (Z_{s,k} \cdot X_{i,k})}_{\text{mission fit}} + \underbrace{u^{(\text{file})}_i}_{\text{applicant RE}}$$

**Stage 2 (Accept | Interview):**
$$\eta^{(\text{acc})}_{i,s} = \beta^{(\text{acc})}_{0,s} + \beta^{(\text{acc})}_{C,s} \cdot C_i + \beta^{(\text{acc})}_{\text{IS},s} \cdot \mathbf{1}[\text{in-state}] + u^{(\text{interview})}_i$$

**Combined:**
$$P(\text{accept}_{i,s}) = \sigma(\eta^{(\text{int})}_{i,s}) \cdot \sigma(\eta^{(\text{acc})}_{i,s})$$

Where $\sigma(x) = 1 / (1 + e^{-x})$.

---

## 2. Data Architecture

### 2.1 Data Sources and Their Role

| Source | What it provides | How it's used |
|--------|-----------------|---------------|
| AAMC Table A-23 | P(≥1 accept \| GPA bin, MCAT bin) | Calibrate $C_i$ splines |
| AAMC Table A-18 | Demographics × acceptance rates | Prior on $\mu_{\text{URM}}$ |
| MSAR (school-level) | Medians, percentiles, accept rates | School intercepts $\beta_{0,s}$ |
| MSAR (admit funnel) | Interview rate, I→A rate | Stage 1/2 baseline calibration |
| Literature | OR estimates for demographics | Informative priors |
| School websites | Mission statements, programs | Binary mission features $Z_s$ |

### 2.2 Data Schema

**`schools.json`** (enhanced):
```typescript
interface SchoolData {
  id: string;
  name: string;

  // Admission funnel (MSAR)
  totalApplicants: number;
  totalInterviewed: number;
  totalAccepted: number;
  interviewRate: number;        // Stage 1 baseline
  interviewToAcceptRate: number; // Stage 2 baseline

  // Stats distribution
  medianGPA: number;
  medianMCAT: number;
  gpaPercentiles: { p10: number; p25: number; p75: number; p90: number };
  mcatPercentiles: { p10: number; p25: number; p75: number; p90: number };

  // Residency
  pctInState: number;
  inStateInterviewRate: number | null;
  oosInterviewRate: number | null;

  // Mission features (binary)
  missionFeatures: {
    ruralMission: boolean;
    researchIntensive: boolean;
    primaryCareFocus: boolean;
    hbcu: boolean;
    diversityFocus: boolean;
  };

  // Tier (for hierarchical pooling)
  tier: 1 | 2 | 3 | 4;  // Top, High, Mid, Low

  isPublic: boolean;
}
```

**`model_parameters.json`** (precomputed):
```typescript
interface ModelParameters {
  version: string;
  dataSnapshot: string;  // e.g., "2026.1.0"

  // Latent C splines
  competitiveness: {
    gpaSpline: SplineParameters;
    mcatSpline: SplineParameters;
    trendEffect: number;
  };

  // Experience saturation
  experience: {
    clinical: { tau: number; alpha: number; minThreshold: number };
    research: { tau: number; alpha: number };
    volunteer: { tau: number; alpha: number };
    shadowing: { tau: number; alpha: number };
    leadership: { tau: number; alpha: number };
    publications: { firstAuthor: number; middle: number; poster: number; diminishing: number };
  };

  // School-level parameters
  schools: {
    [schoolId: string]: {
      interceptInterview: number;
      interceptAccept: number;
      slopeC_interview: number;
      slopeC_accept: number;
      inStateBonus_interview: number;
      inStateBonus_accept: number;
    };
  };

  // Global parameters
  global: {
    urmEffect: { mean: number; sd: number };
    firstGenEffect: { mean: number; sd: number };
    disadvantagedEffect: { mean: number; sd: number };
    ruralEffect: { mean: number; sd: number };
  };

  // Mission interactions
  missionInteractions: {
    rural_x_rural: { mean: number; sd: number };
    research_x_research: { mean: number; sd: number };
    hbcu_x_urm: { mean: number; sd: number };
    public_x_instate: { mean: number; sd: number };
  };

  // Random effect variances
  randomEffects: {
    fileQuality: { sd: number };
    interviewSkill: { sd: number };
  };
}
```

### 2.3 Spline Parameter Format

For monotone splines, store:
```typescript
interface SplineParameters {
  knots: number[];      // e.g., [2.5, 3.0, 3.3, 3.5, 3.7, 3.8, 3.9, 4.0]
  coefficients: number[]; // I-spline coefficients (all non-negative for monotonicity)
  intercept: number;
}
```

Runtime evaluation:
```typescript
function evaluateMonotoneSpline(x: number, params: SplineParameters): number {
  let result = params.intercept;
  for (let i = 0; i < params.coefficients.length; i++) {
    result += params.coefficients[i] * isplineBasis(x, params.knots, i);
  }
  return result;
}
```

---

## 3. Parameter Estimation Strategy

### 3.1 Philosophy: Calibration Without Microdata

Since we lack applicant-level outcomes, we cannot learn $\beta$ coefficients from data directly. Instead:

1. **Use aggregate constraints** - Ensure model predictions match known marginals
2. **Use informative priors** - Encode literature knowledge
3. **Propagate uncertainty** - Wide posteriors where identification is weak

### 3.2 Calibrating $C_i$ (Competitiveness)

**Target:** AAMC Table A-23 gives 100 cells of $P(\geq 1 \mid \text{GPA bin}, \text{MCAT bin})$.

**Procedure:**

1. Parameterize $f_{\text{GPA}}$ and $f_{\text{MCAT}}$ as monotone I-splines
2. For each GPA/MCAT bin center $(g, m)$:
   - Compute $C = f_{\text{GPA}}(g) + f_{\text{MCAT}}(m)$
   - Compute model-implied $P(\geq 1)$ assuming 16 applications to a representative school mix
   - This is $1 - \prod_s (1 - \sigma(\beta_{0,s} + \beta_{C,s} \cdot C + \ldots))$
3. Minimize squared error between model-implied and observed $P(\geq 1)$

**Regularization:**
- Penalize non-monotonicity (automatically satisfied by I-splines)
- Penalize excessive curvature (smoothness)
- Anchor: $C=0$ at (3.75, 512) ≈ median accepted applicant

**Implementation:** Python + scipy.optimize or PyMC for Bayesian fit.

### 3.3 Calibrating School Intercepts

**Stage 1 intercept ($\beta^{(\text{int})}_{0,s}$):**

From MSAR: $\text{interviewRate}_s = \text{interviewed}_s / \text{applicants}_s$

But this is marginal over all applicant types. For a "typical" applicant ($C=0$, no bonuses):

$$\text{interviewRate}_s \approx \sigma(\beta^{(\text{int})}_{0,s})$$

So:
$$\beta^{(\text{int})}_{0,s} \approx \text{logit}(\text{interviewRate}_s)$$

**Stage 2 intercept ($\beta^{(\text{acc})}_{0,s}$):**

Similarly:
$$\beta^{(\text{acc})}_{0,s} \approx \text{logit}(\text{interviewToAcceptRate}_s)$$

**Adjustments for selection:**
- Interviewed applicants are positively selected on $C$ and $u^{(\text{file})}$
- Apply a correction factor based on assumed selection intensity

### 3.4 Calibrating $\beta_C$ Slopes

**Intuition:** Top schools have steeper dependence on $C$ (stats matter more at Harvard than at lower-tier schools).

**From MSAR percentile data:**
- School $s$ has 10th/25th/50th/75th/90th percentiles for GPA and MCAT
- Map these to $C$ values via splines
- Steeper percentile spread → flatter $\beta_C$ (diverse class)
- Narrow percentile spread → steeper $\beta_C$ (homogeneous on stats)

**Estimation:**
$$\beta_{C,s} \approx k \cdot \frac{1}{\text{IQR}_C(s)}$$

Where $\text{IQR}_C(s)$ is the interquartile range of $C$ among admitted students.

**Partial pooling:**
$$\beta_{C,s} \sim N(\mu_{\beta_C} + \delta_{\text{tier}(s)}, \sigma_{\beta_C}^2)$$

With tier adjustments: Top schools get higher $\mu$, low-tier schools get lower $\mu$.

### 3.5 Calibrating Demographic Effects

**URM effect:**

From AAMC Table A-18 and literature:
- Black applicants: OR ≈ 4.5-5.5 relative to White (controlling for stats)
- Hispanic applicants: OR ≈ 3.0-4.0
- These are national averages; school-specific variation is large

**Prior specification:**
$$\mu_{\text{URM,Black}} \sim N(\log(5.0), 0.3^2) \approx N(1.61, 0.09)$$
$$\mu_{\text{URM,Hispanic}} \sim N(\log(3.5), 0.3^2) \approx N(1.25, 0.09)$$

**School-specific effects:**
$$\beta_{\text{URM},s} \sim N(\mu_{\text{URM}}, \sigma^2_{\text{URM}})$$

Without school-level outcome data, $\sigma_{\text{URM}}$ controls shrinkage:
- Larger $\sigma_{\text{URM}}$ → wider uncertainty per school
- Set $\sigma_{\text{URM}} \approx 0.4$ (implies schools could vary by factor of ~1.5 either direction)

### 3.6 Calibrating In-State Effects

**For public schools:**

MSAR provides:
- In-state interview rate (or can be computed from pct in-state interviewed / pct in-state applicants)
- OOS interview rate

$$\beta_{\text{IS},s} = \text{logit}(\text{IS rate}) - \text{logit}(\text{OOS rate})$$

**For private schools:**
- Small regional preference: $\beta_{\text{IS},s} \sim N(0.1, 0.1^2)$

### 3.7 Estimating Random Effect Variances

Without microdata, we cannot estimate $\sigma_{\text{file}}$ and $\sigma_{\text{interview}}$ from outcomes. Use:

**Literature-based prior:**
- $\sigma_{\text{file}} \sim \text{HalfNormal}(0.5)$ implies ~60% of variation in interview rate explained by $C$
- $\sigma_{\text{interview}} \sim \text{HalfNormal}(0.7)$ implies interview skill matters more than file

**Calibration check:**
- Simulate cycles with various $\sigma$ values
- Compare variance of simulated outcomes to observed variance in aggregate statistics
- Adjust $\sigma$ to match "all-or-nothing" cycle frequency

### 3.8 Parameter Estimation Pipeline (Python)

```python
# estimate_parameters.py (pseudocode structure)

import pymc as pm
import numpy as np
from scipy.interpolate import BSpline

def fit_competitiveness_splines(a23_data: dict) -> dict:
    """
    Fit monotone splines to match A-23 acceptance rates.
    """
    # Define I-spline basis
    gpa_knots = [2.5, 3.0, 3.3, 3.5, 3.7, 3.8, 3.9, 4.0]
    mcat_knots = [490, 500, 505, 510, 515, 518, 521, 528]

    with pm.Model() as model:
        # Monotone spline coefficients (non-negative)
        gpa_coefs = pm.HalfNormal('gpa_coefs', sigma=1.0, shape=len(gpa_knots))
        mcat_coefs = pm.HalfNormal('mcat_coefs', sigma=1.0, shape=len(mcat_knots))

        # For each A-23 cell, compute predicted P(>=1)
        for (gpa_bin, mcat_bin), observed_rate in a23_data.items():
            gpa_center = bin_center(gpa_bin)
            mcat_center = bin_center(mcat_bin)

            C = evaluate_ispline(gpa_center, gpa_knots, gpa_coefs) + \
                evaluate_ispline(mcat_center, mcat_knots, mcat_coefs)

            # Predicted P(>=1) for typical school list
            predicted = compute_p_at_least_one(C, school_params)

            # Likelihood
            pm.Normal(f'obs_{gpa_bin}_{mcat_bin}',
                     mu=predicted, sigma=0.03,  # ~3% observation noise
                     observed=observed_rate)

        trace = pm.sample(2000, tune=1000)

    return extract_spline_params(trace)

def calibrate_school_params(msar_data: list, C_splines: dict) -> dict:
    """
    Calibrate school-specific intercepts and slopes.
    """
    school_params = {}

    for school in msar_data:
        # Stage 1 intercept from interview rate
        int_rate = school['totalInterviewed'] / school['totalApplicants']
        beta_0_int = logit(int_rate)

        # Stage 2 intercept from I->A rate
        ia_rate = school['totalAccepted'] / school['totalInterviewed']
        beta_0_acc = logit(ia_rate)

        # Slope from percentile spread
        C_25 = compute_C(school['gpa25'], school['mcat25'], C_splines)
        C_75 = compute_C(school['gpa75'], school['mcat75'], C_splines)
        iqr_C = C_75 - C_25

        beta_C = estimate_slope_from_iqr(iqr_C, school['tier'])

        # In-state bonus
        if school['isPublic'] and school['inStateInterviewRate']:
            beta_IS = logit(school['inStateInterviewRate']) - logit(school['oosInterviewRate'])
        else:
            beta_IS = 0.1  # Small regional preference for privates

        school_params[school['id']] = {
            'interceptInterview': beta_0_int,
            'interceptAccept': beta_0_acc,
            'slopeC_interview': beta_C,
            'slopeC_accept': beta_C * 0.5,  # Flatter post-interview
            'inStateBonus_interview': beta_IS,
            'inStateBonus_accept': beta_IS * 0.3,  # Smaller post-interview
        }

    return school_params
```

---

## 4. Implementation Phases

### Phase 1: Data Infrastructure (Week 1-2)

**Objectives:**
- Clean and structure all data sources
- Create versioned data pipeline
- Establish schema for model parameters

**Deliverables:**
1. `data/aamc/table-a23-processed.json` - Cleaned A-23 with bin centers
2. `data/aamc/table-a18-processed.json` - Demographics with ORs
3. `data/schools/md-schools-enhanced.json` - MSAR + mission features
4. `data/model/parameters-schema.ts` - TypeScript schema
5. `scripts/validate-data.ts` - Data integrity checks

**Tasks:**
- [ ] Add missing MSAR fields (interview rate, I→A rate) to schools data
- [ ] Manually code mission features for all ~155 schools
- [ ] Create data versioning system (snapshot ID)
- [ ] Write data validation tests

### Phase 2: Competitiveness Spline Fitting (Week 2-3)

**Objectives:**
- Implement monotone I-spline fitting in Python
- Calibrate to A-23 acceptance rates
- Export spline parameters to JSON

**Deliverables:**
1. `python/spline_fitting.py` - I-spline implementation
2. `python/calibrate_C.py` - A-23 calibration script
3. `data/model/competitiveness-splines-v1.json` - Fitted parameters
4. Validation plots showing fit quality

**Tasks:**
- [ ] Implement I-spline basis functions
- [ ] Write A-23 likelihood function
- [ ] Add smoothness regularization
- [ ] Fit with scipy.optimize or PyMC
- [ ] Validate monotonicity and smoothness
- [ ] Generate calibration diagnostic plots

### Phase 3: School Parameter Calibration (Week 3-4)

**Objectives:**
- Estimate school-specific intercepts and slopes
- Implement partial pooling by tier
- Calibrate in-state effects

**Deliverables:**
1. `python/calibrate_schools.py` - School calibration script
2. `data/model/school-parameters-v1.json` - Per-school params
3. Validation: predicted vs observed interview/accept rates

**Tasks:**
- [ ] Compute intercepts from MSAR rates
- [ ] Estimate slopes from percentile IQRs
- [ ] Apply tier-based shrinkage
- [ ] Calibrate in-state effects from MSAR
- [ ] Handle missing data with hierarchical defaults
- [ ] Validate against known school selectivity patterns

### Phase 4: Experience Saturation Functions (Week 4)

**Objectives:**
- Replace linear hour buckets with saturating functions
- Implement research productivity channel

**Deliverables:**
1. `src/lib/scoring/experience-model.ts` - New experience functions
2. `data/model/experience-parameters.json` - τ, α values
3. Tests verifying saturation behavior

**Tasks:**
- [ ] Implement $g(h) = \alpha(1 - e^{-h/\tau})$ for each domain
- [ ] Calibrate τ from literature (AAMC "typical" applicant hours)
- [ ] Implement publication diminishing returns
- [ ] Add minimum threshold handling (soft penalties)
- [ ] Write comprehensive unit tests

### Phase 5: Demographic and Mission Effects (Week 5)

**Objectives:**
- Replace global OR multipliers with hierarchical effects
- Implement mission fit interactions

**Deliverables:**
1. `python/calibrate_demographics.py` - Demographic prior fitting
2. `data/model/demographic-parameters-v1.json` - Effect parameters
3. `src/lib/scoring/mission-interactions.ts` - Interaction logic

**Tasks:**
- [ ] Encode literature ORs as informative priors
- [ ] Set school-level variance hyperparameters
- [ ] Implement binary mission feature extraction
- [ ] Code interaction terms (rural×rural, etc.)
- [ ] Validate interaction magnitudes against intuition

### Phase 6: Two-Stage Probability Model (Week 6)

**Objectives:**
- Replace multiplier stacking with additive logit model
- Implement two-stage (interview, accept|interview) structure

**Deliverables:**
1. `src/lib/scoring/two-stage-model.ts` - New probability calculator
2. Tests comparing old vs new model outputs
3. Documentation of model equations

**Tasks:**
- [ ] Implement Stage 1 (interview) linear predictor
- [ ] Implement Stage 2 (accept|interview) linear predictor
- [ ] Combine stages: $P = P_{int} \times P_{acc|int}$
- [ ] Handle missing interview rate data (fallback to combined)
- [ ] Validate against current model (sanity check)

### Phase 7: Applicant Random Effects (Week 7)

**Objectives:**
- Add applicant-level random effects
- Implement correlated Monte Carlo simulation

**Deliverables:**
1. `src/lib/scoring/monte-carlo-correlated.ts` - New MC simulator
2. Validation: all-or-nothing cycle frequency analysis
3. Performance benchmarks

**Tasks:**
- [ ] Sample $u^{(\text{file})}$ per applicant per simulation
- [ ] Sample $u^{(\text{interview})}$ per applicant per simulation
- [ ] Apply random effects to all school predictions
- [ ] Validate correlation structure (same applicant across schools)
- [ ] Tune $\sigma$ values for realistic cycle variance
- [ ] Optimize for performance (still need 10k iterations)

### Phase 8: Uncertainty Quantification (Week 8)

**Objectives:**
- Propagate parameter uncertainty to outputs
- Generate credible intervals for all predictions

**Deliverables:**
1. `src/lib/scoring/uncertainty.ts` - Uncertainty propagation
2. Updated UI components showing intervals
3. Documentation of interval interpretation

**Tasks:**
- [ ] Store parameter posterior samples (or summary stats)
- [ ] Implement parametric bootstrap for predictions
- [ ] Compute 80% credible intervals per school
- [ ] Compute list-level P(≥1) intervals
- [ ] Implement distribution buckets (0/1/2-3/4+)
- [ ] Update UI to display intervals cleanly

### Phase 9: Validation and Calibration Checks (Week 9)

**Objectives:**
- Comprehensive validation without microdata
- Calibration diagnostics
- Edge case testing

**Deliverables:**
1. `tests/integration/calibration.test.ts` - Calibration tests
2. `scripts/generate-validation-report.ts` - Validation report generator
3. Written validation methodology document

**Tasks:**
- [ ] Check A-23 reproduction accuracy
- [ ] Check school-level rate reproduction
- [ ] Verify demographic effect magnitudes
- [ ] Test extreme applicants (3.0/490 vs 4.0/528)
- [ ] Test edge cases (no research, 0 clinical hours, etc.)
- [ ] Manual review of top/bottom school predictions

### Phase 10: Migration and Cleanup (Week 10)

**Objectives:**
- Migrate all consumers to new model
- Deprecate old scoring system
- Final polish

**Deliverables:**
1. Migration guide for existing code
2. Deprecated old files moved to `_legacy/`
3. Updated API documentation
4. Performance optimization

**Tasks:**
- [ ] Update all API routes to use new model
- [ ] Update UI components for new output format
- [ ] Remove/deprecate old scoring functions
- [ ] Performance profiling and optimization
- [ ] Final code review
- [ ] Update CLAUDE.md with new architecture

---

## 5. Validation Framework

### 5.1 Validation Without Ground Truth

Since we lack applicant-level outcomes, validation relies on:

1. **Internal consistency** - Model reproduces calibration targets
2. **Sensitivity analysis** - Outputs respond appropriately to input changes
3. **Expert review** - Predictions match domain expert expectations
4. **Aggregate constraint satisfaction** - Model respects known marginals

### 5.2 Calibration Metrics

**A-23 Reproduction:**
- For each GPA/MCAT bin, compare model-implied P(≥1) to observed
- Metric: RMSE across all 100 bins
- Target: RMSE < 0.03 (3 percentage points)

**School-Level Rate Reproduction:**
- Compare predicted interview rate (for average applicant) to MSAR
- Compare predicted I→A rate to MSAR
- Metric: Correlation and mean absolute error
- Target: r > 0.9, MAE < 0.05

**Demographic Effect Validation:**
- Compute model-implied acceptance rates by race/ethnicity
- Compare to A-18 observed rates
- Should be within confidence interval of literature ORs

### 5.3 Sensitivity Analysis Tests

**Monotonicity:**
- Higher GPA → higher probability (holding all else fixed)
- Higher MCAT → higher probability
- More clinical hours → higher probability (with saturation)
- In-state → higher probability at public schools

**Reasonable Ranges:**
- No school probability > 0.80 (except in-state public for stellar applicant)
- No school probability < 0.005
- P(≥1) for 3.8/520 applicant with 20 schools should be > 0.85
- P(≥1) for 3.2/505 applicant with 20 schools should be < 0.50

**Tier Ordering:**
- E[P(accept)] at Harvard < E[P(accept)] at mid-tier < E[P(accept)] at low-tier
- This should hold for any fixed applicant

### 5.4 Edge Case Tests

```typescript
// Test cases to verify
const edgeCases = [
  { gpa: 4.0, mcat: 528, clinical: 2000, research: 1500, pubs: 3 }, // Perfect applicant
  { gpa: 3.0, mcat: 500, clinical: 100, research: 0, pubs: 0 },     // Weak applicant
  { gpa: 3.7, mcat: 515, clinical: 0, research: 0, pubs: 0 },       // Stats-only
  { gpa: 3.2, mcat: 500, clinical: 3000, research: 2000, pubs: 5 }, // Experience-heavy
  { gpa: 3.8, mcat: 520, urm: true },                               // URM boost test
  { gpa: 3.8, mcat: 520, inState: 'TX', school: 'UTSW' },          // In-state test
];
```

### 5.5 Validation Report Structure

```markdown
# Model Validation Report v{version}

## Calibration Fit
- A-23 RMSE: X.XX
- School interview rate correlation: X.XX
- School I→A rate correlation: X.XX

## Demographic Effects
- Black OR: X.X (target: 4.5-5.5)
- Hispanic OR: X.X (target: 3.0-4.0)

## Sensitivity Checks
- [✓] Monotonicity: GPA
- [✓] Monotonicity: MCAT
- [✓] Tier ordering
- [✓] In-state effects

## Edge Cases
- Perfect applicant P(≥1): XX%
- Weak applicant P(≥1): XX%

## Reviewer Sign-off
- [ ] Domain expert review
- [ ] Statistical review
```

---

## 6. Code Architecture

### 6.1 Directory Structure

```
medadmit/
├── data/
│   ├── aamc/
│   │   ├── table-a23.json
│   │   └── table-a18.json
│   ├── schools/
│   │   └── md-schools.json
│   └── model/
│       ├── parameters-v2026.1.0.json      # Precomputed model params
│       ├── competitiveness-splines.json
│       ├── school-parameters.json
│       └── schema.ts                       # TypeScript types
│
├── python/                                 # Offline fitting
│   ├── requirements.txt
│   ├── spline_fitting.py
│   ├── calibrate_C.py
│   ├── calibrate_schools.py
│   ├── calibrate_demographics.py
│   ├── export_parameters.py
│   └── tests/
│       └── test_calibration.py
│
├── src/
│   ├── lib/
│   │   ├── model/                          # NEW: Core model
│   │   │   ├── index.ts
│   │   │   ├── types.ts                    # ModelParameters, etc.
│   │   │   ├── competitiveness.ts          # C_i calculation
│   │   │   ├── experience.ts               # Saturating functions
│   │   │   ├── two-stage.ts                # P(int), P(acc|int)
│   │   │   ├── demographics.ts             # Demographic effects
│   │   │   ├── mission.ts                  # Mission interactions
│   │   │   ├── monte-carlo.ts              # Correlated MC
│   │   │   └── uncertainty.ts              # Interval calculation
│   │   │
│   │   ├── scoring/                        # OLD: Deprecated
│   │   │   └── _legacy/                    # Move old code here
│   │   │
│   │   └── data/
│   │       ├── index.ts
│   │       ├── parameters.ts               # Load model params
│   │       └── schools.ts
│   │
│   ├── app/
│   │   └── api/
│   │       └── predict/
│   │           └── route.ts                # Updated to use new model
│   │
│   └── types/
│       └── model.ts                        # Model-specific types
│
├── tests/
│   ├── model/
│   │   ├── competitiveness.test.ts
│   │   ├── experience.test.ts
│   │   ├── two-stage.test.ts
│   │   └── monte-carlo.test.ts
│   └── integration/
│       └── calibration.test.ts
│
└── scripts/
    ├── regenerate-parameters.sh            # Run Python pipeline
    ├── validate-model.ts
    └── generate-validation-report.ts
```

### 6.2 Core Module: `src/lib/model/`

**`types.ts`:**
```typescript
export interface ModelParameters {
  version: string;
  dataSnapshot: string;
  competitiveness: CompetitivenessParams;
  experience: ExperienceParams;
  schools: Record<string, SchoolParams>;
  demographics: DemographicParams;
  missionInteractions: MissionInteractionParams;
  randomEffects: RandomEffectParams;
}

export interface ApplicantProfile {
  gpa: number;
  mcat: number;
  gpaTrend: 'upward' | 'flat' | 'downward';

  clinicalHours: number;
  researchHours: number;
  volunteerHours: number;
  shadowingHours: number;
  leadershipCount: number;
  publications: { firstAuthor: number; other: number; posters: number };

  stateOfResidence: string;
  raceEthnicity: string | null;
  isUrm: boolean;
  isFirstGen: boolean;
  isDisadvantaged: boolean;
  isRural: boolean;
}

export interface PredictionResult {
  // Per-school
  schools: SchoolPrediction[];

  // List-level
  listMetrics: {
    expectedInterviews: { mean: number; ci80: [number, number] };
    expectedAcceptances: { mean: number; ci80: [number, number] };
    pAtLeastOne: { mean: number; ci80: [number, number] };
    distributionBuckets: { zero: number; one: number; twoThree: number; fourPlus: number };
  };

  // Applicant-level
  competitiveness: {
    C: number;
    percentile: number;
  };

  // Metadata
  modelVersion: string;
  computedAt: string;
}

export interface SchoolPrediction {
  schoolId: string;
  schoolName: string;

  // Two-stage probabilities
  pInterview: { mean: number; ci80: [number, number] };
  pAcceptGivenInterview: { mean: number; ci80: [number, number] };
  pAccept: { mean: number; ci80: [number, number] };

  category: 'reach' | 'target' | 'safety';

  // Breakdown
  factors: {
    baseline: number;
    competitivenessEffect: number;
    residencyEffect: number;
    demographicEffect: number;
    missionFitEffect: number;
  };
}
```

**`competitiveness.ts`:**
```typescript
import { ModelParameters, ApplicantProfile } from './types';
import { evaluateMonotoneSpline } from './spline-utils';

export function calculateCompetitiveness(
  applicant: ApplicantProfile,
  params: ModelParameters
): { C: number; percentile: number } {
  const { competitiveness: cp } = params;

  // Academic contribution
  const gpaContrib = evaluateMonotoneSpline(applicant.gpa, cp.gpaSpline);
  const mcatContrib = evaluateMonotoneSpline(applicant.mcat, cp.mcatSpline);
  const trendContrib = applicant.gpaTrend === 'upward' ? cp.trendEffect : 0;

  // Experience contribution
  const expContrib = calculateExperienceContribution(applicant, params.experience);

  // Total C
  const C = gpaContrib + mcatContrib + trendContrib + expContrib;

  // Convert to percentile (precomputed CDF)
  const percentile = cdfToPercentile(C, cp.cdfTable);

  return { C, percentile };
}
```

**`two-stage.ts`:**
```typescript
import { ModelParameters, ApplicantProfile, SchoolPrediction } from './types';

export function calculateSchoolProbability(
  applicant: ApplicantProfile,
  schoolId: string,
  C: number,
  params: ModelParameters
): SchoolPrediction {
  const sp = params.schools[schoolId];
  const school = getSchoolData(schoolId);

  // Stage 1: Interview
  let eta_int = sp.interceptInterview;
  eta_int += sp.slopeC_interview * C;

  // Residency effect
  const isInState = applicant.stateOfResidence === school.state;
  if (isInState) {
    eta_int += sp.inStateBonus_interview;
  }

  // Demographic effects
  if (applicant.isUrm) {
    eta_int += params.demographics.urmEffect.mean;
  }
  // ... other demographics

  // Mission interactions
  if (school.missionFeatures.ruralMission && applicant.isRural) {
    eta_int += params.missionInteractions.rural_x_rural.mean;
  }
  // ... other interactions

  const pInterview = sigmoid(eta_int);

  // Stage 2: Accept | Interview
  let eta_acc = sp.interceptAccept;
  eta_acc += sp.slopeC_accept * C;
  if (isInState) {
    eta_acc += sp.inStateBonus_accept;
  }

  const pAcceptGivenInterview = sigmoid(eta_acc);

  // Combined
  const pAccept = pInterview * pAcceptGivenInterview;

  // Calculate uncertainty (parametric bootstrap)
  const { ci80_int, ci80_acc, ci80_combined } = calculateIntervals(
    applicant, schoolId, C, params
  );

  return {
    schoolId,
    schoolName: school.name,
    pInterview: { mean: pInterview, ci80: ci80_int },
    pAcceptGivenInterview: { mean: pAcceptGivenInterview, ci80: ci80_acc },
    pAccept: { mean: pAccept, ci80: ci80_combined },
    category: categorizeSchool(pAccept, school),
    factors: {
      baseline: sigmoid(sp.interceptInterview) * sigmoid(sp.interceptAccept),
      competitivenessEffect: sp.slopeC_interview * C + sp.slopeC_accept * C,
      residencyEffect: isInState ? sp.inStateBonus_interview + sp.inStateBonus_accept : 0,
      demographicEffect: applicant.isUrm ? params.demographics.urmEffect.mean : 0,
      missionFitEffect: calculateMissionEffect(applicant, school, params),
    },
  };
}
```

**`monte-carlo.ts`:**
```typescript
export function runCorrelatedSimulation(
  schoolPredictions: SchoolPrediction[],
  params: ModelParameters,
  config: { iterations: number }
): SimulationResult {
  const { iterations } = config;
  const { randomEffects } = params;

  const results: SimulationIterationResult[] = [];

  for (let i = 0; i < iterations; i++) {
    // Sample applicant random effects (ONCE per iteration, shared across schools)
    const u_file = sampleNormal(0, randomEffects.fileQuality.sd);
    const u_interview = sampleNormal(0, randomEffects.interviewSkill.sd);

    let interviews = 0;
    let acceptances = 0;
    const schoolResults: { schoolId: string; interviewed: boolean; accepted: boolean }[] = [];

    for (const sp of schoolPredictions) {
      // Adjust probabilities with random effects
      const adjustedPInt = adjustProbability(sp.pInterview.mean, u_file);
      const adjustedPAcc = adjustProbability(sp.pAcceptGivenInterview.mean, u_interview);

      // Simulate
      const interviewed = Math.random() < adjustedPInt;
      let accepted = false;

      if (interviewed) {
        interviews++;
        accepted = Math.random() < adjustedPAcc;
        if (accepted) acceptances++;
      }

      schoolResults.push({ schoolId: sp.schoolId, interviewed, accepted });
    }

    results.push({ interviews, acceptances, schoolResults });
  }

  return aggregateResults(results, iterations);
}

function adjustProbability(baseProbability: number, randomEffect: number): number {
  // Convert to logit, add RE, convert back
  const logit = Math.log(baseProbability / (1 - baseProbability));
  const adjustedLogit = logit + randomEffect;
  return 1 / (1 + Math.exp(-adjustedLogit));
}
```

### 6.3 Parameter Loading

**`src/lib/data/parameters.ts`:**
```typescript
import parametersJson from '../../../data/model/parameters-v2026.1.0.json';
import { ModelParameters } from '../model/types';

let cachedParams: ModelParameters | null = null;

export function getModelParameters(): ModelParameters {
  if (!cachedParams) {
    cachedParams = parametersJson as ModelParameters;
    validateParameters(cachedParams);
  }
  return cachedParams;
}

function validateParameters(params: ModelParameters): void {
  // Check version
  if (!params.version) throw new Error('Missing model version');

  // Check required schools
  const schoolCount = Object.keys(params.schools).length;
  if (schoolCount < 150) {
    throw new Error(`Only ${schoolCount} schools in parameters, expected ~155`);
  }

  // Check spline validity
  if (params.competitiveness.gpaSpline.knots.length < 5) {
    throw new Error('GPA spline has too few knots');
  }

  // ... more validation
}
```

---

## 7. Migration Strategy

### 7.1 Parallel Running Period

During development, run both old and new models:

```typescript
// In API route
export async function POST(request: Request) {
  const input = await request.json();

  // Run both models
  const oldResult = generatePrediction_legacy(input);
  const newResult = generatePrediction_v2(input);

  // Log comparison for debugging
  logModelComparison(input, oldResult, newResult);

  // Return old model by default, new model if flag set
  const useNewModel = request.headers.get('X-Use-New-Model') === 'true';
  return Response.json(useNewModel ? newResult : oldResult);
}
```

### 7.2 Gradual Rollout

1. **Week 1-2:** Internal testing only
2. **Week 3:** 10% of requests use new model (A/B test)
3. **Week 4:** 50% of requests
4. **Week 5:** 100% new model, old model deprecated

### 7.3 Breaking Changes

**Output format changes:**
- `probability` → `pAccept.mean`
- `probabilityLower/Upper` → `pAccept.ci80[0]/[1]`
- New: `pInterview`, `pAcceptGivenInterview`
- `factors` structure changed

**Update all consumers:**
- Results display components
- School list generation
- Monte Carlo visualization
- API response handlers

---

## Appendices

### A. I-Spline Basis Functions

I-splines (integrated B-splines) are monotonically increasing basis functions. For monotone regression:

$$f(x) = \sum_{j=1}^{k} \beta_j I_j(x), \quad \beta_j \geq 0$$

Where $I_j(x)$ is the $j$-th I-spline basis evaluated at $x$.

**Python implementation:**
```python
from scipy.interpolate import BSpline
import numpy as np

def ispline_basis(x, knots, degree=3):
    """Compute I-spline basis matrix."""
    n_basis = len(knots) + degree - 1
    bspline_basis = BSpline.design_matrix(x, knots, degree)

    # I-spline is cumulative sum of B-spline
    ispline_basis = np.cumsum(bspline_basis, axis=1)
    return ispline_basis
```

### B. Literature Sources for Priors

| Effect | OR Estimate | Source |
|--------|-------------|--------|
| Black applicants | 4.5-5.5 | BMC Med Ed 2023, AAMC A-18 |
| Hispanic applicants | 3.0-4.0 | BMC Med Ed 2023, AAMC A-18 |
| First-generation | 1.1-1.2 | Holistic review literature |
| Disadvantaged SES | 1.2-1.3 | Holistic review literature |
| Rural background | 1.2-1.4 | WWAMI program studies |

### C. Computational Complexity

**Per-applicant prediction:**
- Spline evaluation: O(k) where k = number of knots
- Per-school calculation: O(1)
- Total for N schools: O(N)

**Monte Carlo simulation:**
- Per iteration: O(N)
- Total for M iterations: O(M × N)
- With M=10,000 and N=30 schools: ~300,000 operations
- Runtime: <100ms in TypeScript

### D. Glossary

| Term | Definition |
|------|------------|
| $C_i$ | Latent competitiveness for applicant $i$ |
| $\beta_{0,s}$ | School $s$ intercept (baseline log-odds) |
| $\beta_{C,s}$ | School $s$ slope on competitiveness |
| $u^{(\text{file})}_i$ | Applicant $i$ file quality random effect |
| $u^{(\text{interview})}_i$ | Applicant $i$ interview skill random effect |
| Partial pooling | Shrinking school-specific estimates toward global mean |
| I-spline | Monotonically increasing spline basis |
| Credible interval | Bayesian analog of confidence interval |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial comprehensive plan |

---

*This document is the authoritative specification for the MedAdmit v2 model architecture. All implementation should reference this document.*
