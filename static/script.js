// Cartoon Broadcast UI v2 - Expression-switching with Anime.js animations

let ws = null;
let currentAgentStyle = null;
let currentAgentType = null; // 'adaptive' or 'traditional'
let currentCustomerMotivation = null;
let currentAgentExpression = 'neutral';
let currentCustomerExpression = 'neutral';
let isAgentThinking = false;
let transcript = [];

// DOM Elements - Main Stage
const agentImage = document.getElementById('agent-image');
const customerImage = document.getElementById('customer-image');
const agentName = document.getElementById('agent-name');
const agentTitle = document.getElementById('agent-title');
const agentBubble = document.getElementById('agent-bubble');
const customerBubble = document.getElementById('customer-bubble');
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

// Flavor text arrays
const THINKING_PREFIXES = ['Hmm...', 'Interesting...', 'My read:', 'Gut feeling:', 'Sensing that', 'Noticing', 'Wait...', 'Aha!'];

// ===== EXPRESSION LOGIC =====

// Map backend agent types to frontend character types
function getAgentCharacterType(agentStyle) {
    const adaptiveTypes = ['closer', 'empath', 'gambler'];
    return adaptiveTypes.includes(agentStyle) ? 'adaptive' : 'traditional';
}

// Get agent expression based on confidence and sentiment
function getAgentExpression(confidence, sentiment, isThinking) {
    if (isThinking) {
        return 'thinking';
    }

    const maxConfidence = Math.max(
        confidence.motivation_guess?.head || 0,
        confidence.motivation_guess?.heart || 0,
        confidence.motivation_guess?.hand || 0
    );

    // High confidence + good sentiment = happy
    if (maxConfidence >= 60 && sentiment.likelihood_to_convert >= 7) {
        return 'happy';
    }

    // Customer frustrated = agent worried
    if (sentiment.frustration >= 6) {
        return 'worried';
    }

    // Low confidence = thinking
    if (maxConfidence < 45) {
        return 'thinking';
    }

    return 'neutral';
}

// Get customer expression based on motivation and sentiment
function getCustomerExpression(motivation, sentiment) {
    const frustration = sentiment.frustration || 5;
    const satisfaction = sentiment.satisfaction || 5;
    const trust = sentiment.trust || 5;

    if (motivation === 'head') {
        if (frustration >= 7) return 'frustrated';
        if (satisfaction >= 7 && trust >= 6) return 'satisfied';
        if (trust < 4 || satisfaction < 4) return 'skeptical';
        return 'neutral';
    }

    if (motivation === 'heart') {
        if (frustration >= 7) return 'upset';
        if (satisfaction >= 7) return 'happy';
        if (trust < 5) return 'uncertain';
        return 'neutral';
    }

    if (motivation === 'hand') {
        if (frustration >= 7) return 'frustrated';
        if (satisfaction >= 7) return 'satisfied';
        if (frustration >= 5) return 'impatient';
        return 'neutral';
    }

    return 'neutral';
}

// Update agent image with expression
function updateAgentExpression(expression) {
    if (expression === currentAgentExpression) return;

    const src = `/static/characters/agent-${currentAgentType}-${expression}.png`;

    if (agentImage.src !== src) {
        agentImage.src = src;
        currentAgentExpression = expression;
        animateExpressionChange(agentImage);
    }
}

// Update customer image with expression
function updateCustomerExpression(expression) {
    if (expression === currentCustomerExpression || !currentCustomerMotivation) return;

    const src = `/static/characters/customer-${currentCustomerMotivation}-${expression}.png`;

    if (customerImage.src !== src) {
        customerImage.src = src;
        currentCustomerExpression = expression;
        animateExpressionChange(customerImage);

        // Update border color class
        customerImage.className = `character-image ${currentCustomerMotivation}`;
    }
}

// ===== ANIME.JS ANIMATIONS =====

// Expression change pop animation
function animateExpressionChange(element) {
    anime({
        targets: element,
        scale: [0.85, 1.05, 1],
        duration: 400,
        easing: 'easeOutElastic(1, 0.5)'
    });
}

// Speech bubble pop-in animation
function animateBubblePop(bubbleElement) {
    anime({
        targets: bubbleElement,
        scale: [0, 1.1, 1],
        opacity: [0, 1],
        duration: 350,
        easing: 'easeOutBack'
    });
}

// Meter fill animation
function animateMeterFill(meterElement, targetWidth) {
    anime({
        targets: meterElement,
        width: targetWidth + '%',
        duration: 600,
        easing: 'easeOutElastic(1, 0.6)'
    });
}

// Score counting animation
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

// Victory confetti celebration
function celebrateConversion() {
    if (typeof confetti === 'undefined') return;

    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
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
    // Remove all level classes
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
    // Below 8: hidden (no class added)
}

// ===== WEBSOCKET =====

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        console.log('Connected to server');
        startButton.disabled = false;
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
    const agentInfo = data.agent_info;
    currentAgentStyle = agent.style;
    currentAgentType = getAgentCharacterType(agent.style);
    currentAgentExpression = 'neutral';

    // Set agent character image
    agentImage.src = `/static/characters/agent-${currentAgentType}-neutral.png`;
    agentName.textContent = agent.name;
    agentTitle.textContent = currentAgentType === 'adaptive' ? 'Adaptive' : 'Traditional';

    // Reset agent bubble
    setBubbleContent('agent', 'Waiting for call...');

    // Show intel box with customer info (spectator mode)
    if (data.customer_preview) {
        currentCustomerMotivation = data.customer_preview.motivation;
        currentCustomerExpression = 'neutral';

        intelName.textContent = data.customer_preview.name;
        intelTier.textContent = data.customer_preview.tier_display;
        intelMotivation.textContent = data.customer_preview.motivation.toUpperCase();
        intelMotivation.className = `intel-value motivation-badge ${data.customer_preview.motivation}`;

        intelBox.style.display = 'block';

        // Set customer character image based on motivation
        customerImage.src = `/static/characters/customer-${currentCustomerMotivation}-neutral.png`;
        customerImage.className = `character-image ${currentCustomerMotivation}`;

        // Update customer name plate
        const motivationLabels = { head: 'Analytical', heart: 'Emotional', hand: 'Pragmatic' };
        customerTitle.textContent = motivationLabels[currentCustomerMotivation] || 'Unknown';

        // Highlight correct motivation in psychograph
        highlightCorrectMotivation(currentCustomerMotivation);
    }

    // Reset dashboard
    resetDashboard();

    // Reset customer display
    customerName.textContent = 'SELLER';
    setBubbleContent('customer', '...');
}

function setBubbleContent(speaker, text, isTyping = false) {
    const bubble = speaker === 'agent' ? agentBubble : customerBubble;
    const content = bubble.querySelector('.bubble-content');

    if (isTyping) {
        bubble.classList.add('typing');
        content.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;

        // Set agent to thinking expression while typing
        if (speaker === 'agent') {
            isAgentThinking = true;
            updateAgentExpression('thinking');
        }
    } else {
        bubble.classList.remove('typing');
        content.textContent = text;

        // Clear thinking state
        if (speaker === 'agent') {
            isAgentThinking = false;
        }

        // Animate bubble pop
        animateBubblePop(bubble);
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
    if (isBounce && currentCustomerMotivation) {
        updateCustomerExpression('frustrated');
        anime({
            targets: customerBubble,
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

    // Update spicy indicator (replaces danger overlay)
    updateSpicyIndicator(sentiment.frustration);

    // Update character expressions
    const agentExpr = getAgentExpression(confidence, sentiment, isAgentThinking);
    updateAgentExpression(agentExpr);

    if (currentCustomerMotivation) {
        const customerExpr = getCustomerExpression(currentCustomerMotivation, sentiment);
        updateCustomerExpression(customerExpr);
    }
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

    // Reset expressions
    currentAgentExpression = 'neutral';
    currentCustomerExpression = 'neutral';
    isAgentThinking = false;
}

// ===== CALL END =====

function handleCallEnd(data) {
    console.log('handleCallEnd called with:', data);
    try {
        // Hide spicy indicator
        spicyIndicator.classList.remove('active', 'level-8', 'level-9', 'level-10');

        // Configure outcome modal
        const outcomeEmoji = {
            'conversion': '🎉',
            'missed_opp': '😬',
            'fraud_caught': '🛡️',
            'fraud_missed': '💀',
            'bounced': '👋'
        };

        const outcomeTitle = {
            'conversion': 'CONVERSION!',
            'missed_opp': 'MISSED IT',
            'fraud_caught': 'FRAUD BLOCKED!',
            'fraud_missed': 'GOT SCAMMED',
            'bounced': 'THEY LEFT'
        };

        const outcome = data.customer_bounced ? 'bounced' : data.outcome;

        document.getElementById('outcome-icon').textContent = outcomeEmoji[outcome] || '❓';
        document.getElementById('outcome-title').textContent = outcomeTitle[outcome] || data.outcome_description;

        const pointsEl = document.getElementById('outcome-points');
        pointsEl.className = `outcome-points ${data.points >= 0 ? 'positive' : 'negative'}`;

        // Build details
        const customer = data.customer;
        document.getElementById('outcome-details').innerHTML = `
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Seller</span>
                <span class="outcome-detail-value">${customer.name}</span>
            </div>
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Property</span>
                <span class="outcome-detail-value">${data.customer_tier_display}</span>
            </div>
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Real Motivation</span>
                <span class="outcome-detail-value" style="color: ${customer.motivation === 'head' ? '#4ECDC4' : customer.motivation === 'heart' ? '#FF8FB1' : '#FFE66D'}">${customer.motivation.toUpperCase()}</span>
            </div>
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Agent's Guess</span>
                <span class="outcome-detail-value">${data.agent_motivation_guess ? data.agent_motivation_guess.toUpperCase() : 'N/A'} ${data.motivation_correct ? '✓' : '✗'}</span>
            </div>
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Turns Used</span>
                <span class="outcome-detail-value">${data.turns_used}/8</span>
            </div>
            ${customer.is_fraud ? `
            <div class="outcome-detail-row">
                <span class="outcome-detail-label">Was Fraud</span>
                <span class="outcome-detail-value" style="color: #FF6B6B">YES</span>
            </div>
            ` : ''}
        `;

        document.getElementById('learning-text').textContent = data.new_pattern || 'No learning recorded.';

        // Show modal
        outcomeModal.classList.add(outcome);
        outcomeModal.style.display = 'flex';

        // Celebrate conversion with confetti!
        if (outcome === 'conversion') {
            celebrateConversion();
            updateAgentExpression('happy');
            updateCustomerExpression('satisfied');
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
