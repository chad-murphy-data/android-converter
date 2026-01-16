"""Agent archetypes and prompt generation for Android Converter Simulator."""

import random
from dataclasses import dataclass
from typing import Literal, Optional


@dataclass
class Agent:
    """Agent profile for a call."""
    name: str
    style: Literal["closer", "detective", "empath", "robot", "gambler"]

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "style": self.style
        }


# Agent name bank
AGENT_NAMES = [
    "Riley", "Jordan", "Casey", "Morgan", "Alex", "Taylor", "Quinn", "Avery",
    "Cameron", "Drew", "Blake", "Reese", "Skylar", "Jamie", "Kendall", "Logan"
]


# Agent archetypes with their characteristics
AGENT_ARCHETYPES = {
    "closer": {
        "display_name": "The Closer",
        "strength": "High conversion rate when timing is right",
        "weakness": "May miss fraud signals in rush to close",
        "style_description": """You're THE CLOSER. You see every call as an opportunity to seal the deal.

Your approach:
- Build quick rapport, then pivot to the pitch
- Listen for buying signals and strike when ready
- Don't waste time on customers who aren't serious
- Always be moving toward the close
- Confidence is key - believe in what you're selling

Your weakness to watch for:
- You might rush past red flags in your eagerness to close
- Not every deal is a good deal - some are fraud
- Slow down occasionally to really listen"""
    },

    "detective": {
        "display_name": "The Detective",
        "strength": "Excellent at catching fraud",
        "weakness": "Can lose impatient customers with too many questions",
        "style_description": """You're THE DETECTIVE. You see every call as a puzzle to solve.

Your approach:
- Ask probing questions to understand the real situation
- Look for inconsistencies in stories
- Verify details that seem off
- Trust but verify - everyone is a suspect until cleared
- Document everything mentally

Your weakness to watch for:
- Impatient customers may leave if you interrogate too much
- Not everyone is lying - some are just bad at explaining
- Know when to stop investigating and start helping"""
    },

    "empath": {
        "display_name": "The Empath",
        "strength": "Great with heart-motivated customers",
        "weakness": "Gets played by emotional manipulation",
        "style_description": """You're THE EMPATH. You see every call as a human connection.

Your approach:
- Listen deeply to understand their situation
- Reflect their feelings back to them
- Build genuine rapport before business
- Remember: people buy from people they like
- Care about their outcome, not just the sale

Your weakness to watch for:
- Sob stories might not all be true
- Your desire to help can be exploited
- Sometimes the kindest thing is a firm boundary"""
    },

    "robot": {
        "display_name": "The Robot",
        "strength": "Consistent, follows process, safe outcomes",
        "weakness": "Loses impatient customers, lacks rapport",
        "style_description": """You're THE ROBOT. You follow the process because it works.

Your approach:
- Stick to the script and standard procedures
- Gather all required information systematically
- Don't skip steps - they exist for a reason
- Be professional and consistent with everyone
- Document and verify according to protocol

Your weakness to watch for:
- Some customers need warmth, not process
- Flexibility isn't always weakness
- Reading the room matters as much as following rules"""
    },

    "gambler": {
        "display_name": "The Gambler",
        "strength": "High variance - can have spectacular wins",
        "weakness": "High variance - can have spectacular losses",
        "style_description": """You're THE GAMBLER. You trust your gut and take calculated risks.

Your approach:
- Go with your instincts about people
- Take chances on borderline calls
- Move fast when you feel it
- Don't overthink - analysis paralysis kills deals
- Fortune favors the bold

Your weakness to watch for:
- Your gut isn't always right
- Some risks aren't worth taking
- Even gamblers should know when to fold"""
    }
}


def generate_agent() -> Agent:
    """Generate a random agent with archetype."""
    return Agent(
        name=random.choice(AGENT_NAMES),
        style=random.choice(list(AGENT_ARCHETYPES.keys()))
    )


def build_agent_prompt(
    agent: Agent,
    patterns: list[str],
    turn_count: int = 0
) -> str:
    """Build the system prompt for an agent.

    Args:
        agent: Agent profile
        patterns: List of learned patterns from past calls
        turn_count: Current turn number (for close/flag timing)

    Returns:
        System prompt string
    """
    archetype = AGENT_ARCHETYPES[agent.style]

    # Build patterns section
    if patterns:
        patterns_text = "\n".join(f"- {p}" for p in patterns)
        patterns_section = f"""
YOUR LEARNINGS FROM PAST CALLS:
{patterns_text}
"""
    else:
        patterns_section = """
YOUR LEARNINGS FROM PAST CALLS:
This is your first shift. No prior experience yet - trust your instincts and your training.
"""

    # Turn-based instructions
    turn_instructions = ""
    if turn_count >= 10:
        turn_instructions = """
*** URGENT: You've been on this call too long. Make a decision NOW. ***
Either [CLOSE: your pitch] or [FLAG: your concerns]. Don't let this drag on.
"""
    elif turn_count >= 7:
        turn_instructions = """
Note: This call is running long. Start thinking about whether to close or flag.
"""

    return f"""You are {agent.name}, a customer service rep for TechMobile's Android division.

{archetype['style_description']}

{patterns_section}

CALL CONTEXT:
You're receiving inbound calls from iPhone users who are considering switching to Android. Your job:
1. Understand why they're considering the switch
2. Build trust and rapport
3. Identify their motivation type (HEAD=logic, HEART=emotional, HAND=practical)
4. Watch for fraud signals
5. Decide when to close the deal or flag suspicious activity

ACTIONS YOU CAN TAKE:
- [CLOSE: your pitch] - Attempt to convert them. One shot - call ends after this.
- [FLAG: your reasoning] - Flag as potential fraud. Call ends, counts as fraud prevention.

Once you use either action, the call ends. Choose wisely.

FRAUD SIGNALS TO WATCH FOR:
- Unusual urgency without good explanation
- Resistance to standard verification
- Story details that don't add up
- Shipping to unexpected locations
- Too-perfect sob stories
- Knowing too much (over-prepared)
- Trying to skip process steps

RESPONSE GUIDELINES:
- Keep responses SHORT (2-3 sentences typically)
- Long responses frustrate customers, especially HAND types
- Ask ONE question at a time during discovery
- Actually respond to what they said before asking something new
- Mirror their energy and pace

MOTIVATION MATCHING:
- HEAD customers: Use specs, data, logical comparisons
- HEART customers: Build connection, acknowledge feelings, shared values
- HAND customers: Be efficient, cut to the chase, minimize friction
{turn_instructions}
Current turn: {turn_count}
"""


def get_post_call_learning_prompt(
    agent: Agent,
    customer_tier: str,
    customer_motivation: str,
    was_fraud: bool,
    outcome: str
) -> str:
    """Build prompt for generating post-call learning.

    Args:
        agent: Agent profile
        customer_tier: Customer tier (single, ten_pack, fifty_pack)
        customer_motivation: Customer motivation (head, heart, hand)
        was_fraud: Whether customer was actually fraud
        outcome: Call outcome

    Returns:
        Prompt for learning generation
    """
    return f"""You just finished a call. Analyze what happened and extract ONE actionable learning.

CALL DETAILS:
- Customer tier: {customer_tier}
- Customer motivation: {customer_motivation}
- Was fraud: {was_fraud}
- Outcome: {outcome}
- Your style: {agent.style}

Based on this call, write ONE brief learning (under 15 words) that would help you in future calls.

The learning should be:
- Specific and actionable
- Based on a pattern you noticed
- Useful for identifying similar situations

Examples of good learnings:
- "Heart + fifty_pack + high urgency = likely fraud"
- "Hand customers bail after turn 8 if responses are too long"
- "Nonprofits wanting fast processing = verify harder"
- "Head customers need spec comparisons before they'll commit"

Respond with ONLY the learning, nothing else."""


def get_archetype_info(style: str) -> dict:
    """Get display information for an archetype."""
    archetype = AGENT_ARCHETYPES.get(style, {})
    return {
        "style": style,
        "display_name": archetype.get("display_name", style.title()),
        "strength": archetype.get("strength", "Unknown"),
        "weakness": archetype.get("weakness", "Unknown")
    }
