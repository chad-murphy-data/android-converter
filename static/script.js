// Animated Scene UI - Robots in Office with Idle/Talking Animations

let ws = null;
let currentAgentStyle = null;
let currentAgentType = null; // 'adaptive' or 'traditional'
let currentCustomerMotivation = null;
let transcript = [];

// Animation state
let agentIdleAnim = null;
let customerIdleAnim = null;
let agentTalkingAnim = null;
let customerTalkingAnim = null;

// DOM Elements - Scene
const agentCharacter = document.getElementById('agent-character');
const customerCharacter = document.getElementById('customer-character');
const agentName = document.getElementById('agent-name');
const agentTitle = document.getElementById('agent-title');
const agentBubble = document.getElementById('agent-bubble');
const agentSpeech = document.getElementById('agent-speech');
const customerBubble = document.getElementById('customer-bubble');
const customerSpeech = document.getElementById('customer-speech');
const customerName = document.getElementById('customer-name');
const customerTitle = document.getElementById('customer-title');

// DOM Elements - Header
const turnCount = document.getElementById('turn-count');

// DOM Elements - Psychograph
const headBar = document.getElementById('head-bar');
const headValue = document.getElementById('head-value');
const heartBar = document.getElementById('heart-bar');
const heartValue = document.getElementById('heart-value');
const handBar = document.getElementById('hand-bar');
const handValue = document.getElementById('hand-value');
const confidenceBar = document.getElementById('confidence-bar');
const confidenceValue = document.getElementById('confidence-value');
const reasoningText = document.getElementById('reasoning-text');

// DOM Elements - Intel Box
const intelBox = document.getElementById('intel-box');
const intelName = document.getElementById('intel-name');
const intelTier = document.getElementById('intel-tier');
const intelMotivation = document.getElementById('intel-motivation');

// DOM Elements - Vibes Chyron
const vibeBar = document.getElementById('vibe-bar');
const vibeValue = document.getElementById('vibe-value');
const frustrationBar = document.getElementById('frustration-bar');
const frustrationValue = document.getElementById('frustration-value');
const closeReadyBar = document.getElementById('close-ready-bar');
const closeReadyValue = document.getElementById('close-ready-value');
const moodValue = document.getElementById('mood-value');

// DOM Elements - Spicy Indicator
const spicyIndicator = document.getElementById('spicy-indicator');
const spicyText = document.getElementById('spicy-text');

// DOM Elements - Controls & Modals
const startButton = document.getElementById('start-button');
const logButton = document.getElementById('log-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const conversationLog = document.getElementById('conversation-log');
const logMessages = document.getElementById('log-messages');
const logClose = document.getElementById('log-close');
const outcomeModal = document.getElementById('outcome-modal');
const outcomeClose = document.getElementById('outcome-close');
const leaderboardModal = document.getElementById('leaderboard-modal');
const modalClose = document.getElementById('modal-close');
const leaderboardContent = document.getElementById('leaderboard-content');

// ===== CHARACTER MAPPING =====

// Map backend agent types to frontend character types
function getAgentCharacterType(agentStyle) {
    const adaptiveTypes = ['closer', 'empath', 'gambler'];
    return adaptiveTypes.includes(agentStyle) ? 'adaptive' : 'traditional';
}

// ===== IDLE ANIMATIONS =====

function startIdleAnimations() {
    // Agent idle - gentle bob
    agentIdleAnim = anime({
        targets: agentCharacter,
        translateY: [-3, 3],
        duration: 2000,
        easing: 'easeInOutSine',
        direction: 'alternate',
        loop: true
    });

    // Customer idle - slightly offset timing
    customerIdleAnim = anime({
        targets: customerCharacter,
        translateY: [-3, 3],
        duration: 2200,
        easing: 'easeInOutSine',
        direction: 'alternate',
        loop: true,
        delay: 500
    });
}

// ===== TALKING ANIMATIONS =====

function startTalkingAnimation(character) {
    const element = character === 'agent' ? agentCharacter : customerCharacter;

    // Stop idle animation for this character
    anime.remove(element);

    // Add speaking glow class (CSS handles the glow animation)
    element.classList.add('speaking');

    // No bobbing - just the glow effect from CSS
    if (character === 'agent') {
        agentTalkingAnim = null;
    } else {
        customerTalkingAnim = null;
    }
}

function stopTalkingAnimation(character) {
    const element = character === 'agent' ? agentCharacter : customerCharacter;

    anime.remove(element);

    // Remove speaking glow class
    element.classList.remove('speaking');

    // Return to idle
    const idleAnim = anime({
        targets: element,
        translateY: [-3, 3],
        duration: 2000,
        easing: 'easeInOutSine',
        direction: 'alternate',
        loop: true
    });

    if (character === 'agent') {
        agentIdleAnim = idleAnim;
    } else {
        customerIdleAnim = idleAnim;
    }
}

// ===== SPEECH BUBBLE ANIMATIONS =====

function showSpeechBubble(bubbleElement) {
    anime({
        targets: bubbleElement,
        scale: [0, 1.1, 1],
        opacity: [0, 1],
        duration: 350,
        easing: 'easeOutBack'
    });
}

function animateBubblePop(bubbleElement) {
    anime({
        targets: bubbleElement,
        scale: [0.9, 1.05, 1],
        duration: 300,
        easing: 'easeOutElastic(1, 0.5)'
    });
}

// ===== METER ANIMATIONS =====

function animateMeterFill(meterElement, targetWidth) {
    anime({
        targets: meterElement,
        width: targetWidth + '%',
        duration: 600,
        easing: 'easeOutElastic(1, 0.6)'
    });
}

// ===== SCORE ANIMATION =====

function animateScoreCount(element, targetValue) {
    const obj = { value: 0 };
    anime({
        targets: obj,
        value: targetValue,
        duration: 1000,
        round: 1,
        easing: 'easeOutExpo',
        update: () => {
            const prefix = targetValue >= 0 ? '+' : '';
            element.textContent = prefix + obj.value;
        }
    });
}

// ===== CELEBRATION =====

function celebrateConversion() {
    if (typeof confetti === 'undefined') return;

    // Confetti burst
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });

    // Agent celebration bounce
    anime({
        targets: agentCharacter,
        translateY: [-30, 0],
        scale: [1.1, 1],
        duration: 600,
        easing: 'easeOutBounce'
    });

    setTimeout(() => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
    }, 250);
}

// ===== SPICY INDICATOR =====

function updateSpicyIndicator(frustration) {
    spicyIndicator.classList.remove('active', 'level-8', 'level-9', 'level-10');

    if (frustration >= 10) {
        spicyIndicator.classList.add('active', 'level-10');
        spicyText.textContent = "Maximum spice!";
    } else if (frustration >= 9) {
        spicyIndicator.classList.add('active', 'level-9');
        spicyText.textContent = "Things are heating up...";
    } else if (frustration >= 8) {
        spicyIndicator.classList.add('active', 'level-8');
        spicyText.textContent = "Getting a little spicy";
    }
}

// ===== WEBSOCKET =====

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        console.log('Connected to server');
        startButton.disabled = false;
        startIdleAnimations();
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        startButton.disabled = true;
        setTimeout(connect, 2000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
}

function handleMessage(data) {
    console.log('Received message:', data.type, data);
    switch (data.type) {
        case 'call_start':
            handleCallStart(data);
            break;
        case 'typing':
            showTypingIndicator(data.speaker);
            break;
        case 'message':
            hideTypingIndicator(data.speaker);
            addMessage(data.speaker, data.text, data.is_bounce, data.is_end);
            if (data.turn) {
                turnCount.textContent = data.turn;
            }
            break;
        case 'dashboard_update':
            updateDashboard(data);
            break;
        case 'call_end':
            console.log('Call end received:', data);
            handleCallEnd(data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// ===== CALL HANDLING =====

function handleCallStart(data) {
    // Reset transcript
    transcript = [];
    logMessages.innerHTML = '';
    turnCount.textContent = '0';

    // Update agent info
    const agent = data.agent;
    currentAgentStyle = agent.style;
    currentAgentType = getAgentCharacterType(agent.style);

    // Set agent character image
    agentCharacter.src = `/static/scene/agent-${currentAgentType}.png`;
    agentName.textContent = agent.name;
    agentTitle.textContent = currentAgentType === 'adaptive' ? 'Adaptive' : 'Traditional';

    // Reset agent bubble
    agentSpeech.textContent = 'Waiting for call...';

    // Show intel box with customer info (spectator mode)
    if (data.customer_preview) {
        currentCustomerMotivation = data.customer_preview.motivation;

        intelName.textContent = data.customer_preview.name;
        intelTier.textContent = data.customer_preview.tier_display;
        intelMotivation.textContent = data.customer_preview.motivation.toUpperCase();
        intelMotivation.className = `intel-value motivation-badge ${data.customer_preview.motivation}`;

        intelBox.style.display = 'block';

        // Set customer character image based on motivation
        customerCharacter.src = `/static/scene/customer-${currentCustomerMotivation}.png`;

        // Update customer name plate
        customerName.textContent = data.customer_preview.name;
        const motivationLabels = { head: 'Analytical', heart: 'Emotional', hand: 'Pragmatic' };
        customerTitle.textContent = motivationLabels[currentCustomerMotivation] || 'Unknown';

        // Highlight correct motivation in psychograph
        highlightCorrectMotivation(currentCustomerMotivation);
    }

    // Reset dashboard
    resetDashboard();

    // Reset speech bubbles
    customerSpeech.textContent = '...';

    // Restart idle animations
    startIdleAnimations();
}

function truncateAtSentence(text, maxChars = 280) {
    // If text is short enough, return as-is
    if (text.length <= maxChars) {
        return { display: text, truncated: false, full: text };
    }

    // Find the last sentence boundary before maxChars
    const sentenceEnders = ['. ', '! ', '? ', '." ', '!" ', '?" '];
    let lastBoundary = -1;

    for (const ender of sentenceEnders) {
        const idx = text.lastIndexOf(ender, maxChars);
        if (idx > lastBoundary) {
            lastBoundary = idx + ender.length - 1;  // Include the punctuation
        }
    }

    // Also check for sentence enders at end of text
    const endEnders = ['.', '!', '?'];
    for (const ender of endEnders) {
        const idx = text.lastIndexOf(ender, maxChars);
        if (idx > lastBoundary && (idx === text.length - 1 || text[idx + 1] === ' ' || text[idx + 1] === '"')) {
            lastBoundary = idx + 1;
        }
    }

    // If no sentence boundary found or it's too early, fall back to last space
    if (lastBoundary === -1 || lastBoundary < maxChars * 0.5) {
        lastBoundary = text.lastIndexOf(' ', maxChars);
        if (lastBoundary === -1) lastBoundary = maxChars;
    }

    const truncated = text.slice(0, lastBoundary).trim();

    return {
        display: truncated + '...',
        truncated: true,
        full: text
    };
}

function escapeForAttr(text) {
    return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
}

function expandBubble(btn) {
    const bubble = btn.closest('.speech-bubble');
    const fullText = btn.dataset.fullText;
    const textSpan = bubble.querySelector('.bubble-text');
    if (textSpan && fullText) {
        textSpan.textContent = fullText;
    }
    btn.remove();
}

function setBubbleContent(speaker, text, isTyping = false) {
    const speechEl = speaker === 'agent' ? agentSpeech : customerSpeech;
    const bubbleEl = speaker === 'agent' ? agentBubble : customerBubble;

    if (isTyping) {
        bubbleEl.classList.add('typing');
        speechEl.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        startTalkingAnimation(speaker);
    } else {
        bubbleEl.classList.remove('typing');

        // Truncate at sentence boundary if too long
        const result = truncateAtSentence(text, 280);

        if (result.truncated) {
            speechEl.innerHTML = `<span class="bubble-text">${result.display}</span><button class="expand-btn" onclick="expandBubble(this)" data-full-text="${escapeForAttr(result.full)}">more</button>`;
        } else {
            speechEl.innerHTML = `<span class="bubble-text">${result.display}</span>`;
        }

        stopTalkingAnimation(speaker);
        animateBubblePop(bubbleEl);
    }
}

function showTypingIndicator(speaker) {
    setBubbleContent(speaker, '', true);
}

function hideTypingIndicator(speaker) {
    // Will be replaced by actual message
}

function addMessage(speaker, text, isBounce = false, isEnd = false) {
    // Update speech bubble
    if (speaker !== 'system') {
        setBubbleContent(speaker, text);
    }

    // Add to transcript
    transcript.push({ speaker, text, isBounce });

    // Add to log
    const logMsg = document.createElement('div');
    logMsg.className = `log-message ${speaker}`;

    if (speaker === 'system') {
        logMsg.textContent = text;
    } else {
        logMsg.innerHTML = `<span class="log-speaker">${speaker}:</span>${text}`;
    }

    logMessages.appendChild(logMsg);
    logMessages.scrollTop = logMessages.scrollHeight;

    // Handle bounce - customer leaves frustrated
    if (isBounce) {
        anime({
            targets: customerCharacter,
            translateX: [0, -10, 10, -10, 0],
            duration: 500,
            easing: 'easeInOutSine'
        });
    }
}

// ===== DASHBOARD =====

function updateDashboard(data) {
    console.log('Dashboard update received:', data);
    const { confidence, sentiment, frustration, turn } = data;

    // Update turn count
    if (turn) {
        turnCount.textContent = turn;
    }

    // Update closing confidence with animation
    const closingConf = confidence.closing_confidence || sentiment.likelihood_to_convert || 5;
    animateMeterFill(confidenceBar, closingConf * 10);
    confidenceValue.textContent = `${closingConf}/10`;

    // Update motivation guess with animation
    const motivation = confidence.motivation_guess || { head: 33, heart: 34, hand: 33 };
    animateMeterFill(headBar, motivation.head);
    headValue.textContent = `${motivation.head}%`;
    animateMeterFill(heartBar, motivation.heart);
    heartValue.textContent = `${motivation.heart}%`;
    animateMeterFill(handBar, motivation.hand);
    handValue.textContent = `${motivation.hand}%`;

    // Highlight dominant motivation
    const dominant = getDominantMotivation(motivation);
    document.querySelectorAll('.meter-item').forEach(item => {
        item.classList.remove('dominant');
        if (item.dataset.motivation === dominant) {
            item.classList.add('dominant');
        }
    });

    // Update reasoning
    const reasoning = confidence.reasoning || 'Analyzing...';
    reasoningText.textContent = reasoning;

    // Update vibes chyron with animation
    const vibe = Math.round((sentiment.satisfaction + sentiment.trust) / 2);
    animateMeterFill(vibeBar, vibe * 10);
    vibeValue.textContent = vibe;

    animateMeterFill(frustrationBar, sentiment.frustration * 10);
    frustrationValue.textContent = sentiment.frustration;

    // High frustration visual
    if (sentiment.frustration >= 7) {
        frustrationBar.classList.add('high');
    } else {
        frustrationBar.classList.remove('high');
    }

    animateMeterFill(closeReadyBar, sentiment.likelihood_to_convert * 10);
    closeReadyValue.textContent = sentiment.likelihood_to_convert;

    if (sentiment.likelihood_to_convert >= 7) {
        closeReadyBar.classList.add('high');
    } else {
        closeReadyBar.classList.remove('high');
    }

    // Update mood
    const funMood = getFunMood(sentiment.emotional_tone);
    moodValue.textContent = funMood;
    moodValue.className = `mood-value ${getMoodClass(sentiment.emotional_tone)}`;

    // Update spicy indicator
    updateSpicyIndicator(sentiment.frustration);
}

function getFunMood(tone) {
    const moodMap = {
        'neutral': ['VIBING', 'CHILL', 'STEADY', 'COASTING'][Math.floor(Math.random() * 4)],
        'frustrated': ['SPICY', 'HEATED', 'YIKES', 'PRICKLY'][Math.floor(Math.random() * 4)],
        'annoyed': ['SPICY', 'PRICKLY', 'EDGY'][Math.floor(Math.random() * 3)],
        'impatient': ['ANTSY', 'RESTLESS', 'TAPPING'][Math.floor(Math.random() * 3)],
        'happy': ['GOLDEN', 'WINNING', 'SUNNY'][Math.floor(Math.random() * 3)],
        'interested': ['HOOKED', 'CURIOUS', 'LEANING IN'][Math.floor(Math.random() * 3)],
        'curious': ['INTRIGUED', 'EXPLORING', 'EARS UP'][Math.floor(Math.random() * 3)],
        'skeptical': ['SIDE-EYE', 'HMM...', 'DOUBTFUL'][Math.floor(Math.random() * 3)],
        'warm': ['COZY', 'FRIENDLY', 'OPEN'][Math.floor(Math.random() * 3)],
        'engaged': ['LOCKED IN', 'ALL EARS', 'PRESENT'][Math.floor(Math.random() * 3)]
    };
    return moodMap[tone?.toLowerCase()] || tone?.toUpperCase() || 'VIBING';
}

function getDominantMotivation(motivation) {
    const { head, heart, hand } = motivation;
    if (head >= heart && head >= hand) return 'head';
    if (heart >= head && heart >= hand) return 'heart';
    return 'hand';
}

function getMoodClass(tone) {
    const positive = ['happy', 'interested', 'curious', 'engaged', 'warm', 'friendly'];
    const negative = ['frustrated', 'annoyed', 'skeptical', 'impatient', 'hostile', 'angry'];
    if (positive.includes(tone?.toLowerCase())) return 'positive';
    if (negative.includes(tone?.toLowerCase())) return 'negative';
    return '';
}

function highlightCorrectMotivation(motivation) {
    document.querySelectorAll('.meter-item').forEach(item => {
        item.classList.remove('correct-answer');
        if (item.dataset.motivation === motivation) {
            item.classList.add('correct-answer');
        }
    });
}

function resetDashboard() {
    confidenceBar.style.width = '50%';
    confidenceValue.textContent = '5/10';

    currentCustomerMotivation = null;
    headBar.style.width = '33%';
    headValue.textContent = '33%';
    heartBar.style.width = '33%';
    heartValue.textContent = '33%';
    handBar.style.width = '33%';
    handValue.textContent = '33%';

    document.querySelectorAll('.meter-item').forEach(item => {
        item.classList.remove('dominant');
        item.classList.remove('correct-answer');
    });

    reasoningText.textContent = 'Waiting for call to start...';

    vibeBar.style.width = '50%';
    vibeValue.textContent = '5';
    frustrationBar.style.width = '20%';
    frustrationBar.classList.remove('high');
    frustrationValue.textContent = '2';
    closeReadyBar.style.width = '50%';
    closeReadyBar.classList.remove('high');
    closeReadyValue.textContent = '5';
    moodValue.textContent = 'VIBING';
    moodValue.className = 'mood-value';

    // Reset spicy indicator
    spicyIndicator.classList.remove('active', 'level-8', 'level-9', 'level-10');

    intelBox.style.display = 'none';
}

// ===== CALL END =====

function handleCallEnd(data) {
    console.log('handleCallEnd called with:', data);
    try {
        // Hide spicy indicator
        spicyIndicator.classList.remove('active', 'level-8', 'level-9', 'level-10');

        // Stop talking animations, return to idle
        stopTalkingAnimation('agent');
        stopTalkingAnimation('customer');

        // Configure outcome modal
        const outcomeEmoji = {
            'conversion': '🎉',
            'missed_opp': '😬',
            'fraud_caught': '🛡️',
            'fraud_missed': '💥',
            'bounced': '👋'
        };

        const outcomeTitle = {
            'conversion': 'CONVERSION!',
            'missed_opp': 'MISSED IT',
            'fraud_caught': 'GOOD CALL!',
            'fraud_missed': 'BAD LISTING',
            'bounced': 'THEY LEFT'
        };

        const outcome = data.customer_bounced ? 'bounced' : data.outcome;

        document.getElementById('outcome-icon').textContent = outcomeEmoji[outcome] || '❓';
        document.getElementById('outcome-title').textContent = outcomeTitle[outcome] || data.outcome_description;

        const pointsEl = document.getElementById('outcome-points');
        pointsEl.className = `outcome-points ${data.points >= 0 ? 'positive' : 'negative'}`;

        // Populate motivation comparison (horizontal layout)
        const customer = data.customer;
        const agentGuess = data.agent_motivation_guess || 'unknown';
        const actualMotivation = customer.motivation;
        const isCorrect = data.motivation_correct;

        const agentGuessEl = document.getElementById('debrief-agent-guess');
        agentGuessEl.textContent = agentGuess.toUpperCase();
        agentGuessEl.className = `motivation-badge ${agentGuess}`;

        const actualEl = document.getElementById('debrief-actual');
        actualEl.textContent = actualMotivation.toUpperCase();
        actualEl.className = `motivation-badge ${actualMotivation}`;

        const matchEl = document.getElementById('motivation-match');
        if (isCorrect) {
            matchEl.textContent = '✓';
            matchEl.className = 'motivation-match correct';
        } else {
            matchEl.textContent = '✗';
            matchEl.className = 'motivation-match incorrect';
        }

        // Build compact call details (single line)
        const fraudBadge = customer.is_fraud ? ' <span style="color: #FF6B6B">⚠</span>' : '';
        document.getElementById('call-details').innerHTML = `
            <span class="detail-item"><strong>${customer.name}</strong></span>
            <span class="divider">|</span>
            <span class="detail-item">${data.customer_tier_display}</span>
            <span class="divider">|</span>
            <span class="detail-item">${data.turns_used} turns${fraudBadge}</span>
        `;

        // Generate rich exec insight with takeaway
        const insightHtml = generateExecInsight(outcome, isCorrect, agentGuess, actualMotivation, data);
        document.getElementById('insight-text').innerHTML = insightHtml;

        // Show modal
        outcomeModal.classList.add(outcome);
        outcomeModal.style.display = 'flex';

        // Celebrate conversion with confetti!
        if (outcome === 'conversion') {
            celebrateConversion();
        }

        // Animate score counting
        setTimeout(() => {
            animateScoreCount(pointsEl, data.points);
        }, 300);

        // Re-enable start button
        startButton.disabled = false;
    } catch (error) {
        console.error('Error in handleCallEnd:', error);
        startButton.disabled = false;
    }
}

function generateExecInsight(outcome, motivationCorrect, agentGuess, actualMotivation, data) {
    // Generate a 2-3 sentence executive narrative with a punchy takeaway
    const turnsUsed = data.turns_used || 8;

    const motivationHooks = {
        head: 'data and methodology',
        heart: 'trust and emotional connection',
        hand: 'speed and decisiveness'
    };

    const actualHook = motivationHooks[actualMotivation] || 'their core needs';
    const readHook = motivationHooks[agentGuess] || 'a different approach';

    let narrative = '';
    let takeaway = '';

    if (outcome === 'conversion' && motivationCorrect) {
        // BEST CASE: Correct read + conversion
        if (turnsUsed <= 4) {
            narrative = `Quick close in just ${turnsUsed} turns. The agent spotted a ${actualMotivation.toUpperCase()} customer early and leaned into ${actualHook}.`;
            takeaway = 'Fast reads = fast closes.';
        } else {
            narrative = `Solid conversion after ${turnsUsed} turns of building rapport. The agent correctly identified ${actualHook} as the key and matched their approach.`;
            takeaway = 'Read the room, match the energy.';
        }
    } else if (outcome === 'conversion' && !motivationCorrect) {
        // INTERESTING: Wrong read but still converted
        narrative = `Converted despite reading ${agentGuess.toUpperCase()} when the customer was actually ${actualMotivation.toUpperCase()}. The agent's authenticity overcame the mismatch.`;
        takeaway = 'Being genuine matters more than being perfect.';
    } else if (outcome === 'missed_opp' && motivationCorrect) {
        // FRUSTRATING: Right read but still lost
        if (turnsUsed >= 7) {
            narrative = `Correct read (${actualMotivation.toUpperCase()}) but couldn't close. The agent waited too long to ask for the business—momentum faded.`;
            takeaway = 'Reading isn\'t enough. You have to close.';
        } else {
            narrative = `Correct read (${actualMotivation.toUpperCase()}) but the execution fell short. The customer wanted ${actualHook} but didn't get enough of it.`;
            takeaway = 'Right diagnosis, wrong prescription.';
        }
    } else if (outcome === 'missed_opp' && !motivationCorrect) {
        // MISS: Wrong read + no conversion
        if (agentGuess === 'head' && actualMotivation === 'heart') {
            narrative = `The agent went analytical when the customer needed emotional connection. Data and process talk bounced off someone who wanted to feel heard.`;
            takeaway = 'You can\'t logic someone into trust.';
        } else if (agentGuess === 'heart' && actualMotivation === 'hand') {
            narrative = `Too much rapport-building for a customer who just wanted action. While the agent was building connection, the customer was checking their watch.`;
            takeaway = 'Some people don\'t want a relationship—they want results.';
        } else if (agentGuess === 'hand' && actualMotivation === 'heart') {
            narrative = `The agent's efficiency felt cold to a customer seeking partnership. Speed and decisiveness read as dismissive to someone who needed to feel valued.`;
            takeaway = 'Fast isn\'t always better.';
        } else {
            narrative = `Misread as ${agentGuess.toUpperCase()}, actually ${actualMotivation.toUpperCase()}. The customer needed ${actualHook}, but got ${readHook} instead.`;
            takeaway = 'Wrong lens, wrong outcome.';
        }
    } else if (outcome === 'bounced') {
        narrative = `Customer bailed before the close—frustration built too fast. ${actualMotivation.toUpperCase()} customers need a specific pace and approach.`;
        takeaway = 'Patience is part of the pitch.';
    } else if (outcome === 'fraud_caught') {
        narrative = `Good instincts. The agent recognized the red flags early and protected the business from a problematic listing.`;
        takeaway = 'Trust your gut when something feels off.';
    } else if (outcome === 'fraud_missed') {
        narrative = `Missed warning signs. The deal went through, but the red flags were there. Review the conversation for signals that should have triggered caution.`;
        takeaway = 'Not every listing is worth taking.';
    } else {
        narrative = `Analyze what worked and what didn't to improve future performance.`;
        takeaway = 'Every call teaches something.';
    }

    return `${narrative} <span class="takeaway">${takeaway}</span>`;
}

// ===== UI CONTROLS =====

function startNewCall() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        startButton.disabled = true;
        outcomeModal.style.display = 'none';
        outcomeModal.className = 'outcome-modal';
        ws.send(JSON.stringify({ type: 'new_call' }));
    }
}

function toggleLog() {
    if (conversationLog.style.display === 'none') {
        conversationLog.style.display = 'block';
    } else {
        conversationLog.style.display = 'none';
    }
}

async function showLeaderboard() {
    leaderboardModal.classList.add('active');
    leaderboardContent.innerHTML = 'Loading...';

    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        renderLeaderboard(data);
    } catch (error) {
        leaderboardContent.innerHTML = '<p class="error">Failed to load leaderboard</p>';
    }
}

function renderLeaderboard(data) {
    if (!data || data.length === 0) {
        leaderboardContent.innerHTML = '<p class="no-data">No calls completed yet. Start some calls!</p>';
        return;
    }

    let html = '<div class="leaderboard-list">';

    data.forEach((agent, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

        html += `
            <div class="leaderboard-item ${agent.style}">
                <div class="rank ${rankClass}">#${rank}</div>
                <div class="agent-info">
                    <span class="agent-style-name">${agent.display_name || agent.style}</span>
                    <span class="agent-stats">
                        ${agent.total_calls} calls |
                        ${agent.conversion_rate}% conv |
                        ${agent.frauds_caught} fraud
                    </span>
                </div>
                <div class="agent-points ${agent.total_points >= 0 ? 'positive' : 'negative'}">
                    ${agent.total_points >= 0 ? '+' : ''}${agent.total_points}
                </div>
            </div>
        `;
    });

    html += '</div>';
    leaderboardContent.innerHTML = html;
}

function hideLeaderboard() {
    leaderboardModal.classList.remove('active');
}

// ===== EVENT LISTENERS =====

startButton.addEventListener('click', startNewCall);
logButton.addEventListener('click', toggleLog);
logClose.addEventListener('click', () => { conversationLog.style.display = 'none'; });
leaderboardButton.addEventListener('click', showLeaderboard);
modalClose.addEventListener('click', hideLeaderboard);
leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) hideLeaderboard();
});
outcomeClose.addEventListener('click', () => {
    outcomeModal.style.display = 'none';
    outcomeModal.className = 'outcome-modal';
});

// ===== INITIALIZE =====
connect();
