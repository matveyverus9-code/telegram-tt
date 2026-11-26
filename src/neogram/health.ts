
import NeoGramApi from './api';

export type NeoGramConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'checking';

export interface NeoGramHealth {
  status: NeoGramConnectionStatus;
  service: string | null;
  online: number | null;
  checkedAt: number | null;
  error: string | null;
}

const API_URL = 'https://tg-api.matveyverus9.workers.dev';

let health: NeoGramHealth = {
  status: 'disconnected',
  service: null,
  online: null,
  checkedAt: null,
  error: null,
};

const listeners = new Set<(value: NeoGramHealth) => void>();

function updateHealth(next: Partial<NeoGramHealth>) {
  health = {
    ...health,
    ...next,
  };

  listeners.forEach((listener) => {
    try {
      listener({ ...health });
    } catch (error) {
      console.error('[NeoGram Health] Listener error:', error);
    }
  });

  window.dispatchEvent(
    new CustomEvent('neogram:health-changed', {
      detail: { ...health },
    }),
  );
}

export function getHealth(): NeoGramHealth {
  return { ...health };
}

export function subscribeHealth(
  listener: (value: NeoGramHealth) => void,
): () => void {
  listeners.add(listener);

  listener(getHealth());

  return () => {
    listeners.delete(listener);
  };
}

export async function checkHealth(): Promise<NeoGramHealth> {
  updateHealth({
    status: 'checking',
    error: null,
  });

  try {
    const response = await NeoGramApi.request<{
      ok?: boolean;
      service?: string;
      online?: number;
    }>('/');

    if (response.ok !== true) {
      throw new Error('Сервер NeoGram недоступен');
    }

    updateHealth({
      status: 'connected',
      service: response.service ?? 'NeoGram API',
      online: typeof response.online === 'number'
        ? response.online
        : null,
      checkedAt: Date.now(),
      error: null,
    });
  } catch (error) {
    updateHealth({
      status: 'disconnected',
      service: null,
      online: null,
      checkedAt: Date.now(),
      error: error instanceof Error
        ? error.message
        : 'Ошибка подключения',
    });
  }

  return getHealth();
}

export function isConnected(): boolean {
  return health.status === 'connected';
}

export function getApiUrl(): string {
  return API_URL;
}

export default {
  getHealth,
  subscribeHealth,
  checkHealth,
  isConnected,
  getApiUrl,
};
