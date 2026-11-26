import {
  attachNeoGramDecorations,
  type NeoGramDecoratedPeer,
  type NeoGramPlayerDecorations,
} from './player-decorations';

export interface NeoGramServerPlayer extends NeoGramPlayerDecorations {
  id?: string | number;
  user_id?: string | number;
  telegram_id?: string | number;
  tg_id?: string | number;
  username?: string;
  user?: string;
  phone?: string;
}

type NativePeer = {
  id?: string | number;
  username?: string;
  phone?: string;
  neogram?: NeoGramPlayerDecorations;
  [key: string]: unknown;
};

const playersByIdentifier = new Map<string, NeoGramServerPlayer>();

function normalizeIdentifier(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim().toLowerCase();

  return normalized || undefined;
}

function getPlayerIdentifiers(
  player: NeoGramServerPlayer,
): string[] {
  const values = [
    player.telegram_id,
    player.tg_id,
    player.user_id,
    player.id,
    player.username,
    player.user,
    player.phone,
  ];

  return values
    .map(normalizeIdentifier)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.startsWith('@') ? value.slice(1) : value);
}

function getPeerIdentifiers(peer: NativePeer): string[] {
  const values = [
    peer.id,
    peer.username,
    peer.phone,
  ];

  return values
    .map(normalizeIdentifier)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.startsWith('@') ? value.slice(1) : value);
}

/**
 * Сохраняет данные игрока, полученные от Cloudflare Worker.
 * Вызывается после успешного поиска или получения профиля.
 */
export function registerNeoGramPlayer(
  player: NeoGramServerPlayer,
): void {
  if (!player || typeof player !== 'object') return;

  const identifiers = getPlayerIdentifiers(player);

  if (!identifiers.length) return;

  identifiers.forEach((identifier) => {
    playersByIdentifier.set(identifier, player);
  });
}

/**
 * Регистрирует список игроков.
 */
export function registerNeoGramPlayers(
  players: NeoGramServerPlayer[],
): void {
  players.forEach(registerNeoGramPlayer);
}

/**
 * Находит серверные данные для существующего Telegram peer.
 */
export function findNeoGramPlayer(
  peer: NativePeer,
): NeoGramServerPlayer | undefined {
  for (const identifier of getPeerIdentifiers(peer)) {
    const player = playersByIdentifier.get(identifier);

    if (player) return player;
  }

  return undefined;
}

/**
 * Добавляет NeoGram-данные к существующему объекту Telegram.
 * Родные поля, фотографии, ID и остальные данные не изменяются.
 */
export function decorateTelegramPeer<T extends NativePeer>(
  peer: T,
): T & NeoGramDecoratedPeer {
  const player = findNeoGramPlayer(peer);

  if (!player) return peer as T & NeoGramDecoratedPeer;

  return attachNeoGramDecorations(
    peer as T & NeoGramDecoratedPeer,
    player,
  );
}

/**
 * Обновляет оформление игрока после изменения настроек на сервере.
 */
export function updateNeoGramPlayer(
  player: NeoGramServerPlayer,
): void {
  registerNeoGramPlayer(player);
}

/**
 * Удаляет локальные серверные данные игрока.
 */
export function clearNeoGramPlayer(
  identifier: string | number,
): void {
  const normalized = normalizeIdentifier(identifier);

  if (!normalized) return;

  playersByIdentifier.delete(
    normalized.startsWith('@')
      ? normalized.slice(1)
      : normalized,
  );
}

/**
 * Полная очистка локального кеша NeoGram.
 */
export function clearNeoGramPlayers(): void {
  playersByIdentifier.clear();
}

/**
 * Получает серверные данные по идентификатору.
 */
export function getNeoGramPlayer(
  identifier: string | number,
): NeoGramServerPlayer | undefined {
  const normalized = normalizeIdentifier(identifier);

  if (!normalized) return undefined;

  return playersByIdentifier.get(
    normalized.startsWith('@')
      ? normalized.slice(1)
      : normalized,
  );
}
