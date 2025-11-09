// Fantasy Golf 2026 - Main Application
class FantasyGolf {
    constructor() {
        this.players = [];
        this.holes = 18;
        // Moraga Country Club par values (you can update these with actual values)
        this.parValues = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 4, 3, 4, 4, 3, 5, 4]; // Default par 72

        this.currentEditingPlayer = null;
        this.currentEditingHole = null;

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

        // Score Modal
        document.getElementById('saveScoreBtn').addEventListener('click', () => {
            this.saveScore();
        });

        document.getElementById('cancelScoreBtn').addEventListener('click', () => {
            this.hideScoreModal();
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
        document.getElementById('scoreInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveScore();
            }
        });

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
        this.players.forEach((player, playerIndex) => {
            html += '<tr>';
            html += `<td class="player-name">
                ${player.name}
                <button class="remove-player" data-player="${playerIndex}">✕</button>
            </td>`;

            for (let hole = 0; hole < this.holes; hole++) {
                const score = player.scores[hole];
                const isEmpty = score === null;
                const cellClass = isEmpty ? 'score-cell empty' : 'score-cell';
                const displayScore = isEmpty ? '—' : score;
                html += `<td class="${cellClass}" data-player="${playerIndex}" data-hole="${hole}">${displayScore}</td>`;
            }

            // Calculate total
            const total = this.calculateTotal(player);
            html += `<td class="total-cell">${total !== null ? total : '—'}</td>`;
            html += '</tr>';
        });

        html += '</table>';
        container.innerHTML = html;

        // Add click listeners to score cells
        document.querySelectorAll('.score-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const playerIndex = parseInt(e.target.dataset.player);
                const hole = parseInt(e.target.dataset.hole);
                this.showScoreModal(playerIndex, hole);
            });
        });

        // Add click listeners to remove buttons
        document.querySelectorAll('.remove-player').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const playerIndex = parseInt(e.target.dataset.player);
                this.removePlayer(playerIndex);
            });
        });
    }

    calculateTotal(player) {
        const validScores = player.scores.filter(score => score !== null);
        if (validScores.length === 0) return null;
        return validScores.reduce((sum, score) => sum + score, 0);
    }

    showScoreModal(playerIndex, hole) {
        this.currentEditingPlayer = playerIndex;
        this.currentEditingHole = hole;

        const player = this.players[playerIndex];
        const currentScore = player.scores[hole];
        const holeNumber = hole + 1;

        document.getElementById('modalInfo').textContent =
            `${player.name} - Hole ${holeNumber} (Par ${this.parValues[hole]})` +
            (currentScore ? ` - Current Best: ${currentScore}` : '');

        document.getElementById('scoreInput').value = currentScore || '';
        document.getElementById('scoreModal').style.display = 'block';
        document.getElementById('scoreInput').focus();
    }

    hideScoreModal() {
        document.getElementById('scoreModal').style.display = 'none';
        this.currentEditingPlayer = null;
        this.currentEditingHole = null;
    }

    saveScore() {
        const scoreInput = document.getElementById('scoreInput');
        const newScore = parseInt(scoreInput.value);

        if (!newScore || newScore < 1 || newScore > 15) {
            alert('Please enter a valid score between 1 and 15');
            return;
        }

        const player = this.players[this.currentEditingPlayer];
        const currentScore = player.scores[this.currentEditingHole];

        // Only update if it's a new score or better than current best
        if (currentScore === null || newScore < currentScore) {
            player.scores[this.currentEditingHole] = newScore;
            this.saveData();
            this.render();
            this.hideScoreModal();
        } else {
            if (confirm(`Current best is ${currentScore}. The new score (${newScore}) is not better. Do you want to update anyway?`)) {
                player.scores[this.currentEditingHole] = newScore;
                this.saveData();
                this.render();
                this.hideScoreModal();
            }
        }
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fantasyGolf = new FantasyGolf();
});
