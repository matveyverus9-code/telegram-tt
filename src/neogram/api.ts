
const API_BASE_URL = 'https://tg-api.matveyverus9.workers.dev';

export interface NeoGramApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

export class NeoGramApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'NeoGramApiError';
    this.status = status;
  }
}

async function request<T = unknown>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(endpoint, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'omit',
    });
  } catch {
    throw new NeoGramApiError(
      'Не удалось подключиться к серверу NeoGram',
      0,
    );
  }

  let result: unknown;

  try {
    result = await response.json();
  } catch {
    throw new NeoGramApiError(
      'Сервер вернул некорректный JSON',
      response.status,
    );
  }

  if (!response.ok) {
    const message = (
      result
      && typeof result === 'object'
      && 'error' in result
      && typeof result.error === 'string'
    )
      ? result.error
      : `Ошибка сервера: ${response.status}`;

    throw new NeoGramApiError(message, response.status);
  }

  return result as T;
}

export async function getFragmentInfo<T = unknown>(
  params: Record<string, string> = {},
): Promise<T> {
  return request<T>('/fragment/info', params);
}

export async function searchPlayer<T = unknown>(
  query: string,
): Promise<T> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new NeoGramApiError('Введите запрос для поиска', 400);
  }

  return getFragmentInfo<T>({
    q: normalizedQuery,
  });
}

export async function checkApiStatus(): Promise<boolean> {
  try {
    const result = await request<{
      ok?: boolean;
      service?: string;
    }>('/');

    return result.ok === true;
  } catch {
    return false;
  }
}

export const NeoGramApi = {
  request,
  getFragmentInfo,
  searchPlayer,
  checkApiStatus,
};

export default NeoGramApi;
