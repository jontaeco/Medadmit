# UI Update Plan: New Model Integration

## Overview

This plan outlines the comprehensive UI update to showcase all features of the v2.0 rigorous probabilistic model, removing legacy elements and updating the methodology page.

---

## Phase 1: API Response Format Update

### 1.1 Create New Native API Response Types

**File:** `src/lib/model/api-types.ts`

```typescript
interface NativePredictionResponse {
  // Competitiveness
  competitiveness: {
    C: number;                    // -3 to +3 scale
    percentile: number;           // 0-100
    classification: string;       // 'very_low' to 'very_high'
    breakdown: {
      gpaContribution: number;
      mcatContribution: number;
    };
  };

  // Experience Analysis
  experience: {
    totalContribution: number;    // logit units
    domains: {
      clinical: { hours: number; contribution: number; saturationPct: number };
      research: { hours: number; contribution: number; saturationPct: number };
      volunteer: { hours: number; contribution: number; saturationPct: number };
      shadowing: { hours: number; contribution: number; saturationPct: number };
      leadership: { count: number; contribution: number; saturationPct: number };
      publications: { count: number; contribution: number };
    };
    thresholdsMet: { clinical: boolean; overall: boolean };
  };

  // Demographic Effects
  demographics: {
    totalEffect: number;          // logit units
    breakdown: {
      raceEthnicity: number;
      firstGen: number;
      disadvantaged: number;
      rural: number;
    };
  };

  // School Predictions (Two-Stage)
  schools: Array<{
    id: string;
    name: string;
    state: string;
    tier: number;
    isPublic: boolean;

    // Two-stage probabilities
    pInterview: { mean: number; ci80: [number, number] };
    pAcceptGivenInterview: { mean: number; ci80: [number, number] };
    pAccept: { mean: number; ci80: [number, number] };

    category: 'reach' | 'target' | 'likely' | 'safety';

    // Factor breakdown
    factors: {
      competitivenessEffect: number;
      inStateBonus: number;
      demographicEffect: number;
      missionFitEffect: number;
    };

    isInState: boolean;
    missionAlignment: string[];
  }>;

  // List-Level Metrics
  listMetrics: {
    expectedInterviews: { mean: number; ci80: [number, number] };
    expectedAcceptances: { mean: number; ci80: [number, number] };
    pAtLeastOne: { mean: number; ci80: [number, number] };
    distributionBuckets: {
      zero: number;
      one: number;
      twoThree: number;
      fourPlus: number;
    };
  };

  // Uncertainty Analysis
  uncertainty: {
    overallLevel: 'very_precise' | 'precise' | 'moderate' | 'uncertain' | 'highly_uncertain';
    decomposition: {
      parameterVariance: number;
      randomEffectVariance: number;
      totalVariance: number;
    };
  };

  // Simulation Results
  simulation: {
    iterations: number;
    correlationDiagnostics: {
      meanPairwiseCorrelation: number;
      acceptanceVariance: number;
    };
    perSchool: Array<{
      schoolId: string;
      interviewRate: number;
      acceptanceRate: number;
    }>;
  };

  metadata: {
    modelVersion: string;
    computedAt: string;
  };
}
```

### 1.2 Update API Route

**File:** `src/app/api/predict/route.ts`

- Create new endpoint or update existing to return native format
- Remove legacy format conversion
- Add `format=native` query param for gradual migration

---

## Phase 2: New UI Components

### 2.1 Competitiveness Gauge

**File:** `src/components/prediction/CompetitivenessGauge.tsx`

Visual display of C score:
- Horizontal gauge from -3 to +3
- Color gradient (red → yellow → green)
- Marker showing applicant position
- Percentile label
- GPA/MCAT contribution breakdown

```
┌─────────────────────────────────────────────────────────────┐
│  Competitiveness Score                                      │
│  ═══════════════════●═══════════════════                   │
│  -3            0            +3                              │
│              Your C: +0.8 (68th percentile)                 │
│                                                             │
│  GPA: +0.5   MCAT: +0.3                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Two-Stage Probability Card

**File:** `src/components/prediction/TwoStageProbability.tsx`

For each school, show:
- P(Interview) with 80% CI bar
- P(Accept|Interview) with 80% CI bar
- Combined P(Accept) with 80% CI bar
- Visual funnel diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Harvard Medical School                           Reach     │
├─────────────────────────────────────────────────────────────┤
│  Interview     ████████░░░░░░░░░░░░  18% (12-25%)          │
│  Accept|Int    ████████████░░░░░░░░  42% (35-50%)          │
│  ─────────────────────────────────────────────────          │
│  Overall       ████░░░░░░░░░░░░░░░░   8% (4-13%)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Experience Saturation Chart

**File:** `src/components/prediction/ExperienceSaturation.tsx`

Interactive chart showing:
- Saturation curves for each domain
- Current position on each curve
- Marginal benefit indicators
- Minimum threshold markers

```
┌─────────────────────────────────────────────────────────────┐
│  Experience Contributions                                   │
│                                                             │
│  Clinical    ████████████████░░░░  85% saturated (1200 hrs)│
│  Research    ████████░░░░░░░░░░░░  45% saturated (400 hrs) │
│  Volunteer   ██████░░░░░░░░░░░░░░  35% saturated (150 hrs) │
│  Shadowing   ████████████████████  100% saturated (80 hrs) │
│  Leadership  ████████████░░░░░░░░  60% saturated (3 roles) │
│                                                             │
│  [View Saturation Curves]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Credible Interval Display

**File:** `src/components/prediction/CredibleInterval.tsx`

Proper 80% CI visualization:
- Point estimate with confidence band
- Hover for exact values
- Color coding by precision level

### 2.5 Uncertainty Breakdown

**File:** `src/components/prediction/UncertaintyBreakdown.tsx`

Pie/bar chart showing:
- Parameter uncertainty vs random effect uncertainty
- Overall precision level badge
- Explanation of what drives uncertainty

```
┌─────────────────────────────────────────────────────────────┐
│  Prediction Uncertainty: MODERATE                          │
│                                                             │
│  ┌────────┐                                                │
│  │████    │ Parameter Uncertainty (40%)                    │
│  │████████│ Random Effects (60%)                           │
│  └────────┘                                                │
│                                                             │
│  Your predictions have moderate uncertainty due to          │
│  applicant-level variation in interview/review outcomes.   │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 Demographic Effects Panel

**File:** `src/components/prediction/DemographicEffects.tsx`

Show demographic contribution breakdown:
- Effect sizes in understandable terms
- Mission fit bonuses
- School-specific variations

---

## Phase 3: Update Existing Components

### 3.1 ResultsDisplay.tsx

**Changes:**
- Replace legacy score display with CompetitivenessGauge
- Add new tabs: "Competitiveness", "Experience", "Uncertainty"
- Update school list to use TwoStageProbability cards
- Remove WARS score references
- Update summary cards with proper CIs

**New Tab Structure:**
1. Overview (summary metrics with CIs)
2. Competitiveness (C score, GPA/MCAT breakdown)
3. Experience (saturation analysis)
4. Schools (two-stage probabilities)
5. Simulation (correlated outcomes)
6. Uncertainty (variance decomposition)

### 3.2 SchoolList.tsx

**Changes:**
- Show P(Interview) and P(Accept|Interview) separately
- Display 80% credible intervals
- Add factor breakdown tooltip
- Show mission fit indicators
- Update category badges (add "likely")

### 3.3 SimulationResults.tsx

**Changes:**
- Explain correlated outcomes
- Show "all-or-nothing" score
- Display correlation diagnostics
- Update distribution charts with proper labels

### 3.4 ScoreDisplay.tsx

**Changes:**
- Replace 0-1000 score with C score
- Show experience saturation instead of raw contributions
- Update demographic effects display
- Remove red flag section (integrate into warnings)

---

## Phase 4: Methodology Page Overhaul

**File:** `src/app/methodology/page.tsx`

### New Sections:

#### 4.1 Two-Stage Admissions Model
- Explain P(accept) = P(interview) × P(accept|interview)
- Why this is more realistic than single-stage
- School-specific parameters

#### 4.2 Competitiveness Score (C)
- Mathematical definition
- Calibration against AAMC A-23 data
- Anchor point explanation (3.75 GPA, 512 MCAT)
- Percentile interpretation

#### 4.3 Experience Saturation
- Diminishing returns explanation
- Saturation curves with examples
- Minimum thresholds
- Domain-specific parameters

#### 4.4 Demographic & Mission Effects
- URM effects (cite A-18 data)
- SES factors
- Mission fit interactions
- School-specific variations

#### 4.5 Monte Carlo Simulation
- Correlated random effects
- Why outcomes are correlated across schools
- "All-or-nothing" cycles explanation
- Interpretation of simulation results

#### 4.6 Uncertainty Quantification
- Sources of uncertainty
- 80% credible intervals
- Parameter vs random effect variance
- How to interpret uncertainty levels

#### 4.7 Validation & Calibration
- A-23 reproduction accuracy
- Sensitivity analysis results
- Model limitations
- Data sources

---

## Phase 5: Remove Legacy Elements

### 5.1 Remove from UI:
- [ ] 0-1000 legacy score display
- [ ] WARS score and level
- [ ] Simple tier badges (exceptional/strong/etc)
- [ ] Rough ±30% confidence ranges
- [ ] Legacy factor breakdown

### 5.2 Remove from API:
- [ ] Legacy format from predict route (after UI migration)
- [ ] generateQuickPrediction legacy wrapper
- [ ] LegacyScoreBreakdown computation

### 5.3 Clean up types:
- [ ] Remove legacy type exports
- [ ] Update ResultsDisplayProps
- [ ] Update database schema if needed

---

## Phase 6: Database Schema Updates (if needed)

**File:** Update Supabase schema

- Add columns for new metrics
- Store two-stage probabilities
- Store competitiveness score
- Store uncertainty metrics

---

## Implementation Order

### Sprint 1: Foundation
1. Create `api-types.ts` with native response types
2. Create new API endpoint with native format
3. Build CompetitivenessGauge component
4. Build CredibleInterval component

### Sprint 2: Core Components
5. Build TwoStageProbability component
6. Build ExperienceSaturation component
7. Update SchoolList with two-stage display
8. Update SimulationResults

### Sprint 3: Integration
9. Update ResultsDisplay with new layout
10. Build UncertaintyBreakdown component
11. Build DemographicEffects panel
12. Wire up new API to UI

### Sprint 4: Methodology & Cleanup
13. Rewrite methodology page
14. Remove legacy elements
15. Update database schema
16. Testing and polish

---

## Testing Checklist

- [ ] All new components render correctly
- [ ] 80% CIs display properly
- [ ] Two-stage probabilities sum correctly
- [ ] Experience saturation charts are accurate
- [ ] Methodology page is clear and accurate
- [ ] No legacy references remain
- [ ] Mobile responsive design
- [ ] Accessibility (ARIA labels, contrast)
- [ ] Performance (no unnecessary re-renders)

---

## Files to Create

```
src/components/prediction/
├── CompetitivenessGauge.tsx      (NEW)
├── TwoStageProbability.tsx       (NEW)
├── ExperienceSaturation.tsx      (NEW)
├── CredibleInterval.tsx          (NEW)
├── UncertaintyBreakdown.tsx      (NEW)
├── DemographicEffects.tsx        (NEW)
├── SchoolList.tsx                (UPDATE)
├── SimulationResults.tsx         (UPDATE)
├── ScoreDisplay.tsx              (UPDATE → maybe DELETE)
├── SankeyDiagram.tsx             (UPDATE)
└── index.ts                      (UPDATE)

src/lib/model/
├── api-types.ts                  (NEW)
└── native-prediction.ts          (NEW - wrapper for native format)

src/app/
├── api/predict/
│   ├── route.ts                  (UPDATE)
│   └── native/route.ts           (NEW - optional)
├── methodology/
│   └── page.tsx                  (REWRITE)
└── (dashboard)/results/[id]/
    └── ResultsDisplay.tsx        (MAJOR UPDATE)
```

---

## Estimated Effort

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | API types & endpoint | Medium |
| Phase 2 | 6 new components | High |
| Phase 3 | Update 4 existing | Medium |
| Phase 4 | Methodology rewrite | Medium |
| Phase 5 | Legacy removal | Low |
| Phase 6 | DB schema | Low |

**Total: ~40-60 hours of development**
