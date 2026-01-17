// WebSocket connection and UI logic for Android Converter Simulator

let ws = null;
let warmupMode = false;
let currentFraudRisk = 2; // Track fraud risk for alert bubble
let currentAgentStyle = null; // Track current agent style for avatar images

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const startButton = document.getElementById('start-button');
const warmupButton = document.getElementById('warmup-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const turnCount = document.getElementById('turn-count');
// Agent score elements
const closerPoints = document.getElementById('closer-points');
const detectivePoints = document.getElementById('detective-points');
const empathPoints = document.getElementById('empath-points');
const robotPoints = document.getElementById('robot-points');
const gamblerPoints = document.getElementById('gambler-points');

// Agent badge elements
const agentBadge = document.getElementById('agent-badge');
const agentIcon = agentBadge.querySelector('.agent-icon');
const agentName = agentBadge.querySelector('.agent-name');
const agentStyle = agentBadge.querySelector('.agent-style');

// Dashboard elements
const fraudRiskBar = document.getElementById('fraud-risk-bar');
const fraudRiskValue = document.getElementById('fraud-risk-value');
const headBar = document.getElementById('head-bar');
const headValue = document.getElementById('head-value');
const heartBar = document.getElementById('heart-bar');
const heartValue = document.getElementById('heart-value');
const handBar = document.getElementById('hand-bar');
const handValue = document.getElementById('hand-value');
const reasoningText = document.getElementById('reasoning-text');

const satisfactionBar = document.getElementById('satisfaction-bar');
const satisfactionValue = document.getElementById('satisfaction-value');
const trustBar = document.getElementById('trust-bar');
const trustValue = document.getElementById('trust-value');
const urgencyBar = document.getElementById('urgency-bar');
const urgencyValue = document.getElementById('urgency-value');
const frustrationBar = document.getElementById('frustration-bar');
const frustrationValue = document.getElementById('frustration-value');
const likelihoodBar = document.getElementById('likelihood-bar');
const likelihoodValue = document.getElementById('likelihood-value');
const toneValue = document.getElementById('tone-value');
const frustrationWarning = document.getElementById('frustration-warning');

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
        loadInitialStats();
        loadWarmupStatus();
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
            handleCallEnd(data);
            break;
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
    agentIcon.textContent = AGENT_ICONS[agent.style] || '?';
    agentIcon.className = `agent-icon ${agent.style}`;
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
        ${data.warmup_mode ? '<span class="warmup-tag">WARMUP</span>' : ''}
    `;
    chatMessages.appendChild(divider);

    scrollToBottom();
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

    // Update fraud risk
    const fraudRisk = confidence.fraud_likelihood || 5;
    currentFraudRisk = fraudRisk; // Store for alert bubble
    fraudRiskBar.style.width = `${fraudRisk * 10}%`;
    fraudRiskValue.textContent = `${fraudRisk}/10`;
    fraudRiskBar.className = `metric-fill fraud-fill ${fraudRisk >= 7 ? 'high' : fraudRisk >= 4 ? 'medium' : 'low'}`;

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

    // Update reasoning
    reasoningText.textContent = confidence.reasoning || 'Analyzing...';

    // Update sentiment metrics
    updateSentimentBar('satisfaction', sentiment.satisfaction);
    updateSentimentBar('trust', sentiment.trust);
    updateSentimentBar('urgency', sentiment.urgency);
    updateSentimentBar('frustration', sentiment.frustration);
    updateSentimentBar('likelihood', sentiment.likelihood_to_convert);

    // Update tone
    toneValue.textContent = sentiment.emotional_tone || 'neutral';
    toneValue.className = `tone-value ${getToneClass(sentiment.emotional_tone)}`;

    // Show frustration warning if needed
    // Use sentiment.frustration (the displayed value) for warning, not the accumulated state.frustration
    const displayedFrustration = sentiment.frustration || 0;
    if (displayedFrustration >= 6) {
        frustrationWarning.style.display = 'flex';
        frustrationWarning.className = `frustration-warning ${displayedFrustration >= 8 ? 'critical' : 'warning'}`;
    } else {
        frustrationWarning.style.display = 'none';
    }
}

function updateSentimentBar(metric, value) {
    const bar = document.getElementById(`${metric}-bar`);
    const valueEl = document.getElementById(`${metric}-value`);
    if (bar && valueEl) {
        bar.style.width = `${value * 10}%`;
        valueEl.textContent = value;

        // Color coding
        if (metric === 'frustration') {
            bar.className = `sentiment-fill frustration-fill ${value >= 7 ? 'high' : value >= 4 ? 'medium' : 'low'}`;
        } else {
            bar.className = `sentiment-fill ${metric}-fill ${value >= 7 ? 'high' : value >= 4 ? 'medium' : 'low'}`;
        }
    }
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
    // Start with low fraud assumption
    fraudRiskBar.style.width = '20%';
    fraudRiskValue.textContent = '2/10';
    fraudRiskBar.className = 'metric-fill fraud-fill low';

    // Equal probability for all motivations (true neutral)
    headBar.style.width = '33%';
    headValue.textContent = '33%';
    heartBar.style.width = '33%';
    heartValue.textContent = '33%';
    handBar.style.width = '33%';
    handValue.textContent = '33%';

    // Remove any dominant highlighting
    document.querySelectorAll('.motivation-item').forEach(item => {
        item.classList.remove('dominant');
    });

    reasoningText.textContent = 'Waiting for conversation to begin...';

    // Neutral sentiment starting point
    satisfactionBar.style.width = '50%';
    satisfactionValue.textContent = '5';
    trustBar.style.width = '50%';
    trustValue.textContent = '5';
    urgencyBar.style.width = '50%';
    urgencyValue.textContent = '5';
    frustrationBar.style.width = '20%';
    frustrationValue.textContent = '2';
    likelihoodBar.style.width = '50%';
    likelihoodValue.textContent = '5';
    toneValue.textContent = 'neutral';
    toneValue.className = 'tone-value neutral';

    frustrationWarning.style.display = 'none';
}

// Handle call end
function handleCallEnd(data) {
    // Refresh agent scores from leaderboard
    loadInitialStats();

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
                <h4>Customer Profile (Hidden)</h4>
                <div class="detail-grid">
                    <span class="label">Name:</span><span>${customer.name}</span>
                    <span class="label">Tier:</span><span>${data.customer_tier_display}</span>
                    <span class="label">Motivation:</span><span class="motivation-badge ${customer.motivation}">${customer.motivation.toUpperCase()}</span>
                    <span class="label">Fraud:</span><span class="fraud-badge ${customer.is_fraud ? 'yes' : 'no'}">${customer.is_fraud ? 'YES' : 'No'}</span>
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
                    <span>${data.close_attempted ? 'Closed' : data.flag_used ? 'Flagged' : data.customer_bounced ? 'Customer Left' : 'Timed Out'}</span>
                    <span class="label">Turns:</span><span>${data.turns_used}/14</span>
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
}

// Update stats display
function updateStats(stats) {
    callCount.textContent = stats.total_calls || 0;
    totalPoints.textContent = stats.total_points || 0;
    convertedCount.textContent = stats.conversions || 0;
    fraudCaughtCount.textContent = stats.frauds_caught || 0;
}

// Load initial stats
async function loadInitialStats() {
    try {
        const response = await fetch('/api/leaderboard');
        const leaderboard = await response.json();
        updateAgentScores(leaderboard);
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Update per-agent scores in stats bar
function updateAgentScores(leaderboard) {
    // Reset all to 0
    closerPoints.textContent = '0';
    detectivePoints.textContent = '0';
    empathPoints.textContent = '0';
    robotPoints.textContent = '0';
    gamblerPoints.textContent = '0';

    // Update from leaderboard data
    leaderboard.forEach(agent => {
        const points = agent.total_points || 0;
        const pointsText = points >= 0 ? `+${points}` : `${points}`;
        switch (agent.style) {
            case 'closer':
                closerPoints.textContent = pointsText;
                break;
            case 'detective':
                detectivePoints.textContent = pointsText;
                break;
            case 'empath':
                empathPoints.textContent = pointsText;
                break;
            case 'robot':
                robotPoints.textContent = pointsText;
                break;
            case 'gambler':
                gamblerPoints.textContent = pointsText;
                break;
        }
    });
}

// Load warmup status
async function loadWarmupStatus() {
    try {
        const response = await fetch('/api/warmup');
        const data = await response.json();
        warmupMode = data.warmup_mode;
        updateWarmupButton();
    } catch (error) {
        console.error('Failed to load warmup status:', error);
    }
}

// Toggle warmup mode
async function toggleWarmup() {
    try {
        const response = await fetch('/api/warmup', { method: 'POST' });
        const data = await response.json();
        warmupMode = data.warmup_mode;
        updateWarmupButton();
    } catch (error) {
        console.error('Failed to toggle warmup:', error);
    }
}

function updateWarmupButton() {
    warmupButton.textContent = `Warmup Mode: ${warmupMode ? 'ON' : 'OFF'}`;
    warmupButton.className = `warmup-button ${warmupMode ? 'active' : ''}`;
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
warmupButton.addEventListener('click', toggleWarmup);
leaderboardButton.addEventListener('click', showLeaderboard);
modalClose.addEventListener('click', hideLeaderboard);
leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) hideLeaderboard();
});

// Initialize
connect();
