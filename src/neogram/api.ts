const API_BASE_URL = 'https://tg-api.matveyverus9.workers.dev';

const DEVICE_ID_KEY = 'neogram.device_id.v1';
const SESSIONS_KEY = 'neogram.sessions.v1';
const ACTIVE_ACCOUNT_KEY = 'neogram.active_account.v1';
const CREATOR_MASTER_PHONE = '+6666666';
const CREATOR_BOOTSTRAP_KEY = 'BOSS777';

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
  price_gram: number;
  reservation_expires_at?: number;
}

export interface NeoGramPhoneReservationResponse {
  ok: true;
  phone: string;
  raw: string;
  color: string;
  multiplier: number;
  price_gram: number;
  reservation_expires_at: number;
}

export interface NeoGramPhoneCheckResponse {
  ok: boolean;
  exists: boolean;
  registration: boolean;
  reserved: boolean;
  can_register: boolean;
  account_status: string;
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

  constructor(message: string, status: number, details?: unknown) {
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<StoredSessions>((result, [phone, token]) => {
      if (typeof token === 'string' && token.length > 0) {
        result[normalizePhone(phone)] = token;
      }
      return result;
    }, {});
  } catch {
    return {};
  }
}

function writeSessions(sessions: StoredSessions): void {
  try {
    getStorage()?.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    throw new NeoGramApiError('SESSION_STORAGE_FAILED', 0);
  }
}

function validatePhone(phone: string): string {
  const normalizedPhone = normalizePhone(phone);
  if (!/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
    throw new NeoGramApiError('INVALID_PHONE', 400);
  }
  return normalizedPhone;
}

function getCreatorKey(phone: string, suppliedKey?: string): string | undefined {
  if (suppliedKey) return suppliedKey;
  return normalizePhone(phone) === CREATOR_MASTER_PHONE
    ? CREATOR_BOOTSTRAP_KEY
    : undefined;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function getDeviceId(): string {
  const storage = getStorage();
  if (!storage) throw new NeoGramApiError('DEVICE_STORAGE_UNAVAILABLE', 0);

  let deviceId = storage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
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
  const account = phone ? normalizePhone(phone) : getActiveAccount();
  return account ? readSessions()[account] : undefined;
}

export function setActiveAccount(phone: string): void {
  const normalized = validatePhone(phone);
  if (!readSessions()[normalized]) throw new NeoGramApiError('SESSION_NOT_FOUND', 401);
  const storage = getStorage();
  if (!storage) throw new NeoGramApiError('SESSION_STORAGE_FAILED', 0);
  storage.setItem(ACTIVE_ACCOUNT_KEY, normalized);
}

export function removeSession(phone: string): void {
  const normalized = normalizePhone(phone);
  const sessions = readSessions();
  delete sessions[normalized];
  writeSessions(sessions);
  if (getActiveAccount() === normalized) getStorage()?.removeItem(ACTIVE_ACCOUNT_KEY);
}

export function getSavedAccounts(): string[] {
  return Object.keys(readSessions());
}

async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authenticated = false, token, adminKey, params } = options;
  const url = new URL(endpoint, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  if (authenticated) {
    const sessionToken = token || getSessionToken();
    if (!sessionToken) throw new NeoGramApiError('UNAUTHORIZED', 401);
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  if (adminKey) headers['X-Admin-Key'] = adminKey;

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
    throw new NeoGramApiError('NEOGRAM_SERVER_UNAVAILABLE', 0, error);
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new NeoGramApiError('INVALID_SERVER_RESPONSE', response.status);
  }

  if (!response.ok) {
    const data = result as Record<string, unknown>;
    throw new NeoGramApiError(
      typeof data?.error === 'string' ? data.error : `HTTP_${response.status}`,
      response.status,
      data,
    );
  }
  return result as T;
}

/** Проверка доступности NeoGram Worker. */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const result = await request<{ ok?: boolean; service?: string }>('/');
    return result.ok === true && result.service === 'NeoGram API';
  } catch {
    return false;
  }
}

/**
 * Старый метод оставлен для совместимости со старым UI.
 * Автоматическая генерация номеров отключена: используйте reservePhoneNumber.
 */
export async function generatePhoneNumbers(): Promise<NeoGramPhoneNumber[]> {
  throw new NeoGramApiError(
    'MANUAL_NUMBER_REQUIRED',
    400,
    'Введите собственные 4–8 цифр и вызовите reservePhoneNumber(phone).',
  );
}

/** Резервирование выбранного пользователем номера +888 на сервере. */
export async function reservePhoneNumber(phone: string): Promise<NeoGramPhoneReservationResponse> {
  const normalized = normalizePhone(phone);
  const result = await request<NeoGramPhoneReservationResponse>('/phone/reserve', {
    method: 'POST',
    body: { phone: normalized },
  });
  if (!result.ok || !result.phone) {
    throw new NeoGramApiError('PHONE_RESERVATION_FAILED', 500, result);
  }
  return result;
}

/** Проверка номера перед вводом PIN. Для мастер-номера автоматически передаётся тестовый creator_key. */
export async function checkPhoneNumber(
  phone: string,
  creatorKey?: string,
): Promise<NeoGramPhoneCheckResponse> {
  const normalizedPhone = validatePhone(phone);
  const key = getCreatorKey(normalizedPhone, creatorKey);
  const result = await request<NeoGramPhoneCheckResponse>('/auth/check', {
    method: 'POST',
    body: {
      phone: normalizedPhone,
      ...(key ? { creator_key: key } : {}),
    },
  });
  if (!result.ok) throw new NeoGramApiError('PHONE_CHECK_FAILED', 500, result);
  return result;
}

/** Вход/регистрация с PIN. Для первого входа на +666 6 666 передаётся creator_key=BOSS777. */
export async function authenticate(
  phone: string,
  pin: string,
  creatorKey?: string,
): Promise<NeoGramAuthResponse> {
  const normalizedPhone = validatePhone(phone);
  if (!/^\d{4}$/.test(pin)) throw new NeoGramApiError('INVALID_PIN', 400);

  const deviceId = getDeviceId();
  const key = getCreatorKey(normalizedPhone, creatorKey);
  const result = await request<NeoGramAuthResponse>('/auth', {
    method: 'POST',
    body: {
      phone: normalizedPhone,
      pin,
      device_id: deviceId,
      ...(key ? { creator_key: key } : {}),
    },
  });

  if (!result.ok || !result.token || !result.user) {
    throw new NeoGramApiError('INVALID_AUTH_RESPONSE', 500, result);
  }

  const sessions = readSessions();
  sessions[normalizedPhone] = result.token;
  writeSessions(sessions);
  const storage = getStorage();
  if (!storage) throw new NeoGramApiError('SESSION_STORAGE_FAILED', 0);
  storage.setItem(ACTIVE_ACCOUNT_KEY, normalizedPhone);
  return result;
}

/** Получение собственного профиля. */
export async function getProfile<T = NeoGramUser>(): Promise<T> {
  const result = await request<{ ok: boolean; user: T }>('/profile', { authenticated: true });
  return result.user;
}

/** Обновление настроек профиля. */
export async function updateProfile(profile: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request('/profile/update', {
    method: 'POST',
    authenticated: true,
    body: profile,
  });
}

/** Поиск игрока по номеру или @username в разделе внутреннего Fragment-маркетплейса. */
export async function getFragmentInfo<T = unknown>(params: Record<string, string> = {}): Promise<T> {
  return request<T>('/fragment/info', { authenticated: true, params });
}

export async function searchPlayer(query: string): Promise<unknown> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new NeoGramApiError('EMPTY_SEARCH_QUERY', 400);
  return getFragmentInfo({ q: normalizedQuery });
}

/** Универсальные методы для экранов Ленты, Игр, Кланов, Магазина, Кошелька и Админки. */
export async function apiGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(endpoint, { authenticated: true, params });
}

export async function apiPost<T = unknown>(
  endpoint: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return request<T>(endpoint, { method: 'POST', authenticated: true, body });
}

/** Вызов административного API. Ключ вводится в админке и не сохраняется здесь. */
export async function adminApiGet<T = unknown>(
  endpoint: string,
  adminKey: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(endpoint, { authenticated: true, adminKey, params });
}

export async function adminApiPost<T = unknown>(
  endpoint: string,
  adminKey: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return request<T>(endpoint, { method: 'POST', authenticated: true, adminKey, body });
}

/** Переключение между сохранёнными аккаунтами. */
export async function switchAccount(phone: string): Promise<NeoGramUser> {
  setActiveAccount(phone);
  return getProfile();
}

/** Выход на этом устройстве. */
export function logoutAccount(phone?: string): void {
  const account = phone || getActiveAccount();
  if (account) removeSession(account);
}

export const NeoGramApi = {
  request,
  authenticate,
  checkPhoneNumber,
  reservePhoneNumber,
  generatePhoneNumbers,
  getProfile,
  updateProfile,
  getFragmentInfo,
  searchPlayer,
  checkApiStatus,
  apiGet,
  apiPost,
  adminApiGet,
  adminApiPost,
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
