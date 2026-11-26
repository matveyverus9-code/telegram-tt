
import {
  attachNeoGramDecorations,
  normalizeNeoGramDecorations,
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

/**
 * Нормализует идентификатор.
 * Убирает @ у username и поддерживает варианты user123 / 123.
 */
function normalizeIdentifier(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  let normalized = String(value).trim().toLowerCase();

  if (!normalized) return undefined;

  if (normalized.startsWith('@')) {
    normalized = normalized.slice(1);
  }

  return normalized || undefined;
}

/**
 * Возвращает варианты идентификатора.
 *
 * Telegram peer может иметь ID вида user123,
 * а сервер NeoGram может прислать просто 123.
 */
function getIdentifierVariants(value: unknown): string[] {
  const normalized = normalizeIdentifier(value);

  if (!normalized) return [];

  const variants = new Set<string>([normalized]);

  const userIdMatch = normalized.match(/^user(\d+)$/);

  if (userIdMatch) {
    variants.add(userIdMatch[1]);
  } else if (/^\d+$/.test(normalized)) {
    variants.add(`user${normalized}`);
  }

  return Array.from(variants);
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

  return Array.from(new Set(
    values.flatMap(getIdentifierVariants),
  ));
}

function getPeerIdentifiers(peer: NativePeer): string[] {
  const values = [
    peer.id,
    peer.username,
    peer.phone,
  ];

  return Array.from(new Set(
    values.flatMap(getIdentifierVariants),
  ));
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
  if (!Array.isArray(players)) return;

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
 *
 * Приоритет:
 * 1. Декорации, уже вложенные сервером в peer.neogram.
 * 2. Данные игрока из локального кеша.
 *
 * Родные поля, фотографии, ID и остальные данные не изменяются.
 */
export function decorateTelegramPeer<T extends NativePeer>(
  peer: T,
): T & NeoGramDecoratedPeer {
  const cachedPlayer = findNeoGramPlayer(peer);
  const serverDecorations = peer.neogram;

  if (!cachedPlayer && !serverDecorations) {
    return peer as T & NeoGramDecoratedPeer;
  }

  const decorations: NeoGramPlayerDecorations = {
    ...(cachedPlayer || {}),
    ...(serverDecorations || {}),
  };

  return attachNeoGramDecorations(
    peer as T & NeoGramDecoratedPeer,
    decorations,
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
  const variants = getIdentifierVariants(identifier);

  variants.forEach((variant) => {
    playersByIdentifier.delete(variant);
  });
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
  for (const variant of getIdentifierVariants(identifier)) {
    const player = playersByIdentifier.get(variant);

    if (player) return player;
  }

  return undefined;
}
