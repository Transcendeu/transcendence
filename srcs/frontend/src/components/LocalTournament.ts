import { Router } from '../router/Router';
import { PongGame } from './PongGame';

interface Player {
    name: string;
    wins: number;
    losses: number;
}

interface Match {
    player1: Player;
    player2: Player;
    winner?: Player;
    round: number;
}

export class LocalTournament {
    private container: HTMLElement;
    private router: Router;
    private players: Player[] = [];
    private matches: Match[] = [];
    private currentMatch: number = 0;
    private currentRound: number = 1;
    private totalRounds: number = 0;

    constructor(container: HTMLElement, router: Router) {
        this.container = container;
        this.router = router;
        this.showPlayerSetup();
    }

    private showPlayerSetup(): void {
        this.container.innerHTML = `
            <div class="tournament-setup">
                <h2>LOCAL TOURNAMENT SETUP</h2>
                <div class="setup-form">
                    <div class="form-group">
                        <label for="playerCount">Number of Players (4, 8, or 16):</label>
                        <select id="playerCount" class="tournament-select">
                            <option value="4">4 Players</option>
                            <option value="8">8 Players</option>
                            <option value="16">16 Players</option>
                        </select>
                    </div>
                    <button id="startSetup" class="tournament-button">START SETUP</button>
                </div>
            </div>
        `;

        const startSetupBtn = document.getElementById('startSetup');
        if (startSetupBtn) {
            startSetupBtn.addEventListener('click', () => {
                const playerCountSelect = document.getElementById('playerCount') as HTMLSelectElement;
                const playerCount = parseInt(playerCountSelect.value);
                this.showPlayerNameInputs(playerCount);
            });
        }
    }

    private showPlayerNameInputs(playerCount: number): void {
        let inputs = '';
        for (let i = 1; i <= playerCount; i++) {
            inputs += `
                <div class="form-group">
                    <label for="player${i}">Player ${i} Nickname:</label>
                    <input type="text" id="player${i}" required minlength="2" maxlength="15" placeholder="Enter nickname">
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="tournament-setup">
                <h2>ENTER PLAYER NAMES</h2>
                <form id="playerNamesForm" class="setup-form">
                    ${inputs}
                    <button type="submit" class="tournament-button">START TOURNAMENT</button>
                </form>
            </div>
        `;

        const form = document.getElementById('playerNamesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.players = [];
                for (let i = 1; i <= playerCount; i++) {
                    const input = document.getElementById(`player${i}`) as HTMLInputElement;
                    if (input.value.trim()) {
                        this.players.push({
                            name: input.value.trim(),
                            wins: 0,
                            losses: 0
                        });
                    }
                }
                if (this.players.length === playerCount) {
                    this.startTournament();
                }
            });
        }
    }

    private shufflePlayers(): void {
        for (let i = this.players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.players[i], this.players[j]] = [this.players[j], this.players[i]];
        }
    }

    private startTournament(): void {
        this.shufflePlayers();
        this.totalRounds = Math.log2(this.players.length);
        this.currentRound = 1;
        this.matches = [];
        this.currentMatch = 0;

        // Create first round matches
        for (let i = 0; i < this.players.length; i += 2) {
            this.matches.push({
                player1: this.players[i],
                player2: this.players[i + 1],
                round: 1
            });
        }

        this.showTournamentBracket();
    }

    private showTournamentBracket(): void {
        let bracketHTML = '<div class="tournament-bracket">';
        
        // Generate rounds
        for (let round = 1; round <= this.totalRounds; round++) {
            bracketHTML += `
                <div class="round">
                    <h3>Round ${round}</h3>
                    <div class="matches">
            `;

            // Filter matches for this round
            const roundMatches = this.matches.filter(match => match.round === round);
            roundMatches.forEach(match => {
                bracketHTML += `
                    <div class="match ${match === this.matches[this.currentMatch] ? 'current' : ''}">
                        <div class="player ${match.winner === match.player1 ? 'winner' : ''}">${match.player1.name}</div>
                        <div class="vs">VS</div>
                        <div class="player ${match.winner === match.player2 ? 'winner' : ''}">${match.player2.name}</div>
                    </div>
                `;
            });

            bracketHTML += `
                    </div>
                </div>
            `;
        }

        bracketHTML += '</div>';

        this.container.innerHTML = `
            <div class="tournament-view">
                <h2>TOURNAMENT BRACKET</h2>
                ${bracketHTML}
                <div class="tournament-controls">
                    <button id="playMatch" class="tournament-button">PLAY NEXT MATCH</button>
                    <button id="exitTournament" class="tournament-button danger">EXIT TOURNAMENT</button>
                </div>
            </div>
        `;

        this.setupTournamentControls();
    }

    private setupTournamentControls(): void {
        const playMatchBtn = document.getElementById('playMatch');
        const exitTournamentBtn = document.getElementById('exitTournament');

        if (playMatchBtn) {
            playMatchBtn.addEventListener('click', () => {
                if (this.currentMatch < this.matches.length) {
                    this.playMatch(this.matches[this.currentMatch]);
                }
            });
        }

        if (exitTournamentBtn) {
            exitTournamentBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to exit the tournament?')) {
                    this.router.navigate('/');
                }
            });
        }
    }

    private async playMatch(match: Match): Promise<void> {
        this.container.innerHTML = '';
        
        // Create a temporary container for the game
        const gameContainer = document.createElement('div');
        this.container.appendChild(gameContainer);

        // Show match announcement
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'match-announcement';
        announcementDiv.innerHTML = `
            <h2>${match.player1.name} VS ${match.player2.name}</h2>
            <p>Round ${match.round}</p>
            <div class="countdown">Starting in: <span id="countdown">3</span></div>
        `;
        this.container.insertBefore(announcementDiv, gameContainer);

        // Countdown
        await new Promise<void>(resolve => {
            let count = 3;
            const countdownSpan = document.getElementById('countdown');
            const interval = setInterval(() => {
                count--;
                if (countdownSpan) countdownSpan.textContent = count.toString();
                if (count === 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });

        // Start the game
        new PongGame(gameContainer, () => {
            // Update match results
            const winner = 1; // Default to player 1 for now
            const winningPlayer = winner === 1 ? match.player1 : match.player2;
            const losingPlayer = winner === 1 ? match.player2 : match.player1;
            
            match.winner = winningPlayer;
            winningPlayer.wins++;
            losingPlayer.losses++;

            // If this completes a round, create next round matches
            const roundMatches = this.matches.filter(m => m.round === this.currentRound);
            if (roundMatches.every(m => m.winner)) {
                this.currentRound++;
                
                // Create next round matches
                const winners = roundMatches.map(m => m.winner!);
                for (let i = 0; i < winners.length; i += 2) {
                    if (winners[i + 1]) {
                        this.matches.push({
                            player1: winners[i],
                            player2: winners[i + 1],
                            round: this.currentRound
                        });
                    }
                }
            }

            this.currentMatch++;

            // Check if tournament is complete
            if (this.currentMatch === this.matches.length) {
                this.showTournamentResults();
            } else {
                this.showTournamentBracket();
            }
        });
    }

    private showTournamentResults(): void {
        // Find the winner (player with most wins)
        const winner = this.players.reduce((prev, current) => 
            (prev.wins > current.wins) ? prev : current
        );

        this.container.innerHTML = `
            <div class="tournament-results">
                <h2>TOURNAMENT COMPLETE!</h2>
                <div class="winner-announcement">
                    <h3>Winner: ${winner.name}</h3>
                    <p>Wins: ${winner.wins} | Losses: ${winner.losses}</p>
                </div>
                <div class="player-standings">
                    <h3>Final Standings</h3>
                    <div class="standings-list">
                        ${this.players
                            .sort((a, b) => b.wins - a.wins)
                            .map((player, index) => `
                                <div class="standing-item">
                                    <span class="position">${index + 1}</span>
                                    <span class="name">${player.name}</span>
                                    <span class="record">W: ${player.wins} | L: ${player.losses}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
                <button id="returnToMenu" class="tournament-button">RETURN TO MENU</button>
            </div>
        `;

        const returnBtn = document.getElementById('returnToMenu');
        if (returnBtn) {
            returnBtn.addEventListener('click', () => {
                this.router.navigate('/');
            });
        }
    }
} 