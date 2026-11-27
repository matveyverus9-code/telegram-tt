import type {
  ApiUpdateAuthorizationState,
  ApiUpdateAuthorizationStateType,
  ApiUser,
  ApiUserFullInfo,
} from '../../types';

import { sendApiUpdate } from '../updates/apiUpdateEmitter';

const WORKER_URL = 'https://tg-api.gramjs.workers.dev';

type WorkerProfile = {
  id: number | string;
  phone?: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | number;
  last_seen_at?: string | number;
  profile?: Record<string, unknown> | null;
  is_creator?: boolean;
  is_creator_badge?: boolean;
  hold_badge?: boolean;
  major_badge?: boolean;
  stars?: number;
  gram?: number;
  [key: string]: unknown;
};

type WorkerAuthResponse = {
  ok: boolean;
  token?: string;
  user?: WorkerProfile;
  error?: string;
  code?: string;
};

type WorkerCheckResponse = {
  ok: boolean;
  exists?: boolean;
  registration?: boolean;
  reserved?: boolean;
  can_register?: boolean;
  account_status?: string;
  error?: string;
  code?: string;
};

export type WorkerAuthResult = {
  token: string;
  user: ApiUser;
  userFullInfo: ApiUserFullInfo;
  profile: WorkerProfile;
};

let workerToken: string | undefined;
let currentWorkerUser: ApiUser | undefined;
let currentWorkerProfile: WorkerProfile | undefined;

let deviceId: string | undefined;

const authController: {
  resolve?: (value: string | [string, string?]) => void;
  reject?: (error: Error) => void;
} = {};

function getDeviceId(): string {
  if (deviceId) {
    return deviceId;
  }

  try {
    const generatedId = globalThis.crypto?.randomUUID?.();

    if (generatedId) {
      deviceId = generatedId;
      return deviceId;
    }
  } catch {
    // Use the fallback below.
  }

  deviceId = [
    'device',
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('-');

  return deviceId;
}

async function workerRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    token?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const token = options.token ?? workerToken;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${WORKER_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let data: T;

  try {
    data = await response.json() as T;
  } catch {
    throw new Error('INVALID_WORKER_RESPONSE');
  }

  if (!response.ok) {
    const errorData = data as {
      error?: string;
      code?: string;
    };

    throw new Error(errorData.code || errorData.error || `HTTP_${response.status}`);
  }

  return data;
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s()-]/g, '');
}

function normalizeUsername(username?: string | null): string | undefined {
  if (!username) {
    return undefined;
  }

  const normalized = username.trim().replace(/^@/, '');

  return normalized || undefined;
}

function buildApiUser(profile: WorkerProfile): ApiUser {
  const username = normalizeUsername(profile.username);
  const firstName = profile.first_name?.trim() || username || undefined;
  const lastName = profile.last_name?.trim() || undefined;

  return {
    id: String(profile.id),
    isMin: false,
    isSelf: true,
    type: 'userTypeRegular',
    firstName,
    lastName,
    phoneNumber: profile.phone || '',
    usernames: username
      ? [{
        username,
        isActive: true,
        isEditable: true,
      }]
      : [],
    hasUsername: Boolean(username),
    noStatus: false,
  };
}

function buildApiUserFullInfo(): ApiUserFullInfo {
  return {};
}

function buildAuthStateUpdate(
  authorizationState: ApiUpdateAuthorizationStateType,
): ApiUpdateAuthorizationState {
  return {
    '@type': 'updateAuthorizationState',
    authorizationState,
  };
}

function emitAuthorizationState(
  authorizationState: ApiUpdateAuthorizationStateType,
) {
  sendApiUpdate(buildAuthStateUpdate(authorizationState));
}

function emitAuthorizationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  sendApiUpdate({
    '@type': 'updateAuthorizationError',
    errorKey: 'PHONE_NUMBER_INVALID',
    errorCode: message,
  });
}

function emitCurrentUser(user: ApiUser) {
  sendApiUpdate({
    '@type': 'updateCurrentUser',
    currentUser: user,
    currentUserFullInfo: buildApiUserFullInfo(),
  });
}

export async function checkWorkerPhone(phone: string): Promise<WorkerCheckResponse> {
  const normalizedPhone = normalizePhone(phone);

  if (!/^\+888\d{4,8}$/.test(normalizedPhone)) {
    throw new Error('PHONE_NUMBER_INVALID');
  }

  const result = await workerRequest<WorkerCheckResponse>('/auth/check', {
    method: 'POST',
    body: {
      phone: normalizedPhone,
    },
  });

  if (!result.ok) {
    throw new Error(result.code || result.error || 'AUTH_CHECK_FAILED');
  }

  return result;
}

export async function authenticateWithWorker(
  phone: string,
  pin: string,
): Promise<WorkerAuthResult> {
  const normalizedPhone = normalizePhone(phone);

  if (!/^\+888\d{4,8}$/.test(normalizedPhone)) {
    throw new Error('PHONE_NUMBER_INVALID');
  }

  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN_INVALID');
  }

  const check = await checkWorkerPhone(normalizedPhone);

  if (!check.exists && !check.can_register) {
    throw new Error('PHONE_NOT_RESERVED');
  }

  const result = await workerRequest<WorkerAuthResponse>('/auth', {
    method: 'POST',
    body: {
      phone: normalizedPhone,
      pin,
      device_id: getDeviceId(),
    },
  });

  if (!result.ok || !result.token || !result.user) {
    throw new Error(result.code || result.error || 'AUTH_FAILED');
  }

  workerToken = result.token;
  currentWorkerProfile = result.user;
  currentWorkerUser = buildApiUser(result.user);

  const userFullInfo = buildApiUserFullInfo();

  emitCurrentUser(currentWorkerUser);
  emitAuthorizationState('authorizationStateReady');

  return {
    token: result.token,
    user: currentWorkerUser,
    userFullInfo,
    profile: result.user,
  };
}

export async function restoreWorkerSession(token: string): Promise<WorkerAuthResult> {
  if (!token.trim()) {
    throw new Error('TOKEN_REQUIRED');
  }

  const result = await workerRequest<{
    ok: boolean;
    user?: WorkerProfile;
    error?: string;
    code?: string;
  }>('/profile', {
    token,
  });

  if (!result.ok || !result.user) {
    throw new Error(result.code || result.error || 'SESSION_RESTORE_FAILED');
  }

  workerToken = token;
  currentWorkerProfile = result.user;
  currentWorkerUser = buildApiUser(result.user);

  const userFullInfo = buildApiUserFullInfo();

  emitCurrentUser(currentWorkerUser);
  emitAuthorizationState('authorizationStateReady');

  return {
    token,
    user: currentWorkerUser,
    userFullInfo,
    profile: result.user,
  };
}

export function getWorkerToken(): string | undefined {
  return workerToken;
}

export function getCurrentWorkerUser(): ApiUser | undefined {
  return currentWorkerUser;
}

export function getCurrentWorkerProfile(): WorkerProfile | undefined {
  return currentWorkerProfile;
}

export function clearWorkerSession() {
  workerToken = undefined;
  currentWorkerUser = undefined;
  currentWorkerProfile = undefined;
}

export function onWebAuthTokenFailed() {
  sendApiUpdate({
    '@type': 'updateWebAuthTokenFailed',
  });
}

export function onPasskeyOption() {
  // Passkey authentication is not supported by the REST Worker.
}

export function onRequestPhoneNumber() {
  emitAuthorizationState('authorizationStateWaitPhoneNumber');

  return new Promise<string>((resolve, reject) => {
    authController.resolve = (value) => {
      if (typeof value !== 'string') {
        reject(new Error('INVALID_PHONE_NUMBER'));
        return;
      }

      resolve(value);
    };

    authController.reject = reject;
  });
}

export function onRequestCode() {
  emitAuthorizationState('authorizationStateWaitCode');

  return new Promise<string>((resolve, reject) => {
    authController.resolve = (value) => {
      if (typeof value !== 'string') {
        reject(new Error('INVALID_PIN'));
        return;
      }

      resolve(value);
    };

    authController.reject = reject;
  });
}

export function onRequestPassword() {
  return Promise.reject(new Error('PASSWORD_AUTH_NOT_SUPPORTED'));
}

export function onRequestRegistration() {
  emitAuthorizationState('authorizationStateWaitRegistration');

  return new Promise<[string, string?]>((resolve, reject) => {
    authController.resolve = (value) => {
      if (!Array.isArray(value)) {
        reject(new Error('INVALID_REGISTRATION_DATA'));
        return;
      }

      resolve(value);
    };

    authController.reject = reject;
  });
}

export function onRequestQrCode() {
  return Promise.reject(new Error('QR_AUTH_NOT_SUPPORTED'));
}

export function onAuthError(error: Error) {
  emitAuthorizationError(error);
}

export function onAuthReady() {
  emitAuthorizationState('authorizationStateReady');
}

export function onCurrentUserUpdate(
  currentUser: ApiUser,
  currentUserFullInfo: ApiUserFullInfo,
) {
  currentWorkerUser = currentUser;

  sendApiUpdate({
    '@type': 'updateCurrentUser',
    currentUser,
    currentUserFullInfo,
  });
}

export function provideAuthPhoneNumber(phoneNumber: string) {
  authController.resolve?.(normalizePhone(phoneNumber));
}

export function provideAuthCode(code: string) {
  authController.resolve?.(code.trim());
}

export function provideAuthPassword(password: string) {
  authController.resolve?.(password);
}

export function provideAuthRegistration(registration: {
  firstName: string;
  lastName: string;
}) {
  authController.resolve?.([
    registration.firstName,
    registration.lastName,
  ]);
}

export function restartAuth() {
  authController.reject?.(new Error('RESTART_AUTH'));
}

export function restartAuthWithQr() {
  authController.reject?.(new Error('QR_AUTH_NOT_SUPPORTED'));
}

export function restartAuthWithPasskey() {
  authController.reject?.(new Error('PASSKEY_AUTH_NOT_SUPPORTED'));
}
