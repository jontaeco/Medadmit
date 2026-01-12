# UI Update Changelog: v2.0 Model Integration

This document describes the changes made to integrate the v2.0 rigorous probabilistic model into the MedAdmit UI.

## Overview

The v2.0 model **replaces** the heuristic 0-1000 scoring system and WARS (WedgeDawg Applicant Rating System) with a statistically rigorous approach based on AAMC data. The legacy system has been completely removed.

### v2.0 Model Features

| Feature | Description |
|---------|-------------|
| **Competitiveness (C)** | -3 to +3 scale, calibrated to AAMC A-23 acceptance rates |
| **Two-Stage Probability** | P(accept) = P(interview) × P(accept\|interview) |
| **80% Credible Intervals** | Parametric bootstrap for uncertainty quantification |
| **Experience Saturation** | Diminishing returns: g(h) = α(1 - e^(-h/τ)) |
| **Demographic Effects** | URM from A-18, SES factors, mission interactions |
| **Correlated Simulation** | Monte Carlo with random effects for realistic cycles |

---

## Removed Legacy Code

The following legacy elements have been **completely removed**:

### Deleted Directories
- `src/lib/_legacy/` - All legacy scoring code (0-1000 scale, WARS)

### Deleted Components
- `src/components/prediction/ScoreDisplay.tsx` - Legacy 0-1000 score display
- `src/components/prediction/SankeyDiagram.tsx` - Legacy simulation visualization

### Deleted API Routes
- `src/app/api/predict/quick/route.ts` - Legacy quick prediction endpoint

### Deleted Files
- `src/lib/model/migration.ts` - Legacy format migration utilities
- `scripts/test-wars-*.ts` - WARS testing scripts
- `tests/_legacy/` - Legacy test directory

---

## Updated Files

### API Route (`src/app/api/predict/route.ts`)
- Removed legacy format support
- Now exclusively uses `generateNativePrediction()`
- Returns v2.0 format with competitiveness, two-stage probabilities, credible intervals

### Results Display (`src/app/(dashboard)/results/[id]/`)
- `page.tsx` - Simplified to only handle v2.0 format
- `ResultsDisplay.tsx` - Now a thin wrapper around `NativeResultsDisplay`

### Component Exports (`src/components/prediction/index.ts`)
- Removed legacy component exports
- Clean v2.0-only exports

### Model Exports (`src/lib/model/index.ts`)
- Removed legacy migration utilities
- Organized into clear sections: API, Competitiveness, Two-Stage, Experience, Demographics, Monte Carlo, Uncertainty, Validation

### SchoolList (`src/components/prediction/SchoolList.tsx`)
- Updated header documentation
- Now shows two-stage probabilities with credible intervals

---

## New Components (v2.0)

These components display the v2.0 model output:

| Component | Purpose |
|-----------|---------|
| `CompetitivenessGauge` | C score gauge from -3 to +3 |
| `TwoStageProbability` | P(interview) × P(accept\|interview) breakdown |
| `CredibleInterval` | 80% CI visualization |
| `ExperienceSaturation` | Diminishing returns curves |
| `DemographicEffects` | URM, SES, mission fit effects |
| `UncertaintyBreakdown` | Variance decomposition |
| `NativeResultsDisplay` | Main tabbed results container |

---

## API Changes

### Before (Legacy - Removed)
```typescript
POST /api/predict
{
  "applicant": { ... },
  "format": "legacy"
}

// Response (no longer supported)
{
  "applicantScore": 750,  // 0-1000 scale
  "schoolList": {
    "reach": [...],
    "target": [...],
    "safety": [...]  // WARS tiers
  }
}
```

### After (v2.0 - Current)
```typescript
POST /api/predict
{
  "applicant": { ... }
}

// Response
{
  "competitiveness": {
    "C": 0.5,
    "ci80": [0.3, 0.7],
    "gpaContribution": 0.3,
    "mcatContribution": 0.2
  },
  "schools": [{
    "schoolId": "harvard-med",
    "pInterview": { "mean": 0.25, "ci80": [0.18, 0.33] },
    "pAcceptGivenInterview": { "mean": 0.65, "ci80": [0.55, 0.75] },
    "pAccept": { "mean": 0.16, "ci80": [0.10, 0.23] },
    "category": "reach"
  }],
  "listMetrics": {
    "pAtLeastOne": { "mean": 0.85, "ci80": [0.78, 0.91] },
    "expectedAcceptances": { "mean": 2.3, "ci80": [1.0, 4.0] }
  },
  "uncertainty": {
    "overallLevel": "moderate",
    "decomposition": { ... }
  },
  "simulation": {
    "iterations": 5000,
    "correlationDiagnostics": { ... }
  }
}
```

---

## Breaking Changes

1. **API format parameter removed** - The `format: "legacy"` option no longer exists
2. **0-1000 score removed** - Use `competitiveness.C` instead (-3 to +3 scale)
3. **WARS tiers removed** - Schools categorized by probability thresholds
4. **Legacy components removed** - `ScoreDisplay`, `SankeyDiagram` no longer exist
5. **Quick predict endpoint removed** - Use main `/api/predict` endpoint

---

## Migration Notes

If you have existing predictions stored in the database with legacy format, they will need to be re-generated using the new API. The database schema (JSONB columns) supports both formats, but the UI now only renders v2.0 format.
