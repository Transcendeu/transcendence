import { Router } from '../router/Router';

interface GameHistoryEntry {
  id: number;
  p1_id: number;
  p1_username: string;
  p2_id: number;
  p2_username: string;
  p1_score: number;
  p2_score: number;
  winner_id: number;
  winner_username: string;
  created_at: string;
}

const GAME_HISTORY_URL = process.env.GAME_HISTORY_SERVICE_URL || "https://localhost:8443/games/users"

export class GameHistory {
  private userId!: string;

  constructor(
    private container: HTMLElement,
    private router: Router
  ) {
    const raw = localStorage.getItem('user_data');
    if (!raw) {
      this.renderError('Usuário não autenticado');
      return;
    }

    try {
      const user = JSON.parse(raw) as {
        id: number;
        accessToken: string;
      };
      this.userId = String(user.id);
    } catch {
      this.renderError('Dados do usuário corrompidos');
      return;
    }

    this.render();
    this.loadHistory();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="game-history-content">
        <h2 class="game-history-title">USER GAME HISTORY</h2>
        <div class="game-history-container">
          <table class="game-history-table">
            <thead class="game-history-thead">
              <tr>
                <th class="px-4">User</th>
                <th class="px-4">Points</th>
                <th class="px-4"></th>
                <th class="px-4">Points</th>
                <th class="px-4">User</th>
                <th class="px-4">Winner</th>
              </tr>
            </thead>
            <tbody id="history-body">
              <tr><td colspan="6">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="settings-links">
          <button class="text-button" id="backToMenu">BACK TO MENU</button>
        </div>
      </div>
    `;

    this.container
      .querySelector('#backToMenu')!
      .addEventListener('click', () => this.router.navigate('/'));
  }

  private async loadHistory() {
    const tbody = this.container.querySelector<HTMLTableSectionElement>('#history-body')!;
    tbody.innerHTML = `<tr><td colspan="6">Buscando histórico...</td></tr>`;

    try {
      const res = await fetch(`${GAME_HISTORY_URL}/${this.userId}/history`, {
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user_data')!).accessToken}`
        }
      });

      const rawText = await res.text();
      console.log('[Raw response]:', rawText);

      if (!res.ok) {
        throw new Error(`Status ${res.status} - ${rawText}`);
      }

      // ✅ Correção: o backend retorna um objeto com uma chave "history"
      let history: GameHistoryEntry[] = [];
      try {
        const data = JSON.parse(rawText);
        if (!Array.isArray(data.history)) {
          throw new Error('Formato inesperado de resposta');
        }
        history = data.history;
      } catch (e) {
        console.error('Erro ao parsear JSON:', e);
        tbody.innerHTML = `<tr><td colspan="6">Resposta inválida do servidor</td></tr>`;
        return;
      }

      if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">Nenhuma partida encontrada.</td></tr>`;
        return;
      }

      // ✅ Renderiza cada partida
      tbody.innerHTML = '';
      for (const h of history) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${h.p1_username}</td>
          <td>${h.p1_score}</td>
          <td>vs</td>
          <td>${h.p2_score}</td>
          <td>${h.p2_username}</td>
          <td class="game-history-winner">${h.winner_username}</td>
        `;
        tbody.appendChild(tr);
      }
    } catch (err: any) {
      console.error('Erro no carregamento:', err);
      tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar histórico: ${err.message}</td></tr>`;
    }
  }

  private renderError(msg: string) {
    this.container.innerHTML = `<p class="error">${msg}</p>`;
  }
}
