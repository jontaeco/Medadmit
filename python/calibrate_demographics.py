#!/usr/bin/env python3
"""
Demographic and Mission Effect Calibration

This script calibrates demographic effect parameters from AAMC A-18 data
and literature, then exports parameters for the TypeScript model.

Effects are specified on the logit scale:
  logit(P) = ... + β_demo * I(demographic)

where β_demo > 0 increases acceptance probability.

Sources:
- AAMC Table A-18: Race/ethnicity acceptance rates
- BMC Medical Education 2023: Demographic ORs controlling for stats
- WWAMI studies: Rural mission effectiveness
- Holistic review literature: First-gen, disadvantaged effects
"""

import json
from pathlib import Path
from typing import Dict, Any
import numpy as np

# Paths
DATA_DIR = Path(__file__).parent.parent / "data"
A18_PATH = DATA_DIR / "aamc" / "table-a18-processed.json"
SCHOOLS_PATH = DATA_DIR / "schools" / "md-schools-enhanced.json"
OUTPUT_PATH = DATA_DIR / "model" / "demographic-parameters-v1.json"


def load_a18_data() -> Dict:
    """Load processed A-18 data."""
    with open(A18_PATH) as f:
        return json.load(f)


def load_schools_data() -> Dict:
    """Load enhanced schools data."""
    with open(SCHOOLS_PATH) as f:
        return json.load(f)


def calibrate_race_ethnicity_effects(a18: Dict, verbose: bool = True) -> Dict:
    """
    Extract race/ethnicity effects from A-18 data.

    The A-18 data already has logit effects computed relative to White applicants,
    adjusting for average GPA/MCAT differences.

    Returns effects on logit scale with uncertainty.
    """
    effects = {}

    by_race = a18["byRaceEthnicity"]

    for race, data in by_race.items():
        effect = {
            "mean": data["logitEffect"],
            "sd": data["logitEffectSE"] * 2,  # Inflate SE for model uncertainty
            "ci95": data.get("logitEffectCI", [data["logitEffect"], data["logitEffect"]]),
            "oddsRatio": data["oddsRatio"],
            "isURM": data.get("isURM", False),
            "evidenceLevel": data.get("evidenceLevel", "moderate"),
            "source": "AAMC A-18 2023-2024",
        }

        # Use normalized key names
        key = race.lower().replace(" ", "_").replace(",", "").replace("/", "_or_")
        effects[key] = effect

    # Add aggregate URM effect
    urm_agg = a18.get("urmAggregate", {})
    effects["urm_aggregate"] = {
        "mean": urm_agg.get("logitEffect", 1.70),
        "sd": 0.40,  # From literature variation
        "oddsRatio": urm_agg.get("weightedOddsRatio", 5.45),
        "source": "A-18 weighted aggregate + BMC Med Ed 2023",
    }

    if verbose:
        print("Race/Ethnicity Effects (logit scale):")
        for race, eff in effects.items():
            or_val = eff.get("oddsRatio", np.exp(eff["mean"]))
            print(f"  {race}: β={eff['mean']:.3f} (OR={or_val:.2f})")

    return effects


def calibrate_ses_effects(verbose: bool = True) -> Dict:
    """
    Calibrate socioeconomic status effects from literature.

    These are not directly available in AAMC data but supported by literature.
    """
    effects = {
        "first_generation": {
            "mean": 0.15,  # OR ≈ 1.16
            "sd": 0.10,
            "oddsRatio": 1.16,
            "source": "Holistic review literature (Addams et al., 2021)",
            "notes": "Small positive effect; schools value first-gen status",
        },
        "disadvantaged_ses": {
            "mean": 0.22,  # OR ≈ 1.25
            "sd": 0.12,
            "oddsRatio": 1.25,
            "source": "Holistic review literature + AAMC FAP correlation",
            "notes": "Moderate effect; FAP applicants get holistic consideration",
        },
        "rural_background": {
            "mean": 0.20,  # OR ≈ 1.22
            "sd": 0.15,
            "oddsRatio": 1.22,
            "source": "WWAMI and rural track studies",
            "notes": "Effect varies greatly by school mission",
        },
    }

    if verbose:
        print("\nSES Effects (logit scale):")
        for name, eff in effects.items():
            print(f"  {name}: β={eff['mean']:.3f} (OR={eff['oddsRatio']:.2f})")

    return effects


def calibrate_mission_interactions(schools: Dict, verbose: bool = True) -> Dict:
    """
    Calibrate mission fit interaction effects.

    These represent the additional benefit when applicant features
    match school mission features.

    Interaction: β * I(school_feature) * I(applicant_feature)
    """
    # Count schools with each mission feature
    school_list = schools.get("schools", [])
    n_schools = len(school_list)

    feature_counts = {
        "ruralMission": 0,
        "researchIntensive": 0,
        "primaryCareFocus": 0,
        "hbcu": 0,
        "diversityFocus": 0,
    }

    for school in school_list:
        mission = school.get("missionFeatures", {})
        for feat in feature_counts:
            if mission.get(feat, False):
                feature_counts[feat] += 1

    if verbose:
        print(f"\nSchool mission feature counts (n={n_schools}):")
        for feat, count in feature_counts.items():
            print(f"  {feat}: {count} ({100*count/n_schools:.1f}%)")

    # Define interaction effects
    interactions = {
        "rural_x_rural": {
            "mean": 0.40,  # OR ≈ 1.49 for rural applicant at rural school
            "sd": 0.20,
            "oddsRatio": 1.49,
            "schoolFeature": "ruralMission",
            "applicantFeature": "isRural",
            "source": "WWAMI program studies",
            "notes": "Strong effect for schools with explicit rural mission",
        },
        "research_x_research": {
            "mean": 0.20,  # OR ≈ 1.22
            "sd": 0.15,
            "oddsRatio": 1.22,
            "schoolFeature": "researchIntensive",
            "applicantFeature": "hasStrongResearch",
            "source": "Research-focused school admission patterns",
            "notes": "Modest effect; research schools value research experience",
        },
        "hbcu_x_urm_black": {
            "mean": 0.50,  # OR ≈ 1.65
            "sd": 0.25,
            "oddsRatio": 1.65,
            "schoolFeature": "hbcu",
            "applicantFeature": "isBlack",
            "source": "HBCU mission and historical patterns",
            "notes": "HBCUs have strong mission to train Black physicians",
        },
        "diversity_x_urm": {
            "mean": 0.25,  # OR ≈ 1.28
            "sd": 0.15,
            "oddsRatio": 1.28,
            "schoolFeature": "diversityFocus",
            "applicantFeature": "isUrm",
            "source": "Schools with diversity initiatives",
            "notes": "Schools with diversity focus may give URM additional consideration",
        },
        "public_x_instate": {
            "mean": 0.80,  # OR ≈ 2.23
            "sd": 0.30,
            "oddsRatio": 2.23,
            "schoolFeature": "isPublic",
            "applicantFeature": "isInState",
            "source": "MSAR in-state vs OOS rates for public schools",
            "notes": "Strong effect; public schools funded by state taxes",
        },
        "primary_care_x_pc_interest": {
            "mean": 0.15,  # OR ≈ 1.16
            "sd": 0.10,
            "oddsRatio": 1.16,
            "schoolFeature": "primaryCareFocus",
            "applicantFeature": "primaryCareInterest",
            "source": "Primary care track admission patterns",
            "notes": "Modest effect; schools want mission-aligned students",
        },
    }

    if verbose:
        print("\nMission Interaction Effects (logit scale):")
        for name, eff in interactions.items():
            print(f"  {name}: β={eff['mean']:.3f} (OR={eff['oddsRatio']:.2f})")

    return interactions


def calibrate_school_level_variance(verbose: bool = True) -> Dict:
    """
    Set hyperparameters for school-level variation in demographic effects.

    Without school-specific outcome data, we use these to express
    uncertainty about how effects vary across schools.
    """
    variances = {
        "urm_effect": {
            "sd": 0.40,  # Schools vary by ~1.5x in either direction
            "notes": "Large variation; some schools much more URM-friendly",
        },
        "ses_effect": {
            "sd": 0.25,
            "notes": "Moderate variation in SES consideration",
        },
        "instate_effect": {
            "sd": 0.35,
            "notes": "Varies by state mandate and funding",
        },
        "mission_interaction": {
            "sd": 0.20,
            "notes": "Some schools weight mission fit more than others",
        },
    }

    if verbose:
        print("\nSchool-level variance (σ for partial pooling):")
        for name, var in variances.items():
            print(f"  {name}: σ={var['sd']:.2f}")

    return variances


def export_parameters(
    race_effects: Dict,
    ses_effects: Dict,
    mission_interactions: Dict,
    school_variances: Dict,
    output_path: Path,
    verbose: bool = True,
) -> None:
    """Export all demographic parameters to JSON."""

    parameters = {
        "metadata": {
            "version": "1.0.0",
            "generatedAt": "2026-01-12",
            "sources": [
                "AAMC Table A-18 (2023-2024)",
                "BMC Medical Education 2023",
                "WWAMI program studies",
                "Holistic review literature",
            ],
            "notes": [
                "All effects on logit scale: logit(P) = ... + β * I(feature)",
                "Positive β increases acceptance probability",
                "SD represents uncertainty, not just sampling error",
                "School-level variances control shrinkage toward mean",
            ],
        },
        "raceEthnicity": race_effects,
        "socioeconomic": ses_effects,
        "missionInteractions": mission_interactions,
        "schoolLevelVariance": school_variances,
        "referenceGroup": {
            "raceEthnicity": "White",
            "ses": "Not first-gen, not disadvantaged, not rural",
            "notes": "All effects relative to reference group",
        },
    }

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(parameters, f, indent=2)

    if verbose:
        print(f"\nExported parameters to {output_path}")


def main():
    """Main calibration routine."""
    print("=" * 60)
    print("Demographic and Mission Effect Calibration")
    print("=" * 60)

    # Load data
    print("\nLoading data...")
    a18 = load_a18_data()
    schools = load_schools_data()

    # Calibrate effects
    race_effects = calibrate_race_ethnicity_effects(a18)
    ses_effects = calibrate_ses_effects()
    mission_interactions = calibrate_mission_interactions(schools)
    school_variances = calibrate_school_level_variance()

    # Export
    export_parameters(
        race_effects,
        ses_effects,
        mission_interactions,
        school_variances,
        OUTPUT_PATH,
    )

    # Summary statistics
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Race/ethnicity effects: {len(race_effects)}")
    print(f"SES effects: {len(ses_effects)}")
    print(f"Mission interactions: {len(mission_interactions)}")

    # Validation checks
    print("\nValidation:")

    # Check that URM effects are positive and substantial
    urm_agg = race_effects.get("urm_aggregate", {})
    urm_or = urm_agg.get("oddsRatio", 1.0)
    print(f"  URM aggregate OR: {urm_or:.2f} (target: 4.5-5.5)")
    if 4.0 <= urm_or <= 6.0:
        print("    [OK] Within expected range")
    else:
        print("    [WARN] Outside expected range")

    # Check Black effect specifically (strongest)
    black_eff = race_effects.get("black_or_african_american", {})
    black_or = black_eff.get("oddsRatio", 1.0)
    print(f"  Black OR: {black_or:.2f} (target: 5.5-7.5)")
    if 5.0 <= black_or <= 8.0:
        print("    [OK] Within expected range")
    else:
        print("    [WARN] Outside expected range")

    # Check in-state effect
    instate = mission_interactions.get("public_x_instate", {})
    instate_or = instate.get("oddsRatio", 1.0)
    print(f"  In-state (public) OR: {instate_or:.2f} (target: 2.0-3.0)")
    if 1.8 <= instate_or <= 3.5:
        print("    [OK] Within expected range")
    else:
        print("    [WARN] Outside expected range")

    print("\n" + "=" * 60)
    print("Calibration complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
