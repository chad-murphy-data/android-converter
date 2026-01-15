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

// Event listeners
startButton.addEventListener('click', startNewSession);

// Initialize
connect();
