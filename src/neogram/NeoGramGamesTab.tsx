import React, {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  apiGet,
  apiPost,
} from './api';

type GameSection = 'tap' | 'mouse' | 'clans' | 'leaders' | 'cases' | 'crash';
type LeaderboardType = 'taps' | 'mouse' | 'clans' | 'wealth';

interface GamePlayer {
  id: number;
  username?: string;
  name?: string;
  avatar?: string;
  score?: number;
  taps?: number;
  level?: number;
  gram?: number;
  is_creator?: number;
  is_creator_badge?: number;
  [key: string]: unknown;
}

interface MouseState {
  level: number;
  experience: number;
  coins: number;
  attack: number;
  defense: number;
  shield_until?: number;
  traps?: number;
  revenge_available?: boolean;
  [key: string]: unknown;
}

interface Clan {
  id: number;
  name: string;
  tag?: string;
  members?: number;
  level?: number;
  treasury?: number;
  points?: number;
  is_mine?: boolean;
  shield_level?: number;
  [key: string]: unknown;
}

interface GameCase {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  color?: string;
}

interface GameInventoryItem {
  id: number;
  name: string;
  rarity?: string;
  image?: string;
  value?: number;
}

interface GameData {
  taps?: number;
  total_taps?: number;
  tap_balance?: number;
  tap_power?: number;
  mouse?: MouseState;
  clan?: Clan | null;
  clans?: Clan[];
  leaders?: GamePlayer[];
  inventory?: GameInventoryItem[];
  cases?: GameCase[];
  [key: string]: unknown;
}

interface NeoGramGamesTabProps {
  className?: string;
}

const LEADERBOARDS: Array<{
  id: LeaderboardType;
  label: string;
  icon: string;
}> = [
  { id: 'taps', label: 'Тапы', icon: '👆' },
  { id: 'mouse', label: 'Мышки', icon: '🐭' },
  { id: 'clans', label: 'Кланы', icon: '⚔️' },
  { id: 'wealth', label: 'GRAM', icon: '💎' },
];

const DEFAULT_CASES: GameCase[] = [
  {
    id: 'rubup-basic',
    name: 'RubUP Basic',
    price: 100,
    description: 'Стандартный кейс',
    color: '#4787c9',
  },
  {
    id: 'rubup-rare',
    name: 'RubUP Rare',
    price: 500,
    description: 'Повышенный шанс редких предметов',
    color: '#9055dc',
  },
  {
    id: 'rubup-epic',
    name: 'RubUP Epic',
    price: 1500,
    description: 'Эпические предметы',
    color: '#d34f9c',
  },
  {
    id: 'rubup-legendary',
    name: 'RubUP Legendary',
    price: 5000,
    description: 'Легендарный RubUP',
    color: '#d49b36',
  },
];

const INITIAL_MOUSE: MouseState = {
  level: 1,
  experience: 0,
  coins: 0,
  attack: 1,
  defense: 1,
  traps: 0,
};

const styles = `
.ng-games {
  --ng-game-card: var(--color-background-secondary);
  --ng-game-border: var(--color-borders);
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text);
  background: var(--color-background);
  font-family: inherit;
  box-sizing: border-box;
}

.ng-games *,
.ng-games *::before,
.ng-games *::after {
  box-sizing: border-box;
}

.ng-games button,
.ng-games input {
  font: inherit;
}

.ng-games button {
  -webkit-tap-highlight-color: transparent;
}

.ng-games__header {
  flex-shrink: 0;
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--color-borders);
}

.ng-games__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ng-games__title {
  margin: 0;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -.5px;
}

.ng-games__subtitle {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.ng-games__balance {
  padding: 8px 11px;
  border: 1px solid var(--color-borders);
  border-radius: 12px;
  background: var(--color-background-secondary);
  font-size: 12px;
  font-weight: 750;
}

.ng-games__tabs {
  display: flex;
  flex-shrink: 0;
  gap: 5px;
  overflow-x: auto;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-borders);
  scrollbar-width: none;
}

.ng-games__tabs::-webkit-scrollbar {
  display: none;
}

.ng-games__tab {
  min-height: 38px;
  flex-shrink: 0;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.ng-games__tab--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-background);
}

.ng-games__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 14px 13px calc(24px + env(safe-area-inset-bottom));
}

.ng-games__card {
  margin-bottom: 12px;
  padding: 15px;
  border: 1px solid var(--color-borders);
  border-radius: 17px;
  background: var(--color-background-secondary);
}

.ng-games__card-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 800;
}

.ng-games__muted {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.ng-games__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-bottom: 12px;
}

.ng-games__stat {
  padding: 12px;
  border: 1px solid var(--color-borders);
  border-radius: 13px;
  background: var(--color-background);
}

.ng-games__stat-label {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-games__stat-value {
  margin-top: 5px;
  font-size: 21px;
  font-weight: 850;
  overflow-wrap: anywhere;
}

.ng-games__tap-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 17px 0 12px;
}

.ng-games__tap-button {
  width: min(230px, 65vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 7px solid rgba(255,255,255,.13);
  border-radius: 50%;
  color: white;
  background: radial-gradient(circle at 35% 25%, #76b8ff, #3979d4 60%, #2451a6);
  box-shadow: 0 12px 35px rgba(48, 113, 207, .27), inset 0 3px 12px rgba(255,255,255,.2);
  font-size: 78px;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  transition: transform .07s ease;
}

.ng-games__tap-button:active {
  transform: scale(.93);
}

.ng-games__tap-caption {
  margin-top: 15px;
  font-size: 13px;
  font-weight: 750;
}

.ng-games__sync {
  margin-top: 7px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-games__progress {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 20px;
  background: var(--color-borders);
}

.ng-games__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width .2s ease;
}

.ng-games__button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid var(--color-borders);
  border-radius: 11px;
  color: var(--color-text);
  background: var(--color-background);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.ng-games__button--primary {
  border-color: transparent;
  color: white;
  background: var(--color-primary);
}

.ng-games__button:disabled {
  opacity: .45;
  cursor: default;
}

.ng-games__button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ng-games__mouse {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 170px;
  font-size: 100px;
  filter: drop-shadow(0 10px 14px rgba(0,0,0,.12));
}

.ng-games__upgrade {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--color-borders);
}

.ng-games__upgrade-icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--color-background);
  font-size: 22px;
}

.ng-games__upgrade-info {
  flex: 1;
  min-width: 0;
}

.ng-games__upgrade-name {
  font-size: 13px;
  font-weight: 750;
}

.ng-games__upgrade-description {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-games__upgrade-price {
  margin-top: 4px;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 800;
}

.ng-games__clan-banner {
  padding: 19px;
  border-radius: 16px;
  color: white;
  background: linear-gradient(130deg, #253d6d, #576eb5);
}

.ng-games__clan-name {
  font-size: 22px;
  font-weight: 850;
}

.ng-games__clan-tag {
  margin-top: 4px;
  opacity: .8;
  font-size: 12px;
}

.ng-games__clan-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 18px;
}

.ng-games__clan-stat strong {
  display: block;
  font-size: 18px;
}

.ng-games__clan-stat span {
  font-size: 10px;
  opacity: .8;
}

.ng-games__clan-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-borders);
}

.ng-games__clan-row:last-child {
  border-bottom: 0;
}

.ng-games__clan-info {
  flex: 1;
  min-width: 0;
}

.ng-games__clan-info strong {
  display: block;
  font-size: 13px;
}

.ng-games__clan-info span {
  display: block;
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.ng-games__shield {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(70, 160, 255, .3);
  border-radius: 14px;
  background: var(--color-background);
}

.ng-games__shield-icon {
  font-size: 36px;
}

.ng-games__leader-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin-bottom: 12px;
}

.ng-games__leader-tab {
  flex: 1;
  min-width: 64px;
  padding: 9px 5px;
  border: 1px solid var(--color-borders);
  border-radius: 10px;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
}

.ng-games__leader-tab--active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.ng-games__leader-row {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 59px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-borders);
}

.ng-games__rank {
  width: 25px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 850;
}

.ng-games__rank--1 {
  color: #d7a632;
}

.ng-games__rank--2 {
  color: #929eaf;
}

.ng-games__rank--3 {
  color: #b87849;
}

.ng-games__leader-avatar {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-background-secondary);
  font-weight: 800;
}

.ng-games__leader-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ng-games__leader-info {
  flex: 1;
  min-width: 0;
}

.ng-games__leader-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.ng-games__leader-info span {
  display: block;
  margin-top: 3px;
  color: var(--color-text-secondary);
  font-size: 10px;
}

.ng-games__leader-score {
  font-size: 13px;
  font-weight: 850;
  text-align: right;
}

.ng-games__cases {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ng-games__case {
  min-width: 0;
  padding: 13px 10px;
  border: 1px solid var(--color-borders);
  border-radius: 14px;
  background: var(--color-background);
  text-align: center;
}

.ng-games__case-art {
  min-height: 93px;
  display: grid;
  place-items: center;
  margin-bottom: 8px;
  border-radius: 11px;
  font-size: 48px;
  background: var(--color-background-secondary);
}

.ng-games__case-name {
  font-size: 12px;
  font-weight: 850;
}

.ng-games__case-price {
  margin: 5px 0 9px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
}

.ng-games__inventory-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-borders);
}

.ng-games__inventory-art {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 11px;
  background: var(--color-background);
  font-size: 23px;
}

.ng-games__inventory-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ng-games__inventory-name {
  flex: 1;
  font-size: 12px;
  font-weight: 750;
}

.ng-games__rarity {
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
}

.ng-games__crash-display {
  padding: 28px 10px;
  border-radius: 15px;
  background: var(--color-background);
  text-align: center;
}

.ng-games__multiplier {
  font-size: clamp(42px, 12vw, 65px);
  font-weight: 900;
  letter-spacing: -2px;
}

.ng-games__multiplier--crashed {
  color: #e45b68;
}

.ng-games__bet-input {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--color-borders);
  border-radius: 11px;
  outline: none;
  color: var(--color-text);
  background: var(--color-background);
  font-size: 14px;
}

.ng-games__bet-input:focus {
  border-color: var(--color-primary);
}

.ng-games__notice {
  margin: 10px 0;
  padding: 11px;
  border-radius: 10px;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.ng-games__message {
  padding: 24px 12px;
  color: var(--color-text-secondary);
  text-align: center;
  font-size: 12px;
}

.ng-games__error {
  margin: 10px 0;
  padding: 11px;
  border: 1px solid rgba(220, 80, 80, .25);
  border-radius: 10px;
  color: #d75c65;
  font-size: 12px;
  line-height: 1.4;
}

.ng-games__loading {
  min-height: 130px;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .ng-games__tap-button,
  .ng-games__progress-fill {
    transition: none;
  }
}
`;

function numberFormat(value: number | undefined): string {
  return Math.floor(Number(value) || 0).toLocaleString('ru-RU');
}

function getPlayerName(player: GamePlayer): string {
  return player.name
    || (player.username ? `@${player.username.replace(/^@/, '')}` : '')
    || `Игрок ${player.id}`;
}

function isCreator(player: GamePlayer): boolean {
  return Number(player.is_creator || player.is_creator_badge) === 1;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') {
      return 'Войдите в NeoGram, чтобы играть.';
    }
    if (error.message === 'NEOGRAM_SERVER_UNAVAILABLE') {
      return 'Сервер временно недоступен.';
    }
    return error.message;
  }
  return 'Не удалось выполнить запрос.';
}

function extractList<T>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) return response as T[];

  if (!response || typeof response !== 'object') return [];

  const data = response as Record<string, unknown>;

  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key] as T[];
  }

  if (data.data && typeof data.data === 'object') {
    return extractList<T>(data.data, keys);
  }

  return [];
}

export default function NeoGramGamesTab({
  className,
}: NeoGramGamesTabProps) {
  const [section, setSection] = useState<GameSection>('tap');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [game, setGame] = useState<GameData>({});
  const [pendingTaps, setPendingTaps] = useState(0);
  const [tapSending, setTapSending] = useState(false);
  const tapQueue = useRef(0);
  const tapInFlight = useRef(false);

  const [mouse, setMouse] = useState<MouseState>(INITIAL_MOUSE);
  const [mouseBusy, setMouseBusy] = useState(false);

  const [clans, setClans] = useState<Clan[]>([]);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [clanName, setClanName] = useState('');
  const [clanBusy, setClanBusy] = useState(false);

  const [leaderType, setLeaderType] = useState<LeaderboardType>('taps');
  const [leaders, setLeaders] = useState<GamePlayer[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  const [cases, setCases] = useState<GameCase[]>(DEFAULT_CASES);
  const [inventory, setInventory] = useState<GameInventoryItem[]>([]);
  const [caseBusy, setCaseBusy] = useState(false);

  const [bet, setBet] = useState('100');
  const [crashMultiplier, setCrashMultiplier] = useState(1);
  const [crashStatus, setCrashStatus] = useState<'idle' | 'running' | 'crashed' | 'cashed'>('idle');
  const [crashBetId, setCrashBetId] = useState<string | number | null>(null);
  const [crashResult, setCrashResult] = useState<number | null>(null);
  const crashPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  const balance = Number(game.tap_balance ?? game.gram ?? 0);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiGet<GameData>('/games');

      if (response.ok === false) {
        throw new Error(String(response.error || 'GAMES_LOAD_FAILED'));
      }

      setGame(response);

      if (response.mouse) setMouse({
        ...INITIAL_MOUSE,
        ...response.mouse,
      });

      if (response.clan) setMyClan(response.clan);
      if (Array.isArray(response.clans)) setClans(response.clans);
      if (Array.isArray(response.inventory)) {
        setInventory(response.inventory as GameInventoryItem[]);
      }
      if (Array.isArray(response.cases)) {
        setCases(response.cases as GameCase[]);
      }
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGame();

    return () => {
      if (crashPoll.current) clearInterval(crashPoll.current);
    };
  }, [loadGame]);

  const flushTaps = useCallback(async () => {
    if (tapInFlight.current || tapQueue.current <= 0) return;

    tapInFlight.current = true;
    const batch = tapQueue.current;
    tapQueue.current = 0;
    setTapSending(true);

    try {
      const response = await apiPost<{
        ok?: boolean;
        taps?: number;
        total_taps?: number;
        tap_balance?: number;
        balance?: number;
      }>('/games/tap', {
        taps: batch,
        count: batch,
      });

      if (response.ok === false) {
        throw new Error('TAP_REJECTED');
      }

      setGame((current) => ({
        ...current,
        taps: Number(response.taps ?? current.taps ?? 0),
        total_taps: Number(response.total_taps ?? current.total_taps ?? 0),
        tap_balance: Number(response.tap_balance ?? response.balance ?? current.tap_balance ?? 0),
      }));
    } catch (requestError) {
      tapQueue.current += batch;
      setError(errorText(requestError));
    } finally {
      tapInFlight.current = false;
      setPendingTaps(tapQueue.current);
      setTapSending(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flushTaps();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [flushTaps]);

  const handleTap = useCallback(() => {
    tapQueue.current += Math.max(1, Number(game.tap_power || 1));
    setPendingTaps(tapQueue.current);
  }, [game.tap_power]);

  const mouseAction = useCallback(async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (mouseBusy) return;

    setMouseBusy(true);
    setError('');

    try {
      const response = await apiPost<{
        ok?: boolean;
        mouse?: MouseState;
        data?: MouseState;
        [key: string]: unknown;
      }>(`/games/mouse/${action}`, payload);

      if (response.ok === false) {
        throw new Error(String(response.error || 'MOUSE_ACTION_FAILED'));
      }

      const updated = response.mouse || response.data;

      if (updated && typeof updated === 'object') {
        setMouse((current) => ({ ...current, ...updated }));
      } else {
        const refreshed = await apiGet<GameData>('/games/mouse');
        if (refreshed.mouse) setMouse((current) => ({
          ...current,
          ...refreshed.mouse,
        }));
      }

      await loadGame();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setMouseBusy(false);
    }
  }, [mouseBusy, loadGame]);

  const loadClans = useCallback(async () => {
    try {
      const response = await apiGet<unknown>('/games/clans');
      const list = extractList<Clan>(response, ['clans', 'items', 'results']);
      setClans(list);

      if (response && typeof response === 'object') {
        const data = response as Record<string, unknown>;
        if (data.clan && typeof data.clan === 'object') {
          setMyClan(data.clan as Clan);
        }
      }
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, []);

  useEffect(() => {
    if (section === 'clans') void loadClans();
  }, [section, loadClans]);

  const clanAction = useCallback(async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (clanBusy) return;

    setClanBusy(true);
    setError('');

    try {
      const response = await apiPost<{
        ok?: boolean;
        clan?: Clan | null;
        clans?: Clan[];
        data?: Clan;
        [key: string]: unknown;
      }>(`/games/clans/${action}`, payload);

      if (response.ok === false) {
        throw new Error(String(response.error || 'CLAN_ACTION_FAILED'));
      }

      if (response.clan !== undefined) setMyClan(response.clan);
      else if (response.data) setMyClan(response.data);

      await loadClans();
      await loadGame();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setClanBusy(false);
    }
  }, [clanBusy, loadClans, loadGame]);

  const loadLeaders = useCallback(async (type: LeaderboardType) => {
    setLeadersLoading(true);
    setError('');

    try {
      const response = await apiGet<unknown>('/games/leaderboard', {
        type,
        category: type,
        limit: 50,
      });

      const list = extractList<GamePlayer>(response, [
        'leaders',
        'players',
        'leaderboard',
        'items',
        'results',
      ]);

      setLeaders(list.filter((player) => !isCreator(player)));
    } catch (requestError) {
      setLeaders([]);
      setError(errorText(requestError));
    } finally {
      setLeadersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'leaders') void loadLeaders(leaderType);
  }, [section, leaderType, loadLeaders]);

  const openCase = useCallback(async (item: GameCase) => {
    if (caseBusy) return;

    setCaseBusy(true);
    setError('');

    try {
      const response = await apiPost<{
        ok?: boolean;
        item?: GameInventoryItem;
        reward?: GameInventoryItem;
        inventory?: GameInventoryItem[];
        data?: GameInventoryItem;
        [key: string]: unknown;
      }>('/games/cases/open', {
        case_id: item.id,
      });

      if (response.ok === false) {
        throw new Error(String(response.error || 'CASE_OPEN_FAILED'));
      }

      const reward = response.item || response.reward || response.data;

      if (reward) {
        setInventory((current) => [reward, ...current]);
      }

      if (response.inventory) setInventory(response.inventory);
      await loadGame();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setCaseBusy(false);
    }
  }, [caseBusy, loadGame]);

  const loadInventory = useCallback(async () => {
    try {
      const response = await apiGet<unknown>('/games/cases/inventory');
      setInventory(extractList<GameInventoryItem>(
        response,
        ['inventory', 'items', 'gifts', 'results'],
      ));
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, []);

  useEffect(() => {
    if (section === 'cases') void loadInventory();
  }, [section, loadInventory]);

  const startCrash = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (crashStatus === 'running') return;

    const amount = Number(bet);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Укажите корректную сумму ставки.');
      return;
    }

    setError('');
    setCrashResult(null);

    try {
      const response = await apiPost<{
        ok?: boolean;
        bet_id?: string | number;
        round_id?: string | number;
        multiplier?: number;
        status?: string;
        [key: string]: unknown;
      }>('/games/crash/bet', {
        amount,
        bet: amount,
      });

      if (response.ok === false) {
        throw new Error(String(response.error || 'CRASH_BET_FAILED'));
      }

      setCrashBetId(response.bet_id ?? response.round_id ?? null);
      setCrashMultiplier(Number(response.multiplier || 1));
      setCrashStatus('running');

      if (crashPoll.current) clearInterval(crashPoll.current);

      crashPoll.current = window.setInterval(async () => {
        try {
          const state = await apiGet<{
            ok?: boolean;
            multiplier?: number;
            status?: string;
            crashed_at?: number;
            [key: string]: unknown;
          }>('/games/crash/status');

          if (state.multiplier !== undefined) {
            setCrashMultiplier(Number(state.multiplier));
          }

          if (state.status === 'crashed') {
            setCrashStatus('crashed');
            setCrashResult(Number(state.crashed_at || state.multiplier || 0));
            if (crashPoll.current) clearInterval(crashPoll.current);
            crashPoll.current = null;
          } else if (state.status === 'cashed') {
            setCrashStatus('cashed');
            if (crashPoll.current) clearInterval(crashPoll.current);
            crashPoll.current = null;
          }
        } catch {
          // Следующий опрос повторит запрос, не прерывая текущий раунд.
        }
      }, 1000);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, [bet, crashStatus]);

  const cashOut = useCallback(async () => {
    if (crashStatus !== 'running') return;

    try {
      const response = await apiPost<{
        ok?: boolean;
        multiplier?: number;
        winnings?: number;
      }>('/games/crash/cashout', {
        bet_id: crashBetId,
      });

      if (response.ok === false) {
        throw new Error('CASHOUT_FAILED');
      }

      setCrashMultiplier(Number(response.multiplier || crashMultiplier));
      setCrashResult(Number(response.winnings || 0));
      setCrashStatus('cashed');

      if (crashPoll.current) clearInterval(crashPoll.current);
      crashPoll.current = null;
      await loadGame();
    } catch (requestError) {
      setError(errorText(requestError));
    }
  }, [crashStatus, crashBetId, crashMultiplier, loadGame]);

  const resetCrash = useCallback(() => {
    if (crashPoll.current) clearInterval(crashPoll.current);
    crashPoll.current = null;
    setCrashStatus('idle');
    setCrashBetId(null);
    setCrashMultiplier(1);
    setCrashResult(null);
  }, []);

  const renderTap = () => (
    <>
      <div className="ng-games__stats">
        <div className="ng-games__stat">
          <div className="ng-games__stat-label">Всего тапов</div>
          <div className="ng-games__stat-value">
            {numberFormat(game.total_taps ?? game.taps)}
          </div>
        </div>
        <div className="ng-games__stat">
          <div className="ng-games__stat-label">Сила тапа</div>
          <div className="ng-games__stat-value">
            ×{numberFormat(game.tap_power || 1)}
          </div>
        </div>
      </div>

      <div className="ng-games__card">
        <div className="ng-games__tap-area">
          <button
            type="button"
            className="ng-games__tap-button"
            aria-label="Нажать"
            onClick={handleTap}
          >
            👆
          </button>

          <div className="ng-games__tap-caption">
            Нажимай и зарабатывай
          </div>

          <div className="ng-games__sync">
            В очереди: {numberFormat(pendingTaps)} тапов
            {tapSending ? ' · отправка...' : ' · синхронизация каждые 2,5 сек'}
          </div>
        </div>
      </div>

      <div className="ng-games__card">
        <h3 className="ng-games__card-title">Как это работает</h3>
        <div className="ng-games__muted">
          Тапы собираются на устройстве и отправляются серверу пачками.
          При временной ошибке отправка повторяется при следующем цикле.
          Прогресс хранится на сервере.
        </div>
      </div>
    </>
  );

  const renderMouse = () => {
    const experiencePercent = Math.min(
      100,
      (mouse.experience / Math.max(1, mouse.level * 100)) * 100,
    );

    return (
      <>
        <div className="ng-games__card">
          <div className="ng-games__mouse">🐭</div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 850 }}>
              Мышка · уровень {numberFormat(mouse.level)}
            </div>
            <div className="ng-games__muted" style={{ marginTop: 5 }}>
              {numberFormat(mouse.coins)} 🧀 сыров
            </div>
          </div>

          <div style={{ marginTop: 17 }}>
            <div className="ng-games__muted" style={{ marginBottom: 7 }}>
              Опыт: {numberFormat(mouse.experience)} / {numberFormat(mouse.level * 100)}
            </div>
            <div className="ng-games__progress">
              <div
                className="ng-games__progress-fill"
                style={{ width: `${experiencePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="ng-games__stats">
          <div className="ng-games__stat">
            <div className="ng-games__stat-label">Атака</div>
            <div className="ng-games__stat-value">
              ⚔️ {numberFormat(mouse.attack)}
            </div>
          </div>
          <div className="ng-games__stat">
            <div className="ng-games__stat-label">Защита</div>
            <div className="ng-games__stat-value">
              🛡️ {numberFormat(mouse.defense)}
            </div>
          </div>
          <div className="ng-games__stat">
            <div className="ng-games__stat-label">Мышеловки</div>
            <div className="ng-games__stat-value">
              {numberFormat(mouse.traps)}
            </div>
          </div>
          <div className="ng-games__stat">
            <div className="ng-games__stat-label">Щит</div>
            <div className="ng-games__stat-value">
              {mouse.shield_until && mouse.shield_until > Date.now() / 1000
                ? 'Активен'
                : 'Нет'}
            </div>
          </div>
        </div>

        <div className="ng-games__card">
          <h3 className="ng-games__card-title">Прокачка</h3>

          <div className="ng-games__upgrade">
            <div className="ng-games__upgrade-icon">⚔️</div>
            <div className="ng-games__upgrade-info">
              <div className="ng-games__upgrade-name">Усилить атаку</div>
              <div className="ng-games__upgrade-description">
                Больше урона во время набегов.
              </div>
              <div className="ng-games__upgrade-price">Стоимость определяет сервер</div>
            </div>
            <button
              className="ng-games__button ng-games__button--primary"
              disabled={mouseBusy}
              onClick={() => void mouseAction('upgrade', { stat: 'attack' })}
            >
              Улучшить
            </button>
          </div>

          <div className="ng-games__upgrade">
            <div className="ng-games__upgrade-icon">🛡️</div>
            <div className="ng-games__upgrade-info">
              <div className="ng-games__upgrade-name">Усилить защиту</div>
              <div className="ng-games__upgrade-description">
                Защита от нападений других мышек.
              </div>
              <div className="ng-games__upgrade-price">Стоимость определяет сервер</div>
            </div>
            <button
              className="ng-games__button ng-games__button--primary"
              disabled={mouseBusy}
              onClick={() => void mouseAction('upgrade', { stat: 'defense' })}
            >
              Улучшить
            </button>
          </div>
        </div>

        <div className="ng-games__card">
          <h3 className="ng-games__card-title">Тактика</h3>
          <div className="ng-games__button-row">
            <button
              className="ng-games__button ng-games__button--primary"
              disabled={mouseBusy}
              onClick={() => void mouseAction('raid')}
            >
              ⚔️ Набег
            </button>

            <button
              className="ng-games__button"
              disabled={mouseBusy}
              onClick={() => void mouseAction('trap')}
            >
              🪤 Мышеловка
            </button>

            <button
              className="ng-games__button"
              disabled={mouseBusy}
              onClick={() => void mouseAction('shield')}
            >
              🛡️ Щит
            </button>

            <button
              className="ng-games__button"
              disabled={mouseBusy || mouse.revenge_available === false}
              onClick={() => void mouseAction('revenge')}
            >
              🔥 Месть
            </button>
          </div>
          <div className="ng-games__notice">
            Набеги, ловушки и месть рассчитываются сервером. Защита и награды
            не начисляются локально.
          </div>
        </div>
      </>
    );
  };

  const renderClans = () => (
    <>
      {myClan ? (
        <>
          <div className="ng-games__clan-banner">
            <div className="ng-games__clan-name">
              {myClan.name}
            </div>
            <div className="ng-games__clan-tag">
              {myClan.tag ? `#${myClan.tag}` : 'Клан NeoGram'}
            </div>

            <div className="ng-games__clan-stats">
              <div className="ng-games__clan-stat">
                <strong>{numberFormat(myClan.members)}</strong>
                <span>Участники</span>
              </div>
              <div className="ng-games__clan-stat">
                <strong>{numberFormat(myClan.treasury)} GRAM</strong>
                <span>Казна</span>
              </div>
              <div className="ng-games__clan-stat">
                <strong>{numberFormat(myClan.points)}</strong>
                <span>Очки</span>
              </div>
            </div>
          </div>

          <div className="ng-games__card" style={{ marginTop: 12 }}>
            <h3 className="ng-games__card-title">Казна клана</h3>
            <div className="ng-games__stat-value">
              💰 {numberFormat(myClan.treasury)} GRAM
            </div>
            <div className="ng-games__muted" style={{ margin: '7px 0 12px' }}>
              Общий банк клана используется в клановых войнах.
            </div>
            <div className="ng-games__button-row">
              <button
                className="ng-games__button ng-games__button--primary"
                disabled={clanBusy}
                onClick={() => {
                  const value = window.prompt('Сколько GRAM внести в казну?');
                  const amount = Number(value);
                  if (Number.isFinite(amount) && amount > 0) {
                    void clanAction('treasury/deposit', { amount });
                  }
                }}
              >
                Пополнить казну
              </button>
            </div>
          </div>

          <div className="ng-games__card">
            <h3 className="ng-games__card-title">Эволюционирующий щит</h3>
            <div className="ng-games__shield">
              <div className="ng-games__shield-icon">
                {Number(myClan.shield_level || 0) >= 5 ? '💠' : '🛡️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  Щит Топ-1
                </div>
                <div className="ng-games__muted">
                  Уровень {numberFormat(myClan.shield_level)} · развивается
                  вместе с лидерством клана.
                </div>
              </div>
            </div>
            <div className="ng-games__notice">
              Внешний вид и уровень щита определяются текущим рейтингом клана.
              Преимущество Топ-1 подтверждается сервером.
            </div>
          </div>

          <div className="ng-games__card">
            <h3 className="ng-games__card-title">Клановые войны</h3>
            <div className="ng-games__muted" style={{ marginBottom: 12 }}>
              Сражайтесь за общую казну и место в рейтинге.
            </div>
            <div className="ng-games__button-row">
              <button
                className="ng-games__button ng-games__button--primary"
                disabled={clanBusy}
                onClick={() => void clanAction('war/attack')}
              >
                ⚔️ Участвовать в войне
              </button>
              <button
                className="ng-games__button"
                disabled={clanBusy}
                onClick={() => void clanAction('war/status')}
              >
                Статус войны
              </button>
            </div>
          </div>

          <button
            className="ng-games__button"
            style={{ width: '100%' }}
            disabled={clanBusy}
            onClick={() => void clanAction('leave')}
          >
            Покинуть клан
          </button>
        </>
      ) : (
        <>
          <div className="ng-games__card">
            <h3 className="ng-games__card-title">Создать клан</h3>
            <input
              className="ng-games__bet-input"
              placeholder="Название клана"
              maxLength={32}
              value={clanName}
              onChange={(event) => setClanName(event.target.value)}
            />
            <button
              className="ng-games__button ng-games__button--primary"
              style={{ width: '100%', marginTop: 10 }}
              disabled={clanBusy || clanName.trim().length < 3}
              onClick={() => void clanAction('create', {
                name: clanName.trim(),
              })}
            >
              Создать клан
            </button>
          </div>

          <div className="ng-games__card">
            <h3 className="ng-games__card-title">Найти клан</h3>
            {clans.length === 0 ? (
              <div className="ng-games__message">
                Пока нет доступных кланов.
              </div>
            ) : clans.map((clan) => (
              <div className="ng-games__clan-row" key={clan.id}>
                <div className="ng-games__upgrade-icon">🏰</div>
                <div className="ng-games__clan-info">
                  <strong>{clan.name}</strong>
                  <span>
                    {numberFormat(clan.members)} участников · {numberFormat(clan.points)} очков
                  </span>
                </div>
                <button
                  className="ng-games__button ng-games__button--primary"
                  disabled={clanBusy}
                  onClick={() => void clanAction('join', {
                    clan_id: clan.id,
                  })}
                >
                  Вступить
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  const renderLeaders = () => (
    <>
      <div className="ng-games__leader-tabs">
        {LEADERBOARDS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`ng-games__leader-tab ${leaderType === item.id ? 'ng-games__leader-tab--active' : ''}`}
            onClick={() => setLeaderType(item.id)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <div className="ng-games__card">
        <h3 className="ng-games__card-title">
          {LEADERBOARDS.find((item) => item.id === leaderType)?.label} · Топ игроков
        </h3>

        {leadersLoading ? (
          <div className="ng-games__loading">Загружаем рейтинг...</div>
        ) : leaders.length === 0 ? (
          <div className="ng-games__message">
            Рейтинг пока пуст. Станьте первым!
          </div>
        ) : leaders.map((player, index) => (
          <div className="ng-games__leader-row" key={player.id}>
            <div className={`ng-games__rank ${index < 3 ? `ng-games__rank--${index + 1}` : ''}`}>
              {index + 1}
            </div>
            <div className="ng-games__leader-avatar">
              {player.avatar ? (
                <img src={player.avatar} alt="" />
              ) : (
                getPlayerName(player).charAt(0).toUpperCase()
              )}
            </div>
            <div className="ng-games__leader-info">
              <strong>{getPlayerName(player)}</strong>
              <span>
                {leaderType === 'taps' ? 'Тапы' :
                  leaderType === 'mouse' ? 'Уровень мышки' :
                    leaderType === 'clans' ? 'Очки клана' : 'Баланс'}
              </span>
            </div>
            <div className="ng-games__leader-score">
              {numberFormat(
                leaderType === 'taps'
                  ? Number(player.taps ?? player.score)
                  : leaderType === 'mouse'
                    ? Number(player.level ?? player.score)
                    : leaderType === 'wealth'
                      ? Number(player.gram ?? player.score)
                      : Number(player.score),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="ng-games__notice">
        Аккаунт Создателя (is_creator) исключается из всех четырёх рейтингов,
        даже если сервер случайно вернул его в списке.
      </div>
    </>
  );

  const renderCases = () => (
    <>
      <div className="ng-games__card">
        <h3 className="ng-games__card-title">🎁 Кейсы RubUP</h3>
        <div className="ng-games__muted">
          Открывайте кейсы и собирайте предметы в отдельном игровом инвентаре.
          Стоимость и выпадение наград проверяются сервером.
        </div>
      </div>

      <div className="ng-games__cases">
        {cases.map((item, index) => (
          <div className="ng-games__case" key={item.id}>
            <div
              className="ng-games__case-art"
              style={{
                background: item.color
                  ? `linear-gradient(145deg, ${item.color}30, var(--color-background-secondary))`
                  : undefined,
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  style={{ maxWidth: '75%', maxHeight: 75, objectFit: 'contain' }}
                />
              ) : (
                ['📦', '💎', '🎁', '👑'][index % 4]
              )}
            </div>
            <div className="ng-games__case-name">{item.name}</div>
            <div className="ng-games__muted">{item.description}</div>
            <div className="ng-games__case-price">
              {numberFormat(item.price)} GRAM
            </div>
            <button
              className="ng-games__button ng-games__button--primary"
              style={{ width: '100%' }}
              disabled={caseBusy}
              onClick={() => void openCase(item)}
            >
              {caseBusy ? 'Открываем...' : 'Открыть'}
            </button>
          </div>
        ))}
      </div>

      <div className="ng-games__card" style={{ marginTop: 13 }}>
        <div className="ng-games__header-row" style={{ marginBottom: 10 }}>
          <h3 className="ng-games__card-title" style={{ margin: 0 }}>
            Мой инвентарь RubUP
          </h3>
          <span className="ng-games__muted">{inventory.length} предметов</span>
        </div>

        {inventory.length === 0 ? (
          <div className="ng-games__message">
            Инвентарь пуст. Откройте первый кейс!
          </div>
        ) : inventory.map((item) => (
          <div className="ng-games__inventory-item" key={item.id}>
            <div className="ng-games__inventory-art">
              {item.image ? (
                <img src={item.image} alt="" />
              ) : '🎁'}
            </div>
            <div className="ng-games__inventory-name">
              {item.name}
              <div className="ng-games__muted">
                {numberFormat(item.value)} GRAM
              </div>
            </div>
            <div className="ng-games__rarity">
              {item.rarity || 'RubUP'}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderCrash = () => (
    <>
      <div className="ng-games__card">
        <h3 className="ng-games__card-title">🚀 NeoGram Crash</h3>
        <div className="ng-games__crash-display">
          <div className={`ng-games__multiplier ${crashStatus === 'crashed' ? 'ng-games__multiplier--crashed' : ''}`}>
            {crashStatus === 'crashed'
              ? `${(crashResult || crashMultiplier).toFixed(2)}x`
              : `${crashMultiplier.toFixed(2)}x`}
          </div>
          <div className="ng-games__muted">
            {crashStatus === 'idle' ? 'Ожидание ставки' :
              crashStatus === 'running' ? 'Раунд идёт — успей забрать!' :
                crashStatus === 'cashed' ? 'Вы забрали выигрыш' :
                  'Краш! Раунд завершён'}
          </div>
        </div>

        {crashStatus === 'idle' ? (
          <form onSubmit={(event) => void startCrash(event)}>
            <div style={{ margin: '15px 0 7px' }} className="ng-games__muted">
              Ставка в GRAM
            </div>
            <input
              className="ng-games__bet-input"
              type="number"
              min="1"
              step="1"
              value={bet}
              onChange={(event) => setBet(event.target.value)}
            />
            <button
              type="submit"
              className="ng-games__button ng-games__button--primary"
              style={{ width: '100%', marginTop: 11 }}
            >
              🚀 Сделать ставку
            </button>
          </form>
        ) : crashStatus === 'running' ? (
          <button
            type="button"
            className="ng-games__button ng-games__button--primary"
            style={{ width: '100%', marginTop: 13 }}
            onClick={() => void cashOut()}
          >
            Забрать выигрыш
          </button>
        ) : (
          <>
            <div className="ng-games__notice">
              {crashStatus === 'cashed'
                ? `Раунд завершён. Результат: ${numberFormat(crashResult || 0)} GRAM.`
                : 'Вы не успели забрать ставку до краша.'}
            </div>
            <button
              className="ng-games__button ng-games__button--primary"
              style={{ width: '100%' }}
              onClick={resetCrash}
            >
              Новый раунд
            </button>
          </>
        )}
      </div>

      <div className="ng-games__notice">
        Crash — игра с риском потери ставки. Коэффициент, момент краша,
        расчёт выигрыша и состояние раунда контролируются сервером.
      </div>
    </>
  );

  const sectionContent: Record<GameSection, () => React.ReactNode> = {
    tap: renderTap,
    mouse: renderMouse,
    clans: renderClans,
    leaders: renderLeaders,
    cases: renderCases,
    crash: renderCrash,
  };

  return (
    <section
      className={`ng-games ${className || ''}`}
      aria-label="Игры NeoGram"
    >
      <style>{styles}</style>

      <header className="ng-games__header">
        <div className="ng-games__header-row">
          <div>
            <h1 className="ng-games__title">Игры</h1>
            <div className="ng-games__subtitle">
              Играй, развивайся, соревнуйся
            </div>
          </div>
          <div className="ng-games__balance">
            💎 {numberFormat(balance)} GRAM
          </div>
        </div>
      </header>

      <nav className="ng-games__tabs" aria-label="Разделы игр">
        {([
          ['tap', '👆 Тапалка'],
          ['mouse', '🐭 Мышка'],
          ['clans', '⚔️ Кланы'],
          ['leaders', '🏆 Топ'],
          ['cases', '🎁 RubUP'],
          ['crash', '🚀 Краш'],
        ] as Array<[GameSection, string]>).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={`ng-games__tab ${section === id ? 'ng-games__tab--active' : ''}`}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="ng-games__content">
        {error && (
          <div className="ng-games__error" role="alert">
            {error}
            <button
              type="button"
              className="ng-games__button"
              style={{ marginLeft: 8, minHeight: 29 }}
              onClick={() => setError('')}
            >
              Закрыть
            </button>
          </div>
        )}

        {loading ? (
          <div className="ng-games__loading">
            Загружаем игровые данные...
          </div>
        ) : (
          sectionContent[section]()
        )}
      </main>
    </section>
  );
}
