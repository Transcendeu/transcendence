import { checkPlayerMatch } from "./relay-api";

type MatchRole = 'player1' | 'player2' | 'spectator';
type Match = {
    gameId: string | null;
    role: MatchRole;
};

export class MatchFinder {
    private container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
    }

    public async findMatch(playerName: string): Promise<Match> {
    if (!playerName) throw new Error("Player name required");

    return new Promise(async (resolve ) => {
      const existingMatch = await checkPlayerMatch(playerName);
      const renderButton = (match: typeof existingMatch): string => {
        let returnHtml: string = '<button id="create-btn" class="menu-button">Create New Match</button>';

        if (match) {
          const opponent = match.players?.find(name => name !== playerName);
          returnHtml += '<button id="join-btn" class="menu-button mt-4">Join Existing Match</button>';
          const matchTypeMessage = match.local
            ? 'local match'
            : opponent
              ? `match against ${opponent}`
              : 'match waiting for an opponent';
          returnHtml += `<div class="warning-message mt-4 text-neonCyan text-xs text-center">You have an ongoing ${matchTypeMessage}, it will be forfeit if you create or join a different one</div>`;
        }
        return returnHtml;
      };

      this.container.innerHTML = `
        <div class="match-finder flex flex-col items-center gap-6 p-8 bg-black bg-opacity-80 border-2 border-neonCyan shadow-[0_0_20px_#0ff] max-w-[500px] w-full">
          <h2 class="text-neonCyan text-2xl text-center mb-4">Online Match</h2>
          ${renderButton(existingMatch)}
          <div class="search-box flex flex-col gap-4 w-full">
            <div class="relative mb-6"> <!-- Added mb-6 for more space below the input -->
              <input id="player-search" type="text" placeholder="Player name" 
                class="w-full p-3 bg-black border border-neonCyan text-white font-press text-xs
                focus:outline-none focus:border-neonMagenta focus:shadow-[0_0_15px_rgba(255,0,255,0.4)]">
              <div class="absolute -bottom-5 left-0 text-neonMagenta text-xs">Find a player</div>
            </div>
            <button id="search-btn" class="menu-button">Search</button>
          </div>
            <button id="matchfinder-back-btn" class="back-button mt-6">← Back</button>
        </div>
      `;

      if (existingMatch) {
        this.container.querySelector('#join-btn')?.addEventListener('click', () => {
          resolve({
            gameId: existingMatch.gameId,
            role: existingMatch.players[0] === playerName ? 'player1' : 'player2'
          });
        });
      }
      this.container.querySelector('#create-btn')?.addEventListener('click', () => {
        resolve({
          gameId: null,
          role: 'player1'
        });
      });

      this.container.querySelector('#matchfinder-back-btn')?.addEventListener('click', () => {
        window.history.back(); // or this.router.navigate('/menu')
      });

      this.container.querySelector('#search-btn')?.addEventListener('click', async () => {
        const input = this.container.querySelector('#player-search') as HTMLInputElement;
        const searchName = input.value.trim();
        const resultsDiv = this.container.querySelector('.search-results') || document.createElement('div');
        resultsDiv.className = 'search-results mt-6 w-full max-w-[500px]';
        
        if (!searchName) {
          resultsDiv.innerHTML = '<div class="search-message text-neonCyan text-xs text-center">Please enter a player name</div>';
          if (!this.container.contains(resultsDiv)) this.container.appendChild(resultsDiv);
          return;
        }

        
        const currentMatch = await checkPlayerMatch(searchName);
        resultsDiv.innerHTML = '';

        if (!currentMatch) {
            resultsDiv.innerHTML = `<div class="search-message text-neonCyan text-xs text-center">No active match found for ${searchName}</div>`;
        } else {
          const isCurrentPlayerInMatch = currentMatch.players.includes(playerName);
          const isSearchPlayerSpectating = currentMatch.isSpectator;
          const activePlayers = currentMatch.players;
          if (isCurrentPlayerInMatch) {
            const opponent = activePlayers.find(name => name !== playerName);
            resultsDiv.innerHTML = `
              <div class="search-result p-4 border-2 border-neonCyan bg-black bg-opacity-50 flex flex-col gap-3 shadow-[0_0_10px_#0ff]">
                <p class="text-neonCyan text-sm">You have a match against ${opponent}</p>
                <button id="join-existing-match" class="menu-button">
                  Join Match
                </button>
              </div>
            `;
          } else {
            let matchStatus;
            if (isSearchPlayerSpectating) {
              matchStatus = `${searchName} is spectating`;
            } else if (activePlayers.length === 2) {
              matchStatus = `${activePlayers[0]} vs ${activePlayers[1]}`;
            } else {
              matchStatus = `${searchName} is waiting for an opponent`;
            }

            resultsDiv.innerHTML = `
              <div class="search-result p-4 border-2 border-neonCyan bg-black bg-opacity-50 flex flex-col gap-3 shadow-[0_0_10px_#0ff]">
                <p class="text-neonCyan text-sm">${matchStatus}</p>
                <button id="spectate-match" class="menu-button">
                  Join as Spectator
                </button>
            `;

            if (!isSearchPlayerSpectating && activePlayers.length < 2) {
              const joinButton = document.createElement('button');
              joinButton.id = 'join-new-match';
              joinButton.className = 'menu-button mt-2';
              joinButton.textContent = 'Join as Player';
              resultsDiv.querySelector('.search-result')?.appendChild(joinButton);
            }
          }
        }
        if (!this.container.contains(resultsDiv)) {
          this.container.appendChild(resultsDiv);
        }
        this.container.querySelector('#join-existing-match')?.addEventListener('click', () => {
          if (!currentMatch) return;
          resolve({
            gameId: currentMatch.gameId,
            role: currentMatch.players[0] === playerName ? 'player1' : 'player2'
          });
        });

        this.container.querySelector('#join-new-match')?.addEventListener('click', () => {
            if (!currentMatch) return;
            resolve({
              gameId: currentMatch.gameId,
              role: currentMatch.players[0] === playerName ? 'player1' : 'player2'
            });
        });

        this.container.querySelector('#spectate-match')?.addEventListener('click', () => {
          if (!currentMatch) return;
          resolve({
            gameId: currentMatch.gameId,
            role: 'spectator'
          });
        });
      });
    });
  }
}
