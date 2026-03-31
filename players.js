const UI = {
    winner: document.getElementById('playerWinner'),
    sub: document.getElementById('playerSub'),
    category: document.getElementById('playerCategory'),
    list: document.getElementById('playerList'),
    recapPanel: document.getElementById('playerRecap'),
    recapTitle: document.getElementById('playerRecapTitle'),
    recapList: document.getElementById('playerRecapList'),
};

const STATE = {
    players: [],
    lastWinnerId: null,
    armed: false,
    locked: false,
    currentDifficulty: null,
    gameStarted: false,
    gameInRecap: false,
    completedDifficulty: null,
    nextDifficulty: null,
};

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
            <div class="score"><span class="score-text">SCORE ${score}</span></div>
		`;
            if (player.id === STATE.lastWinnerId) {
                card.classList.add('active');
            }
            UI.list.appendChild(card);
        });
}

function renderWinner() {
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
    STATE.currentDifficulty = payload.currentDifficulty || null;
    STATE.gameStarted = Boolean(payload.gameStarted);
    STATE.gameInRecap = Boolean(payload.gameInRecap);
    STATE.completedDifficulty = payload.completedDifficulty || null;
    STATE.nextDifficulty = payload.nextDifficulty || null;
    renderWinner();
    renderPlayers();
    renderRecap();
}

function triggerPing(playerId) {
    const card = UI.list.querySelector(`[data-player-id="${playerId}"]`);
    if (!card) return;
    card.classList.remove('ping');
    void card.offsetWidth;
    card.classList.add('ping');
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
    });

    channel.postMessage({ type: 'request-state' });
}

init();
