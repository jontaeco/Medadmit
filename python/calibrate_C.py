#!/usr/bin/env python3
"""
Calibrate Competitiveness Splines to AAMC Table A-23

This script fits monotone splines for GPA and MCAT that map to a latent
competitiveness score C. The splines are calibrated such that the model-implied
P(>=1 acceptance) matches the observed rates in A-23.

The calibration target is:
    P(>=1 acceptance | GPA bin, MCAT bin) from A-23

The model computes:
    C = f_GPA(gpa) + f_MCAT(mcat)
    P(accept at school s) = sigmoid(beta_0 + beta_C * C)
    P(>=1) = 1 - prod_s(1 - P(accept at school s))

We fit f_GPA and f_MCAT such that model P(>=1) matches A-23 rates.
"""

import json
import numpy as np
from pathlib import Path
from scipy.optimize import minimize
from scipy.special import expit  # sigmoid function
from typing import Dict, Tuple, List

from spline_fitting import (
    create_ispline_basis,
    fit_monotone_spline,
    evaluate_monotone_spline,
)


# ============================================================================
# Constants
# ============================================================================

# Number of schools a typical applicant applies to
TYPICAL_APPLICATIONS = 16

# Anchor points for C=0 (median accepted applicant)
GPA_ANCHOR = 3.75
MCAT_ANCHOR = 512

# Spline configuration
GPA_N_BASIS = 6
MCAT_N_BASIS = 6
SPLINE_DEGREE = 3

# GPA range
GPA_MIN = 2.0
GPA_MAX = 4.0

# MCAT range
MCAT_MIN = 486
MCAT_MAX = 528


# ============================================================================
# Data Loading
# ============================================================================

def load_a23_data() -> Dict:
    """Load processed A-23 data."""
    path = Path(__file__).parent.parent / "data" / "aamc" / "table-a23-processed.json"
    with open(path) as f:
        return json.load(f)


def load_school_data() -> List[Dict]:
    """Load enhanced school data."""
    path = Path(__file__).parent.parent / "data" / "schools" / "md-schools-enhanced.json"
    with open(path) as f:
        data = json.load(f)
    return data["schools"]


# ============================================================================
# Model Functions
# ============================================================================

def compute_C(
    gpa: float,
    mcat: float,
    gpa_params: Dict,
    mcat_params: Dict
) -> float:
    """
    Compute competitiveness score C from GPA and MCAT.

    C = f_GPA(gpa) + f_MCAT(mcat)

    The splines are anchored such that C=0 at (GPA_ANCHOR, MCAT_ANCHOR).
    """
    gpa_contrib = evaluate_monotone_spline(np.array([gpa]), gpa_params)[0]
    mcat_contrib = evaluate_monotone_spline(np.array([mcat]), mcat_params)[0]
    return gpa_contrib + mcat_contrib


def compute_p_accept_single(
    C: float,
    school: Dict,
    global_slope: float = 1.0
) -> float:
    """
    Compute P(accept) at a single school given competitiveness C.

    Uses logistic model:
        logit(P) = intercept + slope * C

    The intercept is derived from the school's overall acceptance rate.
    """
    # Get school's overall acceptance rate
    total_apps = school.get("totalApplicants", 5000)
    total_acc = school.get("totalAccepted", 200)

    if total_apps == 0 or total_acc is None:
        return 0.05  # Default low probability

    base_rate = total_acc / total_apps

    # Convert to logit
    base_logit = np.log(base_rate / (1 - base_rate + 1e-10))

    # Apply C effect
    # At C=0 (median applicant), probability should be close to base_rate
    # Higher C increases probability
    logit_p = base_logit + global_slope * C

    # Convert back to probability
    return expit(logit_p)


def compute_p_at_least_one(
    C: float,
    schools: List[Dict],
    n_applications: int = TYPICAL_APPLICATIONS,
    global_slope: float = 1.0
) -> float:
    """
    Compute P(>=1 acceptance) for an applicant with competitiveness C.

    Assumes applicant applies to n_applications schools drawn from the
    school distribution (weighted by application volume).

    P(>=1) = 1 - prod(1 - P(accept_s))
    """
    # Sort schools by acceptance rate to get a representative mix
    sorted_schools = sorted(
        schools,
        key=lambda s: s.get("totalApplicants", 0),
        reverse=True
    )

    # Take top schools by application volume
    selected = sorted_schools[:min(n_applications * 2, len(sorted_schools))]

    # Compute P(reject all)
    p_reject_all = 1.0

    for i, school in enumerate(selected[:n_applications]):
        p_accept = compute_p_accept_single(C, school, global_slope)
        p_reject_all *= (1 - p_accept)

    return 1 - p_reject_all


# ============================================================================
# Calibration
# ============================================================================

def calibrate_splines(
    a23_data: Dict,
    schools: List[Dict],
    verbose: bool = True
) -> Tuple[Dict, Dict, Dict]:
    """
    Calibrate GPA and MCAT splines to match A-23 acceptance rates.

    Strategy:
    1. Convert observed P(>=1) to logit scale
    2. Fit additive model: logit(P) = f_GPA(gpa) + f_MCAT(mcat)
    3. Use monotone splines for f_GPA and f_MCAT

    This avoids the complex P(>=1) computation during optimization.
    """
    cells = a23_data["cells"]

    # Extract data points
    gpa_centers = np.array([c["gpaCenter"] for c in cells])
    mcat_centers = np.array([c["mcatCenter"] for c in cells])
    observed_rates = np.array([c["acceptanceRate"] for c in cells])
    weights = np.array([c["weight"] for c in cells])

    # Clamp rates to avoid log(0) issues
    observed_rates = np.clip(observed_rates, 0.01, 0.99)

    # Convert to logit scale: logit(P) = log(P / (1-P))
    observed_logit = np.log(observed_rates / (1 - observed_rates))

    # Unique GPA and MCAT values
    unique_gpas = np.unique(gpa_centers)
    unique_mcats = np.unique(mcat_centers)

    if verbose:
        print(f"Calibrating to {len(cells)} A-23 cells")
        print(f"  GPA bins: {len(unique_gpas)}")
        print(f"  MCAT bins: {len(unique_mcats)}")
        print(f"  Rate range: {observed_rates.min():.3f} - {observed_rates.max():.3f}")
        print(f"  Logit range: {observed_logit.min():.2f} - {observed_logit.max():.2f}")

    # Build design matrix for additive model
    # Create indicator matrices for GPA and MCAT bins
    gpa_to_idx = {g: i for i, g in enumerate(unique_gpas)}
    mcat_to_idx = {m: i for i, m in enumerate(unique_mcats)}

    n_gpa = len(unique_gpas)
    n_mcat = len(unique_mcats)

    # Design matrix: one-hot encoding for GPA and MCAT
    X_gpa = np.zeros((len(cells), n_gpa))
    X_mcat = np.zeros((len(cells), n_mcat))

    for i, cell in enumerate(cells):
        X_gpa[i, gpa_to_idx[cell["gpaCenter"]]] = 1
        X_mcat[i, mcat_to_idx[cell["mcatCenter"]]] = 1

    # Fit additive model using constrained least squares
    # Model: y = X_gpa @ alpha_gpa + X_mcat @ alpha_mcat
    # Constraints: alpha_gpa and alpha_mcat are monotonically increasing

    def loss(params):
        """Weighted MSE with monotonicity soft constraints."""
        alpha_gpa = params[:n_gpa]
        alpha_mcat = params[n_gpa:n_gpa + n_mcat]

        pred = X_gpa @ alpha_gpa + X_mcat @ alpha_mcat
        mse = np.sum(weights * (observed_logit - pred) ** 2)

        # Soft monotonicity penalty
        mono_gpa = np.sum(np.maximum(0, -np.diff(alpha_gpa)) ** 2) * 100
        mono_mcat = np.sum(np.maximum(0, -np.diff(alpha_mcat)) ** 2) * 100

        # Smoothness penalty
        smooth = 0.01 * (np.sum(np.diff(alpha_gpa) ** 2) + np.sum(np.diff(alpha_mcat) ** 2))

        return mse + mono_gpa + mono_mcat + smooth

    # Initial guess: linear in GPA and MCAT
    x0_gpa = np.linspace(-2, 2, n_gpa)  # Range of logits
    x0_mcat = np.linspace(-2, 2, n_mcat)
    x0 = np.concatenate([x0_gpa, x0_mcat])

    if verbose:
        print("\nOptimizing additive model...")

    # Optimize
    result = minimize(
        loss,
        x0,
        method='L-BFGS-B',
        options={'maxiter': 2000, 'ftol': 1e-12}
    )

    # Extract fitted values
    alpha_gpa = result.x[:n_gpa]
    alpha_mcat = result.x[n_gpa:n_gpa + n_mcat]

    # Center at anchor points (C=0 at anchor)
    gpa_anchor_idx = np.argmin(np.abs(unique_gpas - GPA_ANCHOR))
    mcat_anchor_idx = np.argmin(np.abs(unique_mcats - MCAT_ANCHOR))

    # Compute global intercept: the logit at anchor point
    # This is alpha_gpa[anchor] + alpha_mcat[anchor]
    global_intercept = alpha_gpa[gpa_anchor_idx] + alpha_mcat[mcat_anchor_idx]

    # Center effects so C=0 at anchor
    alpha_gpa_centered = alpha_gpa - alpha_gpa[gpa_anchor_idx]
    alpha_mcat_centered = alpha_mcat - alpha_mcat[mcat_anchor_idx]

    if verbose:
        print(f"\n  Global intercept (logit at anchor): {global_intercept:.3f}")
        print(f"  → P(≥1) at anchor: {expit(global_intercept):.1%}")

    # Now fit monotone splines through these discrete values
    gpa_params, gpa_info = fit_monotone_spline(
        unique_gpas, alpha_gpa_centered,
        n_basis=GPA_N_BASIS,
        smoothness_penalty=0.001,
        x_min=GPA_MIN,
        x_max=GPA_MAX,
    )

    mcat_params, mcat_info = fit_monotone_spline(
        unique_mcats, alpha_mcat_centered,
        n_basis=MCAT_N_BASIS,
        smoothness_penalty=0.001,
        x_min=MCAT_MIN,
        x_max=MCAT_MAX,
    )

    # Adjust intercepts so splines give 0 at anchor
    gpa_at_anchor = evaluate_monotone_spline(np.array([GPA_ANCHOR]), gpa_params)[0]
    mcat_at_anchor = evaluate_monotone_spline(np.array([MCAT_ANCHOR]), mcat_params)[0]
    gpa_params['intercept'] = gpa_params['intercept'] - gpa_at_anchor
    mcat_params['intercept'] = mcat_params['intercept'] - mcat_at_anchor

    # Store global intercept in the output
    gpa_params['globalIntercept'] = float(global_intercept)

    # Compute final fit statistics
    pred_logit = X_gpa @ alpha_gpa + X_mcat @ alpha_mcat
    pred_rates = expit(pred_logit)  # Convert back to probability

    residuals = observed_rates - pred_rates
    rmse = np.sqrt(np.sum(weights * residuals ** 2))
    ss_res = np.sum(weights * residuals ** 2)
    ss_tot = np.sum(weights * (observed_rates - np.average(observed_rates, weights=weights)) ** 2)
    r2 = 1 - ss_res / ss_tot

    # Check monotonicity
    gpa_test = np.linspace(GPA_MIN, GPA_MAX, 50)
    mcat_test = np.linspace(MCAT_MIN, MCAT_MAX, 50)
    gpa_C_test = evaluate_monotone_spline(gpa_test, gpa_params)
    mcat_C_test = evaluate_monotone_spline(mcat_test, mcat_params)
    gpa_monotone = np.all(np.diff(gpa_C_test) >= -1e-10)
    mcat_monotone = np.all(np.diff(mcat_C_test) >= -1e-10)

    calibration_info = {
        'rmse': float(rmse),
        'r2': float(r2),
        'gpa_monotone': bool(gpa_monotone),
        'mcat_monotone': bool(mcat_monotone),
        'converged': result.success,
        'n_iterations': result.nit,
        'anchor_gpa': GPA_ANCHOR,
        'anchor_mcat': MCAT_ANCHOR,
        'gpa_spline_r2': gpa_info['r2'],
        'mcat_spline_r2': mcat_info['r2'],
        'global_intercept': float(global_intercept),
    }

    if verbose:
        print(f"\nCalibration Results:")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  R²: {r2:.4f}")
        print(f"  GPA spline R²: {gpa_info['r2']:.4f}")
        print(f"  MCAT spline R²: {mcat_info['r2']:.4f}")
        print(f"  GPA monotone: {gpa_monotone}")
        print(f"  MCAT monotone: {mcat_monotone}")
        print(f"  Converged: {result.success}")

        # Show fitted values
        print(f"\n  GPA effect range: {alpha_gpa_centered.min():.2f} to {alpha_gpa_centered.max():.2f}")
        print(f"  MCAT effect range: {alpha_mcat_centered.min():.2f} to {alpha_mcat_centered.max():.2f}")

    return gpa_params, mcat_params, calibration_info


def export_spline_parameters(
    gpa_params: Dict,
    mcat_params: Dict,
    calibration_info: Dict,
    output_path: Path
) -> None:
    """Export calibrated spline parameters to JSON."""
    output = {
        'version': '1.0.0',
        'calibratedAt': '2026-01-12',
        'description': 'GPA and MCAT to competitiveness splines, calibrated to A-23',
        'gpaSpline': gpa_params,
        'mcatSpline': mcat_params,
        'calibration': calibration_info,
    }

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nParameters exported to: {output_path}")


def generate_calibration_plots(
    gpa_params: Dict,
    mcat_params: Dict,
    a23_data: Dict,
    schools: List[Dict],
    calibration_info: Dict,
    output_dir: Path
) -> None:
    """Generate diagnostic plots for calibration quality."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.colors import Normalize
    from matplotlib.cm import ScalarMappable

    cells = a23_data["cells"]

    # --- Plot 1: GPA spline ---
    fig, ax = plt.subplots(figsize=(8, 5))
    gpa_range = np.linspace(GPA_MIN, GPA_MAX, 100)
    gpa_C = evaluate_monotone_spline(gpa_range, gpa_params)
    ax.plot(gpa_range, gpa_C, 'b-', linewidth=2)
    ax.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(GPA_ANCHOR, color='red', linestyle='--', alpha=0.5, label=f'Anchor: {GPA_ANCHOR}')
    ax.set_xlabel('GPA')
    ax.set_ylabel('Competitiveness Contribution')
    ax.set_title('GPA → Competitiveness Spline')
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.savefig(output_dir / 'gpa_spline.png', dpi=150, bbox_inches='tight')
    plt.close()

    # --- Plot 2: MCAT spline ---
    fig, ax = plt.subplots(figsize=(8, 5))
    mcat_range = np.linspace(MCAT_MIN, MCAT_MAX, 100)
    mcat_C = evaluate_monotone_spline(mcat_range, mcat_params)
    ax.plot(mcat_range, mcat_C, 'g-', linewidth=2)
    ax.axhline(0, color='gray', linestyle='--', alpha=0.5)
    ax.axvline(MCAT_ANCHOR, color='red', linestyle='--', alpha=0.5, label=f'Anchor: {MCAT_ANCHOR}')
    ax.set_xlabel('MCAT')
    ax.set_ylabel('Competitiveness Contribution')
    ax.set_title('MCAT → Competitiveness Spline')
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.savefig(output_dir / 'mcat_spline.png', dpi=150, bbox_inches='tight')
    plt.close()

    # --- Plot 3: Observed vs Predicted ---
    observed = np.array([c["acceptanceRate"] for c in cells])

    # Compute predicted rates using additive model on logit scale
    global_int = calibration_info.get('global_intercept', 0)
    predicted = []
    for cell in cells:
        C = compute_C(cell["gpaCenter"], cell["mcatCenter"], gpa_params, mcat_params)
        logit_p = global_int + C
        p = expit(logit_p)
        predicted.append(p)
    predicted = np.array(predicted)

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.scatter(observed, predicted, alpha=0.5, s=30)
    ax.plot([0, 1], [0, 1], 'r--', label='Perfect fit')
    ax.set_xlabel('Observed P(≥1 acceptance)')
    ax.set_ylabel('Predicted P(≥1 acceptance)')
    ax.set_title(f'Calibration Quality (R² = {calibration_info["r2"]:.3f})')
    ax.legend()
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.grid(True, alpha=0.3)
    fig.savefig(output_dir / 'calibration_scatter.png', dpi=150, bbox_inches='tight')
    plt.close()

    # --- Plot 4: Heatmap comparison ---
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    unique_gpas = sorted(set(c["gpaCenter"] for c in cells))
    unique_mcats = sorted(set(c["mcatCenter"] for c in cells))

    # Create grids
    obs_grid = np.zeros((len(unique_gpas), len(unique_mcats)))
    pred_grid = np.zeros((len(unique_gpas), len(unique_mcats)))

    gpa_to_idx = {g: i for i, g in enumerate(unique_gpas)}
    mcat_to_idx = {m: i for i, m in enumerate(unique_mcats)}

    for i, cell in enumerate(cells):
        gi = gpa_to_idx[cell["gpaCenter"]]
        mi = mcat_to_idx[cell["mcatCenter"]]
        obs_grid[gi, mi] = observed[i]
        pred_grid[gi, mi] = predicted[i]

    vmin, vmax = 0, 1

    im1 = axes[0].imshow(obs_grid, aspect='auto', origin='lower', vmin=vmin, vmax=vmax, cmap='RdYlGn')
    axes[0].set_xticks(range(len(unique_mcats)))
    axes[0].set_xticklabels([f'{int(m)}' for m in unique_mcats], rotation=45)
    axes[0].set_yticks(range(len(unique_gpas)))
    axes[0].set_yticklabels([f'{g:.1f}' for g in unique_gpas])
    axes[0].set_xlabel('MCAT')
    axes[0].set_ylabel('GPA')
    axes[0].set_title('Observed P(≥1)')
    plt.colorbar(im1, ax=axes[0])

    im2 = axes[1].imshow(pred_grid, aspect='auto', origin='lower', vmin=vmin, vmax=vmax, cmap='RdYlGn')
    axes[1].set_xticks(range(len(unique_mcats)))
    axes[1].set_xticklabels([f'{int(m)}' for m in unique_mcats], rotation=45)
    axes[1].set_yticks(range(len(unique_gpas)))
    axes[1].set_yticklabels([f'{g:.1f}' for g in unique_gpas])
    axes[1].set_xlabel('MCAT')
    axes[1].set_ylabel('GPA')
    axes[1].set_title('Predicted P(≥1)')
    plt.colorbar(im2, ax=axes[1])

    fig.suptitle('Observed vs Predicted Acceptance Rates')
    fig.tight_layout()
    fig.savefig(output_dir / 'heatmap_comparison.png', dpi=150, bbox_inches='tight')
    plt.close()

    print(f"\nPlots saved to: {output_dir}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("MedAdmit Competitiveness Spline Calibration")
    print("=" * 60)

    # Load data
    print("\nLoading data...")
    a23_data = load_a23_data()
    schools = load_school_data()
    print(f"  Loaded {len(a23_data['cells'])} A-23 cells")
    print(f"  Loaded {len(schools)} schools")

    # Calibrate
    gpa_params, mcat_params, calibration_info = calibrate_splines(
        a23_data, schools, verbose=True
    )

    # Export parameters
    output_path = Path(__file__).parent.parent / "data" / "model" / "competitiveness-splines-v1.json"
    export_spline_parameters(gpa_params, mcat_params, calibration_info, output_path)

    # Generate plots
    plots_dir = Path(__file__).parent.parent / "data" / "model" / "calibration-plots"
    plots_dir.mkdir(exist_ok=True)
    generate_calibration_plots(
        gpa_params, mcat_params, a23_data, schools, calibration_info, plots_dir
    )

    # Test at anchor point
    print("\n" + "-" * 40)
    print("Verification at anchor point (C should be 0):")
    C_anchor = compute_C(GPA_ANCHOR, MCAT_ANCHOR, gpa_params, mcat_params)
    print(f"  GPA={GPA_ANCHOR}, MCAT={MCAT_ANCHOR}: C = {C_anchor:.6f}")

    # Test at extremes
    # Note: logit(P) = global_intercept + C, where C = GPA_contrib + MCAT_contrib
    global_int = calibration_info['global_intercept']
    print(f"\nCompetitiveness at key points:")
    print(f"  (Note: logit(P) = {global_int:.2f} + C, where C = GPA + MCAT contributions)")
    test_points = [
        (2.5, 490, "Very low stats"),
        (3.0, 500, "Low stats"),
        (3.5, 508, "Below average"),
        (3.75, 512, "Median accepted (anchor)"),
        (3.85, 516, "Above average"),
        (3.95, 520, "Strong stats"),
        (4.0, 525, "Top stats"),
    ]
    for gpa, mcat, desc in test_points:
        gpa_c = evaluate_monotone_spline(np.array([gpa]), gpa_params)[0]
        mcat_c = evaluate_monotone_spline(np.array([mcat]), mcat_params)[0]
        C = gpa_c + mcat_c
        logit_p = global_int + C
        p = expit(logit_p)
        print(f"  {desc}: GPA={gpa} ({gpa_c:+.2f}), MCAT={mcat} ({mcat_c:+.2f}) → C={C:+.2f}, P(≥1)={p:.1%}")

    print("\n" + "=" * 60)
    print("Calibration complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
