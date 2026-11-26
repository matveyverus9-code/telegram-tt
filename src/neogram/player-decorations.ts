// src/neogram/player-decorations.ts

/**
 * NeoGram custom player decorations.
 * Единственный источник кастомного оформления игрока.
 * Родные Avatar и FullNameTitle должны использовать эти данные.
 */

export interface NeoGramPlayerDecorations {
  id?: number | string;
  user_id?: number | string;

  is_verified?: boolean;
  verified?: boolean;

  avatar_frame?: string | null;
  frame?: string | null;

  nickname_gradient?: string | null;
  nickname_color?: string | null;

  nickname_font?: string | null;
  custom_font?: string | null;

  [key: string]: unknown;
}

export interface NeoGramDecoratedPeer {
  id?: string;
  neogram?: NeoGramPlayerDecorations;
  isVerified?: boolean;
  [key: string]: unknown;
}

const GRADIENTS: Record<string, string> = {
  rainbow: 'linear-gradient(90deg,#ff4d4d,#ffb84d,#f9ed69,#6bff95,#55c7ff,#bd69ff)',
  fire: 'linear-gradient(90deg,#ff3d00,#ff9100,#ffeb3b)',
  ocean: 'linear-gradient(90deg,#00c6ff,#0072ff,#8e54e9)',
  purple: 'linear-gradient(90deg,#a18cd1,#fbc2eb)',
  gold: 'linear-gradient(90deg,#bf953f,#fcf6ba,#b38728)',
  emerald: 'linear-gradient(90deg,#11998e,#38ef7d)',
};

const FONTS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, sans-serif',
  rounded: 'ui-rounded, -apple-system, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
};

const FRAME_URLS: Record<string, string> = {};

export function normalizeNeoGramDecorations(
  player: NeoGramPlayerDecorations,
): NeoGramPlayerDecorations {
  return {
    ...player,
    is_verified: player.is_verified === true || player.verified === true,
    avatar_frame: player.avatar_frame || player.frame || null,
    nickname_gradient: player.nickname_gradient || null,
    nickname_color: player.nickname_color || null,
    nickname_font: player.nickname_font || player.custom_font || null,
  };
}

export function attachNeoGramDecorations<T extends NeoGramDecoratedPeer>(
  peer: T,
  player: NeoGramPlayerDecorations,
): T {
  const decorations = normalizeNeoGramDecorations(player);

  return {
    ...peer,
    neogram: decorations,
  };
}

export function getNeoGramVerification(
  peer?: NeoGramDecoratedPeer,
): boolean {
  return peer?.neogram?.is_verified === true;
}

export function getNeoGramNicknameStyle(
  peer?: NeoGramDecoratedPeer,
): Record<string, string> {
  const decorations = peer?.neogram;

  if (!decorations) return {};

  const style: Record<string, string> = {};

  const gradient = decorations.nickname_gradient;

  if (gradient) {
    style.backgroundImage = GRADIENTS[gradient] || gradient;
    style.backgroundClip = 'text';
    style.webkitBackgroundClip = 'text';
    style.webkitTextFillColor = 'transparent';
    style.backgroundSize = '200% auto';
  } else if (decorations.nickname_color) {
    style.color = decorations.nickname_color;
  }

  const font = decorations.nickname_font;

  if (font) {
    style.fontFamily = FONTS[font] || font;
  }

  return style;
}

export function getNeoGramAvatarFrame(
  peer?: NeoGramDecoratedPeer,
): string | undefined {
  const frame = peer?.neogram?.avatar_frame;

  if (!frame) return undefined;

  return FRAME_URLS[frame] || frame;
}

export function registerNeoGramAvatarFrame(
  id: string,
  url: string,
): void {
  if (!id || !url) return;

  FRAME_URLS[id] = url;
}

export function getNeoGramAvatarFrameStyle(
  peer?: NeoGramDecoratedPeer,
): Record<string, string> | undefined {
  const frame = getNeoGramAvatarFrame(peer);

  if (!frame) return undefined;

  return {
    backgroundImage: `url("${frame}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    pointerEvents: 'none',
  };
}

export function getNeoGramDecorationClass(
  peer?: NeoGramDecoratedPeer,
): string {
  const decorations = peer?.neogram;

  if (!decorations) return '';

  return [
    decorations.is_verified ? 'neogram-verified' : '',
    decorations.avatar_frame ? 'neogram-avatar-framed' : '',
    decorations.nickname_gradient ? 'neogram-gradient-name' : '',
    decorations.nickname_font ? 'neogram-custom-font' : '',
  ].filter(Boolean).join(' ');
}
