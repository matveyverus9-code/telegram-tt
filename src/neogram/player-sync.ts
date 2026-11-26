import { getFragmentInfo } from './api';

import {
  registerNeoGramPlayer,
  registerNeoGramPlayers,
  type NeoGramServerPlayer,
} from './player-peer';

interface PlayerResponse {
  ok?: boolean;
  data?: unknown;
  result?: unknown;
  results?: unknown;
  players?: unknown;
  users?: unknown;
  error?: string;
  [key: string]: unknown;
}

function isPlayer(value: unknown): value is NeoGramServerPlayer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const player = value as Record<string, unknown>;

  return (
    player.telegram_id !== undefined
    || player.tg_id !== undefined
    || player.user_id !== undefined
    || player.id !== undefined
    || typeof player.username === 'string'
    || typeof player.user === 'string'
  );
}

function extractPlayers(response: unknown): NeoGramServerPlayer[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  if (Array.isArray(response)) {
    return response.filter(isPlayer);
  }

  const result = response as PlayerResponse;

  const candidates = [
    result.players,
    result.users,
    result.results,
    result.data,
    result.result,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isPlayer);
    }

    if (isPlayer(candidate)) {
      return [candidate];
    }

    if (candidate && typeof candidate === 'object') {
      const nested = extractPlayers(candidate);

      if (nested.length) return nested;
    }
  }

  return isPlayer(response) ? [response] : [];
}

/**
 * Получает игроков с сервера и регистрирует
 * их оформление в общем кеше NeoGram.
 */
export async function syncNeoGramPlayers(
  query: string,
): Promise<NeoGramServerPlayer[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return [];

  const response = await getFragmentInfo<PlayerResponse>({
    q: normalizedQuery,
  });

  if (response.ok === false) {
    throw new Error(response.error || 'Ошибка получения игроков NeoGram');
  }

  const players = extractPlayers(response);

  registerNeoGramPlayers(players);

  return players;
}

/**
 * Синхронизация одного игрока.
 */
export async function syncNeoGramPlayer(
  identifier: string | number,
): Promise<NeoGramServerPlayer | undefined> {
  const query = String(identifier).trim();

  if (!query) return undefined;

  const players = await syncNeoGramPlayers(query);

  const normalized = query.replace(/^@/, '').toLowerCase();

  const player = players.find((item) => {
    const identifiers = [
      item.telegram_id,
      item.tg_id,
      item.user_id,
      item.id,
      item.username,
      item.user,
      item.phone,
    ];

    return identifiers.some(
      (value) => String(value ?? '')
        .replace(/^@/, '')
        .toLowerCase() === normalized,
    );
  });

  if (player) registerNeoGramPlayer(player);

  return player;
}

/**
 * Регистрирует уже полученные серверные данные
 * без повторного сетевого запроса.
 */
export function applyNeoGramPlayers(
  players: NeoGramServerPlayer[],
): void {
  registerNeoGramPlayers(players);
}

export default syncNeoGramPlayers;
