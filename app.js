// Fantasy Golf 2026 - Main Application with Firebase Sync

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
        this.pendingFocus = null; // Track where to restore focus after render

        this.init();
    }

    init() {
        this.setupFirebase();
        this.setupEventListeners();
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
                // Convert Firebase data back to proper format
                this.players = this.convertFromFirebase(data.players);
                if (data.parValues) {
                    this.parValues = data.parValues;
                }
                // Also save to localStorage as backup
                this.saveToLocalStorage();
                this.render();
                this.updateSyncStatus('synced');
            } else {
                // No data in Firebase, load from localStorage or use defaults
                this.loadFromLocalStorage();
                this.render();
                // Push initial data to Firebase
                if (this.players.length > 0) {
                    this.saveToFirebase();
                }
            }
        }, (error) => {
            console.error('Firebase read error:', error);
            this.loadFromLocalStorage();
            this.render();
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

    // Convert players array for Firebase storage (null -> -1)
    convertToFirebase(players) {
        return players.map(player => ({
            name: player.name,
            scores: player.scores.map(score => score === null ? -1 : score)
        }));
    }

    // Convert players array from Firebase (−1 -> null, fix sparse arrays)
    convertFromFirebase(playersData) {
        // Handle if Firebase returns an object instead of array
        const playersArray = Array.isArray(playersData) ? playersData : Object.values(playersData);

        return playersArray.map(player => {
            // Ensure scores is a proper 18-element array
            let scores = Array(18).fill(null);
            if (player.scores) {
                const scoresData = Array.isArray(player.scores) ? player.scores : Object.values(player.scores);
                for (let i = 0; i < 18; i++) {
                    const score = scoresData[i];
                    scores[i] = (score === -1 || score === undefined || score === null) ? null : score;
                }
            }
            return {
                name: player.name,
                scores: scores
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
            this.players = data.players || [];
            if (data.parValues) {
                this.parValues = data.parValues;
            }
        } else {
            // Initialize with default players
            this.players = [
                { name: 'Rob', scores: Array(18).fill(null) },
                { name: 'Drew', scores: Array(18).fill(null) },
                { name: 'Mike', scores: Array(18).fill(null) }
            ];
            this.saveData();
        }
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

        // Tools Dropdown
        document.getElementById('toolsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('toolsMenu').classList.toggle('show');
        });

        // Close dropdown when clicking outside
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
            if (confirm('Are you sure you want to reset ALL scores? This cannot be undone.')) {
                this.players.forEach(player => {
                    player.scores = Array(18).fill(null);
                });
                this.saveData();
                this.render();
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
    }

    render() {
        const container = document.getElementById('scorecardContainer');

        if (this.players.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No players yet. Add some players to get started!</p>';
            return;
        }

        let html = '<table class="scorecard">';

        // Header row - Hole numbers with F9/B9/Total
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
        html += '<th>Total</th>';
        html += '</tr>';

        // Par row with F9/B9 subtotals
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
        html += '</tr>';

        // Player rows
        let tabIndex = 1;
        this.players.forEach((player, playerIndex) => {
            html += '<tr>';
            html += `<td class="player-name">
                ${player.name}
                <button class="remove-player" data-player="${playerIndex}">✕</button>
            </td>`;

            let front9Total = 0, front9Count = 0;
            let back9Total = 0, back9Count = 0;

            // Front 9 holes
            for (let hole = 0; hole < 9; hole++) {
                const score = player.scores[hole];
                const displayScore = score !== null ? score : '';
                const parClass = this.getParClass(score, this.parValues[hole]);
                html += `<td class="score-cell ${parClass}" data-player="${playerIndex}" data-hole="${hole}">
                    <input type="text"
                           class="score-input"
                           data-player="${playerIndex}"
                           data-hole="${hole}"
                           value="${displayScore}"
                           tabindex="${tabIndex}"
                           maxlength="2"
                           inputmode="numeric"
                           pattern="[0-9]*">
                </td>`;
                tabIndex++;
                if (score !== null) {
                    front9Total += score;
                    front9Count++;
                }
            }

            // Front 9 subtotal
            html += `<td class="subtotal-cell">${front9Count > 0 ? front9Total : '—'}</td>`;

            // Back 9 holes
            for (let hole = 9; hole < 18; hole++) {
                const score = player.scores[hole];
                const displayScore = score !== null ? score : '';
                const parClass = this.getParClass(score, this.parValues[hole]);
                html += `<td class="score-cell ${parClass}" data-player="${playerIndex}" data-hole="${hole}">
                    <input type="text"
                           class="score-input"
                           data-player="${playerIndex}"
                           data-hole="${hole}"
                           value="${displayScore}"
                           tabindex="${tabIndex}"
                           maxlength="2"
                           inputmode="numeric"
                           pattern="[0-9]*">
                </td>`;
                tabIndex++;
                if (score !== null) {
                    back9Total += score;
                    back9Count++;
                }
            }

            // Back 9 subtotal
            html += `<td class="subtotal-cell">${back9Count > 0 ? back9Total : '—'}</td>`;

            // Calculate total
            const total = this.calculateTotal(player);
            html += `<td class="total-cell">${total !== null ? total : '—'}</td>`;
            html += '</tr>';
        });

        html += '</table>';
        container.innerHTML = html;

        // Add event listeners to inline score inputs
        this.setupScoreInputListeners();

        // Add click listeners to remove buttons
        document.querySelectorAll('.remove-player').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playerIndex = parseInt(e.target.dataset.player);
                this.removePlayer(playerIndex);
            });
        });

        // Restore focus if there's a pending focus position (e.g., after deleting a score)
        if (this.pendingFocus) {
            this.focusCell(this.pendingFocus.playerIndex, this.pendingFocus.hole);
            this.pendingFocus = null;
        }
    }

    setupScoreInputListeners() {
        document.querySelectorAll('.score-input').forEach(input => {
            // Save on blur
            input.addEventListener('blur', (e) => {
                this.saveInlineScore(e.target);
            });

            // Handle keyboard navigation
            input.addEventListener('keydown', (e) => {
                const playerIndex = parseInt(e.target.dataset.player);
                const hole = parseInt(e.target.dataset.hole);

                // Handle backspace - if empty, go to previous cell (don't auto-clear it)
                if (e.key === 'Backspace' && e.target.value === '') {
                    e.preventDefault();
                    if (hole > 0 || playerIndex > 0) {
                        // Move to previous cell without clearing it
                        if (hole > 0) {
                            this.focusCell(playerIndex, hole - 1);
                        } else if (playerIndex > 0) {
                            this.focusCell(playerIndex - 1, this.holes - 1);
                        }
                    }
                    return;
                }

                // Save before handling navigation
                if (['Enter', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    this.saveInlineScore(e.target);
                }

                switch (e.key) {
                    case 'Enter':
                    case 'ArrowRight':
                        this.moveToNextCell(playerIndex, hole);
                        break;
                    case 'ArrowLeft':
                        this.moveToPrevCell(playerIndex, hole);
                        break;
                    case 'ArrowDown':
                        this.moveToNextPlayer(playerIndex, hole);
                        break;
                    case 'ArrowUp':
                        this.moveToPrevPlayer(playerIndex, hole);
                        break;
                    case 'Escape':
                        e.target.blur();
                        break;
                }
            });

            // Select all text on focus
            input.addEventListener('focus', (e) => {
                e.target.select();
            });

            // Handle input - auto-advance after single digit
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');

                // If multiple digits entered (e.g., typing over existing value),
                // keep only the last digit typed for smooth overwrite behavior
                if (value.length > 1) {
                    value = value.slice(-1);
                }
                e.target.value = value;

                // Auto-advance after entering a single digit (1-9)
                if (value.length === 1 && value >= '1' && value <= '9') {
                    const playerIndex = parseInt(e.target.dataset.player);
                    const hole = parseInt(e.target.dataset.hole);
                    this.saveInlineScore(e.target);
                    this.moveToNextCell(playerIndex, hole);
                }
            });
        });
    }

    saveInlineScore(input) {
        const playerIndex = parseInt(input.dataset.player);
        const hole = parseInt(input.dataset.hole);
        const newValue = input.value.trim();
        const player = this.players[playerIndex];
        const currentScore = player.scores[hole];

        // If empty, clear the score
        if (newValue === '') {
            if (currentScore !== null) {
                player.scores[hole] = null;
                // Set pending focus to previous hole before save triggers re-render
                if (hole > 0) {
                    this.pendingFocus = { playerIndex, hole: hole - 1 };
                } else if (playerIndex > 0) {
                    this.pendingFocus = { playerIndex: playerIndex - 1, hole: this.holes - 1 };
                }
                this.saveData();
                this.updateTotal(playerIndex);
            }
            return;
        }

        const newScore = parseInt(newValue);

        // Validate score
        if (isNaN(newScore) || newScore < 1 || newScore > 15) {
            input.value = currentScore !== null ? currentScore : '';
            return;
        }

        // Only update if it's a new score or better than current best
        if (currentScore === null || newScore <= currentScore) {
            player.scores[hole] = newScore;
            this.saveData();
            this.updateTotal(playerIndex);
        } else {
            // Score is worse - show feedback and revert
            input.value = currentScore;
            input.classList.add('rejected');
            setTimeout(() => input.classList.remove('rejected'), 300);
        }
    }

    updateTotal(playerIndex) {
        const player = this.players[playerIndex];
        const total = this.calculateTotal(player);
        const rows = document.querySelectorAll('.scorecard tr');
        const playerRow = rows[playerIndex + 2]; // +2 for header and par rows
        if (playerRow) {
            const totalCell = playerRow.querySelector('.total-cell');
            if (totalCell) {
                totalCell.textContent = total !== null ? total : '—';
            }
        }
    }

    moveToNextCell(playerIndex, hole) {
        const nextHole = hole + 1;
        if (nextHole < this.holes) {
            this.focusCell(playerIndex, nextHole);
        } else if (playerIndex + 1 < this.players.length) {
            this.focusCell(playerIndex + 1, 0);
        }
    }

    moveToPrevCell(playerIndex, hole) {
        const prevHole = hole - 1;
        if (prevHole >= 0) {
            this.focusCell(playerIndex, prevHole);
        } else if (playerIndex > 0) {
            this.focusCell(playerIndex - 1, this.holes - 1);
        }
    }

    moveToNextPlayer(playerIndex, hole) {
        if (playerIndex + 1 < this.players.length) {
            this.focusCell(playerIndex + 1, hole);
        }
    }

    moveToPrevPlayer(playerIndex, hole) {
        if (playerIndex > 0) {
            this.focusCell(playerIndex - 1, hole);
        }
    }

    focusCell(playerIndex, hole) {
        const input = document.querySelector(`.score-input[data-player="${playerIndex}"][data-hole="${hole}"]`);
        if (input) {
            input.focus();
        }
    }

    calculateTotal(player) {
        const validScores = player.scores.filter(score => score !== null);
        if (validScores.length === 0) return null;
        return validScores.reduce((sum, score) => sum + score, 0);
    }

    // Returns CSS class for score relative to par
    // birdie (1 under) = circle, bogey (1 over) = square, double+ = double shapes
    getParClass(score, par) {
        if (score === null || par === null) return '';
        const diff = score - par;
        if (diff === 0) return ''; // par - no decoration
        if (diff === -1) return 'birdie'; // 1 under par - circle
        if (diff <= -2) return 'eagle'; // 2+ under par - double circle
        if (diff === 1) return 'bogey'; // 1 over par - square
        if (diff >= 2) return 'double-bogey'; // 2+ over par - double square
        return '';
    }

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
            scores: Array(18).fill(null)
        });

        this.saveData();
        this.render();
        this.hidePlayerModal();
    }

    removePlayer(playerIndex) {
        const player = this.players[playerIndex];
        if (confirm(`Are you sure you want to remove ${player.name}? All their scores will be lost.`)) {
            this.players.splice(playerIndex, 1);
            this.saveData();
            this.render();
        }
    }

    // OCR Processing
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

        // Get all numbers from the OCR text in order
        const allMatches = text.match(/\b\d+\b/g);
        if (!allMatches) {
            console.log('No numbers found in OCR text');
            return [];
        }

        const numbers = allMatches.map(n => parseInt(n));
        console.log('All numbers found:', numbers);

        // STRATEGY 1: Find hole number anchors (1-9 and 10-18 sequences)
        const scores = this.extractByAnchorPattern(numbers);
        if (scores.length >= 9) {
            console.log('Anchor strategy succeeded:', scores);
            return scores;
        }

        // STRATEGY 2: Line-by-line analysis
        const lineScores = this.extractByLineAnalysis(text);
        if (lineScores.length >= 9) {
            console.log('Line analysis succeeded:', lineScores);
            return lineScores;
        }

        // STRATEGY 3: Find valid score groups (exclude obvious non-scores)
        const groupScores = this.extractByFiltering(numbers);
        if (groupScores.length >= 9) {
            console.log('Filtering strategy succeeded:', groupScores);
            return groupScores;
        }

        console.log('All strategies failed, returning filtered numbers');
        return numbers.filter(n => n >= 1 && n <= 12).slice(0, 18);
    }

    // Strategy 1: Find 1-9 and 10-18 anchor sequences
    extractByAnchorPattern(numbers) {
        console.log('Starting anchor pattern extraction with', numbers.length, 'numbers');

        // Find front 9 hole numbers: exactly 1,2,3,4,5,6,7,8,9 in sequence
        let front9Anchor = -1;
        for (let i = 0; i <= numbers.length - 9; i++) {
            const slice = numbers.slice(i, i + 9);
            if (slice[0] === 1 && slice[8] === 9 &&
                slice.every((n, idx) => n === idx + 1)) {
                front9Anchor = i;
                break;
            }
        }

        // Find back 9 hole numbers: look for 10 followed by increasing numbers ending in 18
        let back9Anchor = -1;
        for (let i = 0; i <= numbers.length - 9; i++) {
            const slice = numbers.slice(i, i + 9);
            // More lenient: starts with 10, ends with 18, generally increasing
            if (slice[0] === 10 && slice[8] === 18) {
                back9Anchor = i;
                break;
            }
        }

        console.log('Anchors found - Front9:', front9Anchor, 'Back9:', back9Anchor);

        const scores = [];

        // GHIN format: after hole numbers (9) comes par row (9 values + total = 10), then scores (9 values)
        // So scores start at anchor + 9 (holes) + 10 (par + total) = anchor + 19

        if (front9Anchor !== -1) {
            const scoresStart = front9Anchor + 19;
            if (scoresStart + 9 <= numbers.length) {
                const front9Scores = numbers.slice(scoresStart, scoresStart + 9);
                console.log('Front 9 scores candidate:', front9Scores);
                if (front9Scores.every(s => s >= 1 && s <= 15)) {
                    scores.push(...front9Scores);
                }
            }
        }

        // If we have front 9, now find back 9
        if (scores.length === 9) {
            console.log('Front 9 found, searching for back 9...');

            // Calculate where front 9 section ends
            // front9Anchor + 9 (holes) + 10 (par+total) + 9 (scores) + 1 (total) = front9Anchor + 29
            const front9SectionEnd = front9Anchor + 29;

            // Method 1: If we found back 9 anchor, use it
            if (back9Anchor !== -1 && back9Anchor >= front9SectionEnd) {
                const scoresStart = back9Anchor + 19;
                if (scoresStart + 9 <= numbers.length) {
                    const back9Scores = numbers.slice(scoresStart, scoresStart + 9);
                    console.log('Back 9 scores via anchor:', back9Scores);
                    if (back9Scores.every(s => s >= 1 && s <= 15)) {
                        scores.push(...back9Scores);
                        return scores;
                    }
                }
            }

            // Method 2: Scan for back 9 structure starting after front 9
            // Look for a "10" that starts the back 9 hole numbers
            for (let i = front9SectionEnd; i <= numbers.length - 28; i++) {
                if (numbers[i] === 10) {
                    // This might be the start of back 9 holes
                    // Skip 9 hole numbers + 10 par values = 19, then get 9 scores
                    const potentialScores = numbers.slice(i + 19, i + 28);
                    console.log(`Checking back 9 at position ${i}:`, potentialScores);

                    if (potentialScores.length === 9 &&
                        potentialScores.every(s => s >= 1 && s <= 15) &&
                        !potentialScores.every(s => s >= 3 && s <= 5)) { // Not all par values
                        console.log('Found back 9 scores:', potentialScores);
                        scores.push(...potentialScores);
                        return scores;
                    }
                }
            }

            // Method 3: Find any valid 9-score sequence after front 9
            console.log('Trying fallback scan from position', front9SectionEnd);
            for (let i = front9SectionEnd; i <= numbers.length - 9; i++) {
                const candidate = numbers.slice(i, i + 9);

                // Skip hole number sequences (10-18)
                if (candidate[0] >= 10 && candidate[0] <= 18 &&
                    candidate.some(n => n >= 10 && n <= 18)) continue;

                // Skip pure par sequences (all 3-5)
                if (candidate.every(n => n >= 3 && n <= 5)) continue;

                // Skip if contains totals (numbers > 20)
                if (candidate.some(n => n > 15)) continue;

                // Valid score sequence
                if (candidate.every(s => s >= 1 && s <= 15)) {
                    const total = candidate.reduce((a, b) => a + b, 0);
                    // Reasonable 9-hole score total (27-63 for bogey to triple bogey average)
                    if (total >= 27 && total <= 70) {
                        console.log('Found back 9 via fallback scan:', candidate, 'total:', total);
                        scores.push(...candidate);
                        return scores;
                    }
                }
            }
        }

        return scores;
    }

    // Strategy 2: Analyze text line by line
    extractByLineAnalysis(text) {
        const lines = text.split('\n');
        const scoreRows = [];

        for (const line of lines) {
            const matches = line.match(/\b\d+\b/g);
            if (!matches || matches.length < 9) continue;

            const numbers = matches.map(n => parseInt(n));
            const first9 = numbers.slice(0, 9);

            // Skip hole number rows (1-9 or 10-18 sequence)
            if (first9.every((n, i) => n === i + 1)) continue;
            if (first9.every((n, i) => n === i + 10)) continue;

            // Skip par rows (all values 3-5)
            if (first9.every(n => n >= 3 && n <= 5)) continue;

            // This could be a score row - check if values are reasonable
            if (first9.every(n => n >= 1 && n <= 15)) {
                scoreRows.push(first9);
            }
        }

        console.log('Score rows found by line analysis:', scoreRows);

        const scores = [];
        if (scoreRows.length >= 2) {
            scores.push(...scoreRows[0], ...scoreRows[1]);
        } else if (scoreRows.length === 1) {
            scores.push(...scoreRows[0]);
        }

        return scores;
    }

    // Strategy 3: Filter and group numbers
    extractByFiltering(numbers) {
        // Remove obvious non-scores: hole numbers (1-9, 10-18), large totals (>20)
        // Keep numbers that could be golf scores (1-15)

        // First, try to identify and skip the hole/par sections
        // Look for groups of 9 numbers that look like scores

        const validScores = numbers.filter(n => n >= 2 && n <= 12);

        // Golf scores typically cluster: par or worse (4-8 for most holes)
        // Try to find 18 consecutive valid scores
        for (let i = 0; i <= validScores.length - 18; i++) {
            const candidate = validScores.slice(i, i + 18);
            // Check if this looks like a realistic round (total 70-120)
            const total = candidate.reduce((a, b) => a + b, 0);
            if (total >= 65 && total <= 130) {
                return candidate;
            }
        }

        // Just return the first 18 valid-looking scores
        return validScores.slice(0, 18);
    }

    displayOcrResults(scores) {
        document.getElementById('ocrProgress').style.display = 'none';
        document.getElementById('ocrResults').style.display = 'block';

        const playerSelect = document.getElementById('ocrPlayerSelect');
        playerSelect.innerHTML = this.players.map((p, i) =>
            `<option value="${i}">${p.name}</option>`
        ).join('');

        const extractedScoresDiv = document.getElementById('extractedScores');
        if (scores.length === 0) {
            extractedScoresDiv.innerHTML = '<p>No scores detected. Please try a clearer image or enter scores manually.</p>';
        } else {
            let html = '<p>Detected scores (edit if needed):</p>';
            for (let i = 0; i < Math.min(scores.length, 18); i++) {
                html += `
                    <div class="score-item">
                        <span>Hole ${i + 1}:</span>
                        <input type="number" class="ocr-score-input" data-hole="${i}"
                               value="${scores[i]}" min="1" max="15"
                               style="width: 60px; padding: 4px; text-align: center;">
                    </div>
                `;
            }
            extractedScoresDiv.innerHTML = html;
        }
    }

    applyOcrScores() {
        const playerIndex = parseInt(document.getElementById('ocrPlayerSelect').value);
        const scoreInputs = document.querySelectorAll('.ocr-score-input');

        const player = this.players[playerIndex];
        let updatedCount = 0;

        scoreInputs.forEach(input => {
            const hole = parseInt(input.dataset.hole);
            const newScore = parseInt(input.value);

            if (newScore >= 1 && newScore <= 15) {
                const currentScore = player.scores[hole];
                if (currentScore === null || newScore < currentScore) {
                    player.scores[hole] = newScore;
                    updatedCount++;
                }
            }
        });

        this.saveData();
        this.render();
        this.hideOcrModal();

        alert(`Updated ${updatedCount} scores for ${player.name}!`);
    }

    hideOcrModal() {
        document.getElementById('ocrModal').style.display = 'none';
        document.getElementById('scorecardUpload').value = '';
    }

    // Export/Import functionality
    exportScores() {
        const data = {
            players: this.players,
            parValues: this.parValues,
            exportedAt: new Date().toISOString()
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fantasy-golf-${new Date().toISOString().split('T')[0]}.json`;
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

                if (!data.players || !Array.isArray(data.players)) {
                    throw new Error('Invalid file format');
                }

                for (const player of data.players) {
                    if (!player.name || !Array.isArray(player.scores) || player.scores.length !== 18) {
                        throw new Error('Invalid player data');
                    }
                }

                if (confirm(`Import ${data.players.length} player(s)? This will replace your current data.`)) {
                    this.players = data.players;
                    if (data.parValues) {
                        this.parValues = data.parValues;
                    }
                    this.saveData();
                    this.render();
                    alert('Scores imported successfully!');
                }
            } catch (error) {
                alert('Failed to import scores. Please check the file format.');
                console.error('Import error:', error);
            }
        };

        reader.readAsText(file);
        document.getElementById('importUpload').value = '';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fantasyGolf = new FantasyGolf();
});
