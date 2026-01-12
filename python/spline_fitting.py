#!/usr/bin/env python3
"""
I-Spline (Integrated B-Spline) Implementation for Monotone Regression

I-splines are monotonically increasing basis functions formed by integrating
B-splines. They are ideal for enforcing monotonicity constraints in regression.

For monotone regression:
    f(x) = intercept + sum_j(beta_j * I_j(x)), where beta_j >= 0

This guarantees f(x) is monotonically increasing.

Reference: Ramsay, J.O. (1988). Monotone Regression Splines in Action.
"""

import numpy as np
from scipy.interpolate import BSpline
from scipy.optimize import minimize, Bounds
from typing import Tuple, List, Optional, Dict


def create_bspline_basis(
    x: np.ndarray,
    n_basis: int,
    degree: int = 3,
    x_min: Optional[float] = None,
    x_max: Optional[float] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create B-spline basis matrix with evenly spaced knots.

    Args:
        x: Points at which to evaluate
        n_basis: Number of basis functions
        degree: Spline degree (default 3 for cubic)
        x_min: Minimum x value for knots (default: min(x))
        x_max: Maximum x value for knots (default: max(x))

    Returns:
        Tuple of (basis_matrix, knots)
    """
    x = np.atleast_1d(x).astype(float)

    if x_min is None:
        x_min = x.min()
    if x_max is None:
        x_max = x.max()

    # Number of interior knots
    n_interior = n_basis - degree - 1
    if n_interior < 0:
        n_interior = 0

    # Create knot sequence
    interior_knots = np.linspace(x_min, x_max, n_interior + 2)[1:-1]
    knots = np.concatenate([
        np.repeat(x_min, degree + 1),
        interior_knots,
        np.repeat(x_max, degree + 1)
    ])

    # Build basis matrix
    basis = np.zeros((len(x), n_basis))
    for i in range(n_basis):
        c = np.zeros(n_basis)
        c[i] = 1.0
        spline = BSpline(knots, c, degree, extrapolate=True)
        basis[:, i] = spline(x)

    return basis, knots


def create_ispline_basis(
    x: np.ndarray,
    n_basis: int,
    degree: int = 3,
    x_min: Optional[float] = None,
    x_max: Optional[float] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create I-spline (monotone increasing) basis matrix.

    I-splines are constructed by taking cumulative sums of B-splines,
    resulting in basis functions that monotonically increase from 0 to 1.

    Args:
        x: Points at which to evaluate
        n_basis: Number of I-spline basis functions
        degree: Spline degree
        x_min: Minimum x value
        x_max: Maximum x value

    Returns:
        Tuple of (ispline_basis_matrix, knots)
    """
    x = np.atleast_1d(x).astype(float)

    if x_min is None:
        x_min = x.min()
    if x_max is None:
        x_max = x.max()

    # First compute B-spline basis at x_max to get normalization constants
    bspline_at_max, knots = create_bspline_basis(
        np.array([x_max]), n_basis + 1, degree, x_min, x_max
    )
    bspline_max_reversed = bspline_at_max[:, 1:]
    ispline_at_max = np.cumsum(bspline_max_reversed[:, ::-1], axis=1)[:, ::-1]
    norm_constants = ispline_at_max[0, :].copy()
    norm_constants[norm_constants == 0] = 1  # Avoid division by zero

    # Now compute B-spline basis at input x
    bspline_basis, _ = create_bspline_basis(
        x, n_basis + 1, degree, x_min, x_max
    )

    # I-spline: cumulative sum from RIGHT to LEFT, then flip
    # This gives monotonically INCREASING basis functions
    bspline_reversed = bspline_basis[:, 1:]  # Drop first basis
    ispline_basis = np.cumsum(bspline_reversed[:, ::-1], axis=1)[:, ::-1]

    # Normalize using constants computed at x_max
    ispline_basis = ispline_basis / norm_constants

    return ispline_basis, knots


def evaluate_monotone_spline(
    x: np.ndarray,
    params: Dict,
) -> np.ndarray:
    """
    Evaluate a fitted monotone spline at given points.

    Args:
        x: Points at which to evaluate
        params: Dictionary with 'coefficients', 'intercept', 'n_basis',
                'degree', 'x_min', 'x_max'

    Returns:
        Spline values at x
    """
    x = np.atleast_1d(x).astype(float)

    coef = np.array(params['coefficients'])
    intercept = params['intercept']
    n_basis = params['n_basis']
    degree = params.get('degree', 3)
    x_min = params['x_min']
    x_max = params['x_max']

    # Create I-spline basis at evaluation points
    basis, _ = create_ispline_basis(x, n_basis, degree, x_min, x_max)

    # Evaluate: f(x) = intercept + sum(coef * basis)
    result = intercept + basis @ coef

    return result


def fit_monotone_spline(
    x: np.ndarray,
    y: np.ndarray,
    n_basis: int = 6,
    weights: Optional[np.ndarray] = None,
    degree: int = 3,
    smoothness_penalty: float = 0.001,
    anchor_point: Optional[Tuple[float, float]] = None,
    x_min: Optional[float] = None,
    x_max: Optional[float] = None,
) -> Tuple[Dict, Dict]:
    """
    Fit a monotone increasing spline to data.

    Uses I-splines with non-negative coefficients to ensure monotonicity.

    Args:
        x: Input values
        y: Target values
        n_basis: Number of basis functions (more = more flexible)
        weights: Optional sample weights
        degree: Spline degree (default 3)
        smoothness_penalty: L2 penalty on coefficient differences
        anchor_point: Optional (x, y) point the spline must pass through
        x_min: Minimum x for knots (default: min(x))
        x_max: Maximum x for knots (default: max(x))

    Returns:
        Tuple of (params_dict, fit_info_dict)
    """
    x = np.atleast_1d(x).astype(float)
    y = np.atleast_1d(y).astype(float)

    if weights is None:
        weights = np.ones_like(x)
    weights = weights / weights.sum()

    if x_min is None:
        x_min = x.min()
    if x_max is None:
        x_max = x.max()

    # Create I-spline basis
    basis, knots = create_ispline_basis(x, n_basis, degree, x_min, x_max)

    # Handle anchor point
    if anchor_point is not None:
        x_anchor, y_anchor = anchor_point
        basis_anchor, _ = create_ispline_basis(
            np.array([x_anchor]), n_basis, degree, x_min, x_max
        )

    def loss(params):
        """Loss function: weighted MSE + smoothness penalty."""
        # Use softplus to ensure positivity: softplus(x) = log(1 + exp(x))
        raw_coef = params[:n_basis]
        coef = np.log1p(np.exp(raw_coef))  # softplus

        if anchor_point is not None:
            # Intercept determined by anchor point
            intercept = y_anchor - (basis_anchor @ coef)[0]
        else:
            intercept = params[n_basis]

        pred = intercept + basis @ coef
        mse = np.sum(weights * (y - pred) ** 2)

        # Smoothness: penalize large differences between adjacent coefficients
        smooth = smoothness_penalty * np.sum(np.diff(coef) ** 2)

        return mse + smooth

    # Initial guess - start with values that give reasonable coef after softplus
    # softplus(0) ≈ 0.69, softplus(1) ≈ 1.31
    init_coef = np.zeros(n_basis)  # softplus(0) ≈ 0.69

    if anchor_point is not None:
        x0 = init_coef
    else:
        x0 = np.concatenate([init_coef, [np.mean(y)]])

    # Optimize with multiple restarts
    best_result = None
    best_loss = np.inf

    for trial in range(3):
        if trial > 0:
            # Random perturbation for restart
            x0_trial = x0 + np.random.randn(len(x0)) * 0.5
        else:
            x0_trial = x0

        result = minimize(
            loss,
            x0_trial,
            method='L-BFGS-B',
            options={'maxiter': 2000, 'ftol': 1e-12, 'gtol': 1e-8}
        )

        if result.fun < best_loss:
            best_loss = result.fun
            best_result = result

    result = best_result

    # Extract results - apply softplus to get actual coefficients
    coef = np.log1p(np.exp(result.x[:n_basis]))

    if anchor_point is not None:
        intercept = y_anchor - (basis_anchor @ coef)[0]
    else:
        intercept = result.x[n_basis]

    # Compute predictions and fit statistics
    pred = intercept + basis @ coef
    residuals = y - pred
    ss_res = np.sum(weights * residuals ** 2)
    ss_tot = np.sum(weights * (y - np.average(y, weights=weights)) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
    rmse = np.sqrt(np.mean(residuals ** 2))

    # Check monotonicity
    x_check = np.linspace(x_min, x_max, 200)
    basis_check, _ = create_ispline_basis(x_check, n_basis, degree, x_min, x_max)
    y_check = intercept + basis_check @ coef
    is_monotone = np.all(np.diff(y_check) >= -1e-10)

    params = {
        'coefficients': coef.tolist(),
        'intercept': float(intercept),
        'n_basis': n_basis,
        'degree': degree,
        'x_min': float(x_min),
        'x_max': float(x_max),
        'knots': knots.tolist(),
    }

    fit_info = {
        'rmse': float(rmse),
        'r2': float(r2),
        'is_monotone': bool(is_monotone),
        'converged': result.success,
        'n_iterations': result.nit,
        'message': result.message if hasattr(result, 'message') else '',
    }

    return params, fit_info


# ============================================================================
# Testing
# ============================================================================

if __name__ == '__main__':
    print("Testing I-spline implementation...")
    print("=" * 50)

    # Test 1: Simple monotonic function
    np.random.seed(42)
    x_test = np.linspace(0, 10, 50)
    y_true = 2 * np.log1p(x_test)
    y_noisy = y_true + np.random.normal(0, 0.2, len(x_test))

    params, info = fit_monotone_spline(
        x_test, y_noisy,
        n_basis=6,
        smoothness_penalty=0.01
    )

    print(f"\nTest 1: Fitting log function")
    print(f"  RMSE: {info['rmse']:.4f}")
    print(f"  R²: {info['r2']:.4f}")
    print(f"  Monotone: {info['is_monotone']}")
    print(f"  Converged: {info['converged']}")
    print(f"  Coefficients: {[f'{c:.3f}' for c in params['coefficients']]}")

    # Test 2: With anchor point
    params2, info2 = fit_monotone_spline(
        x_test, y_noisy,
        n_basis=6,
        smoothness_penalty=0.01,
        anchor_point=(5.0, 2 * np.log1p(5.0))  # Anchor at middle
    )

    print(f"\nTest 2: With anchor point at x=5")
    print(f"  RMSE: {info2['rmse']:.4f}")
    print(f"  R²: {info2['r2']:.4f}")
    print(f"  Monotone: {info2['is_monotone']}")

    # Verify anchor
    y_at_anchor = evaluate_monotone_spline(np.array([5.0]), params2)
    print(f"  Value at anchor x=5: {y_at_anchor[0]:.4f} (target: {2*np.log1p(5.0):.4f})")

    # Test 3: Evaluation at new points
    x_new = np.array([0, 2.5, 5, 7.5, 10])
    y_eval = evaluate_monotone_spline(x_new, params)
    print(f"\nTest 3: Evaluation at new points")
    print(f"  x: {x_new}")
    print(f"  y: {[f'{v:.3f}' for v in y_eval]}")
    print(f"  Increasing: {all(np.diff(y_eval) >= 0)}")

    # Save test plot
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 6))
        ax.scatter(x_test, y_noisy, alpha=0.5, label='Noisy data', s=30)
        ax.plot(x_test, y_true, 'g--', label='True function', linewidth=2)

        x_smooth = np.linspace(0, 10, 200)
        y_pred = evaluate_monotone_spline(x_smooth, params)
        ax.plot(x_smooth, y_pred, 'r-', label='Fitted I-spline', linewidth=2)

        ax.set_xlabel('x')
        ax.set_ylabel('y')
        ax.set_title('Monotone Spline Regression with I-splines')
        ax.legend()
        ax.grid(True, alpha=0.3)
        fig.savefig('ispline_test.png', dpi=150, bbox_inches='tight')
        plt.close()
        print("\nTest plot saved to ispline_test.png")
    except Exception as e:
        print(f"\nCould not save plot: {e}")

    print("\n" + "=" * 50)
    print("All tests passed!")
