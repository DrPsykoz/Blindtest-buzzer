const UI = {
    winner: document.getElementById('playerWinner'),
    sub: document.getElementById('playerSub'),
    category: document.getElementById('playerCategory'),
    list: document.getElementById('playerList'),
    recapPanel: document.getElementById('playerRecap'),
    recapTitle: document.getElementById('playerRecapTitle'),
    recapList: document.getElementById('playerRecapList'),
    gif: document.getElementById('feedbackGif'),
    feedbackTrack: document.getElementById('feedbackTrack'),
    pointsCounter: document.getElementById('pointsCounter'),
};

const GIF_OK = ['gifs/ok/1.gif', 'gifs/ok/2.gif', 'gifs/ok/3.gif', 'gifs/ok/4.gif', 'gifs/ok/5.gif', 'gifs/ok/6.gif', 'gifs/ok/7.gif', 'gifs/ok/8.gif', 'gifs/ok/9.gif', 'gifs/ok/10.gif'];
const GIF_KO = ['gifs/ko/1.gif', 'gifs/ko/2.gif', 'gifs/ko/3.gif', 'gifs/ko/4.gif', 'gifs/ko/5.gif', 'gifs/ko/6.gif', 'gifs/ko/7.gif', 'gifs/ko/8.gif', 'gifs/ko/9.gif', 'gifs/ko/10.gif'];

function pickGif(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// ── Sound effects (Web Audio API) ──────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playCorrectSound() {
    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    // Two-tone ascending ding
    [660, 880].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now + i * 0.12);
        osc.stop(now + 0.8);
    });
}

function playWrongSound() {
    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.5);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.6);
}

const DEFAULT_PLAYERS = [
    { id: 1, name: 'Racaille', color: '#ef4444', score: 0 },
    { id: 2, name: 'Ninja', color: '#3b82f6', score: 0 },
    { id: 3, name: 'Ovni', color: '#22c55e', score: 0 },
    { id: 4, name: 'Paysan', color: '#eab308', score: 0 },
];

const STATE = {
    players: DEFAULT_PLAYERS,
    lastWinnerId: null,
    armed: false,
    locked: false,
    disqualifiedIds: [],
    currentDifficulty: null,
    gameStarted: false,
    gameInRecap: false,
    completedDifficulty: null,
    nextDifficulty: null,
    roundStartTime: null,
};

const POINTS_BY_DIFFICULTY = { facile: 50, moyen: 100, difficile: 200 };
const POINTS_DECAY_SECONDS = 30;
let pointsTickerId = null;

function calcLivePoints() {
    const diff = STATE.currentDifficulty || 'facile';
    const maxPts = POINTS_BY_DIFFICULTY[diff] || 50;
    if (!STATE.roundStartTime) return maxPts;
    const elapsed = (Date.now() - STATE.roundStartTime) / 1000;
    const ratio = Math.max(0, 1 - elapsed / POINTS_DECAY_SECONDS);
    return Math.max(Math.round(maxPts * 0.1), Math.round(maxPts * ratio));
}

function startPointsTicker() {
    stopPointsTicker();
    UI.pointsCounter.classList.remove('hidden');
    function tick() {
        const pts = calcLivePoints();
        UI.pointsCounter.textContent = `${pts} pts`;
        pointsTickerId = requestAnimationFrame(tick);
    }
    tick();
}

function stopPointsTicker() {
    if (pointsTickerId) cancelAnimationFrame(pointsTickerId);
    pointsTickerId = null;
    UI.pointsCounter.classList.add('hidden');
}

function freezePointsDisplay() {
    if (pointsTickerId) cancelAnimationFrame(pointsTickerId);
    pointsTickerId = null;
    const pts = calcLivePoints();
    UI.pointsCounter.textContent = `${pts} pts`;
    UI.pointsCounter.classList.remove('hidden');
}

const CHANNEL_NAME = 'blindtest-channel';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

function renderPlayers() {
    UI.list.innerHTML = '';
    [...STATE.players]
        .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name, 'fr'))
        .forEach((player) => {
            const card = document.createElement('div');
            card.className = 'player';
            card.dataset.playerId = String(player.id);
            if (player.color) {
                card.style.setProperty('--player-color', player.color);
            }
            const score = player.score ?? 0;
            card.innerHTML = `
			<div class="label"><span class="swatch" aria-hidden="true"></span>${player.name}</div>
            <div class="score"><span class="score-text">${score}</span></div>
		`;
            if (player.id === STATE.lastWinnerId) {
                card.classList.add('active');
            }
            if (STATE.disqualifiedIds.includes(player.id)) {
                card.classList.add('disqualified');
            }
            UI.list.appendChild(card);
        });
}

function renderWinner() {
    if (feedbackActive) return;
    const category = STATE.currentDifficulty ? STATE.currentDifficulty : '—';
    UI.category.textContent = `Difficulté: ${category}`;
    if (STATE.gameInRecap) {
        UI.winner.textContent = 'Récap des scores';
        UI.sub.textContent = 'Attente de la difficulté suivante.';
        UI.winner.style.removeProperty('color');
        return;
    }
    const winner = STATE.players.find((p) => p.id === STATE.lastWinnerId);
    if (winner) {
        UI.winner.textContent = winner.name;
        UI.winner.style.color = winner.color || '';
        UI.sub.textContent = `${winner.name} doit répondre`;
        return;
    }

    if (!STATE.armed) {
        UI.winner.textContent = 'En attente d’activation';
        UI.sub.textContent = 'L’animateur va lancer la manche.';
        UI.winner.style.removeProperty('color');
        return;
    }

    UI.winner.textContent = 'Qui va buzzer ?';
    UI.sub.textContent = 'Appuyez sur votre buzzer.';
    UI.winner.style.removeProperty('color');
}

function renderRecap() {
    if (!UI.recapPanel) return;
    UI.recapPanel.classList.toggle('hidden', !STATE.gameInRecap);
    if (!STATE.gameInRecap) return;

    const completed = STATE.completedDifficulty || '—';
    const next = STATE.nextDifficulty || '—';
    UI.recapTitle.textContent = `Récap ${completed} → prochain: ${next}`;

    UI.recapList.innerHTML = '';
    [...STATE.players]
        .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name, 'fr'))
        .forEach((player) => {
            const card = document.createElement('div');
            card.className = 'player';
            card.dataset.playerId = String(player.id);
            if (player.color) {
                card.style.setProperty('--player-color', player.color);
            }
            const score = player.score ?? 0;
            card.innerHTML = `
                <div class="label"><span class="swatch" aria-hidden="true"></span>${player.name}</div>
                <div class="score"><span class="score-text">SCORE ${score}</span></div>
            `;
            UI.recapList.appendChild(card);
        });
}

function applyState(payload) {
    STATE.players = payload.players || [];
    STATE.lastWinnerId = payload.lastWinnerId ?? null;
    STATE.armed = Boolean(payload.armed);
    STATE.locked = Boolean(payload.locked);
    STATE.disqualifiedIds = payload.disqualifiedIds || [];
    STATE.currentDifficulty = payload.currentDifficulty || null;
    STATE.gameStarted = Boolean(payload.gameStarted);
    STATE.gameInRecap = Boolean(payload.gameInRecap);
    STATE.completedDifficulty = payload.completedDifficulty || null;
    STATE.nextDifficulty = payload.nextDifficulty || null;
    STATE.roundStartTime = payload.roundStartTime || null;
    renderWinner();
    renderPlayers();
    renderRecap();
    if (STATE.armed && !feedbackActive) {
        if (STATE.locked) {
            freezePointsDisplay();
        } else {
            startPointsTicker();
        }
    } else {
        stopPointsTicker();
    }
}

function triggerPing(playerId) {
    const card = UI.list.querySelector(`[data-player-id="${playerId}"]`);
    if (!card) return;
    card.classList.remove('ping');
    void card.offsetWidth;
    card.classList.add('ping');
}

let feedbackTimeout = null;
let feedbackActive = false;

function showAnswerFeedback({ result, playerId, trackName, earnedPoints }) {
    clearTimeout(feedbackTimeout);
    feedbackActive = true;
    stopPointsTicker();

    const player = STATE.players.find((p) => p.id === playerId);
    const playerName = player ? player.name : '?';
    const playerColor = player ? player.color : '#fff';
    const isOk = result === 'ok';

    // Play sound
    if (isOk) playCorrectSound();
    else playWrongSound();

    // Show GIF
    const gifSrc = pickGif(isOk ? GIF_OK : GIF_KO);
    UI.gif.src = gifSrc;
    UI.gif.classList.remove('hidden');
    UI.gif.onerror = () => UI.gif.classList.add('hidden');

    // Replace center text
    const icon = isOk ? '✓' : '✗';
    const colorClass = isOk ? 'feedback-text-ok' : 'feedback-text-ko';
    UI.winner.className = `winner ${colorClass}`;
    UI.winner.style.color = '';
    UI.winner.innerHTML = `<span class="feedback-icon">${icon}</span> ${playerName}`;
    UI.winner.style.color = playerColor;

    if (isOk && earnedPoints) {
        UI.sub.textContent = `Bonne réponse ! +${earnedPoints} pts`;
    } else {
        UI.sub.textContent = isOk ? 'Bonne réponse !' : 'Mauvaise réponse';
    }
    UI.sub.className = `subtext ${colorClass}`;

    // Show track name for correct answers
    if (isOk && trackName) {
        UI.feedbackTrack.textContent = `♪ ${trackName}`;
        UI.feedbackTrack.classList.remove('hidden');
    } else {
        UI.feedbackTrack.classList.add('hidden');
    }

    feedbackTimeout = setTimeout(() => {
        feedbackActive = false;
        UI.gif.classList.add('hidden');
        UI.feedbackTrack.classList.add('hidden');
        UI.winner.className = 'winner';
        UI.sub.className = 'subtext';
        renderWinner();
        if (STATE.armed && !STATE.locked) {
            startPointsTicker();
        }
    }, 3000);
}

function init() {
    if (!channel) {
        UI.winner.textContent = 'Navigateur incompatible';
        UI.sub.textContent = 'BroadcastChannel non supporté.';
        return;
    }

    channel.addEventListener('message', (event) => {
        if (!event.data) return;
        if (event.data.type === 'state') {
            applyState(event.data.payload || {});
        }
        if (event.data.type === 'ping') {
            triggerPing(event.data.payload?.playerId);
        }
        if (event.data.type === 'answer-result') {
            showAnswerFeedback(event.data.payload || {});
        }
    });

    channel.postMessage({ type: 'request-state' });
    renderPlayers();
}

init();
