#!/usr/bin/env python3
"""
Process AAMC Table A-18 data for demographic effects in the model.

This script reads the raw A-18 JSON and outputs a processed version with:
- Logit-scale effects (for additive model)
- URM groupings
- Confidence intervals on logit scale
"""

import json
import math
from pathlib import Path


def logit(p):
    """Convert probability to logit (log-odds)."""
    if p <= 0:
        return -10
    if p >= 1:
        return 10
    return math.log(p / (1 - p))


def or_to_logit(odds_ratio):
    """Convert odds ratio to logit effect."""
    return math.log(odds_ratio)


def process_a18():
    """Process the A-18 data and output processed version."""

    # Read raw data
    raw_path = Path(__file__).parent.parent / "data" / "aamc" / "table-a18.json"
    with open(raw_path) as f:
        raw_data = json.load(f)

    # Define URM categories (as per AAMC definition)
    urm_categories = [
        "American Indian or Alaska Native",
        "Black or African American",
        "Hispanic, Latino, or of Spanish Origin",
        "Native Hawaiian or Other Pacific Islander",
    ]

    # Process each race/ethnicity group
    processed_groups = {}

    for group_name, group_data in raw_data["byRaceEthnicity"].items():
        adjustment = raw_data["adjustmentFactors"]["factors"].get(group_name, {})

        or_value = adjustment.get("oddsRatio", 1.0)
        or_lower = adjustment.get("ciLower", or_value)
        or_upper = adjustment.get("ciUpper", or_value)

        # Convert to logit scale
        logit_effect = or_to_logit(or_value)
        logit_lower = or_to_logit(or_lower)
        logit_upper = or_to_logit(or_upper)

        # Compute standard error from CI (assuming 95% CI = 1.96 * SE)
        logit_se = (logit_upper - logit_lower) / (2 * 1.96)

        processed_groups[group_name] = {
            # Raw statistics
            "applicants": group_data["applicants"],
            "matriculants": group_data["matriculants"],
            "rawAcceptanceRate": group_data["acceptanceRate"],
            "avgMCAT": group_data["avgMCAT"],
            "avgGPA": group_data["avgGPA"],

            # Odds ratio (relative to White)
            "oddsRatio": or_value,
            "oddsRatioCI": [or_lower, or_upper],

            # Logit-scale effect (for additive model)
            "logitEffect": round(logit_effect, 4),
            "logitEffectCI": [round(logit_lower, 4), round(logit_upper, 4)],
            "logitEffectSE": round(logit_se, 4),

            # Classification
            "isURM": group_name in urm_categories,
            "evidenceLevel": adjustment.get("evidenceLevel", "unknown"),
        }

    # Compute aggregate URM effect
    urm_applicants = sum(
        raw_data["byRaceEthnicity"][g]["applicants"]
        for g in urm_categories
    )
    urm_matriculants = sum(
        raw_data["byRaceEthnicity"][g]["matriculants"]
        for g in urm_categories
    )

    # Weighted average OR for URM
    urm_weights = [
        raw_data["byRaceEthnicity"][g]["applicants"] / urm_applicants
        for g in urm_categories
    ]
    urm_ors = [
        raw_data["adjustmentFactors"]["factors"][g]["oddsRatio"]
        for g in urm_categories
    ]
    # Geometric mean of ORs weighted by applicants
    import numpy as np
    urm_avg_or = np.exp(sum(w * np.log(o) for w, o in zip(urm_weights, urm_ors)))

    # Build processed output
    processed_data = {
        "metadata": {
            **raw_data["metadata"],
            "processedAt": "2026-01-11",
            "processingVersion": "1.0.0",
            "urmDefinition": urm_categories,
        },
        "byRaceEthnicity": processed_groups,
        "urmAggregate": {
            "categories": urm_categories,
            "totalApplicants": urm_applicants,
            "totalMatriculants": urm_matriculants,
            "rawAcceptanceRate": round(urm_matriculants / urm_applicants, 4),
            "weightedOddsRatio": round(urm_avg_or, 2),
            "logitEffect": round(or_to_logit(urm_avg_or), 4),
            "notes": "Geometric mean of subgroup ORs, weighted by applicant count",
        },
        # Model-ready effects (for direct use in two-stage model)
        "modelEffects": {
            "urm": {
                "mean": round(or_to_logit(urm_avg_or), 4),
                "sd": 0.4,  # As specified in plan - captures school-to-school variation
                "source": "A-18 weighted aggregate + BMC Med Ed 2023",
            },
            "urmBlack": {
                "mean": round(or_to_logit(7.0), 4),
                "sd": 0.3,
                "source": "BMC Med Ed 2023",
            },
            "urmHispanic": {
                "mean": round(or_to_logit(4.0), 4),
                "sd": 0.3,
                "source": "BMC Med Ed 2023",
            },
            "asian": {
                "mean": round(or_to_logit(0.85), 4),
                "sd": 0.15,
                "source": "BMC Med Ed 2023 - slight disadvantage at same stats",
            },
        },
    }

    # Write processed data
    output_path = Path(__file__).parent.parent / "data" / "aamc" / "table-a18-processed.json"
    with open(output_path, "w") as f:
        json.dump(processed_data, f, indent=2)

    print(f"Processed {len(processed_groups)} demographic groups")
    print(f"URM aggregate OR: {urm_avg_or:.2f}")
    print(f"Output written to: {output_path}")

    return processed_data


if __name__ == "__main__":
    process_a18()
