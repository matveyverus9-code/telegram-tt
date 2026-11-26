
import {
  syncNeoGramPlayers,
} from './player-sync';

import type {
  NeoGramServerPlayer,
} from './player-peer';

export interface NeoGramSearchPlayer extends NeoGramServerPlayer {
  telegram_id?: string | number;
  tg_id?: string | number;
  user_id?: string | number;
  id?: string | number;

  username?: string;
  user?: string;

  first_name?: string;
  last_name?: string;
  name?: string;

  phone?: string;
  access_hash?: string | number;
  accessHash?: string | number;
}

function getFirstDefined(
  ...values: unknown[]
): string | number | undefined {
  for (const value of values) {
    if (
      typeof value === 'string'
      || typeof value === 'number'
    ) {
      if (String(value).trim()) {
        return value;
      }
    }
  }

  return undefined;
}

/**
 * Возвращает Telegram ID игрока.
 *
 * Приоритет отдаётся явным Telegram-идентификаторам,
 * а не внутреннему ID записи на сервере.
 */
export function getNeoGramPlayerId(
  player: NeoGramSearchPlayer,
): string | undefined {
  const id = getFirstDefined(
    player.telegram_id,
    player.tg_id,
    player.user_id,
    player.id,
  );

  if (id === undefined) return undefined;

  const normalized = String(id).trim();

  if (!normalized) return undefined;

  return normalized.startsWith('user')
    ? normalized
    : `user${normalized}`;
}

/**
 * Возвращает имя игрока для отображения.
 */
export function getNeoGramPlayerName(
  player: NeoGramSearchPlayer,
): string {
  const fullName = [
    player.first_name,
    player.last_name,
  ]
    .filter((value): value is string => (
      typeof value === 'string' && Boolean(value.trim())
    ))
    .join(' ')
    .trim();

  const name = getFirstDefined(
    player.name,
    fullName,
    player.username,
    player.user,
  );

  return name === undefined
    ? 'Игрок NeoGram'
    : String(name);
}

/**
 * Возвращает username без символа @.
 */
export function getNeoGramPlayerUsername(
  player: NeoGramSearchPlayer,
): string | undefined {
  const username = getFirstDefined(
    player.username,
    player.user,
  );

  if (username === undefined) return undefined;

  return String(username).trim().replace(/^@/, '') || undefined;
}

/**
 * Возвращает номер телефона, если сервер его предоставил.
 */
export function getNeoGramPlayerPhone(
  player: NeoGramSearchPlayer,
): string | undefined {
  const phone = getFirstDefined(player.phone);

  return phone === undefined
    ? undefined
    : String(phone);
}

/**
 * Возвращает access_hash, если сервер его предоставил.
 */
export function getNeoGramPlayerAccessHash(
  player: NeoGramSearchPlayer,
): string | undefined {
  const accessHash = getFirstDefined(
    player.access_hash,
    player.accessHash,
  );

  return accessHash === undefined
    ? undefined
    : String(accessHash);
}

/**
 * Выполняет поиск игроков NeoGram.
 *
 * syncNeoGramPlayers самостоятельно регистрирует
 * полученные серверные декорации в общем кеше.
 */
export async function searchNeoGramPlayers(
  query: string,
): Promise<NeoGramSearchPlayer[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return [];

  return syncNeoGramPlayers(normalizedQuery) as Promise<NeoGramSearchPlayer[]>;
}

/**
 * Проверяет, содержит ли игрок достаточный идентификатор
 * для регистрации как Telegram-пользователь.
 */
export function isNeoGramTelegramPlayer(
  player: NeoGramSearchPlayer,
): boolean {
  return Boolean(
    getNeoGramPlayerId(player)
    || getNeoGramPlayerUsername(player),
  );
}

export default searchNeoGramPlayers;
