#!/usr/bin/env python3
"""
Enhance schools data with mission features and additional MSAR fields.

This script:
1. Adds binary mission features based on keywords and known classifications
2. Estimates missing MCAT percentiles
3. Computes derived fields for the two-stage model
4. Assigns tiers consistently
"""

import json
import math
from pathlib import Path

# Known HBCUs with medical schools
HBCU_SCHOOLS = {
    "howard",
    "meharry",
    "morehouse",
}

# Schools with explicit rural mission/programs
RURAL_MISSION_SCHOOLS = {
    "university-of-washington",  # WWAMI
    "east-tennessee-state",
    "marshall-university",
    "university-of-north-dakota",
    "university-of-south-dakota",
    "university-of-new-mexico",
    "university-of-kansas",
    "university-of-nebraska",
    "university-of-kentucky",
    "west-virginia-university",
    "university-of-minnesota-duluth",
    "michigan-state",
    "ohio-university",
    "east-carolina",
    "mercer-university",
    "university-of-arkansas",
    "louisiana-state-shreveport",
}

# Research-intensive schools (Top 30 NIH funding or large MD/PhD programs)
RESEARCH_INTENSIVE_SCHOOLS = {
    "harvard-med",
    "stanford-med",
    "johns-hopkins",
    "ucsf",
    "upenn",
    "columbia",
    "duke",
    "yale",
    "washu",
    "mit-harvard",
    "nyu",
    "ucla",
    "umich",
    "cornell",
    "northwestern",
    "vanderbilt",
    "uchicago",
    "mayo",
    "pitt",
    "ucsd",
    "usc",
    "baylor",
    "emory",
    "mount-sinai",
    "case-western",
    "ohio-state",
    "uva",
    "unc",
    "utsw",
}

# Primary care focused schools (>40% PC match or explicit mission)
PRIMARY_CARE_SCHOOLS = {
    "university-of-washington",
    "oregon-health-science",
    "university-of-california-davis",
    "university-of-new-mexico",
    "university-of-massachusetts",
    "michigan-state",
    "east-carolina",
    "east-tennessee-state",
    "florida-state",
    "university-of-south-florida",
    "wright-state",
    "southern-illinois",
    "university-of-minnesota-duluth",
    "university-of-north-dakota",
    "university-of-south-dakota",
    "university-of-vermont",
}


def estimate_mcat_percentiles(median, p10=None, p90=None):
    """Estimate missing MCAT percentiles from available data."""
    # MCAT scores are roughly normally distributed with SD ~6
    # Estimate based on median and typical spread
    assumed_sd = 6.0

    if p10 is None:
        p10 = median - 1.28 * assumed_sd  # 10th percentile
    if p90 is None:
        p90 = median + 1.28 * assumed_sd

    # Estimate 25th and 75th
    p25 = median - 0.67 * assumed_sd
    p75 = median + 0.67 * assumed_sd

    return {
        "p10": round(max(472, min(528, p10))),
        "p25": round(max(472, min(528, p25))),
        "p50": median,
        "p75": round(max(472, min(528, p75))),
        "p90": round(max(472, min(528, p90))),
    }


def estimate_gpa_percentiles(median, p10=None, p90=None):
    """Estimate missing GPA percentiles from available data."""
    # GPA compressed at top; use asymmetric distribution
    if p10 is None:
        p10 = max(2.5, median - 0.3)
    if p90 is None:
        p90 = min(4.0, median + 0.08)

    p25 = max(2.5, (median + p10) / 2)
    p75 = min(4.0, (median + p90) / 2)

    return {
        "p10": round(p10, 2),
        "p25": round(p25, 2),
        "p50": median,
        "p75": round(p75, 2),
        "p90": round(p90, 2),
    }


def classify_mission(school):
    """Determine binary mission features for a school."""
    school_id = school.get("id", "").lower()
    school_name = school.get("name", "").lower()
    keywords = [k.lower() for k in school.get("missionKeywords", [])]

    # HBCU detection
    is_hbcu = any(h in school_id or h in school_name for h in HBCU_SCHOOLS)

    # Rural mission detection
    is_rural = (
        school_id in RURAL_MISSION_SCHOOLS
        or "rural" in keywords
        or "rural" in school_name
    )

    # Research intensive
    us_news_rank = school.get("usNewsRankResearch")
    is_research = (
        school_id in RESEARCH_INTENSIVE_SCHOOLS
        or school.get("warsTier", 5) <= 2
        or (us_news_rank is not None and us_news_rank <= 30)
        or "research" in keywords
    )

    # Primary care focus
    is_primary_care = (
        school_id in PRIMARY_CARE_SCHOOLS
        or "primary-care" in keywords
        or "primary care" in school_name
        or "family medicine" in school_name
    )

    # Diversity focus
    is_diversity = (
        is_hbcu
        or "diversity" in keywords
        or "underserved" in keywords
        or "health-equity" in keywords
    )

    return {
        "ruralMission": is_rural,
        "researchIntensive": is_research,
        "primaryCareFocus": is_primary_care,
        "hbcu": is_hbcu,
        "diversityFocus": is_diversity,
    }


def compute_derived_fields(school):
    """Compute additional fields needed by the model."""
    # Interview rate (should already exist)
    total_apps = school.get("totalApplicants", 0)
    total_int = school.get("totalInterviewed", 0)
    total_acc = school.get("totalAccepted", 0)

    interview_rate = total_int / total_apps if total_apps > 0 else None
    interview_to_accept = total_acc / total_int if total_int > 0 else None

    # Compute OOS acceptance rate if not present
    pct_is = school.get("pctInStateMatriculants", 0)
    pct_oos = 1 - pct_is

    # Estimate in-state/OOS interview rates for public schools
    is_public = school.get("isPublic", False)
    if is_public and pct_is > 0.3:
        # Public schools typically have 2-4x higher in-state interview rate
        # Use overall interview rate and in-state composition to estimate
        in_state_factor = 2.5  # Typical ratio
        oos_interview_rate = interview_rate / (pct_is * in_state_factor + pct_oos)
        is_interview_rate = oos_interview_rate * in_state_factor
    else:
        is_interview_rate = interview_rate
        oos_interview_rate = interview_rate

    return {
        "interviewRate": round(interview_rate, 4) if interview_rate else None,
        "interviewToAcceptRate": round(interview_to_accept, 4) if interview_to_accept else None,
        "inStateInterviewRate": round(is_interview_rate, 4) if is_interview_rate else None,
        "oosInterviewRate": round(oos_interview_rate, 4) if oos_interview_rate else None,
    }


def enhance_schools():
    """Main function to enhance all schools data."""

    # Read raw schools data
    raw_path = Path(__file__).parent.parent / "data" / "schools" / "md-schools.json"
    with open(raw_path) as f:
        raw_data = json.load(f)

    enhanced_schools = []

    for school in raw_data["schools"]:
        # Get mission features
        mission = classify_mission(school)

        # Get percentile estimates
        mcat_pct = estimate_mcat_percentiles(
            school.get("medianMCAT", 510),
            school.get("mcat10thPercentile"),
            school.get("mcat90thPercentile"),
        )
        gpa_pct = estimate_gpa_percentiles(
            school.get("medianGPA", 3.7),
            school.get("gpa10thPercentile"),
            school.get("gpa90thPercentile"),
        )

        # Get derived fields
        derived = compute_derived_fields(school)

        # Build enhanced school object
        enhanced = {
            **school,
            "missionFeatures": mission,
            "mcatPercentiles": mcat_pct,
            "gpaPercentiles": gpa_pct,
            "interviewRate": derived["interviewRate"] or school.get("interviewRate"),
            "interviewToAcceptRate": derived["interviewToAcceptRate"] or school.get("interviewToAcceptanceRate"),
            "inStateInterviewRate": derived["inStateInterviewRate"],
            "oosInterviewRate": derived["oosInterviewRate"],
            # Ensure tier is present
            "tier": school.get("warsTier", 3),
        }

        enhanced_schools.append(enhanced)

    # Compute summary statistics
    mission_counts = {
        "ruralMission": sum(1 for s in enhanced_schools if s["missionFeatures"]["ruralMission"]),
        "researchIntensive": sum(1 for s in enhanced_schools if s["missionFeatures"]["researchIntensive"]),
        "primaryCareFocus": sum(1 for s in enhanced_schools if s["missionFeatures"]["primaryCareFocus"]),
        "hbcu": sum(1 for s in enhanced_schools if s["missionFeatures"]["hbcu"]),
        "diversityFocus": sum(1 for s in enhanced_schools if s["missionFeatures"]["diversityFocus"]),
    }

    # Build output
    output_data = {
        "metadata": {
            **raw_data["metadata"],
            "enhancedAt": "2026-01-11",
            "enhancementVersion": "1.0.0",
            "missionFeatureCounts": mission_counts,
        },
        "schools": enhanced_schools,
    }

    # Write enhanced data
    output_path = Path(__file__).parent.parent / "data" / "schools" / "md-schools-enhanced.json"
    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Enhanced {len(enhanced_schools)} schools")
    print(f"Mission feature counts: {mission_counts}")
    print(f"Output written to: {output_path}")

    return output_data


if __name__ == "__main__":
    enhance_schools()
