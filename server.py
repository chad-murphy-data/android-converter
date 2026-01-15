"""FastAPI server with WebSocket handler for Android vs iPhone conversation simulator."""

import asyncio
import json
import os
import re
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import anthropic

from agents import (
    generate_random_profile,
    build_iphone_user_prompt,
    build_android_advocate_prompt,
    build_memory_summary,
    iPhoneUserProfile
)

load_dotenv()

app = FastAPI()

# Ensure directories exist
Path("images").mkdir(exist_ok=True)
Path("results").mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/images", StaticFiles(directory="images"), name="images")

# Global state
session_history: list[dict] = []
session_counter = 0
stats = {"converted": 0, "stayed": 0, "maybe": 0}

# Load existing session history if available
RESULTS_FILE = Path("results/session_logs.json")
if RESULTS_FILE.exists():
    try:
        with open(RESULTS_FILE) as f:
            session_history = json.load(f)
            session_counter = len(session_history)
            for s in session_history:
                outcome = s.get("outcome", "stayed")
                if outcome in stats:
                    stats[outcome] += 1
    except json.JSONDecodeError:
        pass


def save_session(session_data: dict):
    """Save session to JSON file."""
    RESULTS_FILE.parent.mkdir(exist_ok=True)
    with open(RESULTS_FILE, "w") as f:
        json.dump(session_history, f, indent=2)


def parse_advocate_summary(text: str) -> dict:
    """Parse the advocate's summary block from their final message."""
    result = {"predicted_loyalty": None, "pitch_angle_used": None}

    match = re.search(r'\[ADVOCATE_SUMMARY\](.*?)\[/ADVOCATE_SUMMARY\]', text, re.DOTALL)
    if match:
        summary_text = match.group(1)

        loyalty_match = re.search(r'predicted_loyalty:\s*(head|heart|hands)', summary_text)
        if loyalty_match:
            result["predicted_loyalty"] = loyalty_match.group(1)

        pitch_match = re.search(r'pitch_angle_used:\s*(head|heart|hands)', summary_text)
        if pitch_match:
            result["pitch_angle_used"] = pitch_match.group(1)

    return result


def determine_outcome(text: str) -> str:
    """Determine conversation outcome from iPhone user's final message."""
    text_lower = text.lower()

    # Converted indicators
    converted_phrases = [
        "i'll give it a shot", "i'll check out android", "you've convinced me",
        "maybe i'll try", "i'm interested", "sign me up", "you got me",
        "i'll consider switching", "let's do it", "i'm in"
    ]

    # Staying indicators
    staying_phrases = [
        "i'm good with", "sticking with", "staying with", "i'll pass",
        "not for me", "i'm happy with my iphone", "no thanks", "nah"
    ]

    for phrase in converted_phrases:
        if phrase in text_lower:
            return "converted"

    for phrase in staying_phrases:
        if phrase in text_lower:
            return "stayed"

    if "think about it" in text_lower or "maybe" in text_lower:
        return "maybe"

    return "stayed"  # Default


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "new_session":
                await run_conversation(websocket, client)

    except WebSocketDisconnect:
        print("Client disconnected")


async def run_conversation(websocket: WebSocket, client: anthropic.Anthropic):
    """Run a full conversation between the two agents."""
    global session_counter, stats

    session_counter += 1
    session_id = session_counter

    # Generate random profile for iPhone user
    profile = generate_random_profile()

    # Send session start
    await websocket.send_json({
        "type": "session_start",
        "session_id": session_id,
        "stats": stats
    })

    # Build system prompts
    iphone_system = build_iphone_user_prompt(profile)
    memory_summary = build_memory_summary(session_history)
    android_system = build_android_advocate_prompt(memory_summary)

    # Conversation state
    android_messages = []
    iphone_messages = []
    transcript = []

    # Android advocate starts
    max_turns = 12  # Safety limit
    turn = 0
    conversation_ended = False
    advocate_summary = {}

    while turn < max_turns and not conversation_ended:
        turn += 1

        # Android advocate's turn
        await websocket.send_json({"type": "typing", "speaker": "android"})
        await asyncio.sleep(0.5)  # Brief delay for realism

        android_response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=android_system,
            messages=android_messages + ([{"role": "user", "content": iphone_messages[-1]["content"]}] if iphone_messages else [{"role": "user", "content": "Start the conversation. Say hi and ask your first discovery question."}])
        )

        android_text = android_response.content[0].text

        # Check for summary block (conversation ending)
        if "[ADVOCATE_SUMMARY]" in android_text:
            advocate_summary = parse_advocate_summary(android_text)
            # Remove summary block from displayed text
            android_text_display = re.sub(r'\[ADVOCATE_SUMMARY\].*?\[/ADVOCATE_SUMMARY\]', '', android_text, flags=re.DOTALL).strip()
            conversation_ended = True
        else:
            android_text_display = android_text

        android_messages.append({"role": "assistant", "content": android_text})
        transcript.append({"speaker": "android", "text": android_text_display})

        await websocket.send_json({
            "type": "message",
            "speaker": "android",
            "text": android_text_display
        })

        if conversation_ended:
            break

        # iPhone user's turn
        await asyncio.sleep(0.8)  # Pause between speakers
        await websocket.send_json({"type": "typing", "speaker": "iphone"})
        await asyncio.sleep(0.5)

        iphone_response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=iphone_system,
            messages=iphone_messages + [{"role": "user", "content": android_text}]
        )

        iphone_text = iphone_response.content[0].text
        iphone_messages.append({"role": "assistant", "content": iphone_text})
        transcript.append({"speaker": "iphone", "text": iphone_text})

        await websocket.send_json({
            "type": "message",
            "speaker": "iphone",
            "text": iphone_text
        })

        # Update message history for next turn
        android_messages.append({"role": "user", "content": iphone_text})

        # Check if iPhone user made a final decision
        outcome = determine_outcome(iphone_text)
        if any(phrase in iphone_text.lower() for phrase in [
            "i'll give it", "you've convinced", "i'm good with", "sticking with",
            "staying with", "i'll pass", "not for me", "think about it", "maybe someday"
        ]):
            # One more turn for advocate to wrap up
            await asyncio.sleep(0.8)
            await websocket.send_json({"type": "typing", "speaker": "android"})
            await asyncio.sleep(0.5)

            final_response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=android_system,
                messages=android_messages + [{"role": "user", "content": f"{iphone_text}\n\n(The conversation is ending. Respond gracefully and include your [ADVOCATE_SUMMARY] block.)"}]
            )

            final_text = final_response.content[0].text
            advocate_summary = parse_advocate_summary(final_text)
            final_text_display = re.sub(r'\[ADVOCATE_SUMMARY\].*?\[/ADVOCATE_SUMMARY\]', '', final_text, flags=re.DOTALL).strip()

            transcript.append({"speaker": "android", "text": final_text_display})
            await websocket.send_json({
                "type": "message",
                "speaker": "android",
                "text": final_text_display
            })

            conversation_ended = True

    # Determine final outcome from last iPhone message
    last_iphone_msg = next((t["text"] for t in reversed(transcript) if t["speaker"] == "iphone"), "")
    outcome = determine_outcome(last_iphone_msg)

    # Update stats
    stats[outcome] += 1

    # Build session record
    session_data = {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "iphone_user_profile": profile.to_dict(),
        "advocate_predicted_loyalty": advocate_summary.get("predicted_loyalty"),
        "pitch_angle_used": advocate_summary.get("pitch_angle_used"),
        "prediction_correct": advocate_summary.get("predicted_loyalty") == profile.primary_loyalty,
        "outcome": outcome,
        "conversation_turns": len(transcript),
        "full_transcript": transcript
    }

    session_history.append(session_data)
    save_session(session_data)

    # Send session end
    await websocket.send_json({
        "type": "session_end",
        "outcome": outcome,
        "actual_profile": profile.to_dict(),
        "advocate_prediction": advocate_summary.get("predicted_loyalty"),
        "prediction_correct": advocate_summary.get("predicted_loyalty") == profile.primary_loyalty,
        "stats": stats
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
