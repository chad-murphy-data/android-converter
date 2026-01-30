// WebSocket connection and UI logic for Listing Closer Simulator

let ws = null;
let currentFraudRisk = 2; // Track sketchy risk for alert bubble
let currentAgentStyle = null; // Track current agent style for avatar images
let currentCustomerMotivation = null; // Track actual customer motivation for sidebar highlight

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const startButton = document.getElementById('start-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const turnCount = document.getElementById('turn-count');

// Agent badge elements
const agentBadge = document.getElementById('agent-badge');
const agentIcon = agentBadge.querySelector('.agent-icon');
const agentAvatarImg = document.getElementById('agent-avatar-img');
const agentName = agentBadge.querySelector('.agent-name');
const agentStyle = agentBadge.querySelector('.agent-style');

// Dashboard elements
const confidenceBar = document.getElementById('confidence-bar');
const confidenceValue = document.getElementById('confidence-value');
const headBar = document.getElementById('head-bar');
const headValue = document.getElementById('head-value');
const heartBar = document.getElementById('heart-bar');
const heartValue = document.getElementById('heart-value');
const handBar = document.getElementById('hand-bar');
const handValue = document.getElementById('hand-value');
const reasoningText = document.getElementById('reasoning-text');

// Consolidated sentiment elements
const vibeBar = document.getElementById('vibe-bar');
const vibeValue = document.getElementById('vibe-value');
const frustrationBar = document.getElementById('frustration-bar');
const frustrationValue = document.getElementById('frustration-value');
const closeReadyBar = document.getElementById('close-ready-bar');
const closeReadyValue = document.getElementById('close-ready-value');
const toneValue = document.getElementById('tone-value');
const frustrationWarning = document.getElementById('frustration-warning');

// Flavor text arrays
const THINKING_PREFIXES = ['Hmm...', 'Interesting...', 'My read:', 'Gut feeling:', 'Sensing that', 'Noticing'];
const FLAVOR_PHRASES = ["Let's see what happens...", "New challenger approaching", "Simulation initiated", "And we're live"];
const WARNING_TEXTS = [
    "Uh oh. They're getting spicy.",
    "Warning: patience levels critical",
    "Things are heating up",
    "Abort? Continue? ...good luck"
];

// Modal elements
const leaderboardModal = document.getElementById('leaderboard-modal');
const modalClose = document.getElementById('modal-close');
const leaderboardContent = document.getElementById('leaderboard-content');

// Agent style icons
const AGENT_ICONS = {
    'closer': 'C',
    'detective': 'D',
    'empath': 'E',
    'robot': 'R',
    'gambler': 'G'
};

// Connect to WebSocket
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

// Handle incoming WebSocket messages
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
            hideTypingIndicator();
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

// Handle call start
function handleCallStart(data) {
    // Clear welcome message
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) {
        welcome.remove();
    }

    // Reset turn counter
    turnCount.textContent = '0';

    // Update agent badge
    const agent = data.agent;
    const agentInfo = data.agent_info;
    currentAgentStyle = agent.style; // Store for avatar images

    // Show avatar image, hide letter icon
    agentAvatarImg.src = `/avatars/${agent.style}.png`;
    agentAvatarImg.alt = agent.style;
    agentAvatarImg.style.display = 'block';
    agentIcon.style.display = 'none';

    agentName.textContent = agent.name;
    agentStyle.textContent = agentInfo.display_name;

    // Reset dashboard
    resetDashboard();

    // Add call divider
    const divider = document.createElement('div');
    divider.className = 'call-divider';
    divider.innerHTML = `
        <span>Call #${data.call_id}</span>
        <span class="agent-tag ${agent.style}">${agentInfo.display_name}</span>
    `;
    chatMessages.appendChild(divider);

    // Add customer reveal (spectator mode - always visible)
    if (data.customer_preview) {
        // Store customer motivation for sidebar highlighting
        currentCustomerMotivation = data.customer_preview.motivation;
        highlightCorrectMotivation(currentCustomerMotivation);

        const customerReveal = document.createElement('div');
        customerReveal.className = 'customer-reveal';
        customerReveal.innerHTML = `
            <div class="customer-reveal-header">You know. The agent doesn't.</div>
            <div class="customer-reveal-grid">
                <span class="label">Customer:</span>
                <span class="value">${data.customer_preview.name}</span>
                <span class="label">Property:</span>
                <span class="value">${data.customer_preview.tier_display}</span>
                <span class="label">Motivation:</span>
                <span class="value">
                    <span class="motivation-reveal-badge ${data.customer_preview.motivation}">
                        ${data.customer_preview.motivation.toUpperCase()}
                    </span>
                </span>
            </div>
            <div class="spectator-hint">Watch to see if the agent figures it out...</div>
        `;
        chatMessages.appendChild(customerReveal);
    }

    scrollToBottom();
}

// Highlight the correct motivation in the sidebar
function highlightCorrectMotivation(motivation) {
    document.querySelectorAll('.motivation-item').forEach(item => {
        item.classList.remove('correct-answer');
        if (item.dataset.motivation === motivation) {
            item.classList.add('correct-answer');
        }
    });
}

// Add a message bubble
function addMessage(speaker, text, isBounce = false, isEnd = false) {
    const message = document.createElement('div');

    // Handle system messages (call ended notifications)
    if (speaker === 'system') {
        message.className = 'message system-message';
        const bubble = document.createElement('div');
        bubble.className = 'bubble system-bubble';
        bubble.textContent = text;
        message.appendChild(bubble);
        chatMessages.appendChild(message);

        // Add fraud alert bubble if agent flagged for fraud
        if (text.includes('flagged for fraud') && currentFraudRisk >= 5) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'message system-message';
            const alertBubble = document.createElement('div');
            alertBubble.className = 'bubble fraud-alert-bubble';
            alertBubble.innerHTML = `<span class="fraud-icon">⚠</span> Agent detected fraud risk: ${currentFraudRisk}/10`;
            alertDiv.appendChild(alertBubble);
            chatMessages.appendChild(alertDiv);
        }

        scrollToBottom();
        return;
    }

    message.className = `message ${speaker}${isBounce ? ' bounce' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';

    // Use image for agent avatar, letter for customer (for now)
    if (speaker === 'agent' && currentAgentStyle) {
        const img = document.createElement('img');
        img.src = `/avatars/${currentAgentStyle}.png`;
        img.alt = currentAgentStyle;
        img.className = 'avatar-img';
        avatar.appendChild(img);
    } else {
        avatar.textContent = speaker === 'agent' ? 'A' : 'C';
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    message.appendChild(avatar);
    message.appendChild(bubble);
    chatMessages.appendChild(message);

    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator(speaker) {
    hideTypingIndicator();

    const indicator = document.createElement('div');
    indicator.className = `typing-indicator ${speaker}`;
    indicator.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';

    // Use image for agent avatar, letter for customer (for now)
    if (speaker === 'agent' && currentAgentStyle) {
        const img = document.createElement('img');
        img.src = `/avatars/${currentAgentStyle}.png`;
        img.alt = currentAgentStyle;
        img.className = 'avatar-img';
        avatar.appendChild(img);
    } else {
        avatar.textContent = speaker === 'agent' ? 'A' : 'C';
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    indicator.appendChild(avatar);
    indicator.appendChild(bubble);
    chatMessages.appendChild(indicator);

    scrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Update dashboard with real-time data
function updateDashboard(data) {
    console.log('Dashboard update received:', data);
    const { confidence, sentiment, frustration, turn } = data;

    // Update turn count
    if (turn) {
        turnCount.textContent = turn;
    }

    // Update closing confidence (derived from likelihood to convert and trust)
    const closingConf = confidence.closing_confidence || sentiment.likelihood_to_convert || 5;
    confidenceBar.style.width = `${closingConf * 10}%`;
    confidenceValue.textContent = `${closingConf}/10`;
    confidenceBar.className = `metric-fill confidence-fill ${closingConf >= 7 ? 'high' : closingConf >= 4 ? 'medium' : 'low'}`;

    // Store fraud risk for alert bubble (still tracked even if not displayed)
    currentFraudRisk = confidence.fraud_likelihood || 2;

    // Update motivation guess
    const motivation = confidence.motivation_guess || { head: 33, heart: 34, hand: 33 };
    headBar.style.width = `${motivation.head}%`;
    headValue.textContent = `${motivation.head}%`;
    heartBar.style.width = `${motivation.heart}%`;
    heartValue.textContent = `${motivation.heart}%`;
    handBar.style.width = `${motivation.hand}%`;
    handValue.textContent = `${motivation.hand}%`;

    // Highlight dominant motivation
    const dominant = getDominantMotivation(motivation);
    document.querySelectorAll('.motivation-item').forEach(item => {
        item.classList.remove('dominant');
    });
    document.querySelector(`.motivation-item:has(.${dominant}-fill)`)?.classList.add('dominant');

    // Update reasoning with flavor prefix
    const prefix = THINKING_PREFIXES[Math.floor(Math.random() * THINKING_PREFIXES.length)];
    const reasoning = confidence.reasoning || 'Analyzing...';
    reasoningText.textContent = `${prefix} ${reasoning}`;

    // Update consolidated sentiment metrics
    // Vibe = average of satisfaction and trust
    const vibe = Math.round((sentiment.satisfaction + sentiment.trust) / 2);
    updateConsolidatedBar('vibe', vibe);

    // Frustration
    updateConsolidatedBar('frustration', sentiment.frustration);

    // Close Ready = likelihood to convert
    updateConsolidatedBar('close-ready', sentiment.likelihood_to_convert);

    // Update tone with fun vocabulary
    const funTone = getFunTone(sentiment.emotional_tone);
    toneValue.textContent = funTone;
    toneValue.className = `tone-value ${getToneClass(sentiment.emotional_tone)}`;

    // Show frustration warning if needed with random warning text
    const displayedFrustration = sentiment.frustration || 0;
    if (displayedFrustration >= 6) {
        frustrationWarning.style.display = 'flex';
        frustrationWarning.className = `frustration-warning ${displayedFrustration >= 8 ? 'critical' : 'warning'}`;
        // Update warning text
        const warningText = frustrationWarning.querySelector('.warning-text');
        if (warningText) {
            warningText.textContent = WARNING_TEXTS[Math.floor(Math.random() * WARNING_TEXTS.length)];
        }
    } else {
        frustrationWarning.style.display = 'none';
    }
}

// Update consolidated sentiment bars
function updateConsolidatedBar(metric, value) {
    const bar = document.getElementById(`${metric}-bar`);
    const valueEl = document.getElementById(`${metric}-value`);
    if (bar && valueEl) {
        bar.style.width = `${value * 10}%`;
        valueEl.textContent = value;

        // Add high class for visual emphasis
        bar.classList.remove('high');
        if (metric === 'frustration' && value >= 7) {
            bar.classList.add('high');
        } else if (metric === 'close-ready' && value >= 7) {
            bar.classList.add('high');
        }
    }
}

// Get fun vocabulary for tone
function getFunTone(tone) {
    const toneMap = {
        'neutral': ['vibing', 'chill', 'steady', 'coasting'][Math.floor(Math.random() * 4)],
        'frustrated': ['spicy', 'heated', 'yikes', 'prickly'][Math.floor(Math.random() * 4)],
        'annoyed': ['spicy', 'prickly', 'edgy'][Math.floor(Math.random() * 3)],
        'impatient': ['antsy', 'restless', 'tapping feet'][Math.floor(Math.random() * 3)],
        'happy': ['golden', 'winning', 'sunny'][Math.floor(Math.random() * 3)],
        'interested': ['hooked', 'curious', 'leaning in'][Math.floor(Math.random() * 3)],
        'curious': ['intrigued', 'exploring', 'ears perked'][Math.floor(Math.random() * 3)],
        'skeptical': ['side-eye', 'hmm...', 'unconvinced'][Math.floor(Math.random() * 3)],
        'warm': ['cozy', 'friendly', 'open'][Math.floor(Math.random() * 3)],
        'engaged': ['locked in', 'all ears', 'present'][Math.floor(Math.random() * 3)]
    };
    return toneMap[tone?.toLowerCase()] || tone || 'vibing';
}


function getDominantMotivation(motivation) {
    const { head, heart, hand } = motivation;
    if (head >= heart && head >= hand) return 'head';
    if (heart >= head && heart >= hand) return 'heart';
    return 'hand';
}

function getToneClass(tone) {
    const positive = ['happy', 'interested', 'curious', 'engaged', 'warm', 'friendly'];
    const negative = ['frustrated', 'annoyed', 'skeptical', 'impatient', 'hostile', 'angry'];
    if (positive.includes(tone?.toLowerCase())) return 'positive';
    if (negative.includes(tone?.toLowerCase())) return 'negative';
    return 'neutral';
}

// Reset dashboard to initial state (neutral priors - no assumptions)
function resetDashboard() {
    // Start with neutral closing confidence
    confidenceBar.style.width = '50%';
    confidenceValue.textContent = '5/10';
    confidenceBar.className = 'metric-fill confidence-fill medium';

    // Reset customer motivation tracking
    currentCustomerMotivation = null;

    // Equal probability for all motivations (true neutral)
    headBar.style.width = '33%';
    headValue.textContent = '33%';
    heartBar.style.width = '33%';
    heartValue.textContent = '33%';
    handBar.style.width = '33%';
    handValue.textContent = '33%';

    // Remove any dominant or correct-answer highlighting
    document.querySelectorAll('.motivation-item').forEach(item => {
        item.classList.remove('dominant');
        item.classList.remove('correct-answer');
    });

    reasoningText.textContent = 'Waiting for conversation to begin...';

    // Consolidated sentiment starting point
    vibeBar.style.width = '50%';
    vibeValue.textContent = '5';
    frustrationBar.style.width = '20%';
    frustrationValue.textContent = '2';
    closeReadyBar.style.width = '50%';
    closeReadyValue.textContent = '5';
    toneValue.textContent = 'vibing';
    toneValue.className = 'tone-value neutral';

    frustrationWarning.style.display = 'none';
}

// Handle call end
function handleCallEnd(data) {
    console.log('handleCallEnd called with:', data);
    try {
        // Create outcome card
        const card = document.createElement('div');
        card.className = `outcome-card ${data.outcome}`;

        const outcomeEmoji = {
            'conversion': '+',
            'missed_opp': '-',
            'fraud_caught': '!',
            'fraud_missed': 'X'
        };

        const customer = data.customer;
        const pointsClass = data.points >= 0 ? 'positive' : 'negative';

        card.innerHTML = `
            <div class="outcome-header">
                <span class="outcome-emoji">${outcomeEmoji[data.outcome] || '?'}</span>
                <span class="outcome-title">${data.outcome_description}</span>
                <span class="outcome-points ${pointsClass}">${data.points >= 0 ? '+' : ''}${data.points} pts</span>
            </div>
            <div class="outcome-details">
                <div class="detail-section">
                    <h4>Seller Profile (Hidden)</h4>
                    <div class="detail-grid">
                        <span class="label">Name:</span><span>${customer.name}</span>
                        <span class="label">Tier:</span><span>${data.customer_tier_display}</span>
                        <span class="label">Motivation:</span><span class="motivation-badge ${customer.motivation}">${customer.motivation.toUpperCase()}</span>
                        <span class="label">Sketchy:</span><span class="fraud-badge ${customer.is_fraud ? 'yes' : 'no'}">${customer.is_fraud ? 'YES' : 'No'}</span>
                    </div>
                </div>
                <div class="detail-section">
                    <h4>Agent Performance</h4>
                    <div class="detail-grid">
                        <span class="label">Motivation Guess:</span>
                        <span>
                            ${data.agent_motivation_guess ? data.agent_motivation_guess.toUpperCase() : 'N/A'}
                            <span class="guess-badge ${data.motivation_correct ? 'correct' : 'incorrect'}">
                                ${data.motivation_correct ? 'Correct!' : 'Wrong'}
                            </span>
                        </span>
                        <span class="label">Action:</span>
                        <span>${data.close_attempted ? 'Closed' : data.flag_used ? 'Flagged' : data.customer_bounced ? 'Seller Left' : 'Timed Out'}</span>
                        <span class="label">Turns:</span><span>${data.turns_used}/8</span>
                    </div>
                </div>
                ${data.close_pitch ? `
                <div class="detail-section">
                    <h4>Close Pitch</h4>
                    <p class="pitch-text">"${data.close_pitch}"</p>
                </div>
                ` : ''}
                ${data.flag_reason ? `
                <div class="detail-section">
                    <h4>Flag Reason</h4>
                    <p class="flag-text">"${data.flag_reason}"</p>
                </div>
                ` : ''}
                <div class="detail-section">
                    <h4>New Learning</h4>
                    <p class="learning-text">${data.new_pattern}</p>
                </div>
                <div class="detail-section transcript-section">
                    <h4>Full Transcript</h4>
                    <button class="toggle-transcript" onclick="this.nextElementSibling.classList.toggle('hidden'); this.textContent = this.textContent === 'Show' ? 'Hide' : 'Show'">Show</button>
                    <div class="transcript-log hidden">
                        ${data.transcript ? data.transcript.map(t => `<div class="transcript-line ${t.speaker}"><span class="speaker-label">${t.speaker.toUpperCase()}:</span> ${t.text}</div>`).join('') : '<p>No transcript available</p>'}
                    </div>
                </div>
            </div>
        `;

        chatMessages.appendChild(card);
        scrollToBottom();

        // Re-enable start button
        startButton.disabled = false;
    } catch (error) {
        console.error('Error in handleCallEnd:', error);
        // Re-enable start button even on error
        startButton.disabled = false;
    }
}

// Start new call
function startNewCall() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        startButton.disabled = true;
        ws.send(JSON.stringify({ type: 'new_call' }));
    }
}

// Show leaderboard
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
        leaderboardContent.innerHTML = '<p class="no-data">No calls completed yet. Start some calls to see agent performance!</p>';
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
                        ${agent.frauds_caught} fraud caught
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

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event listeners
startButton.addEventListener('click', startNewCall);
leaderboardButton.addEventListener('click', showLeaderboard);
modalClose.addEventListener('click', hideLeaderboard);
leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) hideLeaderboard();
});

// Initialize
connect();
