"""Storage and persistence for Android Converter Simulator."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional


# Paths
RESULTS_DIR = Path("results")
AGENT_STATES_DIR = RESULTS_DIR / "agent_states"
CALL_LOGS_FILE = RESULTS_DIR / "call_logs.json"


def ensure_directories():
    """Ensure all necessary directories exist."""
    RESULTS_DIR.mkdir(exist_ok=True)
    AGENT_STATES_DIR.mkdir(exist_ok=True)


def get_default_agent_state(style: str) -> dict:
    """Get default state for a new agent archetype."""
    return {
        "style": style,
        "total_calls": 0,
        "conversions": 0,
        "frauds_caught": 0,
        "frauds_missed": 0,
        "missed_opps": 0,
        "total_points": 0,
        "patterns_noted": [],
        "last_5_calls": []
    }


def load_agent_state(style: str) -> dict:
    """Load agent state for a specific archetype.

    Args:
        style: Agent archetype (closer, detective, empath, robot, gambler)

    Returns:
        Agent state dictionary
    """
    ensure_directories()
    state_file = AGENT_STATES_DIR / f"{style}.json"

    if state_file.exists():
        try:
            with open(state_file) as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass

    return get_default_agent_state(style)


def save_agent_state(style: str, state: dict):
    """Save agent state for a specific archetype.

    Args:
        style: Agent archetype
        state: State dictionary to save
    """
    ensure_directories()
    state_file = AGENT_STATES_DIR / f"{style}.json"

    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)


def add_pattern(style: str, pattern: str, max_patterns: int = 10):
    """Add a learned pattern to an agent's state.

    Args:
        style: Agent archetype
        pattern: Pattern string to add
        max_patterns: Maximum patterns to keep (oldest removed)
    """
    state = load_agent_state(style)

    # Avoid duplicates
    if pattern not in state["patterns_noted"]:
        state["patterns_noted"].append(pattern)

        # Keep only most recent patterns
        if len(state["patterns_noted"]) > max_patterns:
            state["patterns_noted"] = state["patterns_noted"][-max_patterns:]

    save_agent_state(style, state)


def update_agent_stats(
    style: str,
    outcome: str,
    points: int,
    call_summary: dict
):
    """Update agent statistics after a call.

    Args:
        style: Agent archetype
        outcome: Call outcome
        points: Points earned
        call_summary: Brief summary of the call for last_5_calls
    """
    state = load_agent_state(style)

    state["total_calls"] += 1
    state["total_points"] += points

    if outcome == "conversion":
        state["conversions"] += 1
    elif outcome == "fraud_caught":
        state["frauds_caught"] += 1
    elif outcome == "fraud_missed":
        state["frauds_missed"] += 1
    elif outcome in ("missed_opp", "bounce"):
        state["missed_opps"] += 1

    # Update last 5 calls
    state["last_5_calls"].append(call_summary)
    if len(state["last_5_calls"]) > 5:
        state["last_5_calls"] = state["last_5_calls"][-5:]

    save_agent_state(style, state)


def load_call_history() -> list:
    """Load all call history.

    Returns:
        List of call records
    """
    ensure_directories()

    if CALL_LOGS_FILE.exists():
        try:
            with open(CALL_LOGS_FILE) as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass

    return []


def log_call(call_record: dict):
    """Log a completed call.

    Args:
        call_record: Full call record to log
    """
    ensure_directories()
    history = load_call_history()

    # Add call ID and timestamp if not present
    if "call_id" not in call_record:
        call_record["call_id"] = str(uuid.uuid4())
    if "timestamp" not in call_record:
        call_record["timestamp"] = datetime.now().isoformat()

    history.append(call_record)

    with open(CALL_LOGS_FILE, "w") as f:
        json.dump(history, f, indent=2)


def get_leaderboard() -> list:
    """Get agent leaderboard sorted by total points.

    Returns:
        List of agent stats sorted by points
    """
    ensure_directories()
    leaderboard = []

    for style_file in AGENT_STATES_DIR.glob("*.json"):
        try:
            with open(style_file) as f:
                state = json.load(f)
                if state.get("total_calls", 0) > 0:
                    leaderboard.append({
                        "style": state["style"],
                        "total_calls": state["total_calls"],
                        "total_points": state["total_points"],
                        "conversions": state["conversions"],
                        "frauds_caught": state["frauds_caught"],
                        "frauds_missed": state["frauds_missed"],
                        "conversion_rate": round(
                            100 * state["conversions"] / state["total_calls"], 1
                        ) if state["total_calls"] > 0 else 0
                    })
        except (json.JSONDecodeError, KeyError):
            continue

    # Sort by total points descending
    leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
    return leaderboard


def get_overall_stats() -> dict:
    """Get overall statistics across all agents.

    Returns:
        Dictionary with aggregate stats
    """
    history = load_call_history()

    if not history:
        return {
            "total_calls": 0,
            "total_points": 0,
            "conversions": 0,
            "frauds_caught": 0,
            "frauds_missed": 0,
            "missed_opps": 0
        }

    stats = {
        "total_calls": len(history),
        "total_points": sum(c.get("points", 0) for c in history),
        "conversions": sum(1 for c in history if c.get("outcome") == "conversion"),
        "frauds_caught": sum(1 for c in history if c.get("outcome") == "fraud_caught"),
        "frauds_missed": sum(1 for c in history if c.get("outcome") == "fraud_missed"),
        "missed_opps": sum(1 for c in history if c.get("outcome") in ("missed_opp", "bounce"))
    }

    return stats


def clear_all_data():
    """Clear all stored data. Use with caution!"""
    ensure_directories()

    # Clear agent states
    for state_file in AGENT_STATES_DIR.glob("*.json"):
        state_file.unlink()

    # Clear call logs
    if CALL_LOGS_FILE.exists():
        CALL_LOGS_FILE.unlink()
