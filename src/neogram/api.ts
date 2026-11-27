
const API_BASE_URL = 'https://tg-api.matveyverus9.workers.dev';

const DEVICE_ID_KEY = 'neogram.device_id.v1';
const SESSIONS_KEY = 'neogram.sessions.v1';
const ACTIVE_ACCOUNT_KEY = 'neogram.active_account.v1';

export interface NeoGramUser {
  id: number;
  phone: string;
  username?: string | null;
  created_at?: string;
  last_seen_at?: string;
  stars?: number;
  gram?: number;
  profile?: Record<string, unknown>;
  is_creator?: number;
  is_creator_badge?: number;
  hold_badge?: number;
  major_badge?: number;
  clan_id?: number | null;
  season_points?: number;
  phones?: Array<Record<string, unknown>>;
  usernames?: Array<Record<string, unknown>>;
  gifts?: Array<Record<string, unknown>>;
  inventory?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface NeoGramAuthResponse {
  ok: true;
  token: string;
  user: NeoGramUser;
}

export interface NeoGramPhoneNumber {
  phone: string;
  raw: string;
  color: string;
  multiplier: number;
  price_usd: number;
  price_gram: number;
}

export interface NeoGramApiResponse<T = unknown> {
  ok?: boolean;
  error?: string;
  detail?: string;
  [key: string]: unknown;
  data?: T;
}

export class NeoGramApiError extends Error {
  status: number;

  code: string;

  details?: unknown;

  constructor(
    message: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = 'NeoGramApiError';
    this.status = status;
    this.code = message;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  authenticated?: boolean;
  token?: string;
  adminKey?: string;
  params?: Record<string, string | number | undefined>;
};

type StoredSessions = Record<string, string>;

function getStorage(): Storage | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readSessions(): StoredSessions {
  try {
    const value = getStorage()?.getItem(SESSIONS_KEY);
    if (!value) return {};

    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return parsed as StoredSessions;
  } catch {
    return {};
  }
}

function writeSessions(sessions: StoredSessions): void {
  getStorage()?.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function getDeviceId(): string {
  const storage = getStorage();

  if (!storage) {
    throw new NeoGramApiError('DEVICE_STORAGE_UNAVAILABLE', 0);
  }

  let deviceId = storage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    const randomId = typeof crypto !== 'undefined'
      && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

    deviceId = `neogram-${randomId}`;
    storage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

export function getActiveAccount(): string | undefined {
  return getStorage()?.getItem(ACTIVE_ACCOUNT_KEY) || undefined;
}

export function getSessionToken(phone?: string): string | undefined {
  const account = phone
    ? normalizePhone(phone)
    : getActiveAccount();

  if (!account) return undefined;

  return readSessions()[account];
}

export function setActiveAccount(phone: string): void {
  const normalized = normalizePhone(phone);
  const sessions = readSessions();

  if (!sessions[normalized]) {
    throw new NeoGramApiError('SESSION_NOT_FOUND', 401);
  }

  getStorage()?.setItem(ACTIVE_ACCOUNT_KEY, normalized);
}

export function removeSession(phone: string): void {
  const normalized = normalizePhone(phone);
  const sessions = readSessions();

  delete sessions[normalized];
  writeSessions(sessions);

  if (getActiveAccount() === normalized) {
    getStorage()?.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

export function getSavedAccounts(): string[] {
  return Object.keys(readSessions());
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    body,
    authenticated = false,
    token,
    adminKey,
    params,
  } = options;

  const url = new URL(endpoint, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  if (authenticated) {
    const sessionToken = token || getSessionToken();

    if (!sessionToken) {
      throw new NeoGramApiError('UNAUTHORIZED', 401);
    }

    headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (adminKey) {
    headers['X-Admin-Key'] = adminKey;
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (error) {
    throw new NeoGramApiError(
      'NEOGRAM_SERVER_UNAVAILABLE',
      0,
      error,
    );
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    throw new NeoGramApiError(
      'INVALID_SERVER_RESPONSE',
      response.status,
    );
  }

  if (!response.ok) {
    const data = result as Record<string, unknown>;

    throw new NeoGramApiError(
      typeof data?.error === 'string'
        ? data.error
        : `HTTP_${response.status}`,
      response.status,
      data,
    );
  }

  return result as T;
}

/**
 * Первичная регистрация или авторизация.
 * Worker самостоятельно создаёт пользователя,
 * если номер ещё не зарегистрирован.
 */
export async function authenticate(
  phone: string,
  pin: string,
): Promise<NeoGramAuthResponse> {
  const normalizedPhone = normalizePhone(phone);

  if (!/^\+888\d{4,8}$/.test(normalizedPhone)) {
    throw new NeoGramApiError('INVALID_PHONE', 400);
  }

  if (!/^\d{4}$/.test(pin)) {
    throw new NeoGramApiError('INVALID_PIN', 400);
  }

  const deviceId = getDeviceId();

  const result = await request<NeoGramAuthResponse>(
    '/auth',
    {
      method: 'POST',
      body: {
        phone: normalizedPhone,
        pin,
        device_id: deviceId,
      },
    },
  );

  if (!result.ok || !result.token || !result.user) {
    throw new NeoGramApiError('INVALID_AUTH_RESPONSE', 500);
  }

  const sessions = readSessions();

  sessions[normalizedPhone] = result.token;

  writeSessions(sessions);

  getStorage()?.setItem(ACTIVE_ACCOUNT_KEY, normalizedPhone);

  return result;
}

/**
 * Генерация пяти доступных номеров.
 * ВАЖНО: Worker требует действующую сессию.
 */
export async function generatePhoneNumbers(): Promise<NeoGramPhoneNumber[]> {
  const result = await request<{
    ok: boolean;
    numbers: NeoGramPhoneNumber[];
  }>('/generate-phone', {
    authenticated: true,
  });

  return result.numbers || [];
}

/**
 * Получение собственного профиля.
 */
export async function getProfile<T = NeoGramUser>(): Promise<T> {
  const result = await request<{
    ok: boolean;
    user: T;
  }>('/profile', {
    authenticated: true,
  });

  return result.user;
}

/**
 * Изменение настроек профиля.
 */
export async function updateProfile(
  profile: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request('/profile/update', {
    method: 'POST',
    authenticated: true,
    body: profile,
  });
}

/**
 * Поиск игрока по номеру или @username.
 */
export async function getFragmentInfo<T = unknown>(
  params: Record<string, string> = {},
): Promise<T> {
  return request<T>('/fragment/info', {
    params,
  });
}

export async function searchPlayer<T = unknown>(
  query: string,
): Promise<T> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new NeoGramApiError('EMPTY_SEARCH_QUERY', 400);
  }

  return getFragmentInfo<T>({
    q: normalizedQuery,
  });
}

/**
 * Получение состояния Worker.
 */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const result = await request<{
      ok?: boolean;
      service?: string;
    }>('/');

    return result.ok === true
      && result.service === 'NeoGram API';
  } catch {
    return false;
  }
}

/**
 * Универсальные методы для последующих модулей.
 */
export async function apiGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(endpoint, {
    authenticated: true,
    params,
  });
}

export async function apiPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    authenticated: true,
    body,
  });
}

/**
 * Переключение между сохранёнными аккаунтами.
 */
export async function switchAccount(
  phone: string,
): Promise<NeoGramUser> {
  setActiveAccount(phone);
  return getProfile();
}

/**
 * Выход из текущего аккаунта.
 */
export function logoutAccount(phone?: string): void {
  const account = phone || getActiveAccount();

  if (account) {
    removeSession(account);
  }
}

export const NeoGramApi = {
  request,
  authenticate,
  generatePhoneNumbers,
  getProfile,
  updateProfile,
  getFragmentInfo,
  searchPlayer,
  checkApiStatus,
  apiGet,
  apiPost,
  getDeviceId,
  getSessionToken,
  getSavedAccounts,
  getActiveAccount,
  setActiveAccount,
  switchAccount,
  removeSession,
  logoutAccount,
};

export default NeoGramApi;
