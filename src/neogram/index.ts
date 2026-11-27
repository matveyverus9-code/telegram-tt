import type { NeoGramUser } from './api';

import {
  apiGet,
  getProfile,
} from './api';

import {
  getGlobal,
  setGlobal,
} from '../global';

interface NeoGramChat {
  id: string;
  type: 'private' | 'group' | 'channel';
  title: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  last_message_id?: number;
  role?: string;
  unread_count?: number;
  last_read_message_id?: number;
  last_message?: string;
  last_sender_id?: number;
  last_message_at?: string;
}

interface NeoGramChatsResponse {
  ok: boolean;
  chats: NeoGramChat[];
  next_before?: string | null;
}

interface NeoGramAuthEvent {
  token?: string;
  user?: NeoGramUser;
}

let isLoading = false;
let isAuthenticated = false;

function toUserId(id: string | number): string {
  return `user${id}`;
}

function toChatId(id: string): string {
  return id.startsWith('chat') ? id : `chat${id}`;
}

function buildUser(user: NeoGramUser) {
  const id = toUserId(user.id);
  const username = user.username?.replace(/^@/, '');

  return {
    id,
    isMin: false,
    isSelf: true as const,
    type: 'userTypeRegular' as const,
    firstName: username || user.phone || `Player ${user.id}`,
    phoneNumber: user.phone || '',
    hasUsername: Boolean(username),
    usernames: username
      ? [{
        username,
        isActive: true,
        isEditable: true,
      }]
      : undefined,
  };
}

function buildChat(chat: NeoGramChat) {
  const id = toChatId(chat.id);

  const type = chat.type === 'channel'
    ? 'chatTypeChannel'
    : chat.type === 'private'
      ? 'chatTypePrivate'
      : 'chatTypeBasicGroup';

  return {
    id,
    type,
    title: chat.title || 'NeoGram chat',
    isMin: false,
    creationDate: Math.floor(
      new Date(chat.created_at).getTime() / 1000,
    ) || Math.floor(Date.now() / 1000),
    isOwner: chat.role === 'owner',
    membersCount: undefined,
  };
}

async function loadNeoGramAccount(): Promise<void> {
  if (isLoading) return;

  isLoading = true;

  try {
    const [profile, chatsResponse] = await Promise.all([
      getProfile<NeoGramUser>(),
      apiGet<NeoGramChatsResponse>('/chats', {
        limit: 100,
      }),
    ]);

    if (!profile?.id) {
      throw new Error('NEOGRAM_PROFILE_NOT_FOUND');
    }

    if (!chatsResponse?.ok || !Array.isArray(chatsResponse.chats)) {
      throw new Error('NEOGRAM_CHATS_LOAD_FAILED');
    }

    const global = getGlobal();

    const userId = toUserId(profile.id);

    const usersById = {
      ...global.users.byId,
      [userId]: buildUser(profile),
    };

    const chatsById = {
      ...global.chats.byId,
    };

    const chatIds: string[] = [];

    const lastMessageIds = {
      ...(global.chats.lastMessageIds.all || {}),
    };

    chatsResponse.chats.forEach((chat) => {
      const convertedChat = buildChat(chat);

      chatsById[convertedChat.id] = convertedChat as typeof chatsById[string];
      chatIds.push(convertedChat.id);

      if (chat.last_message_id) {
        lastMessageIds[convertedChat.id] = chat.last_message_id;
      }
    });

    setGlobal({
      ...global,

      currentUserId: userId,

      connectionState: 'connectionStateReady',

      auth: {
        ...global.auth,
        state: 'authorizationStateReady',
        phoneNumber: profile.phone,
        isLoading: false,
        errorKey: undefined,
      },

      users: {
        ...global.users,
        byId: usersById,
      },

      chats: {
        ...global.chats,
        byId: chatsById,

        listIds: {
          ...global.chats.listIds,
          active: chatIds,
        },

        totalCount: {
          ...global.chats.totalCount,
          all: chatIds.length,
        },

        isFullyLoaded: {
          ...global.chats.isFullyLoaded,
          active: true,
        },

        lastMessageIds: {
          ...global.chats.lastMessageIds,
          all: lastMessageIds,
        },
      },
    });

    isAuthenticated = true;

    window.dispatchEvent(new CustomEvent('neogram:account-loaded', {
      detail: {
        user: profile,
        chats: chatsResponse.chats,
      },
    }));

    // eslint-disable-next-line no-console
    console.info('[NeoGram] Account loaded', {
      userId,
      chats: chatIds.length,
    });
  } catch (error) {
    isAuthenticated = false;

    // eslint-disable-next-line no-console
    console.error('[NeoGram] Account loading failed:', error);
  } finally {
    isLoading = false;
  }
}

function handleAuthenticated(event: Event): void {
  const customEvent = event as CustomEvent<NeoGramAuthEvent>;

  if (!customEvent.detail?.token && !customEvent.detail?.user) {
    // Токен уже сохранён модулем authenticate().
    // Профиль будет получен через авторизованный API.
  }

  void loadNeoGramAccount();
}

window.addEventListener(
  'neogram:authenticated',
  handleAuthenticated,
);

export function isNeoGramAuthenticated(): boolean {
  return isAuthenticated;
}

export async function refreshNeoGramAccount(): Promise<void> {
  await loadNeoGramAccount();
}
