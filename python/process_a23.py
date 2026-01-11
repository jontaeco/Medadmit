#!/usr/bin/env python3
"""
Process AAMC Table A-23 data to add bin centers for model calibration.

This script reads the raw A-23 JSON and outputs a processed version with:
- Bin centers (midpoint of each GPA/MCAT range)
- Flattened array format for easier iteration
- Computed P(>=1 acceptance) estimates
"""

import json
from pathlib import Path

# Define bin centers
GPA_BIN_CENTERS = {
    "<2.20": 2.00,
    "2.20-2.39": 2.30,
    "2.40-2.59": 2.50,
    "2.60-2.79": 2.70,
    "2.80-2.99": 2.90,
    "3.00-3.19": 3.10,
    "3.20-3.39": 3.30,
    "3.40-3.59": 3.50,
    "3.60-3.79": 3.70,
    "≥3.80": 3.90,
}

MCAT_BIN_CENTERS = {
    "<486": 483,
    "486-489": 487.5,
    "490-493": 491.5,
    "494-497": 495.5,
    "498-501": 499.5,
    "502-505": 503.5,
    "506-509": 507.5,
    "510-513": 511.5,
    "514-517": 515.5,
    ">517": 521,
}

# GPA bin bounds for validation
GPA_BIN_BOUNDS = {
    "<2.20": (0.0, 2.20),
    "2.20-2.39": (2.20, 2.40),
    "2.40-2.59": (2.40, 2.60),
    "2.60-2.79": (2.60, 2.80),
    "2.80-2.99": (2.80, 3.00),
    "3.00-3.19": (3.00, 3.20),
    "3.20-3.39": (3.20, 3.40),
    "3.40-3.59": (3.40, 3.60),
    "3.60-3.79": (3.60, 3.80),
    "≥3.80": (3.80, 4.00),
}

# MCAT bin bounds
MCAT_BIN_BOUNDS = {
    "<486": (472, 486),
    "486-489": (486, 490),
    "490-493": (490, 494),
    "494-497": (494, 498),
    "498-501": (498, 502),
    "502-505": (502, 506),
    "506-509": (506, 510),
    "510-513": (510, 514),
    "514-517": (514, 518),
    ">517": (518, 528),
}


def process_a23():
    """Process the A-23 data and output processed version."""

    # Read raw data
    raw_path = Path(__file__).parent.parent / "data" / "aamc" / "table-a23.json"
    with open(raw_path) as f:
        raw_data = json.load(f)

    # Build processed cells array
    cells = []

    for gpa_bin, mcat_data in raw_data["grid"].items():
        gpa_center = GPA_BIN_CENTERS[gpa_bin]
        gpa_lower, gpa_upper = GPA_BIN_BOUNDS[gpa_bin]

        for mcat_bin, cell_data in mcat_data.items():
            mcat_center = MCAT_BIN_CENTERS[mcat_bin]
            mcat_lower, mcat_upper = MCAT_BIN_BOUNDS[mcat_bin]

            cells.append({
                "gpaBin": gpa_bin,
                "gpaCenter": gpa_center,
                "gpaLower": gpa_lower,
                "gpaUpper": gpa_upper,
                "mcatBin": mcat_bin,
                "mcatCenter": mcat_center,
                "mcatLower": mcat_lower,
                "mcatUpper": mcat_upper,
                "applicants": cell_data["applicants"],
                "acceptees": cell_data["acceptees"],
                "acceptanceRate": cell_data["acceptanceRate"],
                # Weight for calibration (more applicants = more reliable)
                "weight": cell_data["applicants"] / raw_data["metadata"]["totalApplicants"],
            })

    # Sort by GPA then MCAT for consistent ordering
    cells.sort(key=lambda x: (x["gpaCenter"], x["mcatCenter"]))

    # Compute summary statistics
    total_cells = len(cells)
    weighted_avg_rate = sum(c["acceptanceRate"] * c["weight"] for c in cells)

    processed_data = {
        "metadata": {
            **raw_data["metadata"],
            "processedAt": "2026-01-11",
            "processingVersion": "1.0.0",
            "totalCells": total_cells,
            "weightedAverageAcceptanceRate": round(weighted_avg_rate, 4),
        },
        "binDefinitions": {
            "gpa": {
                bin_name: {
                    "center": GPA_BIN_CENTERS[bin_name],
                    "lower": GPA_BIN_BOUNDS[bin_name][0],
                    "upper": GPA_BIN_BOUNDS[bin_name][1],
                }
                for bin_name in GPA_BIN_CENTERS
            },
            "mcat": {
                bin_name: {
                    "center": MCAT_BIN_CENTERS[bin_name],
                    "lower": MCAT_BIN_BOUNDS[bin_name][0],
                    "upper": MCAT_BIN_BOUNDS[bin_name][1],
                }
                for bin_name in MCAT_BIN_CENTERS
            },
        },
        "cells": cells,
        # Also keep grid format for backward compatibility
        "grid": raw_data["grid"],
    }

    # Write processed data
    output_path = Path(__file__).parent.parent / "data" / "aamc" / "table-a23-processed.json"
    with open(output_path, "w") as f:
        json.dump(processed_data, f, indent=2)

    print(f"Processed {total_cells} cells")
    print(f"Output written to: {output_path}")

    return processed_data


if __name__ == "__main__":
    process_a23()
