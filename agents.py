"""Agent prompt construction and profile generation for Android vs iPhone simulator."""

import random
from dataclasses import dataclass
from typing import Literal


@dataclass
class iPhoneUserProfile:
    """Hidden profile for the iPhone user."""
    years_with_iphone: int
    primary_loyalty: Literal["head", "heart", "hands"]
    openness_to_switch: Literal["low", "medium", "high"]
    disclosure_style: Literal["forthcoming", "guarded"]

    def to_dict(self) -> dict:
        return {
            "years_with_iphone": self.years_with_iphone,
            "primary_loyalty": self.primary_loyalty,
            "openness_to_switch": self.openness_to_switch,
            "disclosure_style": self.disclosure_style
        }


def generate_random_profile() -> iPhoneUserProfile:
    """Generate a random iPhone user profile."""
    return iPhoneUserProfile(
        years_with_iphone=random.randint(1, 10),
        primary_loyalty=random.choice(["head", "heart", "hands"]),
        openness_to_switch=random.choice(["low", "medium", "high"]),
        disclosure_style=random.choice(["forthcoming", "guarded"])
    )


def build_iphone_user_prompt(profile: iPhoneUserProfile) -> str:
    """Build system prompt for the iPhone user agent."""
    return f"""You are an iPhone user who has had an iPhone for {profile.years_with_iphone} years. You just received a sales call from someone trying to get you to switch to Android.

Your hidden profile (embody this, don't state it directly):
- Primary loyalty type: {profile.primary_loyalty}
- Openness to switching: {profile.openness_to_switch}
- Disclosure style: {profile.disclosure_style}

LOYALTY TYPES:
If HEAD loyal: You care about specs, value, practical comparisons. You chose iPhone for rational reasons (privacy, resale value, build quality). You'd consider switching if the numbers made sense.

If HEART loyal: iPhone is part of your identity. You like the aesthetics, the brand, what it says about you. "It just feels right." Switching would feel like a betrayal of who you are.

If HANDS loyal: You're deep in the ecosystem. iMessage with family, iCloud photos going back years, AirPods, Apple Watch, MacBook. Switching sounds exhausting even if Android is better.

DISCLOSURE STYLE:
If FORTHCOMING: You'll share your reasoning when asked. 2-4 sentences per response.
If GUARDED: You give short answers. 1-2 sentences max. The sales rep needs to ask good follow-up questions to learn anything.

OPENNESS LEVEL:
If LOW: You're skeptical, borderline dismissive. Why is this person calling you?
If MEDIUM: You'll hear them out fairly, but you're aware you're being sold to.
If HIGH: You're genuinely curious, maybe already considering switching.

RESPONSE STYLE:
- You are receiving a SALES CALL. Respond like someone being sold to, not like chatting with a friend.
- Be polite but aware this person wants something from you.
- If GUARDED: 1-2 sentences max. Don't volunteer extra information.
- If FORTHCOMING: 2-4 sentences. You'll share more openly.
- NO ONE dumps their entire life story. Keep responses realistic.
- NEVER reveal your profile labels (don't say "I'm heart loyal" or "I'm guarded")

WHEN THEY ASK FOR THE SALE:
When the rep asks you directly to switch (e.g., "Can I set you up with an Android today?"), you MUST respond with a clear decision starting with "Yes" or "No":

- If converting: "Yes, [reason based on what convinced you]." Example: "Yes, let's do it. You addressed my concerns about migration."
- If staying: "No, [reason based on what didn't work]." Example: "No, I'm sticking with iPhone. The ecosystem thing is just too much."
- If maybe: "No, not today. [reason]" Example: "No, not today. I need to think about it, but you've given me something to consider."

Your decision should follow logically from your profile and how well the rep addressed YOUR SPECIFIC concerns."""


def build_android_advocate_prompt(memory_summary: str, turn_count: int = 0) -> str:
    """Build system prompt for the Android advocate agent."""

    close_instruction = ""
    if turn_count >= 6:
        close_instruction = """

IMPORTANT: You have been talking for a while. It's time to CLOSE. Ask directly for the sale:
- "So, can I set you up with a Pixel today?"
- "Are you ready to make the switch?"
- "Can I get you started with an Android phone today?"
Do NOT ask more discovery questions. Make your closing ask NOW."""

    return f"""You are a professional sales representative at Android Switch Services. You're making an outreach call to an iPhone user to see if you can convert them to Android.

YOUR ROLE:
- Professional but personable sales rep
- You have a goal: convert this person to Android
- Be polite and respectful, but remember you're working

CONVERSATION STRUCTURE:
1. OPENING - Introduce yourself professionally (first message only)
2. DISCOVERY - Ask questions ONE AT A TIME to understand the prospect (2-4 questions total)
3. PITCH - Make your tailored case for switching based on what you learned
4. CLOSE - Ask DIRECTLY for the sale
5. WRAP UP - Accept their decision gracefully

CONVERSATION STYLE:
- ONE question at a time. Never ask multiple questions in one message.
- Keep messages SHORT: 2-3 sentences max during discovery.
- Actually respond to what they said before asking something new.
- Mirror their energy - if they give short answers, don't reply with a wall of text.
- This is a professional call, not a chat with a friend.

YOUR PITCH TOOLKIT:
- For analytical types (HEAD): Specs per dollar, customization, freedom from walled garden, better Google Assistant
- For identity-driven types (HEART): Express individuality, diverse designs, creative/tinkerer culture
- For ecosystem-locked types (HANDS): Google Photos migration tool, RCS adoption, cross-platform apps, acknowledge switching is hard but offer to help

OPENING LINE (first message only):
Start with something like: "Hi, this is [name] from Android Switch Services. I'm reaching out to iPhone users who might be interested in what Android has to offer. Do you have a minute?"

CONSTRAINTS:
- Be honest - don't trash iPhone or exaggerate Android's benefits
- Acknowledge when iPhone does something better
- If they're clearly not interested, accept it gracefully
{close_instruction}

When the conversation ends (after their Yes/No decision), include this summary block:

[ADVOCATE_SUMMARY]
predicted_loyalty: head|heart|hands
pitch_angle_used: head|heart|hands
[/ADVOCATE_SUMMARY]

MEMORY FROM PAST SESSIONS:
{memory_summary if memory_summary else "This is your first session. No prior experience yet."}

Use what you've learned to improve your discovery and pitch matching."""


def analyze_learning_insights(past_sessions: list[dict]) -> dict:
    """Analyze past sessions to extract actionable learning insights."""
    if not past_sessions:
        return {}

    insights = {
        "total_sessions": len(past_sessions),
        "overall_conversion_rate": 0,
        "prediction_accuracy": 0,
        "by_loyalty": {},
        "by_openness": {},
        "by_disclosure": {},
        "pitch_effectiveness": {},
        "key_learnings": []
    }

    converted = sum(1 for s in past_sessions if s["outcome"] == "converted")
    correct_preds = sum(1 for s in past_sessions
                       if s.get("advocate_predicted_loyalty") == s["iphone_user_profile"]["primary_loyalty"])

    insights["overall_conversion_rate"] = round(100 * converted / len(past_sessions), 1)
    insights["prediction_accuracy"] = round(100 * correct_preds / len(past_sessions), 1)

    # Analyze by loyalty type
    for loyalty in ["head", "heart", "hands"]:
        matching = [s for s in past_sessions if s["iphone_user_profile"]["primary_loyalty"] == loyalty]
        if matching:
            conv = sum(1 for s in matching if s["outcome"] == "converted")
            insights["by_loyalty"][loyalty] = {
                "count": len(matching),
                "converted": conv,
                "rate": round(100 * conv / len(matching), 1)
            }

    # Analyze by openness level
    for openness in ["low", "medium", "high"]:
        matching = [s for s in past_sessions if s["iphone_user_profile"]["openness_to_switch"] == openness]
        if matching:
            conv = sum(1 for s in matching if s["outcome"] == "converted")
            insights["by_openness"][openness] = {
                "count": len(matching),
                "converted": conv,
                "rate": round(100 * conv / len(matching), 1)
            }

    # Analyze by disclosure style
    for disclosure in ["forthcoming", "guarded"]:
        matching = [s for s in past_sessions if s["iphone_user_profile"]["disclosure_style"] == disclosure]
        if matching:
            conv = sum(1 for s in matching if s["outcome"] == "converted")
            insights["by_disclosure"][disclosure] = {
                "count": len(matching),
                "converted": conv,
                "rate": round(100 * conv / len(matching), 1)
            }

    # Analyze pitch effectiveness (when pitch matches vs mismatches loyalty)
    matched_pitch = [s for s in past_sessions
                    if s.get("pitch_angle_used") == s["iphone_user_profile"]["primary_loyalty"]]
    mismatched_pitch = [s for s in past_sessions
                       if s.get("pitch_angle_used") and s.get("pitch_angle_used") != s["iphone_user_profile"]["primary_loyalty"]]

    if matched_pitch:
        conv = sum(1 for s in matched_pitch if s["outcome"] == "converted")
        insights["pitch_effectiveness"]["matched"] = {
            "count": len(matched_pitch),
            "converted": conv,
            "rate": round(100 * conv / len(matched_pitch), 1)
        }

    if mismatched_pitch:
        conv = sum(1 for s in mismatched_pitch if s["outcome"] == "converted")
        insights["pitch_effectiveness"]["mismatched"] = {
            "count": len(mismatched_pitch),
            "converted": conv,
            "rate": round(100 * conv / len(mismatched_pitch), 1)
        }

    # Generate key learnings
    key_learnings = []

    # Learning: Pitch matching matters
    if "matched" in insights["pitch_effectiveness"] and "mismatched" in insights["pitch_effectiveness"]:
        matched_rate = insights["pitch_effectiveness"]["matched"]["rate"]
        mismatched_rate = insights["pitch_effectiveness"]["mismatched"]["rate"]
        if matched_rate > mismatched_rate + 10:
            key_learnings.append(f"Matching pitch to loyalty type increases conversion by {matched_rate - mismatched_rate:.0f}%")
        elif mismatched_rate > matched_rate:
            key_learnings.append("Surprisingly, mismatched pitches are converting better - worth investigating")

    # Learning: Which loyalty types are hardest
    if insights["by_loyalty"]:
        sorted_loyalty = sorted(insights["by_loyalty"].items(), key=lambda x: x[1]["rate"])
        hardest = sorted_loyalty[0]
        easiest = sorted_loyalty[-1]
        if hardest[1]["rate"] < easiest[1]["rate"] - 15:
            key_learnings.append(f"{hardest[0].upper()} types are hardest to convert ({hardest[1]['rate']}%). {easiest[0].upper()} types convert best ({easiest[1]['rate']}%)")

    # Learning: Openness matters
    if "low" in insights["by_openness"] and "high" in insights["by_openness"]:
        low_rate = insights["by_openness"]["low"]["rate"]
        high_rate = insights["by_openness"]["high"]["rate"]
        if high_rate > low_rate + 20:
            key_learnings.append(f"High-openness prospects convert at {high_rate}% vs {low_rate}% for low-openness")

    # Learning: Guarded vs forthcoming
    if "guarded" in insights["by_disclosure"] and "forthcoming" in insights["by_disclosure"]:
        guarded_rate = insights["by_disclosure"]["guarded"]["rate"]
        forth_rate = insights["by_disclosure"]["forthcoming"]["rate"]
        if abs(guarded_rate - forth_rate) > 15:
            better = "forthcoming" if forth_rate > guarded_rate else "guarded"
            key_learnings.append(f"{better.capitalize()} prospects convert better ({max(guarded_rate, forth_rate)}% vs {min(guarded_rate, forth_rate)}%)")

    # Learning: Best/worst combinations
    combo_stats = {}
    for s in past_sessions:
        p = s["iphone_user_profile"]
        combo = f"{p['primary_loyalty']}_{p['openness_to_switch']}"
        if combo not in combo_stats:
            combo_stats[combo] = {"total": 0, "converted": 0}
        combo_stats[combo]["total"] += 1
        if s["outcome"] == "converted":
            combo_stats[combo]["converted"] += 1

    # Find combos with enough data
    significant_combos = {k: v for k, v in combo_stats.items() if v["total"] >= 3}
    if significant_combos:
        for combo, stats in significant_combos.items():
            rate = 100 * stats["converted"] / stats["total"]
            loyalty, openness = combo.split("_")
            if rate == 0:
                key_learnings.append(f"Never converted {loyalty.upper()} + {openness} openness (0/{stats['total']})")
            elif rate == 100:
                key_learnings.append(f"Always convert {loyalty.upper()} + {openness} openness ({stats['total']}/{stats['total']})")

    insights["key_learnings"] = key_learnings[:5]  # Cap at 5 insights
    return insights


def build_memory_summary(past_sessions: list[dict]) -> str:
    """Build memory summary from past sessions for the Android advocate."""
    if not past_sessions:
        return ""

    insights = analyze_learning_insights(past_sessions)

    summary_parts = [f"You have completed {insights['total_sessions']} sessions.\n"]
    summary_parts.append(f"Overall conversion rate: {insights['overall_conversion_rate']}%")
    summary_parts.append(f"Loyalty prediction accuracy: {insights['prediction_accuracy']}%\n")

    # Conversion by loyalty type
    summary_parts.append("CONVERSION BY LOYALTY TYPE:")
    for loyalty, stats in insights.get("by_loyalty", {}).items():
        summary_parts.append(f"  {loyalty.upper()}: {stats['converted']}/{stats['count']} ({stats['rate']}%)")

    # Conversion by openness
    summary_parts.append("\nCONVERSION BY OPENNESS:")
    for openness, stats in insights.get("by_openness", {}).items():
        summary_parts.append(f"  {openness.upper()}: {stats['converted']}/{stats['count']} ({stats['rate']}%)")

    # Pitch effectiveness
    if insights.get("pitch_effectiveness"):
        summary_parts.append("\nPITCH MATCHING EFFECTIVENESS:")
        if "matched" in insights["pitch_effectiveness"]:
            m = insights["pitch_effectiveness"]["matched"]
            summary_parts.append(f"  When pitch matched loyalty: {m['converted']}/{m['count']} ({m['rate']}%)")
        if "mismatched" in insights["pitch_effectiveness"]:
            m = insights["pitch_effectiveness"]["mismatched"]
            summary_parts.append(f"  When pitch mismatched: {m['converted']}/{m['count']} ({m['rate']}%)")

    # Key learnings
    if insights.get("key_learnings"):
        summary_parts.append("\nKEY LEARNINGS:")
        for learning in insights["key_learnings"]:
            summary_parts.append(f"  - {learning}")

    # Recent sessions (last 3 only for context)
    recent = past_sessions[-3:]
    summary_parts.append("\nRECENT SESSIONS:")
    for session in recent:
        profile = session["iphone_user_profile"]
        outcome = session["outcome"]
        predicted = session.get("advocate_predicted_loyalty", "?")
        pitch = session.get("pitch_angle_used", "?")
        actual = profile["primary_loyalty"]
        pred_icon = "✓" if predicted == actual else "✗"

        summary_parts.append(
            f"  #{session['session_id']}: {outcome.upper()} | "
            f"{actual}/{profile['openness_to_switch']}/{profile['disclosure_style']} | "
            f"Predicted: {predicted}{pred_icon} | Pitch: {pitch}"
        )

    return "\n".join(summary_parts)
