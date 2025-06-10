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
        let returnHtml: string = '<button id="create-btn">Create New Match</button>';
        if (match) {
          const opponent = match.players.find(name => name !== playerName);
          returnHtml += '<br><button id="join-btn">Join Existing Match</button>';
          returnHtml += `<div>You have an ongoing ${match.local ? 'local match' : `match against ${opponent}`}, it will be forfeit if you create or join a different one</div>`;
        }
        return returnHtml;
      };

      this.container.innerHTML = `
        <div class="match-finder">
          <h2>Online Match</h2>
          ${renderButton(existingMatch)}
          <div class="search-box">
            <input id="player-search" type="text" placeholder="Player name">
            <div>Find a player</div>
            <button id="search-btn">Search</button>
          </div>
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

      this.container.querySelector('#search-btn')?.addEventListener('click', async () => {
        const input = this.container.querySelector('#player-search') as HTMLInputElement;
        const searchName = input.value.trim();
        const resultsDiv = this.container.querySelector('.search-results') || document.createElement('div');
        resultsDiv.className = 'search-results';
        
        if (!searchName) {
          resultsDiv.innerHTML = '<div class="search-message">Please enter a player name</div>';
          if (!this.container.contains(resultsDiv)) this.container.appendChild(resultsDiv);
          return;
        }

        // Store match info in class instance
        const currentMatch = await checkPlayerMatch(searchName);
        resultsDiv.innerHTML = '';

        if (!currentMatch) {
            resultsDiv.innerHTML = `<div class="search-message">No active match found for ${searchName}</div>`;
        } else {
          const isCurrentPlayerInMatch = currentMatch.players.includes(playerName);
          const opponent = currentMatch.players.find(name => name !== searchName);
          if (isCurrentPlayerInMatch) {
            resultsDiv.innerHTML = `
              <div class="search-result">
                <p>You have a match against ${searchName}</p>
                <button id="join-existing-match">
                  Join Match
                </button>
              </div>
            `;
          } else {
            resultsDiv.innerHTML = `
              <div class="search-result">
                <p>Match found ${searchName} ${opponent ? `(vs ${opponent})` : 'waiting for an opponent'}</p>
                <button id="spectate-match">
                  Join as Spectator
                </button>
              </div>
            `;

            if (!opponent || opponent === playerName) {
              const joinButton = document.createElement('button');
              joinButton.id = 'join-new-match';
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
              role: 'player2'
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
