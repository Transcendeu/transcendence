import { Router } from '../router/Router';
import { GameManager } from './game-component/game-manager';

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
                    <div id="player${i}-error" class="error-message"></div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="tournament-setup">
                <h2>ENTER PLAYER NAMES</h2>
                <form id="playerNamesForm" class="setup-form">
                    ${inputs}
                    <div id="form-error" class="error-message"></div>
                    <button type="submit" class="tournament-button">START TOURNAMENT</button>
                </form>
            </div>
        `;

        const form = document.getElementById('playerNamesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Clear previous errors
                const errorMessages = this.container.querySelectorAll('.error-message');
                errorMessages.forEach(el => {
                    el.textContent = '';
                    el.classList.remove('error-visible');
                });
                
                const playerNames = new Set<string>();
                let hasErrors = false;
                
                // Collect all names and check for duplicates
                for (let i = 1; i <= playerCount; i++) {
                    const input = document.getElementById(`player${i}`) as HTMLInputElement;
                    const errorElement = document.getElementById(`player${i}-error`) as HTMLElement;
                    const name = input.value.trim();
                    
                    if (!name) {
                        errorElement.textContent = 'Name required';
                        errorElement.classList.add('error-visible');
                        input.classList.add('input-error');
                        hasErrors = true;
                        continue;
                    }
                    
                    if (playerNames.has(name)) {
                        errorElement.textContent = 'Name taken';
                        errorElement.classList.add('error-visible');
                        input.classList.add('input-error');
                        hasErrors = true;
                    } else {
                        playerNames.add(name);
                        input.classList.remove('input-error');
                    }
                }
                
                if (hasErrors) {
                    const formError = document.getElementById('form-error') as HTMLElement;
                    formError.textContent = 'Fix errors to continue';
                    formError.classList.add('error-visible');
                    return;
                }
                
                // If no errors, proceed with tournament setup
                this.players = [];
                for (let i = 1; i <= playerCount; i++) {
                    const input = document.getElementById(`player${i}`) as HTMLInputElement;
                    this.players.push({
                        name: input.value.trim(),
                        wins: 0,
                        losses: 0
                    });
                }
                
                this.startTournament();
            });

            // Add real-time validation
            for (let i = 1; i <= playerCount; i++) {
                const input = document.getElementById(`player${i}`) as HTMLInputElement;
                input.addEventListener('input', () => {
                    const errorElement = document.getElementById(`player${i}-error`) as HTMLElement;
                    errorElement.textContent = '';
                    errorElement.classList.remove('error-visible');
                    input.classList.remove('input-error');
                });
            }
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
        //this.container.insertBefore(announcementDiv, gameContainer);
        document.body.appendChild(announcementDiv); // Attach to body instead

        // Countdown
         await new Promise<void>(resolve => {
            let count = 3;
            const countdownSpan = document.getElementById('countdown');
            const interval = setInterval(() => {
            count--;
            if (countdownSpan) countdownSpan.textContent = count.toString();
            if (count === 0) {
                clearInterval(interval);
                // Smooth fade out before removal
                announcementDiv.classList.add('fade-out');
                setTimeout(() => {
                announcementDiv.remove();
                resolve();
                }, 300); // Match the animation duration
            }
            }, 1000);
        });

       const manager = new GameManager(gameContainer, (result) => {
            // Extract winner from the result object
            const winner = result!.matchWinner === 'player1' ? 1 : 2;
            const winningPlayer = winner === 1 ? match.player1 : match.player2;
            const losingPlayer = winner === 1 ? match.player2 : match.player1;
            
            // Update match results with full game data
            match.winner = winningPlayer;
            //match.score = result.finalScore; // Store full score object
            winningPlayer.wins++;
            losingPlayer.losses++;

            // If this completes a round, create next round matches
            const roundMatches = this.matches.filter(m => m.round === this.currentRound);
            if (roundMatches.every(m => m.winner)) {
                this.currentRound++;
                
                // Create next round matches using winners
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

            // Check tournament completion
            if (this.currentMatch === this.matches.length) {
                this.showTournamentResults();
            } else {
                this.showTournamentBracket();
            }
        });
        await manager.initLocal('', match.player1.name, match.player2.name);
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