"""Game mechanics for Listing Closer Simulator."""

import re
from dataclasses import dataclass, field
from typing import Literal, Optional

from personas import Customer
from agents import Agent


@dataclass
class CallState:
    """State of an ongoing call."""
    customer: Customer
    agent: Agent
    turn: int = 0
    frustration: float = 0.0
    sentiment: dict = field(default_factory=lambda: {
        "satisfaction": 5,
        "trust": 5,
        "urgency": 5,
        "frustration": 2,
        "likelihood_to_convert": 5,
        "emotional_tone": "neutral"
    })
    transcript: list = field(default_factory=list)
    close_attempted: bool = False
    close_pitch: str = ""
    flag_used: bool = False
    flag_reason: str = ""
    customer_bounced: bool = False
    agent_motivation_guess: str = ""
    converted_on_close: bool = False  # Did customer say yes to the close?

    def to_dict(self) -> dict:
        return {
            "customer": self.customer.to_dict(),
            "agent": self.agent.to_dict(),
            "turn": self.turn,
            "frustration": self.frustration,
            "sentiment": self.sentiment,
            "close_attempted": self.close_attempted,
            "close_pitch": self.close_pitch,
            "flag_used": self.flag_used,
            "flag_reason": self.flag_reason,
            "customer_bounced": self.customer_bounced,
            "agent_motivation_guess": self.agent_motivation_guess
        }


# Frustration constants
BASE_FRUSTRATION_PER_TURN = {
    "head": 0.3,
    "heart": 0.5,
    "hand": 1.0
}

MAX_FRUSTRATION = 10.0
BOUNCE_THRESHOLD = 8.0
MIN_BOUNCE_TURN = 3  # Nobody bounces before turn 3 - give agent a chance
HAND_EARLY_BOUNCE_TURN = 4  # HAND customers can bounce after turn 4 at lower threshold
HAND_EARLY_BOUNCE_THRESHOLD = 6.0


def check_close_attempt(text: str) -> tuple[bool, str]:
    """Check if agent attempted to close.

    Args:
        text: Agent's response text

    Returns:
        Tuple of (attempted, pitch)
    """
    # Match [CLOSE: anything here]
    match = re.search(r'\[CLOSE:\s*(.+?)\]', text, re.IGNORECASE | re.DOTALL)
    if match:
        pitch = match.group(1).strip()
        return True, pitch
    return False, ""


def check_flag_attempt(text: str) -> tuple[bool, str]:
    """Check if agent flagged fraud.

    Args:
        text: Agent's response text

    Returns:
        Tuple of (flagged, reason)
    """
    # Match [FLAG: anything here]
    match = re.search(r'\[FLAG:\s*(.+?)\]', text, re.IGNORECASE | re.DOTALL)
    if match:
        reason = match.group(1).strip()
        return True, reason
    return False, ""


def strip_action_tags(text: str) -> str:
    """Remove [CLOSE: ...] and [FLAG: ...] tags from text for display.

    Args:
        text: Text with potential action tags

    Returns:
        Clean text for display
    """
    text = re.sub(r'\[CLOSE:\s*.+?\]', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'\[FLAG:\s*.+?\]', '', text, flags=re.IGNORECASE | re.DOTALL)
    return text.strip()


def assess_motivation_alignment(
    agent_response: str,
    customer_motivation: str
) -> Literal["matched", "neutral", "misaligned"]:
    """Assess how well agent's response matches customer motivation.

    This is a heuristic based on response characteristics.

    Args:
        agent_response: Agent's response text
        customer_motivation: Customer's actual motivation (head/heart/hand)

    Returns:
        Alignment level
    """
    word_count = len(agent_response.split())

    # HEAD customers want data and logic
    head_signals = [
        "spec", "compare", "percent", "price", "cost", "data", "feature",
        "performance", "benchmark", "value", "roi", "savings"
    ]

    # HEART customers want connection
    heart_signals = [
        "understand", "feel", "appreciate", "journey", "story", "together",
        "care", "help", "support", "experience", "community"
    ]

    # HAND customers want brevity and speed
    # Primary signal is response length

    response_lower = agent_response.lower()

    head_score = sum(1 for s in head_signals if s in response_lower)
    heart_score = sum(1 for s in heart_signals if s in response_lower)

    if customer_motivation == "head":
        if head_score >= 2:
            return "matched"
        elif heart_score >= 2:
            return "misaligned"
        return "neutral"

    elif customer_motivation == "heart":
        if heart_score >= 2:
            return "matched"
        elif word_count < 30:  # Too brief for heart customers
            return "misaligned"
        return "neutral"

    else:  # hand
        if word_count <= 50:
            return "matched"
        elif word_count > 100:
            return "misaligned"
        return "neutral"


def calculate_frustration_increase(
    agent_response: str,
    customer_motivation: str,
    alignment: str
) -> float:
    """Calculate frustration increase from an agent response.

    Args:
        agent_response: Agent's response text
        customer_motivation: Customer's motivation type
        alignment: Motivation alignment (matched/neutral/misaligned)

    Returns:
        Frustration increase amount
    """
    word_count = len(agent_response.split())

    # Length penalty
    if word_count > 150:
        length_penalty = 2.0
    elif word_count > 100:
        length_penalty = 1.0
    elif word_count > 50:
        length_penalty = 0.5
    else:
        length_penalty = 0.0

    # Alignment modifier
    alignment_modifiers = {
        "matched": 0.25,
        "neutral": 0.5,
        "misaligned": 1.5
    }
    modifier = alignment_modifiers.get(alignment, 0.5)

    # Hand customers hate verbosity
    if customer_motivation == "hand":
        modifier *= 1.5

    # Base frustration per turn
    base = BASE_FRUSTRATION_PER_TURN.get(customer_motivation, 0.5)

    return base + (length_penalty * modifier)


def check_customer_bounce(
    state: CallState
) -> bool:
    """Check if customer would bounce (hang up) due to frustration.

    Args:
        state: Current call state

    Returns:
        True if customer should bounce
    """
    # Nobody bounces before minimum turn - give agent a chance
    if state.turn < MIN_BOUNCE_TURN:
        return False

    # Check sentiment frustration (from LLM analysis)
    sentiment_frustration = state.sentiment.get("frustration", 0)

    # IMPORTANT: Only bounce if sentiment shows frustration
    # This prevents abrupt bounces when the customer seemed engaged
    # The LLM sentiment must show frustration >= 6 to even consider bouncing
    if sentiment_frustration < 6:
        return False

    # Use max of tracked frustration and sentiment frustration
    effective_frustration = max(state.frustration, sentiment_frustration)

    # General bounce threshold
    if effective_frustration >= BOUNCE_THRESHOLD:
        return True

    # Hand customers bail earlier (after turn 4 at lower threshold)
    if (state.customer.motivation == "hand" and
        state.turn >= HAND_EARLY_BOUNCE_TURN and
        effective_frustration >= HAND_EARLY_BOUNCE_THRESHOLD):
        return True

    return False


def will_convert(
    sentiment: dict,
    matched_motivation: bool,
    is_fraud: bool
) -> bool:
    """Determine if customer will convert when close is attempted.

    Args:
        sentiment: Current sentiment dictionary
        matched_motivation: Whether agent matched customer's motivation
        is_fraud: Whether customer is fraud (fraud never converts)

    Returns:
        True if customer would convert
    """
    # Fraud never converts legitimately
    if is_fraud:
        return False

    satisfaction = sentiment.get("satisfaction", 5)
    frustration = sentiment.get("frustration", 5)
    likelihood = sentiment.get("likelihood_to_convert", 5)

    # Too frustrated = no sale
    if frustration > 7:
        return False

    # If motivation matched, lower bar
    if matched_motivation:
        return satisfaction >= 4 and likelihood >= 4

    # Mismatched motivation = higher bar
    return satisfaction >= 7 and likelihood >= 6


def extract_motivation_guess(text: str) -> Optional[str]:
    """Try to extract agent's motivation guess from their response.

    Looks for explicit mentions of customer type assessment.

    Args:
        text: Agent's response text

    Returns:
        Guessed motivation or None
    """
    text_lower = text.lower()

    # Check for explicit mentions
    if "head" in text_lower and ("type" in text_lower or "customer" in text_lower or "logical" in text_lower):
        return "head"
    if "heart" in text_lower and ("type" in text_lower or "customer" in text_lower or "emotional" in text_lower):
        return "heart"
    if "hand" in text_lower and ("type" in text_lower or "customer" in text_lower or "practical" in text_lower):
        return "hand"

    return None


MAX_TURNS = 8
