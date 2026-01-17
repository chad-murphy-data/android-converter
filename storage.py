"""Storage and persistence for Listing Closer Simulator.

Uses JSONBin.io for cloud persistence (free tier).
Falls back to local files if JSONBin is not configured.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
import httpx


# JSONBin.io configuration
JSONBIN_API_KEY = os.getenv("JSONBIN_API_KEY")
JSONBIN_CALLS_BIN_ID = os.getenv("JSONBIN_CALLS_BIN_ID")  # For call logs
JSONBIN_AGENTS_BIN_ID = os.getenv("JSONBIN_AGENTS_BIN_ID")  # For agent states
JSONBIN_BASE_URL = "https://api.jsonbin.io/v3/b"

# Local paths (fallback)
RESULTS_DIR = Path("results")
AGENT_STATES_DIR = RESULTS_DIR / "agent_states"
CALL_LOGS_FILE = RESULTS_DIR / "call_logs.json"

# In-memory cache for the session
_call_history_cache: list = []
_agent_states_cache: dict = {}


def _jsonbin_enabled() -> bool:
    """Check if JSONBin is configured."""
    return bool(JSONBIN_API_KEY and JSONBIN_CALLS_BIN_ID and JSONBIN_AGENTS_BIN_ID)


def _log_jsonbin_config():
    """Log JSONBin configuration status at startup."""
    print("\n" + "=" * 60)
    print("JSONBin.io Configuration Status")
    print("=" * 60)
    print(f"  JSONBIN_API_KEY: {'SET' if JSONBIN_API_KEY else 'NOT SET'}")
    print(f"  JSONBIN_CALLS_BIN_ID: {JSONBIN_CALLS_BIN_ID if JSONBIN_CALLS_BIN_ID else 'NOT SET'}")
    print(f"  JSONBIN_AGENTS_BIN_ID: {JSONBIN_AGENTS_BIN_ID if JSONBIN_AGENTS_BIN_ID else 'NOT SET'}")
    print(f"  JSONBin enabled: {_jsonbin_enabled()}")
    print("=" * 60 + "\n")


# Log config at module load
_log_jsonbin_config()


def _jsonbin_headers() -> dict:
    """Get headers for JSONBin API calls."""
    return {
        "Content-Type": "application/json",
        "X-Master-Key": JSONBIN_API_KEY
    }


def _load_from_jsonbin(bin_id: str) -> Optional[dict]:
    """Load data from a JSONBin bin."""
    if not JSONBIN_API_KEY:
        print(f"JSONBin load skipped: No API key configured")
        return None
    try:
        url = f"{JSONBIN_BASE_URL}/{bin_id}/latest"
        print(f"JSONBin loading from bin {bin_id}...")
        response = httpx.get(
            url,
            headers=_jsonbin_headers(),
            timeout=10.0
        )
        if response.status_code == 200:
            data = response.json()
            print(f"JSONBin load SUCCESS from bin {bin_id}")
            return data.get("record", {})
        else:
            print(f"JSONBin load FAILED: status={response.status_code}, response={response.text[:500]}")
    except Exception as e:
        print(f"JSONBin load error for bin {bin_id}: {e}")
    return None


def _save_to_jsonbin(bin_id: str, data: dict) -> bool:
    """Save data to a JSONBin bin."""
    if not JSONBIN_API_KEY:
        print(f"JSONBin save skipped: No API key configured")
        return False
    try:
        url = f"{JSONBIN_BASE_URL}/{bin_id}"
        print(f"JSONBin saving to bin {bin_id}...")
        response = httpx.put(
            url,
            headers=_jsonbin_headers(),
            json=data,
            timeout=10.0
        )
        if response.status_code == 200:
            print(f"JSONBin save SUCCESS to bin {bin_id}")
            return True
        else:
            print(f"JSONBin save FAILED: status={response.status_code}, response={response.text[:500]}")
            return False
    except Exception as e:
        print(f"JSONBin save error for bin {bin_id}: {e}")
    return False


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


def _load_all_agent_states() -> dict:
    """Load all agent states from JSONBin or cache."""
    global _agent_states_cache

    # Return cache if populated
    if _agent_states_cache:
        return _agent_states_cache

    # Try JSONBin first
    if _jsonbin_enabled():
        data = _load_from_jsonbin(JSONBIN_AGENTS_BIN_ID)
        if data:
            _agent_states_cache = data
            return _agent_states_cache

    # Fall back to local files
    ensure_directories()
    for style_file in AGENT_STATES_DIR.glob("*.json"):
        try:
            with open(style_file) as f:
                state = json.load(f)
                _agent_states_cache[state["style"]] = state
        except (json.JSONDecodeError, KeyError):
            continue

    return _agent_states_cache


def _save_all_agent_states():
    """Save all agent states to JSONBin and local files."""
    global _agent_states_cache

    # Save to JSONBin
    if _jsonbin_enabled():
        _save_to_jsonbin(JSONBIN_AGENTS_BIN_ID, _agent_states_cache)

    # Also save locally
    ensure_directories()
    for style, state in _agent_states_cache.items():
        state_file = AGENT_STATES_DIR / f"{style}.json"
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)


def load_agent_state(style: str) -> dict:
    """Load agent state for a specific archetype."""
    all_states = _load_all_agent_states()
    return all_states.get(style, get_default_agent_state(style))


def save_agent_state(style: str, state: dict):
    """Save agent state for a specific archetype."""
    global _agent_states_cache
    _agent_states_cache[style] = state
    _save_all_agent_states()


def add_pattern(style: str, pattern: str, max_patterns: int = 10):
    """Add a learned pattern to an agent's state."""
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
    """Update agent statistics after a call."""
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
    """Load all call history."""
    global _call_history_cache

    # Return cache if populated
    if _call_history_cache:
        return _call_history_cache

    # Try JSONBin first
    if _jsonbin_enabled():
        data = _load_from_jsonbin(JSONBIN_CALLS_BIN_ID)
        if data and isinstance(data.get("calls"), list):
            _call_history_cache = data["calls"]
            return _call_history_cache

    # Fall back to local file
    ensure_directories()
    if CALL_LOGS_FILE.exists():
        try:
            with open(CALL_LOGS_FILE) as f:
                _call_history_cache = json.load(f)
                return _call_history_cache
        except json.JSONDecodeError:
            pass

    return []


def log_call(call_record: dict):
    """Log a completed call."""
    global _call_history_cache

    # Ensure we have the latest
    if not _call_history_cache:
        load_call_history()

    # Add call ID and timestamp if not present
    if "call_id" not in call_record:
        call_record["call_id"] = str(uuid.uuid4())
    if "timestamp" not in call_record:
        call_record["timestamp"] = datetime.now().isoformat()

    _call_history_cache.append(call_record)

    # Save to JSONBin
    if _jsonbin_enabled():
        _save_to_jsonbin(JSONBIN_CALLS_BIN_ID, {"calls": _call_history_cache})

    # Also save locally
    ensure_directories()
    with open(CALL_LOGS_FILE, "w") as f:
        json.dump(_call_history_cache, f, indent=2)

    # Print to console for Render logs
    print(f"\n{'='*60}")
    print(f"CALL LOG: {call_record['call_id']}")
    print(f"{'='*60}")
    print(json.dumps(call_record, indent=2))
    print(f"{'='*60}\n")


def get_leaderboard() -> list:
    """Get agent leaderboard sorted by total points."""
    all_states = _load_all_agent_states()
    leaderboard = []

    for style, state in all_states.items():
        if state.get("total_calls", 0) > 0:
            leaderboard.append({
                "style": state["style"],
                "display_name": state["style"].title(),
                "total_calls": state["total_calls"],
                "total_points": state["total_points"],
                "conversions": state["conversions"],
                "frauds_caught": state["frauds_caught"],
                "frauds_missed": state["frauds_missed"],
                "conversion_rate": round(
                    100 * state["conversions"] / state["total_calls"], 1
                ) if state["total_calls"] > 0 else 0
            })

    # Sort by total points descending
    leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
    return leaderboard


def get_overall_stats() -> dict:
    """Get overall statistics across all agents."""
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
    global _call_history_cache, _agent_states_cache

    _call_history_cache = []
    _agent_states_cache = {}

    # Clear JSONBin
    if _jsonbin_enabled():
        _save_to_jsonbin(JSONBIN_CALLS_BIN_ID, {"calls": []})
        _save_to_jsonbin(JSONBIN_AGENTS_BIN_ID, {})

    # Clear local files
    ensure_directories()
    for state_file in AGENT_STATES_DIR.glob("*.json"):
        state_file.unlink()
    if CALL_LOGS_FILE.exists():
        CALL_LOGS_FILE.unlink()
