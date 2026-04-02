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
    introOverlay: document.getElementById('introOverlay'),
    victoryOverlay: document.getElementById('victoryOverlay'),
    victoryTitle: document.getElementById('victoryTitle'),
    victoryPodium: document.getElementById('victoryPodium'),
    fireworksCanvas: document.getElementById('fireworksCanvas'),
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
    roundPausedElapsed: null,
    previousRanking: {},
};

const POINTS_BY_DIFFICULTY = { facile: 50, moyen: 75, difficile: 100 };
const POINTS_DECAY_SECONDS = 30;
let pointsTickerId = null;

function calcLivePoints() {
    const diff = STATE.currentDifficulty || 'facile';
    const maxPts = POINTS_BY_DIFFICULTY[diff] || 50;
    if (!STATE.roundStartTime) return maxPts;
    const now = STATE.roundPausedElapsed != null ? STATE.roundPausedElapsed : Date.now() - STATE.roundStartTime;
    const elapsed = Math.max(0, now) / 1000;
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
    const category = STATE.currentDifficulty || '—';
    UI.category.innerHTML = `Manche en cours <span class="diff-badge diff-${category}">${category}</span>`;
    if (STATE.gameInRecap) {
        UI.winner.textContent = 'Récap des scores';
        UI.sub.textContent = '';
        UI.category.innerHTML = '';
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

function getRankingMap(players) {
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name, 'fr'));
    const map = {};
    sorted.forEach((p, i) => { map[p.id] = i + 1; });
    return map;
}

function renderRecap() {
    if (!UI.recapPanel) return;
    UI.recapPanel.classList.toggle('hidden', !STATE.gameInRecap);
    if (!STATE.gameInRecap) return;

    const completed = STATE.completedDifficulty || '—';
    UI.recapTitle.innerHTML = `Fin de la manche <span class="diff-badge diff-${completed}">${completed}</span>`;

    const currentRanking = getRankingMap(STATE.players);
    const prev = STATE.previousRanking;
    const hasPrev = Object.keys(prev).length > 0;

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
            let moveHtml = '';
            if (hasPrev && prev[player.id] != null) {
                const diff = prev[player.id] - currentRanking[player.id];
                if (diff > 0) {
                    moveHtml = `<span class="rank-change rank-up">▲ +${diff}</span>`;
                } else if (diff < 0) {
                    moveHtml = `<span class="rank-change rank-down">▼ ${diff}</span>`;
                }
            }
            card.innerHTML = `
                <div class="label"><span class="swatch" aria-hidden="true"></span>${player.name}${moveHtml}</div>
                <div class="score"><span class="score-text">SCORE ${score}</span></div>
            `;
            UI.recapList.appendChild(card);
        });
}

function applyState(payload) {
    const wasInRecap = STATE.gameInRecap;
    const enteringRecap = !wasInRecap && Boolean(payload.gameInRecap);
    const exitingRecap = wasInRecap && !Boolean(payload.gameInRecap);
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
    STATE.roundPausedElapsed = payload.roundPausedElapsed ?? null;
    STATE.gameFinished = Boolean(payload.gameFinished);
    if (exitingRecap) {
        STATE.previousRanking = getRankingMap(STATE.players);
    }
    if (STATE.gameStarted && introActive) {
        hideIntro();
    }
    if (STATE.gameFinished) {
        showVictory();
    }
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
        if (event.data.type === 'intro') {
            if (event.data.payload?.visible) showIntro();
            else hideIntro();
        }
    });

    if (channel) channel.postMessage({ type: 'request-state' });
    renderPlayers();
    initIntroSlides();
}

/* ── Intro slides ──────────────────────── */
let introInterval = null;
let introActive = true;

function initIntroSlides() {
    if (!UI.introOverlay) return;
    const slides = UI.introOverlay.querySelectorAll('.intro-slide');
    const dotsContainer = document.getElementById('introDots');
    if (!slides.length) return;

    slides.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'intro-dot' + (i === 0 ? ' active' : '');
        dotsContainer.appendChild(dot);
    });

    let current = 0;
    function goTo(index) {
        slides[current].classList.remove('active');
        dotsContainer.children[current].classList.remove('active');
        current = index % slides.length;
        slides[current].classList.add('active');
        dotsContainer.children[current].classList.add('active');
    }

    introInterval = setInterval(() => {
        goTo(current + 1);
    }, 5000);
}

function hideIntro() {
    if (!introActive || !UI.introOverlay) return;
    introActive = false;
    if (introInterval) clearInterval(introInterval);
    UI.introOverlay.classList.add('intro-hide');
    UI.introOverlay.addEventListener('animationend', () => {
        UI.introOverlay.classList.add('hidden');
    }, { once: true });
}

function showIntro() {
    if (!UI.introOverlay) return;
    introActive = true;
    UI.introOverlay.classList.remove('hidden', 'intro-hide');
    const slides = UI.introOverlay.querySelectorAll('.intro-slide');
    const dotsContainer = document.getElementById('introDots');
    slides.forEach((s, i) => s.classList.toggle('active', i === 0));
    [...dotsContainer.children].forEach((d, i) => d.classList.toggle('active', i === 0));
    if (introInterval) clearInterval(introInterval);
    let current = 0;
    introInterval = setInterval(() => {
        slides[current].classList.remove('active');
        dotsContainer.children[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
        dotsContainer.children[current].classList.add('active');
    }, 5000);
}

// ── Victory screen ─────────────────────────────────
let victoryShown = false;

function showVictory() {
    if (victoryShown) return;
    victoryShown = true;

    stopPointsTicker();

    // Hide main game elements
    document.querySelector('.players-main').classList.add('hidden');
    document.querySelector('.leaderboard').classList.add('hidden');

    // Sort players by score descending
    const sorted = [...STATE.players].sort((a, b) => b.score - a.score);

    // Title
    UI.victoryTitle.innerHTML = '🏆 Victoire ! 🏆';

    // Build podium
    UI.victoryPodium.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    sorted.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'podium-entry' + (i === 0 ? ' podium-winner' : '');
        div.innerHTML = `
            <span class="podium-medal">${medals[i] || ''}</span>
            <span class="podium-name" style="color:${p.color}">${p.name}</span>
            <span class="podium-score">${p.score} pts</span>
        `;
        UI.victoryPodium.appendChild(div);
    });

    UI.victoryOverlay.classList.remove('hidden');
    startFireworks();
}

// ── Fireworks canvas animation ─────────────────────
function startFireworks() {
    const canvas = UI.fireworksCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#f97316', '#06b6d4'];

    function burst(x, y) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const count = 40 + Math.floor(Math.random() * 30);
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
            const speed = 2 + Math.random() * 4;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.008 + Math.random() * 0.012,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    }

    // Rockets that fly up then burst
    const rockets = [];
    function launchRocket() {
        rockets.push({
            x: Math.random() * canvas.width,
            y: canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: -(8 + Math.random() * 5),
            life: 1,
        });
    }

    function animate() {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        // Update & draw rockets
        for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.x += r.vx;
            r.y += r.vy;
            r.vy += 0.12; // gravity
            r.life -= 0.015;

            // Trail spark
            ctx.beginPath();
            ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 220, 150, ${r.life})`;
            ctx.fill();

            if (r.vy >= -1 || r.life <= 0) {
                burst(r.x, r.y);
                rockets.splice(i, 1);
            }
        }

        // Update & draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04; // slight gravity
            p.vx *= 0.99;
            p.life -= p.decay;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        requestAnimationFrame(animate);
    }

    // Launch rockets at intervals
    setInterval(() => {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            setTimeout(launchRocket, Math.random() * 400);
        }
    }, 800);

    // Initial salvo
    for (let i = 0; i < 5; i++) {
        setTimeout(launchRocket, i * 200);
    }

    animate();
}

init();
