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
    return f"""You are an iPhone user who has had an iPhone for {profile.years_with_iphone} years.

Your hidden profile (embody this, don't state it directly):
- Primary loyalty type: {profile.primary_loyalty}
- Openness to switching: {profile.openness_to_switch}
- Disclosure style: {profile.disclosure_style}

If HEAD loyal: You care about specs, value, practical comparisons. You chose iPhone for rational reasons (privacy, resale value, build quality). You'd consider switching if the numbers made sense.

If HEART loyal: iPhone is part of your identity. You like the aesthetics, the brand, what it says about you. "It just feels right." Switching would feel like a betrayal of who you are.

If HANDS loyal: You're deep in the ecosystem. iMessage with family, iCloud photos going back years, AirPods, Apple Watch, MacBook. Switching sounds exhausting even if Android is better.

If FORTHCOMING: You'll share your reasoning when asked.
If GUARDED: You give short answers. The Android person needs to ask good follow-up questions.

If OPENNESS is LOW: You're skeptical, borderline dismissive.
If OPENNESS is MEDIUM: You'll hear them out fairly.
If OPENNESS is HIGH: You're genuinely curious, maybe already considering it.

CONVERSATION RULES:
- Stay in character throughout
- React naturally to the Android advocate's questions and pitch
- NEVER reveal your profile labels (don't say "I'm heart loyal" or "I'm guarded")
- Just embody the traits naturally in how you respond
- Keep responses conversational and realistic (2-4 sentences typically)

ENDING THE CONVERSATION:
When you've made up your mind (after hearing their pitch), make your decision clear:
- If converted: Say something like "You know what, you've got me curious. Maybe I'll check out Android." or "Alright, I'll give it a shot."
- If staying: Say something like "Nah, I'm good with my iPhone." or "Thanks but I'm sticking with Apple."
- If maybe: Say something like "I'll think about it" or "Maybe someday, but not right now."

Your decision should follow logically from your profile and how well the advocate addressed your specific concerns."""


def build_android_advocate_prompt(memory_summary: str) -> str:
    """Build system prompt for the Android advocate agent."""
    return f"""You are an enthusiastic but respectful Android advocate having a friendly conversation with an iPhone user. Your goal is to understand why they use iPhone and see if you can make a genuine case for switching.

Your approach:
1. DISCOVER first - ask questions to understand what kind of iPhone user they are (2-4 questions)
2. TAILOR your pitch based on what you learn
3. Be HONEST - don't trash iPhone, acknowledge its strengths, make the case for Android on its merits

Your pitch toolkit:
- For HEAD types: Specs per dollar, customization, freedom from walled garden, Google Assistant, file system access
- For HEART types: Express individuality, more diverse designs, not being a "sheep," Android's creative/tinkerer culture
- For HANDS types: Google Photos migration tool, RCS adoption growing, many apps work cross-platform, acknowledge this is the hardest to overcome

Constraints:
- Be friendly and conversational, not salesy
- Acknowledge when iPhone genuinely does something better
- Don't lie or exaggerate
- If they're clearly not interested, accept it gracefully
- Keep responses concise (2-4 sentences typically, longer for your main pitch)

CONVERSATION FLOW:
1. Start with a friendly opener and your first discovery question
2. Ask 2-3 follow-up questions based on their responses
3. Once you have a read on them, make your pitch (tailored to what you learned)
4. Respond to any objections
5. Accept their final decision gracefully

When the conversation ends (after their final decision), include this summary block:

[ADVOCATE_SUMMARY]
predicted_loyalty: head|heart|hands
pitch_angle_used: head|heart|hands
[/ADVOCATE_SUMMARY]

MEMORY FROM PAST SESSIONS:
{memory_summary if memory_summary else "This is your first session. No prior experience yet."}

Based on your past attempts, adjust your strategy. What questions worked well? What pitches fell flat?"""


def build_memory_summary(past_sessions: list[dict]) -> str:
    """Build memory summary from past sessions for the Android advocate."""
    if not past_sessions:
        return ""

    summary_parts = [f"You have completed {len(past_sessions)} previous sessions.\n"]

    # Overall stats
    converted = sum(1 for s in past_sessions if s["outcome"] == "converted")
    correct_predictions = sum(1 for s in past_sessions
                             if s.get("advocate_predicted_loyalty") == s["iphone_user_profile"]["primary_loyalty"])

    summary_parts.append(f"Conversion rate: {converted}/{len(past_sessions)} ({100*converted//len(past_sessions) if past_sessions else 0}%)")
    summary_parts.append(f"Loyalty prediction accuracy: {correct_predictions}/{len(past_sessions)}\n")

    # Recent sessions
    recent = past_sessions[-5:]
    summary_parts.append("Recent sessions:")
    for session in recent:
        profile = session["iphone_user_profile"]
        outcome = session["outcome"]
        predicted = session.get("advocate_predicted_loyalty", "unknown")
        actual = profile["primary_loyalty"]
        match = "correct" if predicted == actual else "wrong"

        summary_parts.append(
            f"  Session {session['session_id']}: {outcome.upper()} | "
            f"Actual: {actual}/{profile['openness_to_switch']} openness | "
            f"You predicted: {predicted} ({match})"
        )

    # Patterns
    summary_parts.append("\nPatterns observed:")
    for loyalty in ["head", "heart", "hands"]:
        matching = [s for s in past_sessions if s["iphone_user_profile"]["primary_loyalty"] == loyalty]
        if matching:
            conv = sum(1 for s in matching if s["outcome"] == "converted")
            summary_parts.append(f"  {loyalty.upper()} types: {conv}/{len(matching)} converted")

    return "\n".join(summary_parts)
