# Android vs iPhone Conversion Simulator

A real-time conversation simulator where an Android advocate tries to convert an iPhone user. Watch AI agents debate in a slick chat UI.

## Quick Start (Replit)

1. Import this repo to Replit
2. Go to **Secrets** tab and add `ANTHROPIC_API_KEY`
3. Click **Run**
4. Open the webview and click "Start New Conversation"

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Run the server
uvicorn server:app --reload
```

Open http://localhost:8000

## How It Works

- **iPhone User (Agent 1)**: Gets a random hidden profile (loyalty type, openness, disclosure style)
- **Android Advocate (Agent 2)**: Asks discovery questions, then pitches based on what they learn
- **Memory**: The advocate learns from past sessions to improve their strategy

## Profile Types

| Loyalty | Description | Best Pitch |
|---------|-------------|------------|
| Head | Rational, specs-focused | Value, customization, freedom |
| Heart | Identity-driven, brand loyal | Individuality, creative culture |
| Hands | Deep in ecosystem | Migration tools, cross-platform compatibility |
