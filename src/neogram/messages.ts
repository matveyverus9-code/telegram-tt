
import {
  apiGet,
  apiPost,
} from './api';

export interface NeoGramMessage {
  id: number;
  chat: string;
  sender_id: number;
  body: string;
  created_at: string;
  username?: string | null;
}

export interface NeoGramMessagesResponse {
  ok: boolean;
  messages: NeoGramMessage[];
}

export interface NeoGramSendMessageResponse {
  ok: boolean;
  error?: string;
}

export interface NeoGramSendMessageParams {
  chatId: string;
  text: string;
}

function normalizeChatId(chatId: string): string {
  const normalized = chatId.trim();

  if (!normalized) {
    throw new Error('NEOGRAM_CHAT_ID_REQUIRED');
  }

  return normalized;
}

function normalizeMessageText(text: string): string {
  const normalized = text.trim();

  if (!normalized) {
    throw new Error('NEOGRAM_MESSAGE_EMPTY');
  }

  return normalized;
}

/**
 * Проверяет, относится ли ID чата к NeoGram Worker.
 */
export function isNeoGramChatId(chatId?: string): boolean {
  return Boolean(chatId && chatId.startsWith('chat_'));
}

/**
 * Загружает историю сообщений чата через Worker.
 */
export async function loadNeoGramMessages(
  chatId: string,
): Promise<NeoGramMessage[]> {
  const chat = normalizeChatId(chatId);

  const response = await apiGet<NeoGramMessagesResponse>(
    '/messages',
    { chat },
  );

  if (!response?.ok || !Array.isArray(response.messages)) {
    throw new Error('NEOGRAM_MESSAGES_LOAD_FAILED');
  }

  return response.messages
    .filter((message) => (
      message
      && typeof message.id === 'number'
      && typeof message.body === 'string'
      && typeof message.sender_id === 'number'
    ))
    .sort((a, b) => (
      new Date(a.created_at).getTime()
      - new Date(b.created_at).getTime()
    ));
}

/**
 * Отправляет текстовое сообщение через Worker.
 */
export async function sendNeoGramMessage({
  chatId,
  text,
}: NeoGramSendMessageParams): Promise<void> {
  const chat = normalizeChatId(chatId);
  const body = normalizeMessageText(text);

  const response = await apiPost<NeoGramSendMessageResponse>(
    '/messages/send',
    {
      chat,
      body,
    },
  );

  if (!response?.ok) {
    throw new Error(
      response?.error || 'NEOGRAM_MESSAGE_SEND_FAILED',
    );
  }
}

/**
 * Удобный метод: отправка и повторная загрузка истории.
 */
export async function sendAndReloadNeoGramMessages(
  params: NeoGramSendMessageParams,
): Promise<NeoGramMessage[]> {
  await sendNeoGramMessage(params);

  return loadNeoGramMessages(params.chatId);
}

export const NeoGramMessages = {
  isNeoGramChatId,
  load: loadNeoGramMessages,
  send: sendNeoGramMessage,
  sendAndReload: sendAndReloadNeoGramMessages,
};

export default NeoGramMessages;
