# Claude Development Guidelines - MedAdmit

## Token Usage Optimization

**When searching for something in the codebase:**
- **FIRST try Grep** to locate the code/pattern
- Only read entire files if absolutely necessary
- Use Grep with `-A` and `-B` flags to get surrounding context
- Avoid reading large PDFs - ask user for key numbers instead

This prevents wasting tokens on reading files when you just need to find something specific.

Example:
```bash
# Good: Grep first to find the function
grep -n "calculateSchoolProbability" src/**/*.ts

# Then read only that section if needed
# Bad: Read the entire school-probability.ts file without knowing where to look
```

## Model Architecture (v2.0)

The MedAdmit prediction engine uses a rigorous probabilistic model with the following components:

### Core Model (`src/lib/model/`)

1. **Competitiveness Calculation** (`competitiveness.ts`)
   - Maps GPA and MCAT to a continuous competitiveness score C
   - Uses monotone I-splines calibrated against AAMC A-23 data
   - C = 0 corresponds to anchor point (3.75 GPA, 512 MCAT, ~65% acceptance)

2. **Two-Stage Probability Model** (`two-stage.ts`)
   - P(accept) = P(interview) × P(accept|interview)
   - School-specific intercepts and slopes on C
   - In-state bonuses for public schools

3. **Experience Saturation** (`experience.ts`)
   - Saturating functions: g(h) = α(1 - e^(-h/τ))
   - Separate domains: clinical, research, volunteer, shadowing, leadership
   - Minimum thresholds for critical experiences

4. **Demographic Effects** (`demographics.ts`)
   - URM effects based on AAMC A-18 data
   - SES factors: first-gen, disadvantaged, rural
   - Mission fit interactions (rural schools × rural applicants, etc.)

5. **Monte Carlo Simulation** (`monte-carlo.ts`)
   - Correlated random effects per applicant
   - u^(file) ~ N(0, 0.5²) affects all interview outcomes
   - u^(interview) ~ N(0, 0.7²) affects all acceptance|interview outcomes
   - Creates realistic "all-or-nothing" cycle patterns

6. **Uncertainty Quantification** (`uncertainty.ts`)
   - Parametric bootstrap for parameter uncertainty
   - 80% credible intervals on predictions
   - Variance decomposition

7. **Validation Framework** (`validation.ts`)
   - A-23 reproduction accuracy checks
   - Sensitivity analysis (monotonicity, tier ordering)
   - Edge case testing

### API Compatibility Layer (`migration.ts`)

The migration module provides backward-compatible functions:
- `generatePrediction()` - Full prediction with legacy output format
- `generateQuickPrediction()` - Lightweight prediction
- Converts between old `ApplicantInput` and new `ApplicantProfile` types

### Legacy Code (`src/lib/_legacy/`)

The original scoring system has been moved to `_legacy/` for reference.
All new development should use `src/lib/model/`.

### Key Data Files

- `data/calibration/a23-processed.json` - AAMC Table A-23 acceptance rates
- `data/calibration/a18-processed.json` - Demographic effects
- `data/calibration/school-params.json` - School-specific parameters
- `data/calibration/experience-params.json` - Experience saturation parameters

### Running Tests

```bash
# Model tests (287 tests)
npm test -- --run tests/model tests/integration

# Generate validation report
npx ts-node scripts/generate-validation-report.ts
```
