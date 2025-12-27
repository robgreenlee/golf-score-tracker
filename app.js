// Fantasy Golf 2026 - Main Application
class FantasyGolf {
    constructor() {
        this.players = [];
        this.holes = 18;
        // Moraga Country Club par values (you can update these with actual values)
        this.parValues = [4, 4, 4, 4, 3, 4, 3, 4, 5, 3, 4, 4, 5, 5, 3, 4, 3, 5]; // Moraga CC (Par 72)

        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.render();
    }

    loadData() {
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

    saveData() {
        const data = {
            players: this.players,
            parValues: this.parValues
        };
        localStorage.setItem('fantasyGolf2026', JSON.stringify(data));
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

        // Header row - Hole numbers
        html += '<tr>';
        html += '<th>Player</th>';
        for (let i = 1; i <= this.holes; i++) {
            html += `<th class="hole-header">${i}</th>`;
        }
        html += '<th>Total</th>';
        html += '</tr>';

        // Par row
        html += '<tr class="par-row">';
        html += '<td><strong>Par</strong></td>';
        for (let i = 0; i < this.holes; i++) {
            html += `<td>${this.parValues[i]}</td>`;
        }
        const totalPar = this.parValues.reduce((sum, par) => sum + par, 0);
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

            for (let hole = 0; hole < this.holes; hole++) {
                const score = player.scores[hole];
                const displayScore = score !== null ? score : '';
                html += `<td class="score-cell" data-player="${playerIndex}" data-hole="${hole}">
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
            }

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

            // Only allow numbers
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
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
            // Move to first hole of next player
            this.focusCell(playerIndex + 1, 0);
        }
    }

    moveToPrevCell(playerIndex, hole) {
        const prevHole = hole - 1;
        if (prevHole >= 0) {
            this.focusCell(playerIndex, prevHole);
        } else if (playerIndex > 0) {
            // Move to last hole of previous player
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

            // Extract scores from text
            const scores = this.extractScoresFromText(text);
            this.displayOcrResults(scores);

        } catch (error) {
            console.error('OCR Error:', error);
            alert('Failed to process scorecard image. Please try again or enter scores manually.');
            this.hideOcrModal();
        }
    }

    extractScoresFromText(text) {
        // Look for sequences of numbers that could be golf scores (1-15)
        // This is a simple implementation - you may need to adjust based on actual scorecard format
        const lines = text.split('\n');
        const scores = [];

        // Try to find score patterns
        const scorePattern = /\b([1-9]|1[0-5])\b/g;

        for (const line of lines) {
            const matches = line.match(scorePattern);
            if (matches) {
                scores.push(...matches.map(m => parseInt(m)));
            }
        }

        // Take first 18 valid scores found
        return scores.slice(0, 18);
    }

    displayOcrResults(scores) {
        document.getElementById('ocrProgress').style.display = 'none';
        document.getElementById('ocrResults').style.display = 'block';

        // Populate player select
        const playerSelect = document.getElementById('ocrPlayerSelect');
        playerSelect.innerHTML = this.players.map((p, i) =>
            `<option value="${i}">${p.name}</option>`
        ).join('');

        // Display extracted scores
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

        // Store scores temporarily
        this.tempOcrScores = scores;
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
                // Only update if no score exists or new score is better
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
        document.getElementById('scorecardUpload').value = ''; // Reset file input
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

                // Validate player data
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
        document.getElementById('importUpload').value = ''; // Reset file input
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fantasyGolf = new FantasyGolf();
});
