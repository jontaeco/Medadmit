#!/usr/bin/env python3
"""
Calibrate School-Specific Parameters for the Two-Stage Model

This script computes per-school parameters for the probabilistic admissions model:
- Stage 1 intercept (interview probability baseline)
- Stage 2 intercept (acceptance given interview baseline)
- Slopes on competitiveness C for each stage
- In-state bonus effects

The parameters are calibrated from MSAR data and use hierarchical (partial pooling)
estimates to handle schools with missing data.
"""

import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from scipy.special import logit, expit


# ============================================================================
# Constants
# ============================================================================

# Tier definitions for hierarchical pooling
TIER_NAMES = {1: "Top", 2: "High", 3: "Mid", 4: "Low"}

# Default slopes by tier (on logit scale, per unit of C)
# Higher tier = steeper slope (stats matter more)
DEFAULT_SLOPES_INTERVIEW = {
    1: 1.2,   # Top schools: steep dependence on C
    2: 1.0,   # High schools
    3: 0.8,   # Mid schools
    4: 0.6,   # Low schools: flatter
}

DEFAULT_SLOPES_ACCEPT = {
    1: 0.6,   # Post-interview, stats matter less
    2: 0.5,
    3: 0.4,
    4: 0.3,
}

# In-state bonus priors (logit scale)
PUBLIC_IN_STATE_BONUS_MEAN = 0.8      # ~2.2x odds
PUBLIC_IN_STATE_BONUS_SD = 0.3
PRIVATE_IN_STATE_BONUS_MEAN = 0.1     # Small regional preference
PRIVATE_IN_STATE_BONUS_SD = 0.1


# ============================================================================
# Data Loading
# ============================================================================

def load_school_data() -> List[Dict]:
    """Load enhanced school data."""
    path = Path(__file__).parent.parent / "data" / "schools" / "md-schools-enhanced.json"
    with open(path) as f:
        data = json.load(f)
    return data["schools"]


def load_competitiveness_params() -> Dict:
    """Load calibrated competitiveness spline parameters."""
    path = Path(__file__).parent.parent / "data" / "model" / "competitiveness-splines-v1.json"
    with open(path) as f:
        return json.load(f)


def load_admit_org_stats() -> Dict[str, Dict]:
    """Load admit.org statistics for additional data."""
    path = Path(__file__).parent.parent / "data" / "admit-org" / "md-schools-stats.json"
    with open(path) as f:
        data = json.load(f)

    # Create lookup by name (normalized)
    lookup = {}
    for school in data["schools"]:
        name = school["name"].lower().strip()
        lookup[name] = school
    return lookup


# ============================================================================
# Spline Evaluation (inline to avoid import issues)
# ============================================================================

def create_ispline_basis(x, n_basis, degree, x_min, x_max):
    """Create I-spline basis (simplified version for evaluation)."""
    from scipy.interpolate import BSpline

    x = np.atleast_1d(x).astype(float)

    # Create knot sequence
    n_interior = n_basis - degree
    if n_interior < 0:
        n_interior = 0
    interior_knots = np.linspace(x_min, x_max, n_interior + 2)[1:-1]
    knots = np.concatenate([
        np.repeat(x_min, degree + 1),
        interior_knots,
        np.repeat(x_max, degree + 1)
    ])

    # Compute normalization at x_max
    def eval_bspline_basis(pts, n_b):
        basis = np.zeros((len(pts), n_b))
        for i in range(n_b):
            c = np.zeros(n_b)
            c[i] = 1.0
            spline = BSpline(knots, c, degree, extrapolate=True)
            basis[:, i] = spline(pts)
        return basis

    bspline_at_max = eval_bspline_basis(np.array([x_max]), n_basis + 1)
    bspline_max_rev = bspline_at_max[:, 1:]
    ispline_at_max = np.cumsum(bspline_max_rev[:, ::-1], axis=1)[:, ::-1]
    norm_constants = ispline_at_max[0, :].copy()
    norm_constants[norm_constants == 0] = 1

    # Compute basis at x
    bspline_basis = eval_bspline_basis(x, n_basis + 1)
    bspline_rev = bspline_basis[:, 1:]
    ispline_basis = np.cumsum(bspline_rev[:, ::-1], axis=1)[:, ::-1]
    ispline_basis = ispline_basis / norm_constants

    return ispline_basis


def evaluate_spline(x: float, params: Dict) -> float:
    """Evaluate a monotone spline at a single point."""
    x_arr = np.atleast_1d(x).astype(float)
    coef = np.array(params['coefficients'])
    intercept = params['intercept']
    n_basis = params['n_basis']
    degree = params.get('degree', 3)
    x_min = params['x_min']
    x_max = params['x_max']

    basis = create_ispline_basis(x_arr, n_basis, degree, x_min, x_max)
    result = intercept + basis @ coef
    return result[0]


def compute_C(gpa: float, mcat: float, comp_params: Dict) -> float:
    """Compute competitiveness score from GPA and MCAT."""
    gpa_c = evaluate_spline(gpa, comp_params['gpaSpline'])
    mcat_c = evaluate_spline(mcat, comp_params['mcatSpline'])
    return gpa_c + mcat_c


# ============================================================================
# Parameter Estimation
# ============================================================================

def compute_intercepts(school: Dict) -> Tuple[float, float]:
    """
    Compute Stage 1 and Stage 2 intercepts from school data.

    Stage 1: logit(interview rate) for average applicant
    Stage 2: logit(interview-to-accept rate) for average interviewee
    """
    # Get rates from school data
    int_rate = school.get("interviewRate")
    ia_rate = school.get("interviewToAcceptRate")

    # Handle missing data
    if int_rate is None or int_rate <= 0:
        int_rate = 0.10  # Default 10% interview rate
    if ia_rate is None or ia_rate <= 0:
        ia_rate = 0.40  # Default 40% I->A rate

    # Clamp to avoid extreme logits
    int_rate = np.clip(int_rate, 0.01, 0.99)
    ia_rate = np.clip(ia_rate, 0.01, 0.99)

    # Convert to logit
    intercept_interview = logit(int_rate)
    intercept_accept = logit(ia_rate)

    return float(intercept_interview), float(intercept_accept)


def estimate_slope_from_iqr(school: Dict, comp_params: Dict) -> Tuple[float, float]:
    """
    Estimate the slope on C from the school's percentile spread.

    Schools with narrow percentile ranges have steeper slopes (more selective on stats).
    Schools with wide ranges have flatter slopes (holistic review).
    """
    tier = school.get("tier", 3)

    # Get GPA and MCAT percentiles
    gpa_pct = school.get("gpaPercentiles", {})
    mcat_pct = school.get("mcatPercentiles", {})

    # Get 25th and 75th percentiles
    gpa_25 = gpa_pct.get("p25", school.get("medianGPA", 3.7) - 0.1)
    gpa_75 = gpa_pct.get("p75", school.get("medianGPA", 3.7) + 0.05)
    mcat_25 = mcat_pct.get("p25", school.get("medianMCAT", 512) - 4)
    mcat_75 = mcat_pct.get("p75", school.get("medianMCAT", 512) + 4)

    # Compute C at 25th and 75th percentiles
    C_25 = compute_C(gpa_25, mcat_25, comp_params)
    C_75 = compute_C(gpa_75, mcat_75, comp_params)

    iqr_C = C_75 - C_25

    # If IQR is very small, the slope should be steep
    # If IQR is large, the slope should be flat
    # Use inverse relationship with shrinkage toward tier default

    if iqr_C > 0.1:
        # Empirical slope estimate: narrower IQR = steeper slope
        # A typical IQR of 1.0 corresponds to slope of ~1.0
        raw_slope = 1.0 / iqr_C
    else:
        # Very narrow IQR - use tier default
        raw_slope = DEFAULT_SLOPES_INTERVIEW[tier]

    # Shrink toward tier default
    tier_default = DEFAULT_SLOPES_INTERVIEW[tier]
    shrinkage = 0.5  # 50% shrinkage toward tier mean
    slope_interview = shrinkage * tier_default + (1 - shrinkage) * raw_slope

    # Clamp to reasonable range
    slope_interview = np.clip(slope_interview, 0.3, 2.0)

    # Stage 2 slope is typically flatter (stats matter less post-interview)
    slope_accept = slope_interview * 0.5

    return float(slope_interview), float(slope_accept)


def compute_in_state_bonus(school: Dict) -> Tuple[float, float]:
    """
    Compute in-state bonus for interview and acceptance stages.

    For public schools: estimate from in-state vs OOS interview rates
    For private schools: use small default
    """
    is_public = school.get("isPublic", False)
    pct_in_state = school.get("pctInStateMatriculants", 0.5)

    if is_public and pct_in_state > 0.3:
        # Public school with significant in-state preference
        is_int_rate = school.get("inStateInterviewRate")
        oos_int_rate = school.get("oosInterviewRate")

        if is_int_rate and oos_int_rate and is_int_rate > oos_int_rate:
            # Compute logit difference
            is_logit = logit(np.clip(is_int_rate, 0.01, 0.99))
            oos_logit = logit(np.clip(oos_int_rate, 0.01, 0.99))
            bonus_interview = is_logit - oos_logit
        else:
            # Use prior based on in-state percentage
            # Higher % in-state implies stronger preference
            bonus_interview = PUBLIC_IN_STATE_BONUS_MEAN * (pct_in_state / 0.5)

        # Clamp to reasonable range
        bonus_interview = np.clip(bonus_interview, 0.2, 2.0)

        # Accept stage bonus is typically smaller
        bonus_accept = bonus_interview * 0.3
    else:
        # Private school or low in-state %
        bonus_interview = PRIVATE_IN_STATE_BONUS_MEAN
        bonus_accept = bonus_interview * 0.3

    return float(bonus_interview), float(bonus_accept)


def calibrate_school(school: Dict, comp_params: Dict, tier_stats: Dict) -> Dict:
    """
    Calibrate all parameters for a single school.
    """
    school_id = school.get("id", "unknown")
    tier = school.get("tier", 3)

    # Compute intercepts
    int_intercept, acc_intercept = compute_intercepts(school)

    # Estimate slopes
    slope_int, slope_acc = estimate_slope_from_iqr(school, comp_params)

    # Compute in-state bonus
    is_bonus_int, is_bonus_acc = compute_in_state_bonus(school)

    return {
        "schoolId": school_id,
        "schoolName": school.get("name", "Unknown"),
        "tier": tier,
        "interceptInterview": int_intercept,
        "interceptAccept": acc_intercept,
        "slopeC_interview": slope_int,
        "slopeC_accept": slope_acc,
        "inStateBonus_interview": is_bonus_int,
        "inStateBonus_accept": is_bonus_acc,
        "isPublic": school.get("isPublic", False),
        "state": school.get("state", ""),
    }


# ============================================================================
# Hierarchical Adjustment
# ============================================================================

def compute_tier_statistics(schools: List[Dict], params: Dict[str, Dict]) -> Dict:
    """
    Compute tier-level statistics for partial pooling.
    """
    tier_stats = {1: [], 2: [], 3: [], 4: []}

    for school_id, p in params.items():
        tier = p.get("tier", 3)
        tier_stats[tier].append({
            "interceptInterview": p["interceptInterview"],
            "interceptAccept": p["interceptAccept"],
            "slopeC_interview": p["slopeC_interview"],
        })

    # Compute means and SDs for each tier
    result = {}
    for tier, school_params in tier_stats.items():
        if len(school_params) > 0:
            int_intercepts = [p["interceptInterview"] for p in school_params]
            acc_intercepts = [p["interceptAccept"] for p in school_params]
            slopes = [p["slopeC_interview"] for p in school_params]

            result[tier] = {
                "count": len(school_params),
                "interceptInterview_mean": float(np.mean(int_intercepts)),
                "interceptInterview_sd": float(np.std(int_intercepts)),
                "interceptAccept_mean": float(np.mean(acc_intercepts)),
                "interceptAccept_sd": float(np.std(acc_intercepts)),
                "slopeC_mean": float(np.mean(slopes)),
                "slopeC_sd": float(np.std(slopes)),
            }
        else:
            result[tier] = {
                "count": 0,
                "interceptInterview_mean": -2.0,
                "interceptInterview_sd": 0.5,
                "interceptAccept_mean": -0.5,
                "interceptAccept_sd": 0.3,
                "slopeC_mean": DEFAULT_SLOPES_INTERVIEW[tier],
                "slopeC_sd": 0.2,
            }

    return result


def apply_shrinkage(params: Dict[str, Dict], tier_stats: Dict, shrinkage_factor: float = 0.3) -> Dict[str, Dict]:
    """
    Apply partial pooling (shrinkage) toward tier means.

    This reduces noise in school-specific estimates by pulling them
    toward the tier average.
    """
    adjusted = {}

    for school_id, p in params.items():
        tier = p.get("tier", 3)
        stats = tier_stats.get(tier, tier_stats[3])

        # Shrink intercepts toward tier mean
        int_int = (1 - shrinkage_factor) * p["interceptInterview"] + \
                  shrinkage_factor * stats["interceptInterview_mean"]

        int_acc = (1 - shrinkage_factor) * p["interceptAccept"] + \
                  shrinkage_factor * stats["interceptAccept_mean"]

        # Shrink slopes toward tier mean
        slope_int = (1 - shrinkage_factor) * p["slopeC_interview"] + \
                    shrinkage_factor * stats["slopeC_mean"]

        adjusted[school_id] = {
            **p,
            "interceptInterview": float(int_int),
            "interceptAccept": float(int_acc),
            "slopeC_interview": float(slope_int),
            "slopeC_accept": float(slope_int * 0.5),  # Keep ratio
        }

    return adjusted


# ============================================================================
# Validation
# ============================================================================

def validate_parameters(params: Dict[str, Dict], schools: List[Dict]) -> Dict:
    """
    Validate calibrated parameters against observed data.
    """
    errors = []
    warnings = []

    school_lookup = {s["id"]: s for s in schools}

    for school_id, p in params.items():
        school = school_lookup.get(school_id)
        if not school:
            continue

        # Check intercepts are reasonable
        if p["interceptInterview"] > 0:
            warnings.append(f"{school_id}: interview intercept > 0 (implies >50% interview rate)")

        if p["interceptInterview"] < -5:
            warnings.append(f"{school_id}: interview intercept very low (<1% rate)")

        # Check slopes are positive
        if p["slopeC_interview"] <= 0:
            errors.append(f"{school_id}: negative or zero slope on C")

        # Check in-state bonus
        if school.get("isPublic") and p["inStateBonus_interview"] < 0.1:
            warnings.append(f"{school_id}: public school with small in-state bonus")

    # Compute prediction accuracy
    predicted_int_rates = []
    observed_int_rates = []

    for school_id, p in params.items():
        school = school_lookup.get(school_id)
        if not school:
            continue

        obs_rate = school.get("interviewRate")
        if obs_rate and obs_rate > 0:
            # Predicted rate at C=0 (median applicant)
            pred_rate = expit(p["interceptInterview"])
            predicted_int_rates.append(pred_rate)
            observed_int_rates.append(obs_rate)

    if len(predicted_int_rates) > 0:
        correlation = np.corrcoef(predicted_int_rates, observed_int_rates)[0, 1]
        mae = np.mean(np.abs(np.array(predicted_int_rates) - np.array(observed_int_rates)))
    else:
        correlation = 0
        mae = 1

    return {
        "errors": errors,
        "warnings": warnings,
        "n_schools": len(params),
        "interview_rate_correlation": float(correlation),
        "interview_rate_mae": float(mae),
    }


# ============================================================================
# Export
# ============================================================================

def export_parameters(
    params: Dict[str, Dict],
    tier_stats: Dict,
    validation: Dict,
    output_path: Path
) -> None:
    """Export calibrated school parameters to JSON."""
    output = {
        "version": "1.0.0",
        "calibratedAt": "2026-01-12",
        "description": "School-specific parameters for two-stage model",
        "schools": params,
        "tierStatistics": tier_stats,
        "validation": {
            "nSchools": validation["n_schools"],
            "interviewRateCorrelation": validation["interview_rate_correlation"],
            "interviewRateMAE": validation["interview_rate_mae"],
            "nErrors": len(validation["errors"]),
            "nWarnings": len(validation["warnings"]),
        },
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nParameters exported to: {output_path}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("MedAdmit School Parameter Calibration")
    print("=" * 60)

    # Load data
    print("\nLoading data...")
    schools = load_school_data()
    comp_params = load_competitiveness_params()
    print(f"  Loaded {len(schools)} schools")
    print(f"  Loaded competitiveness splines")

    # First pass: calibrate each school
    print("\nCalibrating school parameters...")
    raw_params = {}
    for school in schools:
        school_id = school.get("id", "unknown")
        params = calibrate_school(school, comp_params, {})
        raw_params[school_id] = params

    # Compute tier statistics
    print("\nComputing tier statistics...")
    tier_stats = compute_tier_statistics(schools, raw_params)
    for tier, stats in tier_stats.items():
        print(f"  Tier {tier} ({TIER_NAMES[tier]}): {stats['count']} schools")
        print(f"    Interview intercept: {stats['interceptInterview_mean']:.2f} ± {stats['interceptInterview_sd']:.2f}")
        print(f"    Slope on C: {stats['slopeC_mean']:.2f} ± {stats['slopeC_sd']:.2f}")

    # Apply shrinkage
    print("\nApplying hierarchical shrinkage...")
    final_params = apply_shrinkage(raw_params, tier_stats, shrinkage_factor=0.3)

    # Validate
    print("\nValidating parameters...")
    validation = validate_parameters(final_params, schools)
    print(f"  Schools calibrated: {validation['n_schools']}")
    print(f"  Interview rate correlation: {validation['interview_rate_correlation']:.3f}")
    print(f"  Interview rate MAE: {validation['interview_rate_mae']:.3f}")
    print(f"  Errors: {len(validation['errors'])}")
    print(f"  Warnings: {len(validation['warnings'])}")

    if validation["warnings"][:5]:
        print("\n  Sample warnings:")
        for w in validation["warnings"][:5]:
            print(f"    - {w}")

    # Export
    output_path = Path(__file__).parent.parent / "data" / "model" / "school-parameters-v1.json"
    export_parameters(final_params, tier_stats, validation, output_path)

    # Show sample schools
    print("\n" + "-" * 40)
    print("Sample school parameters:")
    sample_schools = ["harvard-med", "stanford-med", "university-of-michigan", "ohio-state", "texas-tech"]
    for school_id in sample_schools:
        if school_id in final_params:
            p = final_params[school_id]
            pred_int = expit(p["interceptInterview"])
            pred_acc = expit(p["interceptAccept"])
            print(f"\n  {p['schoolName']} (Tier {p['tier']}):")
            print(f"    Interview rate (C=0): {pred_int:.1%}")
            print(f"    Accept|Interview (C=0): {pred_acc:.1%}")
            print(f"    Slope on C (interview): {p['slopeC_interview']:.2f}")
            print(f"    In-state bonus: {p['inStateBonus_interview']:.2f}")

    print("\n" + "=" * 60)
    print("School calibration complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
