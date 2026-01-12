# UI Update Changelog: v2.0 Model Integration

This document describes the changes made to integrate the v2.0 rigorous probabilistic model into the MedAdmit UI.

## Overview

The v2.0 model replaces the heuristic 0-1000 scoring system and WARS (WedgeDawg Applicant Rating System) with a statistically rigorous approach based on AAMC data. The legacy system is deprecated but retained for backward compatibility.

### Key Differences

| Aspect | Legacy (v1.0) | Native (v2.0) |
|--------|---------------|---------------|
| Applicant Score | 0-1000 heuristic scale | Competitiveness (C): -3 to +3, calibrated to AAMC A-23 |
| School Tiers | WARS levels (reach/target/safety) | Four-tier: reach/target/likely/safety based on P(accept) |
| Probability Model | Single probability estimate | Two-stage: P(interview) × P(accept\|interview) |
| Uncertainty | None | 80% credible intervals via parametric bootstrap |
| Experience | Linear contribution | Saturating functions: g(h) = α(1 - e^(-h/τ)) |
| Demographics | Simple adjustments | URM effects from A-18, SES factors, mission interactions |
| Simulation | Independent outcomes | Correlated Monte Carlo with random effects |

---

## Phase 1: API Response Format

**Files Created:**
- `src/lib/model/api-types.ts` - Native response type definitions
- `src/lib/model/native-prediction.ts` - Native prediction generation

**Changes:**
- Added `NativePredictionResponse` type with full v2.0 model output
- Added `format: 'native' | 'legacy'` option to `/api/predict` endpoint
- Native format returns competitiveness, two-stage probabilities, credible intervals

**API Usage:**
```typescript
// Request native format
POST /api/predict
{
  "format": "native",
  "applicant": { ... }
}

// Response includes:
{
  "competitiveness": { "C": 0.5, "ci80": [0.3, 0.7], ... },
  "schools": [{ "pInterview": 0.4, "pAcceptGivenInterview": 0.6, ... }],
  "listMetrics": { "pAtLeastOne": { "mean": 0.85, "ci80": [0.78, 0.91] } },
  ...
}
```

---

## Phase 2: New UI Components

**Files Created in `src/components/prediction/`:**

1. **`CompetitivenessGauge.tsx`**
   - Displays C score on -3 to +3 scale
   - Visual gauge with color coding
   - Shows GPA and MCAT contributions
   - Compact variant for summaries

2. **`TwoStageProbability.tsx`**
   - Shows P(interview) × P(accept|interview) = P(accept)
   - Visual breakdown with progress bars
   - Per-school factor indicators
   - Compact variant for school lists

3. **`CredibleInterval.tsx`**
   - Displays 80% credible intervals
   - Visual bar showing uncertainty range
   - Point estimate with bounds
   - Compact inline variant

4. **`ExperienceSaturation.tsx`**
   - Visualizes diminishing returns curves
   - Shows current hours vs. saturation point
   - Domain breakdown (clinical, research, etc.)
   - Minimum threshold warnings

5. **`DemographicEffects.tsx`**
   - Shows URM, SES, and mission fit effects
   - Odds ratio display with confidence
   - Factor breakdown
   - Compact badge variant

6. **`UncertaintyBreakdown.tsx`**
   - Variance decomposition visualization
   - Parameter vs. random effect uncertainty
   - Overall uncertainty level badge
   - Explanation of uncertainty sources

7. **`NativeResultsDisplay.tsx`**
   - Main container for v2.0 results
   - Tabbed interface: Overview, Schools, Simulation, Details
   - Integrates all v2.0 components

---

## Phase 3: Update Existing Components

**Files Modified:**

1. **`src/app/(dashboard)/results/[id]/ResultsDisplay.tsx`**
   - Added format detection (native vs legacy)
   - Routes to `NativeResultsDisplay` for v2.0 format
   - Maintains legacy display for backward compatibility
   - Uses TypeScript discriminated union for type safety

2. **`src/components/prediction/SimulationResults.tsx`**
   - Added support for v2.0 correlation diagnostics
   - Shows mean pairwise correlation
   - Displays random effect variance

---

## Phase 4: Methodology Page Overhaul

**File Modified:** `src/app/methodology/page.tsx`

Complete rewrite to document v2.0 model:

- **Two-Stage Admissions Model**: P(accept) = P(interview) × P(accept|interview)
- **Competitiveness Score (C)**: Anchor at 3.75 GPA / 512 MCAT, I-spline calibration
- **Experience Saturation**: Diminishing returns with time constants per domain
- **Demographic & Mission Effects**: URM from A-18, SES factors, mission interactions
- **Monte Carlo Simulation**: Correlated random effects creating realistic cycles
- **Uncertainty Quantification**: Parametric bootstrap, variance decomposition
- **Validation & Calibration**: A-23 reproduction, sensitivity analysis

Removed references to:
- 0-1000 scoring scale
- WARS system
- Simple linear experience contributions

---

## Phase 5: Legacy Deprecation

**Files Modified with Deprecation Notices:**

1. **`src/lib/_legacy/scoring/index.ts`**
   - Added comprehensive deprecation header
   - Documents migration path to v2.0

2. **`src/components/prediction/index.ts`**
   - Reorganized with clear legacy vs v2.0 sections
   - Added `@deprecated` JSDoc to legacy exports

3. **`src/components/prediction/SchoolList.tsx`**
   - Added deprecation notice pointing to TwoStageProbability

4. **`src/app/api/predict/quick/route.ts`**
   - Added deprecation header
   - Points to main endpoint with `format: 'native'`

5. **`src/lib/model/index.ts`**
   - Marked migration utilities as deprecated
   - Added clear section headers for legacy vs native

**Deprecation Strategy:**
- Legacy code remains functional
- Console warnings logged when legacy format used
- JSDoc `@deprecated` tags for IDE warnings
- Comments guide developers to v2.0 alternatives

---

## Phase 6: Database Format Detection

**File Modified:** `src/app/(dashboard)/results/[id]/page.tsx`

- Detects stored prediction format by checking for `score_breakdown.competitiveness`
- Routes native format to `NativeResultsDisplay`
- Routes legacy format to `LegacyResultsDisplay`
- No schema migration required (JSONB columns are flexible)

**Format Detection Logic:**
```typescript
const isNativeFormat = scoreBreakdown?.competitiveness !== undefined

{isNativeFormat ? (
  <ResultsDisplay format="native" prediction={...} />
) : (
  <ResultsDisplay score={...} schoolList={...} simulation={...} />
)}
```

---

## Migration Guide

### For New Code

Always use the native v2.0 API:

```typescript
import { generateNativePrediction } from '@/lib/model'

const prediction = generateNativePrediction(applicantProfile, schoolIds, options)
// Returns NativePredictionResponse with full v2.0 data
```

### For API Consumers

Request native format explicitly:

```json
{
  "format": "native",
  "applicant": { ... },
  "schools": ["harvard", "stanford", ...]
}
```

### For UI Components

Use v2.0 components:

```tsx
import {
  CompetitivenessGauge,
  TwoStageProbability,
  CredibleInterval,
  NativeResultsDisplay
} from '@/components/prediction'
```

---

## Commits

| Commit | Phase | Description |
|--------|-------|-------------|
| (earlier) | 1 | API Response Format |
| (earlier) | 2 | New UI Components |
| (earlier) | 3 | Update Existing Components |
| `d55f783` | 4 | Methodology page overhaul |
| `dff4528` | 5 | Legacy deprecation notices |
| `5873bca` | 6 | Database format detection |

---

## Files Summary

### New Files
- `src/lib/model/api-types.ts`
- `src/lib/model/native-prediction.ts`
- `src/components/prediction/CompetitivenessGauge.tsx`
- `src/components/prediction/TwoStageProbability.tsx`
- `src/components/prediction/CredibleInterval.tsx`
- `src/components/prediction/ExperienceSaturation.tsx`
- `src/components/prediction/DemographicEffects.tsx`
- `src/components/prediction/UncertaintyBreakdown.tsx`
- `src/components/prediction/NativeResultsDisplay.tsx`

### Modified Files
- `src/app/methodology/page.tsx` (complete rewrite)
- `src/app/(dashboard)/results/[id]/page.tsx`
- `src/app/(dashboard)/results/[id]/ResultsDisplay.tsx`
- `src/app/api/predict/route.ts`
- `src/app/api/predict/quick/route.ts`
- `src/components/prediction/index.ts`
- `src/components/prediction/SchoolList.tsx`
- `src/components/prediction/SimulationResults.tsx`
- `src/lib/_legacy/scoring/index.ts`
- `src/lib/model/index.ts`

### Unchanged (Deprecated)
- `src/lib/_legacy/scoring/*` - All legacy scoring code
- `src/components/prediction/ScoreDisplay.tsx` - Legacy 0-1000 display
- `src/components/prediction/SankeyDiagram.tsx` - Legacy simulation flow
