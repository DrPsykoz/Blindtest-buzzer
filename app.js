const UI = {
    connectionStatus: document.getElementById('connectionStatus'),
    winner: document.getElementById('winner'),
    players: document.getElementById('players'),
    debug: document.getElementById('debug'),
    armBtn: document.getElementById('armBtn'),
    resetBtn: document.getElementById('resetBtn'),
    assignBtn: document.getElementById('assignBtn'),
    startGameBtn: document.getElementById('startGameBtn'),
    validateBtn: document.getElementById('validateBtn'),
    invalidateBtn: document.getElementById('invalidateBtn'),
    openPlayersBtn: document.getElementById('openPlayersBtn'),
    localFolderInput: document.getElementById('localFolderInput'),
    localResults: document.getElementById('localResults'),
    localInvalidResults: document.getElementById('localInvalidResults'),
    localInvalidCount: document.getElementById('localInvalidCount'),
    localPlayBtn: document.getElementById('localPlayBtn'),
    localPauseBtn: document.getElementById('localPauseBtn'),
    localNextBtn: document.getElementById('localNextBtn'),
    localSelection: document.getElementById('localSelection'),
    localDifficulty: document.getElementById('localDifficulty'),
    localOrder: document.getElementById('localOrder'),
    localSection: document.getElementById('localSection'),
    undoPointBtn: document.getElementById('undoPointBtn'),
    resetScoresBtn: document.getElementById('resetScoresBtn'),
    nowPlayingTitle: document.getElementById('nowPlayingTitle'),
    nowPlayingMeta: document.getElementById('nowPlayingMeta'),
    nowPlayingStatus: document.getElementById('nowPlayingStatus'),
    currentCategory: document.getElementById('currentCategory'),
    gameStatus: document.getElementById('gameStatus'),
    recapPanel: document.getElementById('recapPanel'),
    recapTitle: document.getElementById('recapTitle'),
    recapList: document.getElementById('recapList'),
    continueCategoryBtn: document.getElementById('continueCategoryBtn'),
};

const STATE = {
    armed: false,
    locked: false,
    assignMode: false,
    disqualifiedIds: [],
    roundStartTime: null,
    roundPausedElapsed: null,
    players: [
        { id: 1, name: 'Racaille', color: '#ef4444', mapping: null, score: 0, soundFile: 'racaille.mp3', soundFreq: 600 },
        { id: 2, name: 'Ninja', color: '#3b82f6', mapping: null, score: 0, soundFile: 'ninja.mp3', soundFreq: 700 },
        { id: 3, name: 'Ovni', color: '#22c55e', mapping: null, score: 0, soundFile: 'ovni.mp3', soundFreq: 800 },
        { id: 4, name: 'Paysan', color: '#eab308', mapping: null, score: 0, soundFile: 'okay.mp3', soundFreq: 900 },
    ],
    lastWinnerId: null,
    lastPressed: {},
    scoreHistory: [],
    game: {
        started: false,
        currentDifficulty: null,
        blacklistIds: [],
        finished: false,
        inRecap: false,
        nextDifficulty: null,
        completedDifficulty: null,
    },
    localTracks: [],
    localIndex: -1,
    localCurrentId: null,
    localDifficulty: 'all',
    localOrderMode: 'manual',
    localShuffleIds: [],
    localRandomOrder: {
        all: [],
        facile: [],
        moyen: [],
        difficile: [],
    },
};

const STORAGE_KEY = 'blindtest-buzzer-mappings-v1';
const LOCAL_DIFFICULTY_KEY = 'blindtest-local-difficulty-v1';
const LOCAL_ORDER_KEY = 'blindtest-local-order-v1';

const DIFFICULTY_ORDER = ['facile', 'moyen', 'difficile'];

const POINTS_BY_DIFFICULTY = { facile: 50, moyen: 100, difficile: 200 };
const POINTS_DECAY_SECONDS = 30;

const CHANNEL_NAME = 'blindtest-channel';
const broadcastChannel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

function broadcastState() {
    if (!broadcastChannel) return;
    broadcastChannel.postMessage({
        type: 'state',
        payload: {
            players: STATE.players.map(({ id, name, color, score }) => ({ id, name, color, score })),
            lastWinnerId: STATE.lastWinnerId,
            armed: STATE.armed,
            locked: STATE.locked,
            currentDifficulty: STATE.game.currentDifficulty,
            gameStarted: STATE.game.started,
            gameInRecap: STATE.game.inRecap,
            completedDifficulty: STATE.game.completedDifficulty,
            nextDifficulty: STATE.game.nextDifficulty,
            disqualifiedIds: STATE.disqualifiedIds,
            roundStartTime: STATE.roundStartTime,
            roundPausedElapsed: STATE.roundPausedElapsed,
        },
    });
}

function broadcastPing(playerId) {
    if (!broadcastChannel) return;
    broadcastChannel.postMessage({
        type: 'ping',
        payload: { playerId },
    });
}

function broadcastAnswerResult(result, playerId, trackName, earnedPoints) {
    if (!broadcastChannel) return;
    broadcastChannel.postMessage({
        type: 'answer-result',
        payload: { result, playerId, trackName, earnedPoints },
    });
}

if (broadcastChannel) {
    broadcastChannel.addEventListener('message', (event) => {
        if (event.data?.type === 'request-state') {
            broadcastState();
        }
    });
}

function saveMappings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.players));
}

function loadMappings() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
        const data = JSON.parse(stored);
        if (Array.isArray(data)) {
            STATE.players = STATE.players.map((p, i) => ({
                ...p,
                mapping: data[i]?.mapping ?? null,
            }));
        }
    } catch {
        // ignore
    }
}

function renderPlayers() {
    UI.players.innerHTML = '';
    [...STATE.players]
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
        .forEach((player) => {
            const card = document.createElement('div');
            card.className = 'player';
            card.style.setProperty('--player-color', player.color);
            const mappingText = player.mapping
                ? `Gamepad ${player.mapping.gamepadIndex}, bouton ${player.mapping.buttonIndex}`
                : 'Non attribué';

            card.innerHTML = `
            <div class="label"><span class="swatch" aria-hidden="true"></span>${player.name}</div>
            <div class="mapping">${mappingText}</div>
                <div class="score-row">
                    <span class="score-label">Score</span>
                    <span class="score-value">${player.score}</span>
                    <button class="score-btn score-minus" data-action="minus" data-player-id="${player.id}">−</button>
                    <button class="score-btn score-plus" data-action="plus" data-player-id="${player.id}">＋</button>
                </div>
    `;

            if (player.id === STATE.lastWinnerId) {
                card.classList.add('active');
            }

            UI.players.appendChild(card);
        });
    renderRecap();
    broadcastState();
}

function setWinner(playerId) {
    const player = STATE.players.find((p) => p.id === playerId);
    STATE.lastWinnerId = playerId;
    if (STATE.roundStartTime) {
        STATE.roundPausedElapsed = Date.now() - STATE.roundStartTime;
    }
    UI.winner.textContent = player ? `${player.name} a buzzé !` : 'Aucun buzzer';
    renderPlayers();
    if (player) {
        playPlayerSound(player);
    }
    pauseAllPlayback();
    setJudgeButtonsEnabled(true);
    broadcastState();
}

function resetRound() {
    STATE.locked = false;
    STATE.lastWinnerId = null;
    STATE.disqualifiedIds = [];
    STATE.roundPausedElapsed = null;
    UI.winner.textContent = 'Aucun buzzer';
    renderPlayers();
    setJudgeButtonsEnabled(false);
    broadcastState();
}

function setArmed(value) {
    STATE.armed = value;
    if (value) STATE.roundStartTime = Date.now();
    UI.armBtn.textContent = value ? 'Activé' : 'Activer';
    UI.armBtn.classList.toggle('primary', !value);
    UI.armBtn.classList.toggle('danger', value);
    broadcastState();
}

function setAssignMode(value) {
    STATE.assignMode = value;
    UI.assignBtn.textContent = value ? 'Attribution active…' : 'Mode attribution';
}

function getFirstUnassignedPlayer() {
    return STATE.players.find((p) => !p.mapping);
}

function assignMapping(gamepadIndex, buttonIndex) {
    const player = getFirstUnassignedPlayer();
    if (!player) return false;
    player.mapping = { gamepadIndex, buttonIndex };
    saveMappings();
    renderPlayers();
    return true;
}

function findPlayerByMapping(gamepadIndex, buttonIndex) {
    return STATE.players.find((p) =>
        p.mapping && p.mapping.gamepadIndex === gamepadIndex && p.mapping.buttonIndex === buttonIndex
    );
}

function handlePress(gamepadIndex, buttonIndex) {
    const key = `${gamepadIndex}-${buttonIndex}`;
    if (STATE.lastPressed[key]) return;
    STATE.lastPressed[key] = true;

    if (STATE.assignMode) {
        if (assignMapping(gamepadIndex, buttonIndex)) {
            setAssignMode(false);
        }
        return;
    }

    const player = findPlayerByMapping(gamepadIndex, buttonIndex);
    if (!player) return;

    if (!STATE.armed || STATE.locked || STATE.disqualifiedIds.includes(player.id)) {
        broadcastPing(player.id);
        return;
    }

    STATE.locked = true;
    setWinner(player.id);
}

function handleRelease(gamepadIndex, buttonIndex) {
    const key = `${gamepadIndex}-${buttonIndex}`;
    STATE.lastPressed[key] = false;
}

function pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connected = [...pads].filter(Boolean);
    UI.connectionStatus.textContent = connected.length
        ? `Gamepad: ${connected.length} connecté(s)`
        : 'Gamepad: en attente…';

    connected.forEach((pad) => {
        pad.buttons.forEach((button, index) => {
            if (button.pressed) {
                handlePress(pad.index, index);
            } else {
                handleRelease(pad.index, index);
            }
        });
    });

    requestAnimationFrame(pollGamepads);
}

function setupKeyboardFallback() {
    const keyMap = {
        Digit1: 1,
        Digit2: 2,
        Digit3: 3,
        Digit4: 4,
    };

    window.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        const playerId = keyMap[event.code];
        if (!playerId) return;
        if (!STATE.armed || STATE.locked || STATE.disqualifiedIds.includes(playerId)) {
            broadcastPing(playerId);
            return;
        }
        STATE.locked = true;
        setWinner(playerId);
    });
}

function beep(freq = 880) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0.25;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch {
        // ignore
    }
}

const playerSoundCache = new Map();
let playerSoundContext = null;

function getSoundContext() {
    if (!playerSoundContext) {
        playerSoundContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return playerSoundContext;
}

function computeRms(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    let sumSquares = 0;
    let count = 0;
    for (let ch = 0; ch < channels; ch += 1) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < data.length; i += 1) {
            const sample = data[i];
            sumSquares += sample * sample;
        }
        count += data.length;
    }
    if (!count) return 0;
    return Math.sqrt(sumSquares / count);
}

async function getNormalizedBuffer(soundFile) {
    if (playerSoundCache.has(soundFile)) {
        return playerSoundCache.get(soundFile);
    }
    const ctx = getSoundContext();
    const response = await fetch(`players/${soundFile}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const rms = computeRms(audioBuffer) || 0.0001;
    const targetRms = 0.12;
    const rawGain = targetRms / rms;
    const gain = Math.min(2.5, Math.max(0.4, rawGain));
    const payload = { audioBuffer, gain };
    playerSoundCache.set(soundFile, payload);
    return payload;
}

async function playPlayerSound(player) {
    if (player?.soundFile) {
        try {
            const ctx = getSoundContext();
            await ctx.resume();
            const { audioBuffer, gain } = await getNormalizedBuffer(player.soundFile);
            const source = ctx.createBufferSource();
            const gainNode = ctx.createGain();
            gainNode.gain.value = gain;
            source.buffer = audioBuffer;
            source.connect(gainNode).connect(ctx.destination);
            source.start(0);
            return;
        } catch {
            // ignore
        }
    }
    beep(player?.soundFreq || 880);
}

function logDebug(info) {
    UI.debug.textContent = info;
}

function updateGameStatusUI() {
    const categoryLabel = STATE.game.currentDifficulty
        ? STATE.game.currentDifficulty
        : '—';
    UI.currentCategory.textContent = `Difficulté: ${categoryLabel}`;
    if (STATE.game.inRecap) {
        UI.gameStatus.textContent = 'Partie: récap scores';
        return;
    }
    if (STATE.game.started) {
        UI.gameStatus.textContent = 'Partie: en cours';
        return;
    }
    UI.gameStatus.textContent = STATE.game.finished ? 'Partie: terminée' : 'Partie: arrêtée';
}

function setCurrentDifficulty(diff) {
    STATE.game.currentDifficulty = diff;
    updateGameStatusUI();
    broadcastState();
}

function enterRecap(completedDifficulty, nextDifficulty) {
    STATE.game.inRecap = true;
    STATE.game.completedDifficulty = completedDifficulty;
    STATE.game.nextDifficulty = nextDifficulty;
    setArmed(false);
    updateGameStatusUI();
    renderRecap();
    broadcastState();
}

function exitRecap() {
    STATE.game.inRecap = false;
    STATE.game.completedDifficulty = null;
    STATE.game.nextDifficulty = null;
    renderRecap();
    updateGameStatusUI();
    broadcastState();
}

function setJudgeButtonsEnabled(enabled) {
    UI.validateBtn.disabled = !enabled;
    UI.invalidateBtn.disabled = !enabled;
}

function pauseAllPlayback() {
    pauseLocalTrack();
}

function calculatePoints() {
    const diff = STATE.game.currentDifficulty || 'facile';
    const maxPts = POINTS_BY_DIFFICULTY[diff] || 50;
    if (!STATE.roundStartTime) return maxPts;
    const elapsed = (STATE.roundPausedElapsed != null ? STATE.roundPausedElapsed : Date.now() - STATE.roundStartTime) / 1000;
    const ratio = Math.max(0, 1 - elapsed / POINTS_DECAY_SECONDS);
    return Math.max(Math.round(maxPts * 0.1), Math.round(maxPts * ratio));
}

function addPointToWinner() {
    const player = STATE.players.find((p) => p.id === STATE.lastWinnerId);
    if (!player) return;
    const pts = calculatePoints();
    STATE.scoreHistory.push({ playerId: player.id, delta: pts });
    player.score += pts;
    renderPlayers();
    return pts;
}

function updatePlayerScore(playerId, delta) {
    const player = STATE.players.find((p) => p.id === playerId);
    if (!player || !delta) return;
    const nextScore = Math.max(0, player.score + delta);
    const appliedDelta = nextScore - player.score;
    if (!appliedDelta) return;
    player.score = nextScore;
    STATE.scoreHistory.push({ playerId: player.id, delta: appliedDelta });
    renderPlayers();
}

function undoLastPoint() {
    const last = STATE.scoreHistory.pop();
    if (!last) return;
    const player = STATE.players.find((p) => p.id === last.playerId);
    if (!player) return;
    player.score = Math.max(0, player.score - last.delta);
    renderPlayers();
}

function resetScores() {
    STATE.players.forEach((player) => {
        player.score = 0;
    });
    STATE.scoreHistory = [];
    renderPlayers();
}

const localAudio = new Audio();
let localObjectUrl = null;
let fadeIntervalId = null;

function loadLocalSettings() {
    const difficulty = localStorage.getItem(LOCAL_DIFFICULTY_KEY);
    if (difficulty === 'all' || difficulty === 'facile' || difficulty === 'moyen' || difficulty === 'difficile') {
        STATE.localDifficulty = difficulty;
    }
    const orderMode = localStorage.getItem(LOCAL_ORDER_KEY);
    if (orderMode === 'manual' || orderMode === 'az' || orderMode === 'za' || orderMode === 'random') {
        STATE.localOrderMode = orderMode;
    }
    if (UI.localDifficulty) UI.localDifficulty.value = STATE.localDifficulty;
    if (UI.localOrder) UI.localOrder.value = STATE.localOrderMode;
}

function setLocalDifficulty(value) {
    STATE.localDifficulty = value;
    localStorage.setItem(LOCAL_DIFFICULTY_KEY, value);
    STATE.localShuffleIds = [];
    STATE.localRandomOrder = { ...STATE.localRandomOrder, all: [], facile: [], moyen: [], difficile: [] };
    renderLocalTracks();
}

function setLocalOrderMode(value) {
    STATE.localOrderMode = value;
    localStorage.setItem(LOCAL_ORDER_KEY, value);
    STATE.localShuffleIds = [];
    STATE.localRandomOrder = { ...STATE.localRandomOrder, all: [], facile: [], moyen: [], difficile: [] };
    renderLocalTracks();
}

function resetLocalTracks() {
    if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
        localObjectUrl = null;
    }
    STATE.game.started = false;
    STATE.game.currentDifficulty = null;
    STATE.game.blacklistIds = [];
    STATE.game.finished = false;
    STATE.game.inRecap = false;
    STATE.game.nextDifficulty = null;
    STATE.game.completedDifficulty = null;
    STATE.localRandomOrder = { all: [], facile: [], moyen: [], difficile: [] };
    STATE.localTracks = [];
    STATE.localIndex = -1;
    STATE.localCurrentId = null;
    STATE.localShuffleIds = [];
    UI.localResults.innerHTML = '';
    UI.localInvalidResults.innerHTML = '';
    UI.localInvalidCount.textContent = '';
    UI.localSelection.textContent = 'Aucune sélection.';
    updateNowPlaying(null, 'En pause');
    updateGameStatusUI();
    renderRecap();
}

function detectDifficulty(file) {
    const path = (file.webkitRelativePath || '').toLowerCase();
    if (/(^|\/)(facile)(\/|$)/.test(path)) return 'facile';
    if (/(^|\/)(moyen)(\/|$)/.test(path)) return 'moyen';
    if (/(^|\/)(difficile)(\/|$)/.test(path)) return 'difficile';
    return 'inconnu';
}

function cleanTrackName(fileName) {
    return fileName
        .replace(/\.[^/.]+$/, '')
        .trim();
}

function loadLocalFiles(files) {
    resetLocalTracks();
    const list = files
        .filter((file) => {
            if (file.type && file.type.startsWith('audio/')) return true;
            return /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name);
        })
        .map((file, index) => ({
            id: `${file.name}-${file.lastModified}-${index}`,
            file,
            name: cleanTrackName(file.name),
            difficulty: detectDifficulty(file),
            path: file.webkitRelativePath || file.name,
            orderIndex: index,
        }));
    STATE.localTracks = list;
    renderLocalTracks();
    const active = getActiveLocalTracks();
    if (active.length) {
        setLocalCurrentId(active[0].id);
        UI.localSelection.textContent = `Sélection: ${active[0].name}`;
    }
}

function orderTracks(tracks, bucketKey) {
    if (STATE.localOrderMode === 'manual') {
        return [...tracks].sort((a, b) => a.orderIndex - b.orderIndex);
    }
    if (STATE.localOrderMode === 'az') {
        return [...tracks].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    if (STATE.localOrderMode === 'za') {
        return [...tracks].sort((a, b) => b.name.localeCompare(a.name, 'fr'));
    }
    if (STATE.localOrderMode === 'random') {
        const key = bucketKey || 'all';
        const currentIds = tracks.map((t) => t.id);
        const cache = STATE.localRandomOrder[key] || [];
        const missing = currentIds.filter((id) => !cache.includes(id));
        const extra = cache.filter((id) => !currentIds.includes(id));
        if (!cache.length || missing.length || extra.length) {
            const shuffled = [...tracks];
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            STATE.localRandomOrder[key] = shuffled.map((t) => t.id);
        }
        const map = new Map(tracks.map((t) => [t.id, t]));
        return STATE.localRandomOrder[key].map((id) => map.get(id)).filter(Boolean);
    }

    return [...tracks];
}

function getActiveLocalTracks() {
    let tracks = STATE.localTracks;
    tracks = tracks.filter((t) => t.difficulty !== 'inconnu');
    if (STATE.localDifficulty !== 'all') {
        tracks = tracks.filter((t) => t.difficulty === STATE.localDifficulty);
    }
    const bucketKey = STATE.localDifficulty === 'all' ? 'all' : STATE.localDifficulty;
    return orderTracks(tracks, bucketKey);
}

function getTracksForDifficulty(difficulty) {
    return STATE.localTracks.filter((track) => track.difficulty === difficulty);
}

function getRemainingTracksForDifficulty(difficulty) {
    const ordered = orderTracks(getTracksForDifficulty(difficulty), difficulty);
    return ordered.filter((track) => !STATE.game.blacklistIds.includes(track.id));
}

function resolveNextDifficulty() {
    if (!STATE.game.currentDifficulty) {
        for (const difficulty of DIFFICULTY_ORDER) {
            if (getRemainingTracksForDifficulty(difficulty).length) {
                return difficulty;
            }
        }
        return null;
    }

    const current = STATE.game.currentDifficulty;
    if (getRemainingTracksForDifficulty(current).length) {
        return current;
    }

    const startIndex = DIFFICULTY_ORDER.indexOf(current) + 1;
    for (let i = startIndex; i < DIFFICULTY_ORDER.length; i += 1) {
        const difficulty = DIFFICULTY_ORDER[i];
        if (getRemainingTracksForDifficulty(difficulty).length) {
            return difficulty;
        }
    }

    return null;
}

function setLocalCurrentId(id) {
    STATE.localCurrentId = id;
    [...UI.localResults.querySelectorAll('button[data-select]')].forEach((btn) => {
        btn.classList.toggle('primary', btn.dataset.select === id);
    });
}

function moveLocalTrack(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= STATE.localTracks.length) return;
    const updated = [...STATE.localTracks];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    STATE.localTracks = updated.map((track, idx) => ({ ...track, orderIndex: idx }));
    renderLocalTracks();
}

function renderLocalTracks() {
    UI.localResults.innerHTML = '';
    // Build play-order list: facile → moyen → difficile, each sorted by current order mode
    const tracks = [];
    for (const diff of DIFFICULTY_ORDER) {
        const bucket = orderTracks(
            STATE.localTracks.filter((t) => t.difficulty === diff),
            diff
        );
        tracks.push(...bucket);
    }
    const invalid = STATE.localTracks.filter((t) => t.difficulty === 'inconnu');

    UI.localInvalidResults.innerHTML = '';
    UI.localInvalidCount.textContent = invalid.length ? `(${invalid.length})` : '';
    invalid.forEach((track) => {
        const el = document.createElement('div');
        el.className = 'result';
        el.innerHTML = `
            <div>
                <div>${track.name}</div>
                <div class="meta">${track.path}</div>
            </div>
        `;
        UI.localInvalidResults.appendChild(el);
    });

    if (!tracks.length) {
        return;
    }

    if (!tracks.find((t) => t.id === STATE.localCurrentId)) {
        STATE.localCurrentId = tracks[0].id;
        UI.localSelection.textContent = `Sélection: ${tracks[0].name}`;
    }

    tracks.forEach((track) => {
        const el = document.createElement('div');
        el.className = 'result';

        const info = document.createElement('div');
        const title = document.createElement('div');
        title.textContent = track.name;

        const meta = document.createElement('div');
        meta.className = 'meta-badges';
        const diffBadge = document.createElement('span');
        diffBadge.className = `badge ${track.difficulty}`;
        diffBadge.textContent = track.difficulty === 'inconnu' ? 'Sans niveau' : track.difficulty;
        meta.appendChild(diffBadge);
        info.appendChild(title);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'result-actions';
        const selectBtn = document.createElement('button');
        selectBtn.textContent = 'Sélectionner';
        selectBtn.dataset.select = track.id;
        if (track.id === STATE.localCurrentId) {
            selectBtn.classList.add('primary');
        }
        selectBtn.addEventListener('click', () => {
            setLocalCurrentId(track.id);
            UI.localSelection.textContent = `Sélection: ${track.name}`;
        });
        actions.appendChild(selectBtn);

        if (STATE.localOrderMode === 'manual') {
            const indexInAll = STATE.localTracks.findIndex((t) => t.id === track.id);
            const upBtn = document.createElement('button');
            upBtn.textContent = '▲';
            upBtn.disabled = indexInAll <= 0;
            upBtn.addEventListener('click', () => moveLocalTrack(indexInAll, -1));
            const downBtn = document.createElement('button');
            downBtn.textContent = '▼';
            downBtn.disabled = indexInAll === STATE.localTracks.length - 1;
            downBtn.addEventListener('click', () => moveLocalTrack(indexInAll, 1));
            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
        }

        el.appendChild(info);
        el.appendChild(actions);
        UI.localResults.appendChild(el);
    });
}

function playSpecificTrack(track) {
    if (!track) return;
    if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
    }
    if (fadeIntervalId) {
        clearInterval(fadeIntervalId);
        fadeIntervalId = null;
    }
    localObjectUrl = URL.createObjectURL(track.file);
    localAudio.src = localObjectUrl;
    localAudio.volume = 0;
    localAudio.play();
    const fadeDurationMs = 2000;
    const stepMs = 50;
    const step = 1 / (fadeDurationMs / stepMs);
    fadeIntervalId = setInterval(() => {
        localAudio.volume = Math.min(1, localAudio.volume + step);
        if (localAudio.volume >= 1) {
            clearInterval(fadeIntervalId);
            fadeIntervalId = null;
        }
    }, stepMs);
    updateNowPlaying(track, 'Lecture');
}

function playLocalTrack() {
    if (localAudio.src && !localAudio.ended && localAudio.currentTime > 0) {
        localAudio.play();
        if (STATE.game.started) {
            setArmed(true);
        }
        updateNowPlaying(getCurrentTrack(), 'Lecture');
        return;
    }
    const tracks = getActiveLocalTracks();
    if (!tracks.length) {
        alert('Ajoute des fichiers audio.');
        return;
    }
    let current = tracks.find((t) => t.id === STATE.localCurrentId);
    if (!current) {
        current = tracks[0];
        setLocalCurrentId(current.id);
    }
    if (STATE.game.started) {
        setArmed(true);
    }
    playSpecificTrack(current);
}

function pauseLocalTrack() {
    localAudio.pause();
    updateNowPlaying(getCurrentTrack(), 'En pause');
}

function nextLocalTrack() {
    if (STATE.game.started) {
        playNextGameTrack();
        return;
    }
    const tracks = getActiveLocalTracks();
    if (!tracks.length) return;
    const currentIndex = tracks.findIndex((t) => t.id === STATE.localCurrentId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % tracks.length : 0;
    const next = tracks[nextIndex];
    setLocalCurrentId(next.id);
    playLocalTrack();
}

function playNextGameTrack() {
    if (STATE.game.inRecap) {
        return;
    }
    const nextDifficulty = resolveNextDifficulty();
    if (!nextDifficulty) {
        STATE.game.started = false;
        STATE.game.finished = true;
        setArmed(false);
        updateGameStatusUI();
        updateNowPlaying(getCurrentTrack(), 'Terminé');
        renderRecap();
        return;
    }

    if (STATE.game.currentDifficulty && STATE.game.currentDifficulty !== nextDifficulty) {
        enterRecap(STATE.game.currentDifficulty, nextDifficulty);
        return;
    }

    if (STATE.game.currentDifficulty !== nextDifficulty) {
        setCurrentDifficulty(nextDifficulty);
    }

    const remaining = getRemainingTracksForDifficulty(nextDifficulty);
    const nextTrack = remaining[0];
    if (!nextTrack) {
        STATE.game.started = false;
        STATE.game.finished = true;
        setArmed(false);
        updateGameStatusUI();
        updateNowPlaying(getCurrentTrack(), 'Terminé');
        renderRecap();
        return;
    }
    if (!STATE.game.blacklistIds.includes(nextTrack.id)) {
        STATE.game.blacklistIds.push(nextTrack.id);
    }
    setArmed(true);
    setLocalCurrentId(nextTrack.id);
    UI.localSelection.textContent = `Sélection: ${nextTrack.name}`;
    playSpecificTrack(nextTrack);
}

function startGame() {
    if (!STATE.localTracks.length) {
        alert('Charge un dossier audio.');
        return;
    }
    STATE.game.started = true;
    STATE.game.finished = false;
    STATE.game.inRecap = false;
    STATE.game.nextDifficulty = null;
    STATE.game.completedDifficulty = null;
    STATE.game.blacklistIds = [];
    STATE.localRandomOrder = { all: [], facile: [], moyen: [], difficile: [] };
    setCurrentDifficulty(null);
    setArmed(true);
    playNextGameTrack();
}

function getCurrentTrack() {
    const tracks = getActiveLocalTracks();
    return tracks.find((t) => t.id === STATE.localCurrentId) || null;
}

function updateNowPlaying(track, status) {
    if (!track) {
        UI.nowPlayingTitle.textContent = 'Aucun morceau';
        UI.nowPlayingMeta.textContent = '—';
        UI.nowPlayingStatus.textContent = status || 'En pause';
        return;
    }
    UI.nowPlayingTitle.textContent = track.name;
    const diff = track.difficulty === 'inconnu' ? 'Sans niveau' : track.difficulty;
    UI.nowPlayingMeta.textContent = `Difficulté: ${diff}`;
    UI.nowPlayingStatus.textContent = status || 'Lecture';
}

function renderRecap() {
    if (!UI.recapPanel) return;
    const shouldShow = STATE.game.inRecap;
    UI.recapPanel.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) return;

    const completed = STATE.game.completedDifficulty || '—';
    const next = STATE.game.nextDifficulty || '—';
    UI.recapTitle.textContent = `Récap ${completed} → prochain: ${next}`;

    UI.recapList.innerHTML = '';
    [...STATE.players]
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
        .forEach((player) => {
            const card = document.createElement('div');
            card.className = 'player';
            card.style.setProperty('--player-color', player.color);
            card.innerHTML = `
                <div class="label"><span class="swatch" aria-hidden="true"></span>${player.name}</div>
                <div class="score"><span class="score-badge">Score: ${player.score}</span></div>
            `;
            UI.recapList.appendChild(card);
        });
}

function init() {
    loadMappings();
    loadLocalSettings();
    renderPlayers();
    setJudgeButtonsEnabled(false);
    broadcastState();
    updateGameStatusUI();
    setupKeyboardFallback();
    pollGamepads();

    localAudio.addEventListener('ended', () => nextLocalTrack());
    localAudio.addEventListener('play', () => updateNowPlaying(getCurrentTrack(), 'Lecture'));
    localAudio.addEventListener('pause', () => updateNowPlaying(getCurrentTrack(), 'En pause'));
    localAudio.addEventListener('error', () => {
        updateNowPlaying(getCurrentTrack(), 'Erreur');
        nextLocalTrack();
    });

    UI.armBtn.addEventListener('click', () => setArmed(!STATE.armed));
    UI.resetBtn.addEventListener('click', () => resetRound());
    UI.assignBtn.addEventListener('click', () => setAssignMode(!STATE.assignMode));

    UI.startGameBtn.addEventListener('click', () => startGame());

    UI.validateBtn.addEventListener('click', () => {
        const track = getCurrentTrack();
        const playerId = STATE.lastWinnerId;
        const pts = addPointToWinner();
        broadcastAnswerResult('ok', playerId, track?.name || null, pts || 0);
        resetRound();
        setArmed(false);
    });

    UI.invalidateBtn.addEventListener('click', () => {
        const playerId = STATE.lastWinnerId;
        if (playerId && !STATE.disqualifiedIds.includes(playerId)) STATE.disqualifiedIds.push(playerId);
        broadcastAnswerResult('ko', playerId, null, 0);
        STATE.locked = false;
        STATE.lastWinnerId = null;
        UI.winner.textContent = 'Aucun buzzer';
        renderPlayers();
        setJudgeButtonsEnabled(false);
        if (STATE.roundPausedElapsed != null) {
            STATE.roundStartTime = Date.now() - STATE.roundPausedElapsed;
            STATE.roundPausedElapsed = null;
        }
        const allDisqualified = STATE.players.every((p) => STATE.disqualifiedIds.includes(p.id));
        if (allDisqualified) {
            STATE.disqualifiedIds = [];
        }
        STATE.armed = true;
        UI.armBtn.textContent = 'Activé';
        UI.armBtn.classList.toggle('primary', false);
        UI.armBtn.classList.toggle('danger', true);
        localAudio.play();
        broadcastState();
    });

    UI.undoPointBtn.addEventListener('click', () => {
        undoLastPoint();
    });

    UI.resetScoresBtn.addEventListener('click', () => {
        resetScores();
    });

    UI.players.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const playerId = Number(button.dataset.playerId);
        const action = button.dataset.action;
        if (action === 'plus') {
            updatePlayerScore(playerId, 1);
        }
        if (action === 'minus') {
            updatePlayerScore(playerId, -1);
        }
    });

    UI.continueCategoryBtn.addEventListener('click', () => {
        if (!STATE.game.nextDifficulty) {
            exitRecap();
            return;
        }
        const nextDifficulty = STATE.game.nextDifficulty;
        exitRecap();
        STATE.game.started = true;
        setCurrentDifficulty(nextDifficulty);
        playNextGameTrack();
    });

    if (UI.openPlayersBtn) {
        UI.openPlayersBtn.addEventListener('click', () => {
            window.open('players.html', '_blank');
        });
    }

    UI.localFolderInput.addEventListener('change', (event) => {
        const files = [...event.target.files];
        loadLocalFiles(files);
    });

    UI.localDifficulty.addEventListener('change', (event) => {
        setLocalDifficulty(event.target.value);
    });

    UI.localOrder.addEventListener('change', (event) => {
        setLocalOrderMode(event.target.value);
    });

    UI.localPlayBtn.addEventListener('click', () => {
        playLocalTrack();
    });

    UI.localPauseBtn.addEventListener('click', () => pauseLocalTrack());
    UI.localNextBtn.addEventListener('click', () => nextLocalTrack());

    logDebug('Astuce: appuie sur un bouton en mode attribution pour mapper un joueur.');
}

init();
