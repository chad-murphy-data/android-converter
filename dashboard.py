"""Dashboard LLM calls for real-time analysis during calls."""

import json
import anthropic


AGENT_CONFIDENCE_PROMPT = """Analyze this exchange between a customer service agent and a caller.

Last exchange:
Agent: {agent_msg}
Caller: {caller_msg}

Based on this exchange, assess:
1. Fraud likelihood (1-10, where 10 = definitely fraud)
2. Customer motivation type (head/heart/hand percentages that sum to 100)
3. Brief reasoning (one sentence)

Respond in JSON format only:
{{
    "fraud_likelihood": <1-10>,
    "motivation_guess": {{
        "head": <0-100>,
        "heart": <0-100>,
        "hand": <0-100>
    }},
    "reasoning": "<one sentence>"
}}"""


SENTIMENT_PROMPT = """Analyze the customer's emotional state from this exchange.

Last exchange:
Agent: {agent_msg}
Caller: {caller_msg}

Rate the customer's current state (1-10 for each):
- satisfaction: How happy are they with this interaction?
- trust: How much do they trust the agent?
- urgency: How urgently do they want to resolve this?
- frustration: How frustrated are they?
- likelihood_to_convert: How likely to actually switch to Android?
- emotional_tone: One word describing their mood

Respond in JSON format only:
{{
    "satisfaction": <1-10>,
    "trust": <1-10>,
    "urgency": <1-10>,
    "frustration": <1-10>,
    "likelihood_to_convert": <1-10>,
    "emotional_tone": "<one word>"
}}"""


async def get_agent_confidence(
    client: anthropic.Anthropic,
    agent_msg: str,
    caller_msg: str
) -> dict:
    """Get agent's confidence assessment of the caller.

    Args:
        client: Anthropic client
        agent_msg: Agent's message
        caller_msg: Caller's response

    Returns:
        Dictionary with fraud_likelihood, motivation_guess, reasoning
    """
    prompt = AGENT_CONFIDENCE_PROMPT.format(
        agent_msg=agent_msg,
        caller_msg=caller_msg
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()

        # Parse JSON from response
        # Handle potential markdown code blocks
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text)

        # Ensure expected structure
        return {
            "fraud_likelihood": result.get("fraud_likelihood", 5),
            "motivation_guess": result.get("motivation_guess", {
                "head": 33,
                "heart": 34,
                "hand": 33
            }),
            "reasoning": result.get("reasoning", "Analyzing...")
        }

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"Confidence parse error: {e}")
        # Return neutral defaults on parse error
        return {
            "fraud_likelihood": 5,
            "motivation_guess": {"head": 33, "heart": 34, "hand": 33},
            "reasoning": "Analysis in progress..."
        }
    except Exception as e:
        print(f"Confidence call error: {e}")
        return {
            "fraud_likelihood": 5,
            "motivation_guess": {"head": 33, "heart": 34, "hand": 33},
            "reasoning": "Analysis in progress..."
        }


async def get_customer_sentiment(
    client: anthropic.Anthropic,
    agent_msg: str,
    caller_msg: str
) -> dict:
    """Get customer sentiment analysis.

    Args:
        client: Anthropic client
        agent_msg: Agent's message
        caller_msg: Caller's response

    Returns:
        Dictionary with sentiment metrics
    """
    prompt = SENTIMENT_PROMPT.format(
        agent_msg=agent_msg,
        caller_msg=caller_msg
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text)

        # Ensure expected structure with defaults
        return {
            "satisfaction": result.get("satisfaction", 5),
            "trust": result.get("trust", 5),
            "urgency": result.get("urgency", 5),
            "frustration": result.get("frustration", 3),
            "likelihood_to_convert": result.get("likelihood_to_convert", 5),
            "emotional_tone": result.get("emotional_tone", "neutral")
        }

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"Sentiment parse error: {e}")
        # Return neutral defaults on parse error
        return {
            "satisfaction": 5,
            "trust": 5,
            "urgency": 5,
            "frustration": 3,
            "likelihood_to_convert": 5,
            "emotional_tone": "neutral"
        }
    except Exception as e:
        print(f"Sentiment call error: {e}")
        return {
            "satisfaction": 5,
            "trust": 5,
            "urgency": 5,
            "frustration": 3,
            "likelihood_to_convert": 5,
            "emotional_tone": "neutral"
        }


async def generate_learning(
    client: anthropic.Anthropic,
    learning_prompt: str
) -> str:
    """Generate post-call learning pattern.

    Args:
        client: Anthropic client
        learning_prompt: Prompt for learning generation

    Returns:
        Learning pattern string
    """
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=50,
            messages=[{"role": "user", "content": learning_prompt}]
        )

        text = response.content[0].text.strip()

        # Clean up response - remove quotes, limit length
        text = text.strip('"\'')
        if len(text) > 100:
            text = text[:97] + "..."

        return text

    except Exception as e:
        return "Call completed - learning pending"


def get_dominant_motivation(motivation_guess: dict) -> str:
    """Get the dominant motivation from percentage guesses.

    Args:
        motivation_guess: Dictionary with head/heart/hand percentages

    Returns:
        Dominant motivation type
    """
    head = motivation_guess.get("head", 0)
    heart = motivation_guess.get("heart", 0)
    hand = motivation_guess.get("hand", 0)

    if head >= heart and head >= hand:
        return "head"
    elif heart >= head and heart >= hand:
        return "heart"
    else:
        return "hand"
