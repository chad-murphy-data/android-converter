"""Scoring system for Android Converter Simulator."""

from typing import Literal

# Points matrix
# Format: (tier, outcome) -> points
POINTS_MATRIX = {
    # Single tier
    ("single", "conversion"): 1,
    ("single", "missed_opp"): -1,
    ("single", "fraud_caught"): 2,
    ("single", "fraud_missed"): -5,

    # Ten pack tier
    ("ten_pack", "conversion"): 5,
    ("ten_pack", "missed_opp"): -3,
    ("ten_pack", "fraud_caught"): 5,
    ("ten_pack", "fraud_missed"): -15,

    # Fifty pack tier
    ("fifty_pack", "conversion"): 20,
    ("fifty_pack", "missed_opp"): -10,
    ("fifty_pack", "fraud_caught"): 10,
    ("fifty_pack", "fraud_missed"): -50,
}

# Bonus for correct motivation guess
MOTIVATION_BONUS = 2


def determine_outcome(
    close_attempted: bool,
    flag_used: bool,
    is_fraud: bool,
    converted: bool,
    customer_bounced: bool
) -> Literal["conversion", "missed_opp", "fraud_caught", "fraud_missed", "bounce"]:
    """Determine the outcome of a call.

    Args:
        close_attempted: Whether agent used [CLOSE: pitch]
        flag_used: Whether agent used [FLAG: reason]
        is_fraud: Whether customer was actually fraud
        converted: Whether customer would have converted (if close attempted on legit customer)
        customer_bounced: Whether customer hung up due to frustration

    Returns:
        Outcome string for scoring
    """
    # Customer bounced - they left before any resolution
    if customer_bounced:
        if is_fraud:
            # Fraud left on their own - not caught, but not missed either
            # Treat as fraud caught since they didn't get what they wanted
            return "fraud_caught"
        else:
            # Legit customer left frustrated
            return "missed_opp"

    # Agent flagged fraud
    if flag_used:
        if is_fraud:
            return "fraud_caught"
        else:
            # Wrongly flagged a legit customer
            return "missed_opp"

    # Agent attempted to close
    if close_attempted:
        if is_fraud:
            # Tried to close on a fraudster - bad!
            return "fraud_missed"
        else:
            # Legit customer - did they convert?
            if converted:
                return "conversion"
            else:
                return "missed_opp"

    # Neither close nor flag - turn limit reached
    # Treat as if customer bounced
    if is_fraud:
        return "fraud_caught"  # Fraud didn't get through
    else:
        return "missed_opp"  # Lost a potential customer


def calculate_score(
    tier: str,
    outcome: str,
    motivation_correct: bool
) -> int:
    """Calculate the score for a call.

    Args:
        tier: Customer tier (single, ten_pack, fifty_pack)
        outcome: Call outcome (conversion, missed_opp, fraud_caught, fraud_missed)
        motivation_correct: Whether agent correctly guessed customer motivation

    Returns:
        Total points for this call
    """
    # Handle bounce outcome by mapping to appropriate base outcome
    if outcome == "bounce":
        outcome = "missed_opp"

    base_points = POINTS_MATRIX.get((tier, outcome), 0)
    bonus = MOTIVATION_BONUS if motivation_correct else 0

    return base_points + bonus


def get_outcome_description(outcome: str) -> str:
    """Get human-readable description of outcome."""
    descriptions = {
        "conversion": "Successfully converted the customer!",
        "missed_opp": "Missed opportunity - customer didn't convert",
        "fraud_caught": "Fraud correctly identified and stopped!",
        "fraud_missed": "Fraud slipped through - bad outcome!",
        "bounce": "Customer left due to frustration"
    }
    return descriptions.get(outcome, "Unknown outcome")


def get_tier_display(tier: str) -> str:
    """Get display name for tier."""
    displays = {
        "single": "Single Phone",
        "ten_pack": "10-Pack",
        "fifty_pack": "50-Pack"
    }
    return displays.get(tier, tier)
