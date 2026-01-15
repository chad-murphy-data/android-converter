// WebSocket connection and chat UI logic

let ws = null;
let sessionCount = 0;

const chatMessages = document.getElementById('chat-messages');
const startButton = document.getElementById('start-button');
const sessionCountEl = document.getElementById('session-count');
const convertedCountEl = document.getElementById('converted-count');
const stayedCountEl = document.getElementById('stayed-count');
const maybeCountEl = document.getElementById('maybe-count');

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
        // Attempt to reconnect after a delay
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
        case 'session_start':
            handleSessionStart(data);
            break;
        case 'typing':
            showTypingIndicator(data.speaker);
            break;
        case 'message':
            hideTypingIndicator();
            addMessage(data.speaker, data.text);
            break;
        case 'session_end':
            handleSessionEnd(data);
            break;
    }
}

// Session start
function handleSessionStart(data) {
    sessionCount = data.session_id;
    sessionCountEl.textContent = sessionCount;

    // Update stats if provided
    if (data.stats) {
        updateStats(data.stats);
    }

    // Clear welcome message if first session
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) {
        welcome.remove();
    }

    // Add session divider
    const divider = document.createElement('div');
    divider.className = 'session-divider';
    divider.innerHTML = `<span>Session ${sessionCount}</span>`;
    chatMessages.appendChild(divider);

    scrollToBottom();
}

// Add a message bubble
function addMessage(speaker, text) {
    const message = document.createElement('div');
    message.className = `message ${speaker}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = speaker === 'android' ? '🤖' : '📱';

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
    hideTypingIndicator(); // Remove any existing indicator

    const indicator = document.createElement('div');
    indicator.className = `typing-indicator ${speaker}`;
    indicator.id = 'typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = speaker === 'android' ? '🤖' : '📱';

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

// Handle session end
function handleSessionEnd(data) {
    // Update stats
    if (data.stats) {
        updateStats(data.stats);
    }

    // Add outcome card
    const card = document.createElement('div');
    card.className = `outcome-card ${data.outcome}`;

    const outcomeText = {
        'converted': '✅ Converted to Android!',
        'stayed': '📱 Staying with iPhone',
        'maybe': '🤔 Maybe Later'
    };

    const profile = data.actual_profile;
    const predictionClass = data.prediction_correct ? 'correct' : 'incorrect';
    const predictionText = data.prediction_correct ? 'Correct!' : 'Wrong';

    card.innerHTML = `
        <h3>${outcomeText[data.outcome]}</h3>
        <div class="outcome-details">
            <div><span class="label">Actual Loyalty:</span> ${profile.primary_loyalty}</div>
            <div><span class="label">Openness:</span> ${profile.openness_to_switch}</div>
            <div><span class="label">Disclosure:</span> ${profile.disclosure_style}</div>
            <div><span class="label">Prediction:</span> ${data.advocate_prediction || 'N/A'}
                <span class="prediction-badge ${predictionClass}">${predictionText}</span>
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
    convertedCountEl.textContent = stats.converted;
    stayedCountEl.textContent = stats.stayed;
    maybeCountEl.textContent = stats.maybe;
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start new session
function startNewSession() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        startButton.disabled = true;
        ws.send(JSON.stringify({ type: 'new_session' }));
    }
}

// Insights modal
const insightsButton = document.getElementById('insights-button');
const insightsModal = document.getElementById('insights-modal');
const modalClose = document.getElementById('modal-close');
const insightsContent = document.getElementById('insights-content');

async function showInsights() {
    insightsModal.classList.add('active');
    insightsContent.innerHTML = 'Loading...';

    try {
        const response = await fetch('/api/insights');
        const data = await response.json();
        renderInsights(data);
    } catch (error) {
        insightsContent.innerHTML = '<p class="no-data">Error loading insights</p>';
    }
}

function renderInsights(data) {
    if (!data.total_sessions) {
        insightsContent.innerHTML = '<p class="no-data">No sessions yet. Run some conversations first!</p>';
        return;
    }

    let html = '';

    // Overview stats
    html += `
        <div class="insights-section">
            <h3>Overview</h3>
            <div class="insights-grid">
                <div class="insight-card">
                    <div class="label">Total Sessions</div>
                    <div class="value neutral">${data.total_sessions}</div>
                </div>
                <div class="insight-card">
                    <div class="label">Conversion Rate</div>
                    <div class="value ${data.overall_conversion_rate >= 50 ? 'good' : 'bad'}">${data.overall_conversion_rate}%</div>
                </div>
                <div class="insight-card">
                    <div class="label">Prediction Accuracy</div>
                    <div class="value ${data.prediction_accuracy >= 50 ? 'good' : 'bad'}">${data.prediction_accuracy}%</div>
                </div>
            </div>
        </div>
    `;

    // By loyalty type
    if (data.by_loyalty && Object.keys(data.by_loyalty).length > 0) {
        html += `
            <div class="insights-section">
                <h3>Conversion by Loyalty Type</h3>
                <div class="insights-grid">
        `;
        for (const [type, stats] of Object.entries(data.by_loyalty)) {
            const rateClass = stats.rate >= 50 ? 'good' : (stats.rate >= 25 ? 'neutral' : 'bad');
            html += `
                <div class="insight-card">
                    <div class="label">${type.toUpperCase()}</div>
                    <div class="value ${rateClass}">${stats.rate}%</div>
                    <div class="label">${stats.converted}/${stats.count}</div>
                </div>
            `;
        }
        html += '</div></div>';
    }

    // Pitch effectiveness
    if (data.pitch_effectiveness && Object.keys(data.pitch_effectiveness).length > 0) {
        html += `
            <div class="insights-section">
                <h3>Pitch Matching Effectiveness</h3>
                <div class="insights-grid">
        `;
        if (data.pitch_effectiveness.matched) {
            const m = data.pitch_effectiveness.matched;
            html += `
                <div class="insight-card">
                    <div class="label">Matched Pitch</div>
                    <div class="value ${m.rate >= 50 ? 'good' : 'bad'}">${m.rate}%</div>
                    <div class="label">${m.converted}/${m.count}</div>
                </div>
            `;
        }
        if (data.pitch_effectiveness.mismatched) {
            const m = data.pitch_effectiveness.mismatched;
            html += `
                <div class="insight-card">
                    <div class="label">Mismatched Pitch</div>
                    <div class="value ${m.rate >= 50 ? 'good' : 'bad'}">${m.rate}%</div>
                    <div class="label">${m.converted}/${m.count}</div>
                </div>
            `;
        }
        html += '</div></div>';
    }

    // Key learnings
    if (data.key_learnings && data.key_learnings.length > 0) {
        html += `
            <div class="insights-section">
                <h3>Key Learnings</h3>
                <ul class="key-learnings">
        `;
        for (const learning of data.key_learnings) {
            html += `<li>${learning}</li>`;
        }
        html += '</ul></div>';
    }

    // Memory summary (what the agent sees)
    if (data.memory_summary) {
        html += `
            <div class="insights-section">
                <h3>What The Agent Sees</h3>
                <div class="memory-summary">${data.memory_summary}</div>
            </div>
        `;
    }

    insightsContent.innerHTML = html;
}

function hideInsights() {
    insightsModal.classList.remove('active');
}

// Event listeners
startButton.addEventListener('click', startNewSession);
insightsButton.addEventListener('click', showInsights);
modalClose.addEventListener('click', hideInsights);
insightsModal.addEventListener('click', (e) => {
    if (e.target === insightsModal) hideInsights();
});

// Initialize
connect();
