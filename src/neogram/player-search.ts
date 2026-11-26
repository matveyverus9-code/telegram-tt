import { searchPlayer } from './api';

interface PlayerInfo {
  id?: string | number;
  user_id?: string | number;
  username?: string;
  user?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  phone?: string;
  [key: string]: unknown;
}

interface SearchResponse {
  ok?: boolean;
  data?: unknown;
  result?: unknown;
  results?: unknown;
  users?: unknown;
  players?: unknown;
  error?: string;
  [key: string]: unknown;
}

const STYLE_ID = 'neogram-player-search-styles';

function createStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;

  style.textContent = `
    .ng-player-search {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ng-player-search-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 48px;
      padding: 0 15px;
      border: 1px solid var(--color-borders);
      border-radius: 13px;
      outline: none;
      background: var(--color-background-secondary);
      color: var(--color-text);
      font: inherit;
      font-size: 15px;
    }

    .ng-player-search-input:focus {
      border-color: var(--color-primary);
    }

    .ng-player-search-input::placeholder {
      color: var(--color-text-secondary);
    }

    .ng-player-search-status {
      padding: 8px 2px;
      color: var(--color-text-secondary);
      font-size: 13px;
    }

    .ng-player-search-results {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .ng-player-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 13px;
      border: 1px solid var(--color-borders);
      border-radius: 13px;
      background: var(--color-background-secondary);
    }

    .ng-player-avatar {
      width: 43px;
      height: 43px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-primary);
      color: white;
      font-size: 19px;
      font-weight: 700;
    }

    .ng-player-info {
      min-width: 0;
      flex: 1;
    }

    .ng-player-name {
      overflow: hidden;
      color: var(--color-text);
      font-size: 15px;
      font-weight: 600;
      text-overflow: ellipsis;
    }

    .ng-player-username {
      margin-top: 4px;
      color: var(--color-text-secondary);
      font-size: 13px;
    }

    .ng-player-id {
      margin-top: 3px;
      color: var(--color-text-secondary);
      font-size: 12px;
    }

    .ng-player-error {
      color: #e05252;
    }
  `;

  document.head.appendChild(style);
}

function getPlayers(response: unknown): PlayerInfo[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const result = response as SearchResponse;

  const candidates = [
    result.data,
    result.results,
    result.result,
    result.users,
    result.players,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is PlayerInfo =>
          !!item && typeof item === 'object',
      );
    }

    if (candidate && typeof candidate === 'object') {
      const nested = getPlayers(candidate);

      if (nested.length > 0) {
        return nested;
      }

      const player = candidate as PlayerInfo;

      if (
        player.id !== undefined ||
        player.user_id !== undefined ||
        player.username ||
        player.user
      ) {
        return [player];
      }
    }
  }

  if (
    result.id !== undefined ||
    result.user_id !== undefined ||
    result.username ||
    result.user
  ) {
    return [result as PlayerInfo];
  }

  return [];
}

function getPlayerName(player: PlayerInfo): string {
  const fullName = [
    player.first_name,
    player.last_name,
  ]
    .filter(Boolean)
    .join(' ');

  return String(
    player.name ||
    fullName ||
    player.username ||
    player.user ||
    'Игрок NeoGram',
  );
}

function getPlayerUsername(player: PlayerInfo): string {
  const username = player.username || player.user;

  if (!username) return 'Юзернейм не указан';

  return `@${String(username).replace(/^@/, '')}`;
}

function getPlayerId(player: PlayerInfo): string {
  const id = player.id ?? player.user_id;

  return id === undefined ? 'ID не указан' : `#${id}`;
}

function createPlayerCard(player: PlayerInfo): HTMLElement {
  const card = document.createElement('article');
  card.className = 'ng-player-card';

  const avatar = document.createElement('div');
  avatar.className = 'ng-player-avatar';

  avatar.textContent = getPlayerName(player)
    .charAt(0)
    .toUpperCase();

  const info = document.createElement('div');
  info.className = 'ng-player-info';

  const name = document.createElement('div');
  name.className = 'ng-player-name';
  name.textContent = getPlayerName(player);

  const username = document.createElement('div');
  username.className = 'ng-player-username';
  username.textContent = getPlayerUsername(player);

  const id = document.createElement('div');
  id.className = 'ng-player-id';
  id.textContent = getPlayerId(player);

  info.append(name, username, id);
  card.append(avatar, info);

  return card;
}

export function createPlayerSearch(): HTMLElement {
  createStyles();

  const root = document.createElement('section');
  root.className = 'ng-player-search';

  const input = document.createElement('input');
  input.className = 'ng-player-search-input';
  input.type = 'search';
  input.placeholder = 'Поиск по @юзу, номеру или #ID';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Поиск игроков');

  const status = document.createElement('div');
  status.className = 'ng-player-search-status';
  status.textContent = 'Найди любого игрока NeoGram';

  const results = document.createElement('div');
  results.className = 'ng-player-search-results';

  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestNumber = 0;

  async function performSearch(query: string): Promise<void> {
    const currentRequest = ++requestNumber;

    if (!query) {
      status.textContent = 'Найди любого игрока NeoGram';
      status.classList.remove('ng-player-error');
      results.replaceChildren();
      return;
    }

    status.textContent = 'Поиск игроков...';
    status.classList.remove('ng-player-error');
    results.replaceChildren();

    try {
      const response = await searchPlayer<SearchResponse>(query);

      if (currentRequest !== requestNumber) return;

      if (response.ok === false) {
        throw new Error(
          response.error || 'Не удалось выполнить поиск',
        );
      }

      const players = getPlayers(response);

      if (players.length === 0) {
        status.textContent = 'Игроки не найдены';
        return;
      }

      status.textContent = `Найдено игроков: ${players.length}`;

      const fragment = document.createDocumentFragment();

      players.forEach((player) => {
        fragment.appendChild(createPlayerCard(player));
      });

      results.replaceChildren(fragment);
    } catch (error) {
      if (currentRequest !== requestNumber) return;

      status.textContent =
        error instanceof Error
          ? error.message
          : 'Ошибка поиска игроков';

      status.classList.add('ng-player-error');
    }
  }

  input.addEventListener('input', () => {
    if (timer) clearTimeout(timer);

    const query = input.value.trim();

    if (!query) {
      requestNumber++;
      void performSearch('');
      return;
    }

    timer = setTimeout(() => {
      void performSearch(query);
    }, 350);
  });

  root.append(input, status, results);

  return root;
}

export default createPlayerSearch;
