import type {
  ApiInitialArgs,
  ApiSessionData,
  ApiUser,
  ApiUserFullInfo,
  ApiChat,
  ApiMessage,
  ApiUpdate,
  ApiMediaFormat,
  ApiOnProgress,
  ApiAvatarUpload,
  ApiAccountConnection,
} from '../../types';
import type { ThreadId } from '../../../types';
import type { TwoFaParams } from '../../../lib/gramjs/client/2fa';
import TelegramClient from '../../../lib/gramjs/client/TelegramClient';
import { Api as GramJs } from '../../../lib/gramjs';

import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import {
  getWorkerToken,
  getCurrentWorkerUser,
  getCurrentWorkerProfile,
  clearWorkerSession,
  restoreWorkerSession,
} from './auth';

const WORKER_URL = 'https://tg-api.gramjs.workers.dev';

type WorkerRecord = Record<string, any>;

type WorkerSyncResponse = {
  ok?: boolean;
  me?: WorkerRecord;
  user?: WorkerRecord;
  chats?: WorkerRecord[];
  messages?: WorkerRecord[];
  profiles?: WorkerRecord[];
  cursor?: string | number | null;
};

type WorkerMessageResponse = {
  ok: boolean;
  message?: WorkerRecord;
  error?: string;
  code?: string;
};

let client: TelegramClient | undefined;
let currentUserId: string | undefined;
let currentCursor: string | number | null = null;
let isInitialized = false;
let syncPromise: Promise<void> | undefined;

const CHAT_ABORT_CONTROLLERS = new Map<string, AbortController>();
const ABORT_CONTROLLERS = new Map<string, AbortController>();

const DEFAULT_USER_FULL_INFO: ApiUserFullInfo = {};

function getString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function getNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getTimestamp(value: unknown): number {
  if (typeof value === 'number') {
    return value > 1000000000000 ? Math.floor(value / 1000) : value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);

    if (Number.isFinite(numeric) && value.trim() !== '') {
      return numeric > 1000000000000 ? Math.floor(numeric / 1000) : numeric;
    }

    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return Math.floor(Date.now() / 1000);
}

function normalizeUsername(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const username = value.trim().replace(/^@/, '');

  return username || undefined;
}

function normalizePeerId(record: WorkerRecord, fallbackType: 'user' | 'chat' | 'channel' = 'user'): string {
  const id = getString(record.id ?? record.user_id ?? record.chat_id);

  if (!id) return '';

  if (record.peer_id !== undefined) {
    return getString(record.peer_id);
  }

  if (record.chat_type === 'channel' || record.type === 'channel') {
    return id.startsWith('-100') ? id : `-100${id}`;
  }

  if (record.chat_type === 'group' || record.type === 'group' || fallbackType === 'chat') {
    return id.startsWith('-') ? id : `-${id}`;
  }

  return id;
}

function buildApiUser(profile: WorkerRecord, self = false): ApiUser {
  const username = normalizeUsername(profile.username);
  const firstName = getString(
    profile.first_name ?? profile.firstName ?? profile.display_name,
    username || 'NeoGram User',
  );

  const lastName = getString(profile.last_name ?? profile.lastName);

  return {
    id: normalizePeerId(profile),
    isMin: false,
    isSelf: self || undefined,
    isVerified: profile.is_verified ? true : undefined,
    isPremium: Boolean(profile.is_premium),
    type: 'userTypeRegular',
    firstName,
    lastName: lastName || undefined,
    phoneNumber: getString(profile.phone ?? profile.phone_number),
    usernames: username
      ? [{
        username,
        isActive: true,
        isEditable: true,
      }]
      : [],
    hasUsername: Boolean(username),
    noStatus: !profile.last_seen_at,
  };
}

function buildApiChat(chat: WorkerRecord): ApiChat {
  const rawType = getString(chat.chat_type ?? chat.type, 'private');
  const id = normalizePeerId(chat, rawType === 'group' ? 'chat' : 'user');

  let type: ApiChat['type'] = 'chatTypePrivate';

  if (rawType === 'group' || rawType === 'basic_group') {
    type = 'chatTypeBasicGroup';
  } else if (rawType === 'supergroup') {
    type = 'chatTypeSuperGroup';
  } else if (rawType === 'channel') {
    type = 'chatTypeChannel';
  } else if (rawType === 'community') {
    type = 'chatTypeCommunity';
  }

  const username = normalizeUsername(chat.username);

  return {
    id,
    type,
    title: getString(
      chat.title ?? chat.name,
      'NeoGram Chat',
    ),
    usernames: username
      ? [{
        username,
        isActive: true,
        isEditable: false,
      }]
      : undefined,
    hasUsername: Boolean(username) || undefined,
    membersCount: chat.members_count !== undefined
      ? getNumber(chat.members_count)
      : undefined,
    isVerified: chat.is_verified ? true : undefined,
    isProtected: chat.is_protected ? true : undefined,
    isForum: chat.is_forum ? true : undefined,
  };
}

function buildApiMessage(message: WorkerRecord, meId = currentUserId || ''): ApiMessage {
  const chatId = getString(
    message.chat_id ?? message.chatId ?? message.peer_id,
  );

  const senderId = getString(
    message.sender_id ?? message.senderId ?? message.user_id,
  );

  const text = getString(message.text ?? message.message ?? message.content);

  const createdAt = getTimestamp(
    message.created_at ?? message.date ?? message.timestamp,
  );

  return {
    id: getNumber(message.id ?? message.message_id),
    chatId,
    senderId: senderId || undefined,
    date: createdAt,
    isOutgoing: Boolean(
      message.is_outgoing ??
      message.out ??
      (senderId && senderId === meId),
    ),
    content: {
      text: {
        text,
      },
    },
    isEdited: Boolean(message.is_edited ?? message.edited),
    isPinned: Boolean(message.is_pinned ?? message.pinned),
    isProtected: Boolean(message.is_protected),
    isForwardingAllowed: !message.is_protected,
    viewsCount: message.views_count !== undefined
      ? getNumber(message.views_count)
      : undefined,
  };
}

function emitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  sendApiUpdate({
    '@type': 'error',
    error: {
      message,
      code: 500,
      hasErrorKey: false,
    },
  });
}

async function workerRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const token = getWorkerToken();

  if (!token) {
    throw new Error('NEOGRAM_AUTH_REQUIRED');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;

  try {
    response = await fetch(`${WORKER_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    throw new Error('NEOGRAM_NETWORK_ERROR');
  }

  let data: T;

  try {
    data = await response.json() as T;
  } catch {
    throw new Error('NEOGRAM_INVALID_RESPONSE');
  }

  if (!response.ok) {
    const errorData = data as {
      error?: string;
      code?: string;
    };

    throw new Error(
      errorData.code ||
      errorData.error ||
      `NEOGRAM_HTTP_${response.status}`,
    );
  }

  return data;
}

function emitCurrentUser(user: ApiUser) {
  sendApiUpdate({
    '@type': 'updateCurrentUser',
    currentUser: user,
    currentUserFullInfo: DEFAULT_USER_FULL_INFO,
  });
}

function emitEntities(
  profiles: WorkerRecord[],
  chats: WorkerRecord[],
  currentUser: ApiUser,
) {
  const users: Record<string, ApiUser> = {};
  const apiChats: Record<string, ApiChat> = {};

  users[currentUser.id] = currentUser;

  profiles.forEach((profile) => {
    const user = buildApiUser(profile, getString(profile.id) === currentUser.id);
    if (user.id) {
      users[user.id] = user;
    }
  });

  chats.forEach((chat) => {
    const apiChat = buildApiChat(chat);

    if (apiChat.id) {
      apiChats[apiChat.id] = apiChat;
    }
  });

  sendApiUpdate({
    '@type': 'updateEntities',
    users,
    chats: apiChats,
  });
}

function emitMessages(messages: WorkerRecord[], meId: string) {
  const orderedMessages = [...messages].sort((a, b) => {
    return getTimestamp(a.created_at ?? a.date) -
      getTimestamp(b.created_at ?? b.date);
  });

  orderedMessages.forEach((record) => {
    const message = buildApiMessage(record, meId);

    if (!message.chatId || !Number.isFinite(message.id)) return;

    sendApiUpdate({
      '@type': 'newMessage',
      chatId: message.chatId,
      id: message.id,
      message,
    });
  });
}

function emitChatsLastMessages(messages: WorkerRecord[], meId: string) {
  const latestByChat = new Map<string, WorkerRecord>();

  messages.forEach((message) => {
    const chatId = getString(
      message.chat_id ?? message.chatId ?? message.peer_id,
    );

    if (!chatId) return;

    const existing = latestByChat.get(chatId);

    if (
      !existing ||
      getTimestamp(message.created_at ?? message.date) >=
      getTimestamp(existing.created_at ?? existing.date)
    ) {
      latestByChat.set(chatId, message);
    }
  });

  latestByChat.forEach((record, chatId) => {
    sendApiUpdate({
      '@type': 'updateChatLastMessage',
      id: chatId,
      lastMessage: buildApiMessage(record, meId),
    });
  });
}

async function performSync() {
  const response = await workerRequest<WorkerSyncResponse>('/sync');

  const me = response.me ?? response.user ?? getCurrentWorkerProfile();

  if (!me) {
    throw new Error('NEOGRAM_PROFILE_NOT_FOUND');
  }

  const currentUser = buildApiUser(me, true);

  currentUserId = currentUser.id;
  currentCursor = response.cursor ?? currentCursor;

  const chats = Array.isArray(response.chats) ? response.chats : [];
  const profiles = Array.isArray(response.profiles) ? response.profiles : [];
  const messages = Array.isArray(response.messages) ? response.messages : [];

  emitCurrentUser(currentUser);
  emitEntities(profiles, chats, currentUser);
  emitMessages(messages, currentUser.id);
  emitChatsLastMessages(messages, currentUser.id);

  sendApiUpdate({
    '@type': 'updateConnectionState',
    connectionState: 'connectionStateReady',
  });

  return;
}

export async function syncWorkerData() {
  if (syncPromise) return syncPromise;

  syncPromise = performSync()
    .catch((error) => {
      emitError(error);
      throw error;
    })
    .finally(() => {
      syncPromise = undefined;
    });

  return syncPromise;
}

export async function fetchWorkerChats(): Promise<ApiChat[]> {
  const response = await workerRequest<{
    chats?: WorkerRecord[];
  }>('/chats');

  return (response.chats || []).map(buildApiChat);
}

export async function fetchWorkerMessages(chatId?: string): Promise<ApiMessage[]> {
  const path = chatId
    ? `/messages?chat_id=${encodeURIComponent(chatId)}`
    : '/messages';

  const response = await workerRequest<{
    messages?: WorkerRecord[];
  }>(path);

  return (response.messages || []).map((message) => {
    return buildApiMessage(message);
  });
}

export async function sendWorkerMessage(
  chatId: string,
  text: string,
): Promise<ApiMessage> {
  const normalizedText = text.trim();

  if (!chatId) {
    throw new Error('NEOGRAM_CHAT_REQUIRED');
  }

  if (!normalizedText) {
    throw new Error('NEOGRAM_MESSAGE_EMPTY');
  }

  const response = await workerRequest<WorkerMessageResponse>(
    '/messages/send',
    {
      method: 'POST',
      body: {
        chat_id: chatId,
        text: normalizedText,
      },
    },
  );

  if (!response.ok || !response.message) {
    throw new Error(response.code || response.error || 'MESSAGE_SEND_FAILED');
  }

  const message = buildApiMessage(
    response.message,
    currentUserId || '',
  );

  sendApiUpdate({
    '@type': 'newMessage',
    chatId: message.chatId,
    id: message.id,
    message,
  });

  sendApiUpdate({
    '@type': 'updateChatLastMessage',
    id: message.chatId,
    lastMessage: message,
  });

  return message;
}

export async function init(
  _initialArgs: ApiInitialArgs,
  onConnected?: NoneToVoidFunction,
) {
  if (isInitialized) {
    await syncWorkerData();
    onConnected?.();
    return;
  }

  sendApiUpdate({
    '@type': 'updateConnectionState',
    connectionState: 'connectionStateConnecting',
  });

  try {
    if (!getWorkerToken()) {
      throw new Error('NEOGRAM_AUTH_REQUIRED');
    }

    await syncWorkerData();

    isInitialized = true;

    sendApiUpdate({
      '@type': 'updateApiReady',
    });

    onConnected?.();
  } catch (error) {
    sendApiUpdate({
      '@type': 'updateConnectionState',
      connectionState: 'connectionStateBroken',
    });

    emitError(error);
    throw error;
  }
}

export async function fetchCurrentUser() {
  const profile = getCurrentWorkerProfile();

  if (profile) {
    const user = buildApiUser(profile, true);
    currentUserId = user.id;
    emitCurrentUser(user);
  }

  await syncWorkerData();
}

export function getClient(): TelegramClient {
  return client as TelegramClient;
}

export function setLanguageCode(_params: { langCode: string }) {
  // NeoGram does not initialize an MTProto client.
}

export function setIsPremium(_params: { isPremium: boolean }) {
  // Premium state is supplied by the NeoGram profile.
}

export async function destroy(
  _noLogOut = false,
  _noClearLocalDb = false,
) {
  client?.destroy();
  client = undefined;

  CHAT_ABORT_CONTROLLERS.forEach((controller) => controller.abort());
  CHAT_ABORT_CONTROLLERS.clear();

  ABORT_CONTROLLERS.forEach((controller) => controller.abort());
  ABORT_CONTROLLERS.clear();

  currentUserId = undefined;
  currentCursor = null;
  isInitialized = false;
  clearWorkerSession();
}

export function disconnect() {
  client?.disconnect();
}

export function handleGramJsUpdate(_update: unknown) {
  // Telegram MTProto updates are intentionally disabled.
}

export async function invokeWithAccount<T extends GramJs.AnyRequest>(
  _request: T,
  _connection?: ApiAccountConnection,
): Promise<T['__response'] | false | undefined> {
  return undefined;
}

export type InvokeRequestParams = {
  shouldThrow?: boolean;
  shouldIgnoreUpdates?: boolean;
  dcId?: number;
  shouldIgnoreErrors?: boolean;
  abortControllerChatId?: string;
  abortControllerThreadId?: ThreadId;
  abortControllerGroup?: 'call';
  shouldRetryOnTimeout?: boolean;
  shouldReturnTrue?: boolean;
};

export async function invokeRequest<T extends GramJs.AnyRequest>(
  _request: T,
  _params?: InvokeRequestParams,
): Promise<T['__response'] | true | undefined> {
  return undefined;
}

export function invokeRequestBeacon<T extends GramJs.AnyRequest>(
  _request: T,
  _dcId?: number,
) {
  // MTProto beacons are disabled.
}

export async function downloadMedia(
  _args: {
    url: string;
    mediaFormat: ApiMediaFormat;
    start?: number;
    end?: number;
  },
  _onProgress?: ApiOnProgress,
) {
  throw new Error('NEOGRAM_MEDIA_DOWNLOAD_NOT_SUPPORTED');
}

export async function uploadFile(
  _file: File,
  _onProgress?: ApiOnProgress,
) {
  throw new Error('NEOGRAM_FILE_UPLOAD_NOT_SUPPORTED');
}

export async function uploadAvatar(_params: ApiAvatarUpload) {
  throw new Error('NEOGRAM_AVATAR_UPLOAD_NOT_SUPPORTED');
}

export async function updateTwoFaSettings(_params: TwoFaParams) {
  throw new Error('NEOGRAM_TWO_FA_NOT_SUPPORTED');
}

export async function getTmpPassword(
  _currentPassword: string,
  _ttl?: number,
) {
  throw new Error('NEOGRAM_TWO_FA_NOT_SUPPORTED');
}

export async function getCurrentPassword(_currentPassword?: string) {
  throw new Error('NEOGRAM_TWO_FA_NOT_SUPPORTED');
}

export function abortChatRequests(params: {
  chatId: string;
  threadId?: ThreadId;
}) {
  const controller = CHAT_ABORT_CONTROLLERS.get(params.chatId);

  controller?.abort();
  CHAT_ABORT_CONTROLLERS.delete(params.chatId);
}

export function abortRequestGroup(group: string) {
  ABORT_CONTROLLERS.get(group)?.abort();
  ABORT_CONTROLLERS.delete(group);
}

export function dispatchErrorUpdate<T extends GramJs.AnyRequest>(
  error: Error,
  _request: T,
) {
  emitError(error);
}

export function requestChannelDifference(_channelId: string) {
  // No MTProto channel differences in NeoGram.
}

export function setOpenedChannelIds(_channelIds: string[]) {
  // Chat state is loaded through the NeoGram Worker.
}

export function setForceHttpTransport(_forceHttpTransport: boolean) {
  // Transport configuration is not applicable to the Worker.
}

export function setAllowHttpTransport(_allowHttpTransport: boolean) {
  // Transport configuration is not applicable to the Worker.
}

export function setShouldDebugExportedSenders(_value: boolean) {
  // MTProto sender debugging is disabled.
}

export function cancelWebTokenAuthorization(
  _params: { token: string },
): Promise<boolean | undefined> {
  return Promise.resolve(false);
}

export async function repairFileReference(_params: { url: string }) {
  return false;
}

export async function repairWebPageMedia(_url: string) {
  return false;
}

export async function refreshWorkerSession(token: string) {
  const result = await restoreWorkerSession(token);

  currentUserId = result.user.id;

  await syncWorkerData();

  return result;
}

export function getWorkerCursor() {
  return currentCursor;
}

export function getNeoGramCurrentUser() {
  return getCurrentWorkerUser();
}

export function getNeoGramCurrentProfile() {
  return getCurrentWorkerProfile();
}
