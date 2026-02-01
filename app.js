// Fantasy Golf 2026 - Main Application with Firebase Sync
// RESTRUCTURED: Primary flow is Enter Round → Submit → Updates Fantasy Scores

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD0FJMW81tgz65zuU7N5fOcRstF1tJKhN0",
    authDomain: "fantasy-golf-71ebf.firebaseapp.com",
    databaseURL: "https://fantasy-golf-71ebf-default-rtdb.firebaseio.com",
    projectId: "fantasy-golf-71ebf",
    storageBucket: "fantasy-golf-71ebf.firebasestorage.app",
    messagingSenderId: "369426324814",
    appId: "1:369426324814:web:718f09e8d4f1273b35121f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

class FantasyGolf {
    constructor() {
        this.players = [];
        this.holes = 18;
        this.parValues = [4, 4, 4, 4, 3, 4, 3, 4, 5, 3, 4, 4, 5, 5, 3, 4, 3, 5]; // Moraga CC (Par 72)
        this.isOnline = false;
        this.isSyncing = false;
        this.currentTab = 'enterRound';

        // Current round being entered (temporary, not saved until submission)
        this.currentRoundScores = Array(18).fill(null);

        // Player-specific configuration for handicap (pops) and personal bests
        this.playerConfig = {
            'Rob': {
                personalBest: 83,
                pops: {
                    general: [2, 11],           // 0-indexed: holes 3 and 12
                    noDoubleBogey: [0, 2, 11]   // 0-indexed: holes 1, 3, and 12
                }
            },
            'Waitzman': {
                personalBest: 77,
                pops: { general: [], noDoubleBogey: [] }
            },
            'Drew': {
                personalBest: 75,
                pops: { general: [], noDoubleBogey: [] }
            }
        };

        // Kicker definitions (max 2 per player per year, each -1 stroke)
        this.kickerTypes = {
            beatPersonalBest: { name: 'Beat Personal Best', value: -1, autoDetect: true },
            holeInOne: { name: 'Hole-in-One', value: -1, autoDetect: true },
            albatross: { name: 'Albatross', value: -1, autoDetect: true },
            fullWedge: { name: 'Full Wedge (100+ yd)', value: -1, autoDetect: false },
            noDoubleBogeys: { name: 'No Double Bogeys', value: -1, autoDetect: true }
        };

        // Track editing state
        this.editingRound = null;

        this.init();
    }

    init() {
        this.setupFirebase();
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setDefaultDate();
    }

    setDefaultDate() {
        const dateInput = document.getElementById('entryDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }

    // Firebase Setup and Sync
    setupFirebase() {
        const dataRef = database.ref('golfData');

        // Listen for connection state
        database.ref('.info/connected').on('value', (snapshot) => {
            this.isOnline = snapshot.val() === true;
            this.updateSyncStatus();
        });

        // Listen for data changes (real-time sync)
        dataRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.players) {
                this.players = this.convertFromFirebase(data.players);
                if (data.parValues) {
                    this.parValues = data.parValues;
                }
                this.saveToLocalStorage();
                this.renderAll();
                this.updateSyncStatus('synced');
            } else {
                this.loadFromLocalStorage();
                this.renderAll();
                if (this.players.length > 0) {
                    this.saveToFirebase();
                }
            }
        }, (error) => {
            console.error('Firebase read error:', error);
            this.loadFromLocalStorage();
            this.renderAll();
            this.updateSyncStatus('offline');
        });
    }

    updateSyncStatus(status) {
        const statusEl = document.getElementById('syncStatus');
        if (!statusEl) return;

        if (status === 'synced') {
            statusEl.textContent = '✓ Synced';
            statusEl.className = 'sync-status synced';
        } else if (status === 'syncing') {
            statusEl.textContent = '↻ Syncing...';
            statusEl.className = 'sync-status syncing';
        } else if (status === 'offline') {
            statusEl.textContent = '○ Offline';
            statusEl.className = 'sync-status offline';
        } else if (this.isOnline) {
            statusEl.textContent = '✓ Connected';
            statusEl.className = 'sync-status synced';
        } else {
            statusEl.textContent = '○ Offline';
            statusEl.className = 'sync-status offline';
        }
    }

    saveData() {
        this.saveToLocalStorage();
        this.saveToFirebase();
    }

    saveToLocalStorage() {
        const data = {
            players: this.players,
            parValues: this.parValues
        };
        localStorage.setItem('fantasyGolf2026', JSON.stringify(data));
    }

    convertToFirebase(players) {
        return players.map(player => ({
            name: player.name,
            scores: player.scores.map(score => score === null ? -1 : score),
            rounds: (player.rounds || []).map(round => ({
                id: round.id,
                date: round.date,
                scores: round.scores.map(s => s === null ? -1 : s),
                kickers: round.kickers || { detected: [], confirmed: [] }
            })),
            kickersUsed: player.kickersUsed || 0,
            confirmedKickers: player.confirmedKickers || []
        }));
    }

    convertFromFirebase(playersData) {
        const playersArray = Array.isArray(playersData) ? playersData : Object.values(playersData);

        return playersArray.map(player => {
            let scores = Array(18).fill(null);
            if (player.scores) {
                const scoresData = Array.isArray(player.scores) ? player.scores : Object.values(player.scores);
                for (let i = 0; i < 18; i++) {
                    const score = scoresData[i];
                    scores[i] = (score === -1 || score === undefined || score === null) ? null : score;
                }
            }

            let rounds = [];
            if (player.rounds) {
                const roundsData = Array.isArray(player.rounds) ? player.rounds : Object.values(player.rounds);
                rounds = roundsData.filter(r => r).map(round => ({
                    id: round.id,
                    date: round.date,
                    scores: (round.scores || []).map(s => (s === -1 || s === undefined || s === null) ? null : s),
                    kickers: round.kickers || { detected: [], confirmed: [] }
                }));
            }

            return {
                name: player.name,
                scores: scores,
                rounds: rounds,
                kickersUsed: player.kickersUsed || 0,
                confirmedKickers: player.confirmedKickers || []
            };
        });
    }

    saveToFirebase() {
        if (!this.isOnline) return;

        this.updateSyncStatus('syncing');
        const data = {
            players: this.convertToFirebase(this.players),
            parValues: this.parValues,
            lastUpdated: Date.now()
        };

        database.ref('golfData').set(data)
            .then(() => {
                this.updateSyncStatus('synced');
            })
            .catch((error) => {
                console.error('Firebase write error:', error);
                this.updateSyncStatus('offline');
            });
    }

    loadFromLocalStorage() {
        const savedData = localStorage.getItem('fantasyGolf2026');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.players = (data.players || []).map(p => this.migratePlayerData(p));
            if (data.parValues) {
                this.parValues = data.parValues;
            }
        } else {
            this.players = [
                { name: 'Rob', scores: Array(18).fill(null), rounds: [], kickersUsed: 0, confirmedKickers: [] },
                { name: 'Drew', scores: Array(18).fill(null), rounds: [], kickersUsed: 0, confirmedKickers: [] },
                { name: 'Waitzman', scores: Array(18).fill(null), rounds: [], kickersUsed: 0, confirmedKickers: [] }
            ];
            this.saveData();
        }
    }

    migratePlayerData(player) {
        if (player.rounds !== undefined && player.kickersUsed !== undefined) {
            return player;
        }
        return {
            name: player.name,
            scores: player.scores || Array(18).fill(null),
            rounds: player.rounds || [],
            kickersUsed: player.kickersUsed || 0,
            confirmedKickers: player.confirmedKickers || []
        };
    }

    setupEventListeners() {
        // Add Player Button
        document.getElementById('addPlayerBtn').addEventListener('click', () => {
            this.showPlayerModal();
        });

        // Upload Scorecard Button
        document.getElementById('uploadScorecardBtn').addEventListener('click', () => {
            document.getElementById('scorecardUpload').click();
        });

        document.getElementById('scorecardUpload').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processScorecard(e.target.files[0]);
            }
        });

        // Clear Round Button
        document.getElementById('clearRoundBtn').addEventListener('click', () => {
            this.clearCurrentRound();
        });

        // Submit Round Button
        document.getElementById('submitRoundBtn').addEventListener('click', () => {
            this.showRoundSubmissionModal();
        });

        // Tools Dropdown
        document.getElementById('toolsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('toolsMenu').classList.toggle('show');
        });

        document.addEventListener('click', () => {
            document.getElementById('toolsMenu').classList.remove('show');
        });

        // Export Button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportScores();
        });

        // Import Button
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importUpload').click();
        });

        document.getElementById('importUpload').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importScores(e.target.files[0]);
            }
        });

        // Reset Button
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset ALL data? This will delete all players, rounds, and scores. This cannot be undone.')) {
                this.players.forEach(player => {
                    player.scores = Array(18).fill(null);
                    player.rounds = [];
                    player.kickersUsed = 0;
                    player.confirmedKickers = [];
                });
                this.saveData();
                this.renderAll();
            }
        });

        // Player Modal
        document.getElementById('savePlayerBtn').addEventListener('click', () => {
            this.addPlayer();
        });

        document.getElementById('cancelPlayerBtn').addEventListener('click', () => {
            this.hidePlayerModal();
        });

        // OCR Modal
        document.getElementById('applyOcrBtn').addEventListener('click', () => {
            this.applyOcrScores();
        });

        document.getElementById('cancelOcrBtn').addEventListener('click', () => {
            this.hideOcrModal();
        });

        // Round Modal
        document.getElementById('confirmRoundBtn').addEventListener('click', () => {
            this.confirmRoundSubmission();
        });

        document.getElementById('cancelRoundBtn').addEventListener('click', () => {
            this.hideRoundModal();
        });

        // Close buttons for all modals
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Enter key to save in modals
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addPlayer();
            }
        });

        // Player selection change updates the round entry display
        document.getElementById('entryPlayer').addEventListener('change', () => {
            this.renderRoundEntry();
        });
    }

    setupTabNavigation() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // History player filter
        document.getElementById('historyPlayerFilter').addEventListener('change', () => {
            this.renderHistory();
        });
    }

    switchTab(tabName) {
        // Update button states
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Show/hide content
        document.getElementById('enterRoundTab').classList.toggle('active', tabName === 'enterRound');
        document.getElementById('fantasyScoresTab').classList.toggle('active', tabName === 'fantasyScores');
        document.getElementById('historyTab').classList.toggle('active', tabName === 'history');

        this.currentTab = tabName;

        // Render appropriate content
        if (tabName === 'enterRound') {
            this.renderRoundEntry();
        } else if (tabName === 'fantasyScores') {
            this.renderFantasyScorecard();
            this.renderFantasyScoring();
        } else if (tabName === 'history') {
            this.populateHistoryPlayerFilter();
            this.renderHistory();
        }
    }

    // ============================================
    // RENDER ALL
    // ============================================
    renderAll() {
        this.populatePlayerDropdowns();

        if (this.currentTab === 'enterRound') {
            this.renderRoundEntry();
        } else if (this.currentTab === 'fantasyScores') {
            this.renderFantasyScorecard();
            this.renderFantasyScoring();
        } else if (this.currentTab === 'history') {
            this.populateHistoryPlayerFilter();
            this.renderHistory();
        }
    }

    populatePlayerDropdowns() {
        const entrySelect = document.getElementById('entryPlayer');
        if (entrySelect) {
            const currentValue = entrySelect.value;
            entrySelect.innerHTML = this.players.map((p, i) =>
                `<option value="${i}">${p.name}</option>`
            ).join('');

            // Restore selection if valid
            if (currentValue && parseInt(currentValue) < this.players.length) {
                entrySelect.value = currentValue;
            }
        }
    }

    // ============================================
    // TAB 1: ENTER ROUND
    // ============================================
    renderRoundEntry() {
        const container = document.getElementById('roundEntryContainer');

        if (this.players.length === 0) {
            container.innerHTML = '<p class="no-data">No players yet. Go to Fantasy Scores tab to add players.</p>';
            return;
        }

        const playerIndex = parseInt(document.getElementById('entryPlayer').value) || 0;
        const player = this.players[playerIndex];
        if (!player) return;

        // Calculate totals and par
        let front9Total = 0, front9Count = 0;
        let back9Total = 0, back9Count = 0;
        let frontPar = 0, backPar = 0;

        for (let i = 0; i < 9; i++) {
            frontPar += this.parValues[i];
            if (this.currentRoundScores[i] !== null) {
                front9Total += this.currentRoundScores[i];
                front9Count++;
            }
        }
        for (let i = 9; i < 18; i++) {
            backPar += this.parValues[i];
            if (this.currentRoundScores[i] !== null) {
                back9Total += this.currentRoundScores[i];
                back9Count++;
            }
        }
        const total = front9Count + back9Count > 0 ? front9Total + back9Total : null;

        // ===== DESKTOP LAYOUT =====
        let desktopHtml = '<div class="desktop-scorecard"><table class="scorecard round-entry">';

        // Header row
        desktopHtml += '<tr><th>Hole</th>';
        for (let i = 1; i <= 9; i++) {
            const isPopHole = this.isPopHole(player.name, i - 1);
            desktopHtml += `<th class="hole-header ${isPopHole ? 'pop-header' : ''}">${i}${isPopHole ? '*' : ''}</th>`;
        }
        desktopHtml += '<th class="subtotal-header">F9</th>';
        for (let i = 10; i <= 18; i++) {
            const isPopHole = this.isPopHole(player.name, i - 1);
            desktopHtml += `<th class="hole-header ${isPopHole ? 'pop-header' : ''}">${i}${isPopHole ? '*' : ''}</th>`;
        }
        desktopHtml += '<th class="subtotal-header">B9</th><th class="gross-header">Total</th></tr>';

        // Par row
        desktopHtml += '<tr class="par-row"><td><strong>Par</strong></td>';
        for (let i = 0; i < 9; i++) desktopHtml += `<td>${this.parValues[i]}</td>`;
        desktopHtml += `<td class="subtotal-cell">${frontPar}</td>`;
        for (let i = 9; i < 18; i++) desktopHtml += `<td>${this.parValues[i]}</td>`;
        desktopHtml += `<td class="subtotal-cell">${backPar}</td>`;
        desktopHtml += `<td><strong>${frontPar + backPar}</strong></td></tr>`;

        // Score entry row
        desktopHtml += `<tr class="entry-row"><td class="player-name">${player.name}</td>`;
        let tabIndex = 1;
        for (let hole = 0; hole < 9; hole++) {
            const score = this.currentRoundScores[hole];
            const isPopHole = this.isPopHole(player.name, hole);
            const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
            const popClass = isPopHole ? 'pop-hole' : '';
            desktopHtml += `<td class="score-cell ${parClass} ${popClass}">
                <input type="text" class="score-input" data-hole="${hole}"
                       value="${score !== null ? score : ''}" tabindex="${tabIndex++}"
                       maxlength="2" inputmode="numeric" pattern="[0-9]*">
            </td>`;
        }
        desktopHtml += `<td class="subtotal-cell">${front9Count > 0 ? front9Total : '—'}</td>`;
        for (let hole = 9; hole < 18; hole++) {
            const score = this.currentRoundScores[hole];
            const isPopHole = this.isPopHole(player.name, hole);
            const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
            const popClass = isPopHole ? 'pop-hole' : '';
            desktopHtml += `<td class="score-cell ${parClass} ${popClass}">
                <input type="text" class="score-input" data-hole="${hole}"
                       value="${score !== null ? score : ''}" tabindex="${tabIndex++}"
                       maxlength="2" inputmode="numeric" pattern="[0-9]*">
            </td>`;
        }
        desktopHtml += `<td class="subtotal-cell">${back9Count > 0 ? back9Total : '—'}</td>`;
        desktopHtml += `<td class="total-cell">${total !== null ? total : '—'}</td></tr>`;
        desktopHtml += '</table></div>';

        // ===== MOBILE LAYOUT (Two stacked tables) =====
        let mobileHtml = '<div class="mobile-scorecard">';

        // Front 9 table
        mobileHtml += '<table class="scorecard scorecard-front round-entry">';
        mobileHtml += '<tr><th>Hole</th>';
        for (let i = 1; i <= 9; i++) {
            const isPopHole = this.isPopHole(player.name, i - 1);
            mobileHtml += `<th class="hole-header ${isPopHole ? 'pop-header' : ''}">${i}${isPopHole ? '*' : ''}</th>`;
        }
        mobileHtml += '<th class="subtotal-header">F9</th></tr>';

        mobileHtml += '<tr class="par-row"><td><strong>Par</strong></td>';
        for (let i = 0; i < 9; i++) mobileHtml += `<td>${this.parValues[i]}</td>`;
        mobileHtml += `<td class="subtotal-cell">${frontPar}</td></tr>`;

        mobileHtml += `<tr class="entry-row"><td class="player-name">${player.name}</td>`;
        for (let hole = 0; hole < 9; hole++) {
            const score = this.currentRoundScores[hole];
            const isPopHole = this.isPopHole(player.name, hole);
            const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
            const popClass = isPopHole ? 'pop-hole' : '';
            mobileHtml += `<td class="score-cell ${parClass} ${popClass}">
                <input type="text" class="score-input" data-hole="${hole}"
                       value="${score !== null ? score : ''}"
                       maxlength="2" inputmode="numeric" pattern="[0-9]*">
            </td>`;
        }
        mobileHtml += `<td class="subtotal-cell">${front9Count > 0 ? front9Total : '—'}</td></tr>`;
        mobileHtml += '</table>';

        // Back 9 table
        mobileHtml += '<table class="scorecard scorecard-back round-entry">';
        mobileHtml += '<tr><th>Hole</th>';
        for (let i = 10; i <= 18; i++) {
            const isPopHole = this.isPopHole(player.name, i - 1);
            mobileHtml += `<th class="hole-header ${isPopHole ? 'pop-header' : ''}">${i}${isPopHole ? '*' : ''}</th>`;
        }
        mobileHtml += '<th class="subtotal-header">B9</th><th class="gross-header">Total</th></tr>';

        mobileHtml += '<tr class="par-row"><td><strong>Par</strong></td>';
        for (let i = 9; i < 18; i++) mobileHtml += `<td>${this.parValues[i]}</td>`;
        mobileHtml += `<td class="subtotal-cell">${backPar}</td>`;
        mobileHtml += `<td><strong>${frontPar + backPar}</strong></td></tr>`;

        mobileHtml += `<tr class="entry-row"><td class="player-name">${player.name}</td>`;
        for (let hole = 9; hole < 18; hole++) {
            const score = this.currentRoundScores[hole];
            const isPopHole = this.isPopHole(player.name, hole);
            const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
            const popClass = isPopHole ? 'pop-hole' : '';
            mobileHtml += `<td class="score-cell ${parClass} ${popClass}">
                <input type="text" class="score-input" data-hole="${hole}"
                       value="${score !== null ? score : ''}"
                       maxlength="2" inputmode="numeric" pattern="[0-9]*">
            </td>`;
        }
        mobileHtml += `<td class="subtotal-cell">${back9Count > 0 ? back9Total : '—'}</td>`;
        mobileHtml += `<td class="total-cell">${total !== null ? total : '—'}</td></tr>`;
        mobileHtml += '</table></div>';

        // Pop holes legend if player has pops
        const popHoles = this.getPopHoles(player.name, 'general');
        let legendHtml = '';
        if (popHoles.length > 0) {
            legendHtml = `<p class="pop-legend">* = Pop hole (Rob gets +1 stroke handicap)</p>`;
        }

        container.innerHTML = desktopHtml + mobileHtml + legendHtml;

        // Setup listeners for the entry inputs
        this.setupRoundEntryListeners();

        // Update submit button state
        this.updateSubmitButtonState();
    }

    setupRoundEntryListeners() {
        document.querySelectorAll('#roundEntryContainer .score-input').forEach(input => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 1) {
                    value = value.slice(-1);
                }
                e.target.value = value;

                const hole = parseInt(e.target.dataset.hole);
                this.currentRoundScores[hole] = value ? parseInt(value) : null;

                // Sync value to other layout's input for same hole
                this.syncEntryInputs(hole, value);

                // Update par class for this cell
                this.updateCellParClass(e.target, hole);

                // Update totals inline (without re-rendering)
                this.updateEntryTotalsInline();
                this.updateSubmitButtonState();

                // Auto-advance for single digits 1-9
                if (value.length === 1 && value >= '1' && value <= '9') {
                    // Use setTimeout to ensure the current input processing completes first
                    setTimeout(() => this.moveToNextEntryCell(hole), 0);
                }
            });

            input.addEventListener('keydown', (e) => {
                const hole = parseInt(e.target.dataset.hole);

                if (e.key === 'Backspace' && e.target.value === '') {
                    e.preventDefault();
                    if (hole > 0) {
                        this.focusEntryCell(hole - 1);
                    }
                    return;
                }

                switch (e.key) {
                    case 'Enter':
                    case 'ArrowRight':
                        e.preventDefault();
                        this.moveToNextEntryCell(hole);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (hole > 0) this.focusEntryCell(hole - 1);
                        break;
                    case 'ArrowUp':
                    case 'ArrowDown':
                        e.preventDefault();
                        // No row navigation in single-player entry
                        break;
                    case 'Tab':
                        // Allow default tab behavior but could customize
                        break;
                    case 'Escape':
                        e.target.blur();
                        break;
                }
            });

            input.addEventListener('focus', (e) => {
                e.target.select();
            });
        });
    }

    moveToNextEntryCell(currentHole) {
        if (currentHole < 17) {
            this.focusEntryCell(currentHole + 1);
        }
    }

    focusEntryCell(hole) {
        // Find the visible input (desktop or mobile layout)
        const inputs = document.querySelectorAll(`#roundEntryContainer .score-input[data-hole="${hole}"]`);
        for (const input of inputs) {
            if (input.offsetParent !== null) {
                input.focus();
                return;
            }
        }
        // Fallback to first input
        if (inputs.length > 0) {
            inputs[0].focus();
        }
    }

    // Sync input values across desktop and mobile layouts
    syncEntryInputs(hole, value) {
        const playerIndex = parseInt(document.getElementById('entryPlayer').value) || 0;
        const player = this.players[playerIndex];
        const inputs = document.querySelectorAll(`#roundEntryContainer .score-input[data-hole="${hole}"]`);

        inputs.forEach(input => {
            input.value = value;
            // Also update par class on the cell
            const cell = input.closest('.score-cell');
            if (cell) {
                cell.classList.remove('birdie', 'eagle', 'bogey', 'double-bogey');
                const score = value ? parseInt(value) : null;
                if (score !== null) {
                    const parClass = this.getParClass(score, this.parValues[hole], player?.name, hole);
                    if (parClass) {
                        cell.classList.add(parClass);
                    }
                }
            }
        });
    }

    updateCellParClass(input, hole) {
        const cell = input.closest('.score-cell');
        if (!cell) return;

        const score = this.currentRoundScores[hole];
        const playerIndex = parseInt(document.getElementById('entryPlayer').value) || 0;
        const player = this.players[playerIndex];

        // Remove existing par classes
        cell.classList.remove('birdie', 'eagle', 'bogey', 'double-bogey');

        // Add new par class if there's a score
        if (score !== null) {
            const parClass = this.getParClass(score, this.parValues[hole], player?.name, hole);
            if (parClass) {
                cell.classList.add(parClass);
            }
        }
    }

    updateEntryTotalsInline() {
        // Calculate totals
        let front9Total = 0, front9Count = 0;
        let back9Total = 0, back9Count = 0;

        for (let i = 0; i < 9; i++) {
            if (this.currentRoundScores[i] !== null) {
                front9Total += this.currentRoundScores[i];
                front9Count++;
            }
        }

        for (let i = 9; i < 18; i++) {
            if (this.currentRoundScores[i] !== null) {
                back9Total += this.currentRoundScores[i];
                back9Count++;
            }
        }

        const totalScore = (front9Count + back9Count) > 0 ? (front9Total + back9Total) : null;

        // Update all entry rows (desktop and mobile layouts)
        document.querySelectorAll('#roundEntryContainer .entry-row').forEach(entryRow => {
            const table = entryRow.closest('table');
            const subtotalCells = entryRow.querySelectorAll('.subtotal-cell');
            const totalCell = entryRow.querySelector('.total-cell');

            // Check if this is a front-9 only table (mobile)
            if (table && table.classList.contains('scorecard-front')) {
                if (subtotalCells.length >= 1) {
                    subtotalCells[0].textContent = front9Count > 0 ? front9Total : '—';
                }
            }
            // Check if this is a back-9 table (mobile)
            else if (table && table.classList.contains('scorecard-back')) {
                if (subtotalCells.length >= 1) {
                    subtotalCells[0].textContent = back9Count > 0 ? back9Total : '—';
                }
                if (totalCell) {
                    totalCell.textContent = totalScore !== null ? totalScore : '—';
                }
            }
            // Desktop table with both F9 and B9
            else {
                if (subtotalCells.length >= 2) {
                    subtotalCells[0].textContent = front9Count > 0 ? front9Total : '—';
                    subtotalCells[1].textContent = back9Count > 0 ? back9Total : '—';
                }
                if (totalCell) {
                    totalCell.textContent = totalScore !== null ? totalScore : '—';
                }
            }
        });
    }

    updateSubmitButtonState() {
        const btn = document.getElementById('submitRoundBtn');
        const hint = document.querySelector('.submit-hint');
        const completedHoles = this.currentRoundScores.filter(s => s !== null).length;

        if (completedHoles === 18) {
            btn.disabled = false;
            btn.classList.add('ready');
            hint.textContent = 'Ready to submit!';
        } else {
            btn.disabled = true;
            btn.classList.remove('ready');
            hint.textContent = `Enter all 18 holes to submit (${completedHoles}/18 completed)`;
        }
    }

    clearCurrentRound() {
        this.currentRoundScores = Array(18).fill(null);
        this.renderRoundEntry();
    }

    // ============================================
    // TAB 2: FANTASY SCORES (Read-Only Best Scores)
    // ============================================
    renderFantasyScorecard() {
        const container = document.getElementById('fantasyScorecardContainer');

        if (this.players.length === 0) {
            container.innerHTML = '<p class="no-data">No players yet. Add some players to get started!</p>';
            return;
        }

        let html = '<table class="scorecard fantasy-scorecard">';

        // Header row
        html += '<tr>';
        html += '<th>Player</th>';
        for (let i = 1; i <= 9; i++) {
            html += `<th class="hole-header">${i}</th>`;
        }
        html += '<th class="subtotal-header">F9</th>';
        for (let i = 10; i <= 18; i++) {
            html += `<th class="hole-header">${i}</th>`;
        }
        html += '<th class="subtotal-header">B9</th>';
        html += '<th class="gross-header">Gross</th>';
        html += '<th class="net-header">Net</th>';
        html += '</tr>';

        // Par row
        html += '<tr class="par-row">';
        html += '<td><strong>Par</strong></td>';
        let frontPar = 0, backPar = 0;
        for (let i = 0; i < 9; i++) {
            html += `<td>${this.parValues[i]}</td>`;
            frontPar += this.parValues[i];
        }
        html += `<td class="subtotal-cell">${frontPar}</td>`;
        for (let i = 9; i < 18; i++) {
            html += `<td>${this.parValues[i]}</td>`;
            backPar += this.parValues[i];
        }
        html += `<td class="subtotal-cell">${backPar}</td>`;
        const totalPar = frontPar + backPar;
        html += `<td><strong>${totalPar}</strong></td>`;
        html += `<td><strong>${totalPar}</strong></td>`;
        html += '</tr>';

        // Player rows (read-only)
        this.players.forEach((player, playerIndex) => {
            html += '<tr>';
            html += `<td class="player-name">
                ${player.name}
                <button class="remove-player" data-player="${playerIndex}">✕</button>
            </td>`;

            let front9Total = 0, front9Count = 0;
            let back9Total = 0, back9Count = 0;

            // Front 9
            for (let hole = 0; hole < 9; hole++) {
                const score = player.scores[hole];
                const isPopHole = this.isPopHole(player.name, hole);
                const netScore = this.getNetScore(player.name, hole, score);

                let displayScore = '';
                if (score !== null) {
                    if (isPopHole) {
                        displayScore = `${netScore} (${score})`;
                    } else {
                        displayScore = score;
                    }
                    front9Total += netScore;
                    front9Count++;
                }

                const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
                const popClass = isPopHole ? 'pop-hole' : '';
                html += `<td class="score-cell readonly ${parClass} ${popClass}">${displayScore || '—'}</td>`;
            }

            html += `<td class="subtotal-cell">${front9Count > 0 ? front9Total : '—'}</td>`;

            // Back 9
            for (let hole = 9; hole < 18; hole++) {
                const score = player.scores[hole];
                const isPopHole = this.isPopHole(player.name, hole);
                const netScore = this.getNetScore(player.name, hole, score);

                let displayScore = '';
                if (score !== null) {
                    if (isPopHole) {
                        displayScore = `${netScore} (${score})`;
                    } else {
                        displayScore = score;
                    }
                    back9Total += netScore;
                    back9Count++;
                }

                const parClass = this.getParClass(score, this.parValues[hole], player.name, hole);
                const popClass = isPopHole ? 'pop-hole' : '';
                html += `<td class="score-cell readonly ${parClass} ${popClass}">${displayScore || '—'}</td>`;
            }

            html += `<td class="subtotal-cell">${back9Count > 0 ? back9Total : '—'}</td>`;

            // Totals
            const grossTotal = this.calculateGrossTotal(player);
            const netTotal = this.calculateTotal(player);
            html += `<td class="total-cell gross-total">${grossTotal !== null ? grossTotal : '—'}</td>`;
            html += `<td class="total-cell net-total">${netTotal !== null ? netTotal : '—'}</td>`;
            html += '</tr>';
        });

        html += '</table>';
        html += '<p class="fantasy-note">Best score per hole from all submitted rounds. Rob\'s pop holes show as "net (gross)".</p>';

        // Add scroll hint for mobile
        const scrollHint = '<p class="scroll-hint">← Swipe to see all holes • Rotate phone for full view →</p>';
        container.innerHTML = scrollHint + html;

        // Add remove player listeners
        document.querySelectorAll('#fantasyScorecardContainer .remove-player').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playerIndex = parseInt(e.target.dataset.player);
                this.removePlayer(playerIndex);
            });
        });

        // Setup scroll indicators
        this.setupScrollIndicators(container);
    }

    setupScrollIndicators(container) {
        const updateScrollIndicators = () => {
            const canScrollLeft = container.scrollLeft > 0;
            const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 5);

            container.classList.toggle('can-scroll-left', canScrollLeft);
            container.classList.toggle('can-scroll-right', canScrollRight);
        };

        container.addEventListener('scroll', updateScrollIndicators);
        // Initial check after render
        setTimeout(updateScrollIndicators, 100);
        // Check again on resize
        window.addEventListener('resize', updateScrollIndicators);
    }

    renderFantasyScoring() {
        const container = document.getElementById('fantasyScores');
        if (!container) return;

        if (this.players.length === 0) {
            container.innerHTML = '<p class="no-data">No players yet.</p>';
            return;
        }

        let html = '';

        this.players.forEach(player => {
            const grossTotal = this.calculateGrossTotal(player);
            const netTotal = this.calculateTotal(player);
            const kickerStatus = this.getKickerStatus(player);
            const kickerDeduction = kickerStatus.used;
            const fantasyNet = netTotal !== null ? netTotal - kickerDeduction : null;
            const confirmedKickers = player.confirmedKickers || [];
            const availableKickers = 2 - kickerStatus.used;

            html += `
                <div class="player-fantasy-card">
                    <h4>${player.name}</h4>
                    <div class="fantasy-row">
                        <span>Gross Total:</span>
                        <span>${grossTotal !== null ? grossTotal : '—'}</span>
                    </div>
                    <div class="fantasy-row">
                        <span>Pop Adjustments:</span>
                        <span>${grossTotal !== null && netTotal !== null ? (netTotal - grossTotal) : '—'}</span>
                    </div>
                    <div class="fantasy-row">
                        <span>Net Total:</span>
                        <span>${netTotal !== null ? netTotal : '—'}</span>
                    </div>
                    <div class="fantasy-row">
                        <span>Kickers Applied:</span>
                        <span class="kicker-deduction">${kickerDeduction > 0 ? '-' + kickerDeduction : '0'}</span>
                    </div>
                    <div class="fantasy-row net-total">
                        <span>Fantasy Score:</span>
                        <span>${fantasyNet !== null ? fantasyNet : '—'}</span>
                    </div>
                    <div class="kicker-badges">
                        ${confirmedKickers.map(k => `<span class="kicker-badge">${this.kickerTypes[k]?.name || k}</span>`).join('')}
                        ${Array(availableKickers).fill('<span class="kicker-badge available">Available</span>').join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // ============================================
    // TAB 3: ROUND HISTORY
    // ============================================
    populateHistoryPlayerFilter() {
        const select = document.getElementById('historyPlayerFilter');
        const currentValue = select.value;

        select.innerHTML = '<option value="all">All Players</option>';
        this.players.forEach(player => {
            select.innerHTML += `<option value="${player.name}">${player.name}</option>`;
        });

        if (currentValue && this.players.some(p => p.name === currentValue)) {
            select.value = currentValue;
        }
    }

    renderHistory() {
        const container = document.getElementById('roundsList');
        const filterValue = document.getElementById('historyPlayerFilter').value;

        let allRounds = [];
        this.players.forEach(player => {
            (player.rounds || []).forEach(round => {
                allRounds.push({
                    ...round,
                    playerName: player.name
                });
            });
        });

        allRounds.sort((a, b) => b.date - a.date);

        if (filterValue !== 'all') {
            allRounds = allRounds.filter(r => r.playerName === filterValue);
        }

        if (allRounds.length === 0) {
            container.innerHTML = '<div class="no-rounds">No rounds submitted yet. Use the Enter Round tab to submit a round.</div>';
            return;
        }

        let html = '';
        allRounds.forEach(round => {
            html += this.renderRoundCard(round);
        });

        container.innerHTML = html;

        // Add edit button listeners
        document.querySelectorAll('.edit-round-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roundId = e.target.dataset.roundId;
                const playerName = e.target.dataset.playerName;
                this.editRound(playerName, roundId);
            });
        });

        // Add delete button listeners
        document.querySelectorAll('.delete-round-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roundId = e.target.dataset.roundId;
                const playerName = e.target.dataset.playerName;
                this.deleteRound(playerName, roundId);
            });
        });
    }

    renderRoundCard(round) {
        const total = round.scores.reduce((a, b) => a + (b || 0), 0);
        const date = new Date(round.date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const confirmedKickers = round.kickers?.confirmed || [];
        const kickerBadges = confirmedKickers.map(k =>
            `<span class="kicker-badge">${this.kickerTypes[k]?.name || k}</span>`
        ).join('');

        let scoresHtml = `
            <div class="round-nine-label">Front 9</div>
            ${Array.from({length: 9}, (_, i) => `<div class="hole-label">${i + 1}</div>`).join('')}
            ${round.scores.slice(0, 9).map(s => `<div class="score-value">${s || '-'}</div>`).join('')}
            <div class="round-nine-label">Back 9</div>
            ${Array.from({length: 9}, (_, i) => `<div class="hole-label">${i + 10}</div>`).join('')}
            ${round.scores.slice(9, 18).map(s => `<div class="score-value">${s || '-'}</div>`).join('')}
        `;

        return `
            <div class="round-card" data-round-id="${round.id}">
                <div class="round-card-header">
                    <span class="round-player">${round.playerName}</span>
                    <span class="round-date">${date}</span>
                </div>
                <div class="round-scores-grid">
                    ${scoresHtml}
                </div>
                <div class="round-footer">
                    <span class="round-total">Total: ${total} (${total > 72 ? '+' : ''}${total - 72})</span>
                    <div class="round-kickers">${kickerBadges}</div>
                    <div class="round-actions">
                        <button class="btn btn-secondary btn-sm edit-round-btn"
                                data-round-id="${round.id}"
                                data-player-name="${round.playerName}">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-sm delete-round-btn"
                                data-round-id="${round.id}"
                                data-player-name="${round.playerName}">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    editRound(playerName, roundId) {
        const player = this.players.find(p => p.name === playerName);
        if (!player) return;

        const round = (player.rounds || []).find(r => r.id === roundId);
        if (!round) return;

        // Load the round into the entry form
        this.currentRoundScores = [...round.scores];

        // Set the player dropdown
        const playerIndex = this.players.indexOf(player);
        document.getElementById('entryPlayer').value = playerIndex;

        // Set the date
        const dateInput = document.getElementById('entryDate');
        dateInput.value = new Date(round.date).toISOString().split('T')[0];

        // Mark that we're editing
        this.editingRound = { playerName, roundId };

        // Switch to enter round tab
        this.switchTab('enterRound');
    }

    deleteRound(playerName, roundId) {
        const player = this.players.find(p => p.name === playerName);
        if (!player) return;

        if (!confirm(`Delete this round for ${playerName}? This will also update their best scores.`)) {
            return;
        }

        // Find and remove the round
        const roundIndex = (player.rounds || []).findIndex(r => r.id === roundId);
        if (roundIndex !== -1) {
            // Check if this round had confirmed kickers and remove them
            const round = player.rounds[roundIndex];
            const confirmedKickers = round.kickers?.confirmed || [];
            confirmedKickers.forEach(kickerId => {
                const idx = player.confirmedKickers.indexOf(kickerId);
                if (idx !== -1) {
                    player.confirmedKickers.splice(idx, 1);
                    player.kickersUsed = Math.max(0, player.kickersUsed - 1);
                }
            });

            player.rounds.splice(roundIndex, 1);

            // Recalculate best scores
            this.recalculateBestScores(player);

            this.saveData();
            this.renderHistory();
        }
    }

    // ============================================
    // ROUND SUBMISSION
    // ============================================
    showRoundSubmissionModal() {
        const completedHoles = this.currentRoundScores.filter(s => s !== null).length;
        if (completedHoles !== 18) {
            alert('Please complete all 18 holes before submitting.');
            return;
        }

        const modal = document.getElementById('roundModal');
        const playerIndex = parseInt(document.getElementById('entryPlayer').value);
        const player = this.players[playerIndex];
        const dateInput = document.getElementById('entryDate');

        // Update modal title based on editing state
        const modalTitle = document.querySelector('#roundModal h3');
        modalTitle.textContent = this.editingRound ? 'Update Round' : 'Confirm Round Submission';

        // Calculate round summary
        const total = this.currentRoundScores.reduce((sum, s) => sum + (s || 0), 0);
        const selectedDate = dateInput.value
            ? new Date(dateInput.value + 'T12:00:00').toLocaleDateString()
            : 'Not selected';

        const summaryHtml = `
            <div class="summary-row">
                <span>Player:</span>
                <span><strong>${player.name}</strong></span>
            </div>
            <div class="summary-row">
                <span>Date:</span>
                <span>${selectedDate}</span>
            </div>
            <div class="summary-row">
                <span>Round Total:</span>
                <span><strong>${total}</strong> (${total > 72 ? '+' : ''}${total - 72})</span>
            </div>
        `;
        document.getElementById('roundSummary').innerHTML = summaryHtml;

        // Detect kickers for this round
        const detectedKickers = this.detectKickers(player, this.currentRoundScores);
        const kickerStatus = this.getKickerStatus(player);

        document.getElementById('kickerStatusText').textContent =
            `${kickerStatus.used}/2 kickers used this year. ${kickerStatus.remaining} remaining.`;

        // Generate detected kickers HTML
        let detectedHtml = '';
        const autoDetectKickers = ['beatPersonalBest', 'holeInOne', 'albatross', 'noDoubleBogeys'];

        autoDetectKickers.forEach(kickerId => {
            const kicker = this.kickerTypes[kickerId];
            const isDetected = detectedKickers.includes(kickerId);
            const canApply = this.canApplyKicker(player, kickerId);
            const alreadyUsed = (player.confirmedKickers || []).includes(kickerId);

            if (isDetected || alreadyUsed) {
                let statusText = '';
                let disabledAttr = '';
                let itemClass = 'kicker-item';

                if (alreadyUsed) {
                    statusText = '<span class="kicker-unavailable">(Already used)</span>';
                    disabledAttr = 'disabled';
                    itemClass += ' disabled';
                } else if (!canApply) {
                    statusText = '<span class="kicker-unavailable">(Max reached)</span>';
                    disabledAttr = 'disabled';
                    itemClass += ' disabled';
                } else if (isDetected) {
                    itemClass += ' detected';
                }

                detectedHtml += `
                    <div class="${itemClass}">
                        <input type="checkbox" id="kicker_${kickerId}" value="${kickerId}" ${disabledAttr}>
                        <label for="kicker_${kickerId}">${kicker.name}</label>
                        <span class="kicker-value">${kicker.value}</span>
                        ${statusText}
                    </div>
                `;
            }
        });

        if (!detectedHtml) {
            detectedHtml = '<p class="no-kickers">No auto-detected kickers for this round.</p>';
        }
        document.getElementById('detectedKickers').innerHTML = detectedHtml;

        // Generate manual kickers HTML
        const fullWedge = this.kickerTypes.fullWedge;
        const canApplyFullWedge = this.canApplyKicker(player, 'fullWedge');
        const fullWedgeUsed = (player.confirmedKickers || []).includes('fullWedge');

        let fullWedgeStatus = '';
        let fullWedgeDisabled = '';
        let fullWedgeClass = 'kicker-item';

        if (fullWedgeUsed) {
            fullWedgeStatus = '<span class="kicker-unavailable">(Already used)</span>';
            fullWedgeDisabled = 'disabled';
            fullWedgeClass += ' disabled';
        } else if (!canApplyFullWedge) {
            fullWedgeStatus = '<span class="kicker-unavailable">(Max reached)</span>';
            fullWedgeDisabled = 'disabled';
            fullWedgeClass += ' disabled';
        }

        document.getElementById('manualKickers').innerHTML = `
            <h5>Manual Kickers</h5>
            <div class="${fullWedgeClass}">
                <input type="checkbox" id="kicker_fullWedge" value="fullWedge" ${fullWedgeDisabled}>
                <label for="kicker_fullWedge">${fullWedge.name}</label>
                <span class="kicker-value">${fullWedge.value}</span>
                ${fullWedgeStatus}
            </div>
        `;

        modal.style.display = 'block';
    }

    confirmRoundSubmission() {
        const playerIndex = parseInt(document.getElementById('entryPlayer').value);
        const player = this.players[playerIndex];
        const dateInput = document.getElementById('entryDate');

        const selectedDate = dateInput.value
            ? new Date(dateInput.value + 'T12:00:00').getTime()
            : Date.now();

        // Get selected kickers
        const selectedKickers = [];
        document.querySelectorAll('#roundModal input[type="checkbox"]:checked').forEach(cb => {
            selectedKickers.push(cb.value);
        });

        // Check if editing existing round
        if (this.editingRound && this.editingRound.playerName === player.name) {
            const existingRound = (player.rounds || []).find(r => r.id === this.editingRound.roundId);
            if (existingRound) {
                existingRound.scores = [...this.currentRoundScores];
                existingRound.date = selectedDate;
                existingRound.kickers.detected = this.detectKickers(player, this.currentRoundScores);

                // Note: We preserve existing confirmed kickers on edit
                this.recalculateBestScores(player);

                this.saveData();
                this.hideRoundModal();
                this.clearCurrentRound();
                this.editingRound = null;
                alert(`Round updated for ${player.name}!`);
                return;
            }
        }

        // Create new round
        const round = {
            id: `round_${Date.now()}`,
            date: selectedDate,
            scores: [...this.currentRoundScores],
            kickers: {
                detected: this.detectKickers(player, this.currentRoundScores),
                confirmed: selectedKickers
            }
        };

        player.rounds = player.rounds || [];
        player.rounds.push(round);

        // Update best scores
        for (let i = 0; i < 18; i++) {
            if (this.currentRoundScores[i] !== null) {
                if (player.scores[i] === null || this.currentRoundScores[i] < player.scores[i]) {
                    player.scores[i] = this.currentRoundScores[i];
                }
            }
        }

        // Apply confirmed kickers
        selectedKickers.forEach(kickerId => {
            this.applyKicker(player, kickerId);
        });

        this.saveData();
        this.hideRoundModal();
        this.clearCurrentRound();
        this.editingRound = null;

        const kickerText = selectedKickers.length > 0
            ? ` with ${selectedKickers.length} kicker(s) applied!`
            : '!';
        alert(`Round saved for ${player.name}${kickerText}`);
    }

    hideRoundModal() {
        document.getElementById('roundModal').style.display = 'none';
    }

    recalculateBestScores(player) {
        const bestScores = Array(18).fill(null);

        (player.rounds || []).forEach(round => {
            for (let i = 0; i < 18; i++) {
                if (round.scores[i] !== null) {
                    if (bestScores[i] === null || round.scores[i] < bestScores[i]) {
                        bestScores[i] = round.scores[i];
                    }
                }
            }
        });

        player.scores = bestScores;
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    calculateTotal(player) {
        let total = 0;
        let hasScores = false;
        for (let hole = 0; hole < 18; hole++) {
            const score = player.scores[hole];
            if (score !== null) {
                hasScores = true;
                total += this.getNetScore(player.name, hole, score);
            }
        }
        return hasScores ? total : null;
    }

    calculateGrossTotal(player) {
        const validScores = player.scores.filter(score => score !== null);
        if (validScores.length === 0) return null;
        return validScores.reduce((sum, score) => sum + score, 0);
    }

    getParClass(score, par, playerName = null, holeIndex = null) {
        if (score === null || par === null) return '';

        let effectiveScore = score;
        if (playerName && holeIndex !== null && this.isPopHole(playerName, holeIndex)) {
            effectiveScore = score - 1;
        }

        const diff = effectiveScore - par;
        if (diff === 0) return '';
        if (diff === -1) return 'birdie';
        if (diff <= -2) return 'eagle';
        if (diff === 1) return 'bogey';
        if (diff >= 2) return 'double-bogey';
        return '';
    }

    getPopHoles(playerName, context = 'general') {
        const config = this.playerConfig[playerName];
        if (!config || !config.pops) return [];
        return context === 'noDoubleBogey'
            ? config.pops.noDoubleBogey || []
            : config.pops.general || [];
    }

    isPopHole(playerName, holeIndex, context = 'general') {
        return this.getPopHoles(playerName, context).includes(holeIndex);
    }

    getNetScore(playerName, holeIndex, grossScore) {
        if (grossScore === null) return null;
        if (this.isPopHole(playerName, holeIndex)) {
            return grossScore - 1;
        }
        return grossScore;
    }

    detectKickers(player, roundScores) {
        const detected = [];
        const config = this.playerConfig[player.name] || {};

        const validScores = roundScores.filter(s => s !== null);
        if (validScores.length !== 18) {
            return detected;
        }

        const total = roundScores.reduce((a, b) => a + (b || 0), 0);
        if (config.personalBest && total < config.personalBest) {
            detected.push('beatPersonalBest');
        }

        if (roundScores.some(s => s === 1)) {
            detected.push('holeInOne');
        }

        for (let i = 0; i < 18; i++) {
            if (roundScores[i] !== null && roundScores[i] === this.parValues[i] - 3) {
                detected.push('albatross');
                break;
            }
        }

        const noDoubleBogeyPopHoles = this.getPopHoles(player.name, 'noDoubleBogey');
        let hasDoubleBogey = false;
        for (let i = 0; i < 18; i++) {
            if (roundScores[i] !== null) {
                const adjustedScore = noDoubleBogeyPopHoles.includes(i)
                    ? roundScores[i] - 1
                    : roundScores[i];
                if (adjustedScore > this.parValues[i] + 1) {
                    hasDoubleBogey = true;
                    break;
                }
            }
        }
        if (!hasDoubleBogey) {
            detected.push('noDoubleBogeys');
        }

        return detected;
    }

    canApplyKicker(player, kickerId) {
        if ((player.kickersUsed || 0) >= 2) {
            return false;
        }
        if ((player.confirmedKickers || []).includes(kickerId)) {
            return false;
        }
        return true;
    }

    applyKicker(player, kickerId) {
        if (!this.canApplyKicker(player, kickerId)) {
            return false;
        }
        player.kickersUsed = (player.kickersUsed || 0) + 1;
        player.confirmedKickers = player.confirmedKickers || [];
        player.confirmedKickers.push(kickerId);
        return true;
    }

    getKickerStatus(player) {
        return {
            used: player.kickersUsed || 0,
            remaining: 2 - (player.kickersUsed || 0),
            confirmed: player.confirmedKickers || []
        };
    }

    // ============================================
    // PLAYER MANAGEMENT
    // ============================================
    showPlayerModal() {
        document.getElementById('playerNameInput').value = '';
        document.getElementById('playerModal').style.display = 'block';
        document.getElementById('playerNameInput').focus();
    }

    hidePlayerModal() {
        document.getElementById('playerModal').style.display = 'none';
    }

    addPlayer() {
        const nameInput = document.getElementById('playerNameInput');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a player name');
            return;
        }

        if (this.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert('A player with this name already exists');
            return;
        }

        this.players.push({
            name: name,
            scores: Array(18).fill(null),
            rounds: [],
            kickersUsed: 0,
            confirmedKickers: []
        });

        this.saveData();
        this.populatePlayerDropdowns();
        this.renderAll();
        this.hidePlayerModal();
    }

    removePlayer(playerIndex) {
        const player = this.players[playerIndex];
        if (confirm(`Are you sure you want to remove ${player.name}? All their scores and rounds will be lost.`)) {
            this.players.splice(playerIndex, 1);
            this.saveData();
            this.populatePlayerDropdowns();
            this.renderAll();
        }
    }

    // ============================================
    // OCR PROCESSING
    // ============================================
    async processScorecard(file) {
        const modal = document.getElementById('ocrModal');
        modal.style.display = 'block';
        document.getElementById('ocrProgress').style.display = 'block';
        document.getElementById('ocrResults').style.display = 'none';

        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                logger: info => {
                    if (info.status === 'recognizing text') {
                        const progress = Math.round(info.progress * 100);
                        document.getElementById('progressFill').style.width = progress + '%';
                    }
                }
            });

            const scores = this.extractScoresFromText(text);
            this.displayOcrResults(scores);

        } catch (error) {
            console.error('OCR Error:', error);
            alert('Failed to process scorecard image. Please try again or enter scores manually.');
            this.hideOcrModal();
        }
    }

    extractScoresFromText(text) {
        console.log('OCR Raw Text:', text);

        const allMatches = text.match(/\b\d+\b/g);
        if (!allMatches) {
            console.log('No numbers found in OCR text');
            return [];
        }

        const numbers = allMatches.map(n => parseInt(n));
        console.log('All numbers found:', numbers);

        const scores = this.extractByAnchorPattern(numbers);
        if (scores.length >= 9) {
            console.log('Anchor strategy succeeded:', scores);
            return scores;
        }

        const lineScores = this.extractByLineAnalysis(text);
        if (lineScores.length >= 9) {
            console.log('Line analysis succeeded:', lineScores);
            return lineScores;
        }

        const groupScores = this.extractByFiltering(numbers);
        if (groupScores.length >= 9) {
            console.log('Filtering strategy succeeded:', groupScores);
            return groupScores;
        }

        console.log('All strategies failed, returning filtered numbers');
        return numbers.filter(n => n >= 1 && n <= 12).slice(0, 18);
    }

    extractByAnchorPattern(numbers) {
        let front9Anchor = -1;
        for (let i = 0; i <= numbers.length - 9; i++) {
            const slice = numbers.slice(i, i + 9);
            if (slice[0] === 1 && slice[8] === 9 && slice.every((n, idx) => n === idx + 1)) {
                front9Anchor = i;
                break;
            }
        }

        let back9Anchor = -1;
        for (let i = 0; i <= numbers.length - 9; i++) {
            const slice = numbers.slice(i, i + 9);
            if (slice[0] === 10 && slice[8] === 18) {
                back9Anchor = i;
                break;
            }
        }

        const scores = [];

        if (front9Anchor !== -1) {
            const scoresStart = front9Anchor + 19;
            if (scoresStart + 9 <= numbers.length) {
                const front9Scores = numbers.slice(scoresStart, scoresStart + 9);
                if (front9Scores.every(s => s >= 1 && s <= 15)) {
                    scores.push(...front9Scores);
                }
            }
        }

        if (scores.length === 9 && back9Anchor !== -1) {
            const scoresStart = back9Anchor + 19;
            if (scoresStart + 9 <= numbers.length) {
                const back9Scores = numbers.slice(scoresStart, scoresStart + 9);
                if (back9Scores.every(s => s >= 1 && s <= 15)) {
                    scores.push(...back9Scores);
                }
            }
        }

        return scores;
    }

    extractByLineAnalysis(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const scores = [];

        for (const line of lines) {
            const nums = line.match(/\b\d+\b/g);
            if (nums && nums.length >= 9) {
                const lineNumbers = nums.map(n => parseInt(n));
                const validScores = lineNumbers.filter(n => n >= 2 && n <= 12);
                if (validScores.length >= 9 && validScores.length <= 10) {
                    const total = validScores.reduce((a, b) => a + b, 0);
                    if (total >= 30 && total <= 65) {
                        scores.push(...validScores.slice(0, 9));
                        if (scores.length >= 18) break;
                    }
                }
            }
        }

        return scores;
    }

    extractByFiltering(numbers) {
        const validScores = numbers.filter(n => n >= 2 && n <= 12);

        if (validScores.length >= 18) {
            const front9 = validScores.slice(0, 9);
            const back9 = validScores.slice(9, 18);
            const total = [...front9, ...back9].reduce((a, b) => a + b, 0);
            if (total >= 65 && total <= 130) {
                return [...front9, ...back9];
            }
        }

        return validScores.slice(0, 18);
    }

    displayOcrResults(scores) {
        document.getElementById('ocrProgress').style.display = 'none';
        document.getElementById('ocrResults').style.display = 'block';

        let html = '<div class="ocr-scores-grid">';

        html += '<div class="ocr-nine"><strong>Front 9</strong></div>';
        for (let i = 0; i < 9; i++) {
            const score = scores[i] || '';
            html += `
                <div class="ocr-hole">
                    <label>Hole ${i + 1}</label>
                    <input type="number" class="ocr-score-input" data-hole="${i}" value="${score}" min="1" max="15">
                </div>
            `;
        }

        html += '<div class="ocr-nine"><strong>Back 9</strong></div>';
        for (let i = 9; i < 18; i++) {
            const score = scores[i] || '';
            html += `
                <div class="ocr-hole">
                    <label>Hole ${i + 1}</label>
                    <input type="number" class="ocr-score-input" data-hole="${i}" value="${score}" min="1" max="15">
                </div>
            `;
        }

        html += '</div>';
        document.getElementById('extractedScores').innerHTML = html;
    }

    applyOcrScores() {
        const inputs = document.querySelectorAll('.ocr-score-input');

        inputs.forEach(input => {
            const hole = parseInt(input.dataset.hole);
            const value = input.value.trim();
            this.currentRoundScores[hole] = value ? parseInt(value) : null;
        });

        this.hideOcrModal();
        this.renderRoundEntry();
    }

    hideOcrModal() {
        document.getElementById('ocrModal').style.display = 'none';
        document.getElementById('scorecardUpload').value = '';
    }

    // ============================================
    // EXPORT/IMPORT
    // ============================================
    exportScores() {
        const data = {
            version: 2,
            exportDate: new Date().toISOString(),
            players: this.players,
            parValues: this.parValues
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fantasy-golf-2026-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importScores(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.players) {
                    if (confirm('This will replace all current data. Continue?')) {
                        this.players = data.players.map(p => this.migratePlayerData(p));
                        if (data.parValues) {
                            this.parValues = data.parValues;
                        }
                        this.saveData();
                        this.renderAll();
                        alert('Data imported successfully!');
                    }
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Failed to import file. Please check the file format.');
            }
        };
        reader.readAsText(file);
        document.getElementById('importUpload').value = '';
    }
}

// Initialize the app
const app = new FantasyGolf();
