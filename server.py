"""FastAPI server for Listing Closer Simulator."""

import asyncio
import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import anthropic

from personas import Customer, generate_customer, build_customer_prompt
from agents import (
    Agent,
    generate_agent,
    build_agent_prompt,
    get_post_call_learning_prompt,
    get_archetype_info
)
from game import (
    CallState,
    check_close_attempt,
    check_flag_attempt,
    strip_action_tags,
    assess_motivation_alignment,
    calculate_frustration_increase,
    check_customer_bounce,
    will_convert,
    MAX_TURNS
)
from scoring import (
    determine_outcome,
    calculate_score,
    get_outcome_description,
    get_tier_display
)
from storage import (
    load_agent_state,
    save_agent_state,
    add_pattern,
    update_agent_stats,
    log_call,
    load_call_history,
    get_leaderboard,
    get_overall_stats,
    ensure_directories
)
from dashboard import (
    get_agent_confidence,
    get_customer_sentiment,
    generate_learning,
    get_dominant_motivation
)


load_dotenv()

app = FastAPI()

# Ensure directories exist
ensure_directories()
Path("images").mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/images", StaticFiles(directory="images"), name="images")

# Global state
warmup_mode = False
call_counter = 0


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.get("/avatars/{filename}")
async def get_avatar(filename: str):
    """Serve agent avatar images from root directory."""
    filepath = Path(filename)
    if filepath.suffix == ".png" and filepath.stem in ["closer", "detective", "empath", "robot", "gambler"]:
        return FileResponse(filename)
    return FileResponse("static/index.html")  # Fallback


@app.get("/api/stats")
async def get_stats():
    """Get overall statistics."""
    return get_overall_stats()


@app.get("/api/leaderboard")
async def get_agent_leaderboard():
    """Get agent archetype leaderboard."""
    return get_leaderboard()


@app.get("/api/agent/{style}/stats")
async def get_agent_stats(style: str):
    """Get stats for a specific agent archetype."""
    state = load_agent_state(style)
    info = get_archetype_info(style)
    return {**state, **info}


@app.post("/api/warmup")
async def toggle_warmup():
    """Toggle warmup mode (5% fraud vs 15%)."""
    global warmup_mode
    warmup_mode = not warmup_mode
    return {"warmup_mode": warmup_mode}


@app.get("/api/warmup")
async def get_warmup_status():
    """Get current warmup mode status."""
    return {"warmup_mode": warmup_mode}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "new_call":
                await run_call(websocket, client)

    except WebSocketDisconnect:
        print("Client disconnected")


async def run_call(websocket: WebSocket, client: anthropic.Anthropic):
    """Run a complete customer service call."""
    global call_counter

    call_counter += 1
    call_id = call_counter

    # Generate customer and agent
    customer = generate_customer(warmup_mode)
    agent = generate_agent()

    # Load agent's learned patterns
    agent_state = load_agent_state(agent.style)
    patterns = agent_state.get("patterns_noted", [])

    # Initialize call state
    state = CallState(customer=customer, agent=agent)

    # Build prompts
    customer_prompt = build_customer_prompt(customer)

    # Send call start info (includes customer preview for optional peek)
    await websocket.send_json({
        "type": "call_start",
        "call_id": call_id,
        "agent": agent.to_dict(),
        "agent_info": get_archetype_info(agent.style),
        "customer_preview": {
            "name": customer.name,
            "tier": customer.tier,
            "tier_display": get_tier_display(customer.tier),
            "motivation": customer.motivation,
            "call_reason": customer.call_reason
        },
        "warmup_mode": warmup_mode
    })

    # Conversation history for each participant
    agent_messages = []
    customer_messages = []

    # Initialize confidence with neutral defaults (updated during conversation)
    confidence = {
        "fraud_likelihood": 2,
        "motivation_guess": {"head": 33, "heart": 34, "hand": 33},
        "reasoning": "Initial assessment"
    }

    # Agent answers the phone with a scripted greeting (turn 0)
    greeting = f"Hi, thanks for calling! This is {agent.name} with Premiere Properties. How can I help you today?"

    await websocket.send_json({"type": "typing", "speaker": "agent"})
    await asyncio.sleep(1.0)

    state.transcript.append({
        "speaker": "agent",
        "text": greeting,
        "turn": 0
    })

    await websocket.send_json({
        "type": "message",
        "speaker": "agent",
        "text": greeting,
        "turn": 0
    })

    # Customer states their reason
    await asyncio.sleep(1.0)
    await websocket.send_json({"type": "typing", "speaker": "customer"})
    await asyncio.sleep(1.0)

    state.transcript.append({
        "speaker": "customer",
        "text": customer.call_reason,
        "turn": 0
    })

    await websocket.send_json({
        "type": "message",
        "speaker": "customer",
        "text": customer.call_reason,
        "turn": 0
    })

    # Add to message histories for context
    agent_messages.append({"role": "assistant", "content": greeting})
    agent_messages.append({"role": "user", "content": customer.call_reason})
    customer_messages.append({"role": "user", "content": greeting})
    customer_messages.append({"role": "assistant", "content": customer.call_reason})

    # Main conversation loop
    while state.turn < MAX_TURNS:
        state.turn += 1

        # Build agent prompt with current turn
        agent_prompt = build_agent_prompt(agent, patterns, state.turn)

        # Agent's turn
        await websocket.send_json({"type": "typing", "speaker": "agent"})
        await asyncio.sleep(1.0)

        # Agent always responds to the last customer message
        user_content = customer_messages[-1]["content"]

        agent_response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=agent_prompt,
            messages=agent_messages + [{"role": "user", "content": user_content}]
        )

        agent_text = agent_response.content[0].text

        # Check for close or flag
        close_attempted, close_pitch = check_close_attempt(agent_text)
        flag_used, flag_reason = check_flag_attempt(agent_text)

        if close_attempted:
            state.close_attempted = True
            state.close_pitch = close_pitch

        if flag_used:
            state.flag_used = True
            state.flag_reason = flag_reason

        # Clean text for display
        display_text = strip_action_tags(agent_text)

        # Record in transcript
        state.transcript.append({
            "speaker": "agent",
            "text": display_text,
            "turn": state.turn
        })

        agent_messages.append({"role": "assistant", "content": agent_text})

        # Send agent message
        await websocket.send_json({
            "type": "message",
            "speaker": "agent",
            "text": display_text,
            "turn": state.turn
        })

        # If agent flagged, end call immediately (no customer response needed)
        if flag_used:
            await websocket.send_json({
                "type": "message",
                "speaker": "system",
                "text": "[Call ended - Agent flagged for fraud]",
                "turn": state.turn,
                "is_end": True
            })
            break

        # If agent closed, let customer respond with YES or NO
        if close_attempted:
            # Get customer's final response to the close
            await asyncio.sleep(1.0)
            await websocket.send_json({"type": "typing", "speaker": "customer"})
            await asyncio.sleep(1.0)

            # Add instruction for customer to give final answer
            close_instruction = "\n\n[The agent has asked for your business. You MUST respond with a clear YES or NO. This is your final answer.]"
            customer_response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=150,
                system=customer_prompt + close_instruction,
                messages=customer_messages + [{"role": "user", "content": agent_text}]
            )

            customer_text = customer_response.content[0].text

            # Record in transcript
            state.transcript.append({
                "speaker": "customer",
                "text": customer_text,
                "turn": state.turn
            })

            # Send customer's final response
            await websocket.send_json({
                "type": "message",
                "speaker": "customer",
                "text": customer_text,
                "turn": state.turn
            })

            # Check if customer said yes (converted)
            customer_lower = customer_text.lower()
            if any(phrase in customer_lower for phrase in ["yes", "let's do", "i'm in", "let's work", "sounds good", "i'll sign", "let's move forward"]):
                state.converted_on_close = True

            await websocket.send_json({
                "type": "message",
                "speaker": "system",
                "text": "[Call ended - Agent closed]",
                "turn": state.turn,
                "is_end": True
            })
            break

        # Turn 8 is the last agent turn - force close if they didn't act
        if state.turn >= 8:
            # Agent didn't close/flag despite instructions - force a close
            state.close_attempted = True
            state.close_pitch = "(Agent failed to make explicit close - forced close)"
            await websocket.send_json({
                "type": "message",
                "speaker": "system",
                "text": "[Call ended - Turn limit reached without close]",
                "turn": state.turn,
                "is_end": True
            })
            break

        # Customer's turn
        await asyncio.sleep(1.0)
        await websocket.send_json({"type": "typing", "speaker": "customer"})
        await asyncio.sleep(1.0)

        customer_response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=customer_prompt,
            messages=customer_messages + [{"role": "user", "content": agent_text}]
        )

        customer_text = customer_response.content[0].text

        # Record in transcript
        state.transcript.append({
            "speaker": "customer",
            "text": customer_text,
            "turn": state.turn
        })

        customer_messages.append({"role": "assistant", "content": customer_text})
        agent_messages.append({"role": "user", "content": customer_text})

        # Send customer message
        await websocket.send_json({
            "type": "message",
            "speaker": "customer",
            "text": customer_text,
            "turn": state.turn
        })

        # Run dashboard analysis in parallel
        confidence_task = asyncio.create_task(
            get_agent_confidence(client, display_text, customer_text)
        )
        sentiment_task = asyncio.create_task(
            get_customer_sentiment(client, display_text, customer_text)
        )

        confidence = await confidence_task
        sentiment = await sentiment_task

        # Update state sentiment
        state.sentiment = sentiment

        # Calculate and update frustration
        alignment = assess_motivation_alignment(agent_text, customer.motivation)
        frustration_increase = calculate_frustration_increase(
            agent_text, customer.motivation, alignment
        )
        state.frustration = min(state.frustration + frustration_increase, 10.0)

        # Send dashboard update
        await websocket.send_json({
            "type": "dashboard_update",
            "turn": state.turn,
            "confidence": confidence,
            "sentiment": sentiment,
            "frustration": state.frustration,
            "alignment": alignment
        })

        # Check for customer bounce
        if check_customer_bounce(state):
            state.customer_bounced = True

            # Send bounce message
            bounce_msg = get_bounce_message(customer.motivation)
            state.transcript.append({
                "speaker": "customer",
                "text": bounce_msg,
                "turn": state.turn
            })

            await websocket.send_json({
                "type": "message",
                "speaker": "customer",
                "text": bounce_msg,
                "turn": state.turn,
                "is_bounce": True
            })

            # Send call-ending system message
            await websocket.send_json({
                "type": "message",
                "speaker": "system",
                "text": "[Call ended - Customer hung up]",
                "turn": state.turn,
                "is_end": True
            })
            break

    # If we hit max turns without a close/flag/bounce, send timeout message
    if state.turn >= MAX_TURNS and not state.close_attempted and not state.flag_used and not state.customer_bounced:
        await websocket.send_json({
            "type": "message",
            "speaker": "system",
            "text": "[Call ended - Maximum turns reached]",
            "turn": state.turn,
            "is_end": True
        })

    # Determine outcome
    try:
        # Use the actual customer response to determine conversion
        # (converted_on_close is set when customer says yes to close)
        converted = state.converted_on_close and not customer.is_sketchy

        # Capture agent's motivation guess from dashboard (for both CLOSE and FLAG)
        dominant_motivation = get_dominant_motivation(confidence.get("motivation_guess", {}))
        state.agent_motivation_guess = dominant_motivation

        outcome = determine_outcome(
            close_attempted=state.close_attempted,
            flag_used=state.flag_used,
            is_fraud=customer.is_sketchy,
            converted=converted,
            customer_bounced=state.customer_bounced
        )

        # Calculate score
        motivation_correct = state.agent_motivation_guess == customer.motivation
        points = calculate_score(customer.tier, outcome, motivation_correct)

        # Generate learning (includes both agent's read AND actual motivation for accurate learning)
        learning_prompt = get_post_call_learning_prompt(
            agent=agent,
            customer_tier=customer.tier,
            agent_motivation_guess=state.agent_motivation_guess or "unknown",
            actual_motivation=customer.motivation,
            guess_was_correct=motivation_correct,
            was_fraud=customer.is_sketchy,
            outcome=outcome
        )
        new_pattern = await generate_learning(client, learning_prompt)

        # Save pattern to agent state
        add_pattern(agent.style, new_pattern)

        # Update agent stats
        call_summary = {
            "call_id": call_id,
            "customer_tier": customer.tier,
            "customer_motivation": customer.motivation,
            "was_fraud": customer.is_sketchy,
            "outcome": outcome,
            "points": points,
            "turns": state.turn
        }
        update_agent_stats(agent.style, outcome, points, call_summary)

        # Log full call
        call_record = {
            "call_id": str(call_id),
            "timestamp": datetime.now().isoformat(),
            "customer": customer.to_dict(),
            "agent": agent.to_dict(),
            "turns_used": state.turn,
            "close_attempted": state.close_attempted,
            "close_pitch": state.close_pitch,
            "flag_used": state.flag_used,
            "flag_reason": state.flag_reason,
            "customer_bounced": state.customer_bounced,
            "outcome": outcome,
            "converted": converted,
            "agent_motivation_guess": state.agent_motivation_guess,
            "motivation_correct": motivation_correct,
            "points": points,
            "new_pattern": new_pattern,
            "final_sentiment": state.sentiment,
            "final_frustration": state.frustration,
            "transcript": state.transcript
        }
        log_call(call_record)

    except Exception as e:
        print(f"ERROR in post-call processing: {e}")
        import traceback
        traceback.print_exc()
        # Set fallback values so call_end still gets sent
        outcome = "missed_opp"
        points = 0
        converted = False
        motivation_correct = False
        new_pattern = "(Error generating learning)"

    # Send call end summary (always send, even if there was an error above)
    await websocket.send_json({
        "type": "call_end",
        "call_id": call_id,
        "outcome": outcome,
        "outcome_description": get_outcome_description(outcome),
        "points": points,
        "customer": customer.to_dict(),
        "customer_tier_display": get_tier_display(customer.tier),
        "agent": agent.to_dict(),
        "agent_info": get_archetype_info(agent.style),
        "close_attempted": state.close_attempted,
        "close_pitch": state.close_pitch,
        "flag_used": state.flag_used,
        "flag_reason": state.flag_reason,
        "customer_bounced": state.customer_bounced,
        "converted": converted,
        "agent_motivation_guess": state.agent_motivation_guess,
        "motivation_correct": motivation_correct,
        "new_pattern": new_pattern,
        "turns_used": state.turn,
        "final_sentiment": state.sentiment,
        "overall_stats": get_overall_stats(),
        "transcript": state.transcript
    })


def get_bounce_message(motivation: str) -> str:
    """Get a bounce (hang-up) message based on customer motivation."""
    messages = {
        "head": "You know what, I don't think this is going anywhere. Thanks for your time, but I'll do my own research.",
        "heart": "I... I don't think this is right for me. Thank you, but I need to go.",
        "hand": "Look, I gotta go. This is taking too long. *click*"
    }
    return messages.get(motivation, "I have to go. Goodbye.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
