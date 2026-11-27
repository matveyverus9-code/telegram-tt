import './styles/neogram.scss';

import {
  authenticateWithWorker,
  checkWorkerPhone,
  getWorkerToken,
} from './api/gramjs/methods/auth';

import {
  fetchWorkerChats,
  fetchWorkerMessages,
  sendWorkerMessage,
  syncWorkerData,
} from './api/gramjs/methods/client';

const API_URL = 'https://tg-api.gramjs.workers.dev';

type NeoGramTab = 'feed' | 'games' | 'chats' | 'settings';

type WorkerPhone = {
  phone: string;
  raw?: string;
  color?: string;
  price_usd?: number;
  reservation_expires_at?: number;
};

type WorkerChat = {
  id: string | number;
  title?: string;
  name?: string;
  username?: string;
  chat_type?: string;
  type?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  [key: string]: unknown;
};

type WorkerMessage = {
  id: string | number;
  text?: string;
  body?: string;
  message?: string;
  sender_id?: string | number;
  created_at?: string;
};

const TABS: Array<{
  id: NeoGramTab;
  label: string;
  icon: string;
}> = [
  {
    id: 'feed',
    label: 'Лента',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16M4 12h16M4 18.5h10"/><path d="M3 3.5h18v17H3z"/></svg>',
  },
  {
    id: 'games',
    label: 'Игры',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1 3.2a2.5 2.5 0 0 1-4.1 1.1L13.5 16h-3l-2.2 1.5a2.5 2.5 0 0 1-4.1-1.1l-1-3.2A4 4 0 0 1 7 8Z"/><path d="M7.5 11v4M5.5 13h4M16.5 12h.01M18.5 14h.01"/></svg>',
  },
  {
    id: 'chats',
    label: 'Чаты',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4H12a8 8 0 0 1 8 7.5Z"/><path d="M8 11h8M8 14.5h5"/></svg>',
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"/></svg>',
  },
];

let mounted = false;
let activeTab: NeoGramTab = 'feed';
let selectedPhone = '';
let phoneNumbers: WorkerPhone[] = [];
let chats: WorkerChat[] = [];
let currentChatId = '';
let isLoadingPhones = false;
let isLoadingChats = false;

let root: HTMLElement | undefined;
let sheet: HTMLElement | undefined;
let page: HTMLElement | undefined;
let navigation: HTMLElement | undefined;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getChatId(chat: WorkerChat): string {
  return String(chat.id);
}

function getChatTitle(chat: WorkerChat): string {
  return String(chat.title || chat.name || chat.username || 'Чат');
}

function formatPrice(price?: number): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return 'Цена не указана';
  }

  return `$${price.toFixed(2)}`;
}

function iconMarkup(name: string): string {
  const icons: Record<string, string> = {
    feed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16M4 12h16M4 18.5h10"/><path d="M3 3.5h18v17H3z"/></svg>',
    games: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a4 4 0 0 1 3.8 5.2l-1 3.2a2.5 2.5 0 0 1-4.1 1.1L13.5 16h-3l-2.2 1.5a2.5 2.5 0 0 1-4.1-1.1l-1-3.2A4 4 0 0 1 7 8Z"/><path d="M7.5 11v4M5.5 13h4M16.5 12h.01M18.5 14h.01"/></svg>',
    chats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4H12a8 8 0 0 1 8 7.5Z"/><path d="M8 11h8M8 14.5h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.8 1.8 0 0 0 .9 2.1 1.8 1.8 0 0 1-2.5 2.5 1.8 1.8 0 0 0-2.1-.9 1.8 1.8 0 0 0-1.2 1.7 1.8 1.8 0 0 1-3.6 0 1.8 1.8 0 0 0-1.2-1.7 1.8 1.8 0 0 0-2.1.9 1.8 1.8 0 0 1-2.5-2.5A1.8 1.8 0 0 0 6 15a1.8 1.8 0 0 0-1.7-1.2 1.8 1.8 0 0 1 0-3.6A1.8 1.8 0 0 0 6 9a1.8 1.8 0 0 0-.9-2.1 1.8 1.8 0 0 1 2.5-2.5 1.8 1.8 0 0 0 2.1.9 1.8 1.8 0 0 0 1.2-1.7 1.8 1.8 0 0 1 3.6 0 1.8 1.8 0 0 0 1.2 1.7 1.8 1.8 0 0 0 2.1-.9 1.8 1.8 0 0 1 2.5 2.5A1.8 1.8 0 0 0 19.4 9a1.8 1.8 0 0 0 1.7 1.2 1.8 1.8 0 0 1 0 3.6 1.8 1.8 0 0 0-1.7 1.2Z"/></svg>',
  };

  return icons[name] || '';
}

function showError(container: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  const errorNode = document.createElement('p');
  errorNode.className = 'ng-error';
  errorNode.textContent = message;

  container.appendChild(errorNode);
}

async function workerPublicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const result = await response.json() as T;

  if (!response.ok) {
    throw new Error(`WORKER_HTTP_${response.status}`);
  }

  return result;
}

function createSheet(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'neogram-sheet';
  overlay.hidden = true;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeSheet();
    }
  });

  document.body.appendChild(overlay);

  return overlay;
}

function openSheet(content: string): void {
  if (!sheet) return;

  sheet.innerHTML = `
    <section class="ng-sheet-panel" role="dialog" aria-modal="true">
      <div class="ng-sheet-grabber"></div>
      ${content}
    </section>
  `;

  sheet.hidden = false;
}

function closeSheet(): void {
  if (!sheet) return;

  sheet.hidden = true;
  sheet.replaceChildren();
}

function renderPhonePicker(): void {
  const options = phoneNumbers.map((number) => {
    const phone = escapeHtml(number.phone);
    const selected = number.phone === selectedPhone;

    return `
      <button
        type="button"
        class="ng-phone-option ${selected ? 'selected' : ''}"
        data-phone="${phone}"
      >
        <span>
          <span class="ng-phone-number">${phone}</span>
          <br>
          <span class="ng-phone-price">${escapeHtml(formatPrice(number.price_usd))}</span>
        </span>
        <span aria-hidden="true">${selected ? '✓' : '›'}</span>
      </button>
    `;
  }).join('');

  openSheet(`
    <h2 class="ng-sheet-heading">Твой номер NeoGram</h2>
    <p class="ng-sheet-description">
      Выбери доступный номер с кодом +888. После выбора можно продолжить вход или регистрацию.
    </p>
    <div class="ng-phone-list">
      ${options || '<div class="ng-empty">Нет доступных номеров</div>'}
    </div>
    <button class="ng-primary-button" id="ng-phone-continue" type="button" ${selectedPhone ? '' : 'disabled'}>
      Продолжить
    </button>
    <button class="ng-secondary-button" id="ng-phone-reload" type="button">
      Обновить список
    </button>
  `);

  sheet?.querySelectorAll<HTMLButtonElement>('[data-phone]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedPhone = button.dataset.phone || '';
      renderPhonePicker();
    });
  });

  sheet?.querySelector('#ng-phone-continue')?.addEventListener('click', () => {
    if (selectedPhone) {
      renderPinEntry(selectedPhone);
    }
  });

  sheet?.querySelector('#ng-phone-reload')?.addEventListener('click', () => {
    void loadPhoneNumbers();
  });
}

async function loadPhoneNumbers(): Promise<void> {
  if (isLoadingPhones) return;

  isLoadingPhones = true;

  openSheet(`
    <h2 class="ng-sheet-heading">Номера +888</h2>
    <p class="ng-loading">Загружаем доступные номера…</p>
  `);

  try {
    const result = await workerPublicRequest<{
      ok: boolean;
      numbers: WorkerPhone[];
    }>('/generate-phone');

    if (!result.ok || !Array.isArray(result.numbers)) {
      throw new Error('PHONE_LIST_UNAVAILABLE');
    }

    phoneNumbers = result.numbers;
    selectedPhone = phoneNumbers[0]?.phone || '';

    renderPhonePicker();
  } catch (error) {
    openSheet(`
      <h2 class="ng-sheet-heading">Не удалось загрузить номера</h2>
      <p class="ng-sheet-description">Проверь подключение к NeoGram Worker и попробуй ещё раз.</p>
      <p class="ng-error">${escapeHtml(error instanceof Error ? error.message : error)}</p>
      <button class="ng-primary-button" id="ng-phone-retry" type="button">Повторить</button>
      <button class="ng-secondary-button" id="ng-phone-close" type="button">Закрыть</button>
    `);

    sheet?.querySelector('#ng-phone-retry')?.addEventListener('click', () => {
      void loadPhoneNumbers();
    });

    sheet?.querySelector('#ng-phone-close')?.addEventListener('click', closeSheet);
  } finally {
    isLoadingPhones = false;
  }
}

function renderPinEntry(phone: string): void {
  openSheet(`
    <h2 class="ng-sheet-heading">Вход в NeoGram</h2>
    <p class="ng-sheet-description">
      Номер <strong>${escapeHtml(phone)}</strong>. Введи четырёхзначный PIN.
    </p>
    <input
      id="ng-pin"
      class="ng-pin-input"
      type="password"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="4"
      placeholder="••••"
      aria-label="Четырёхзначный PIN"
    >
    <div id="ng-auth-error" aria-live="polite"></div>
    <button class="ng-primary-button" id="ng-auth-submit" type="button">Войти</button>
    <button class="ng-secondary-button" id="ng-auth-back" type="button">Назад к номерам</button>
  `);

  const pinInput = sheet?.querySelector<HTMLInputElement>('#ng-pin');
  const submit = sheet?.querySelector<HTMLButtonElement>('#ng-auth-submit');
  const errorContainer = sheet?.querySelector<HTMLElement>('#ng-auth-error');

  pinInput?.focus();

  pinInput?.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
  });

  sheet?.querySelector('#ng-auth-back')?.addEventListener('click', renderPhonePicker);

  submit?.addEventListener('click', async () => {
    const pin = pinInput?.value || '';

    if (!/^\d{4}$/.test(pin)) {
      if (errorContainer) {
        errorContainer.textContent = 'PIN должен состоять из четырёх цифр.';
        errorContainer.className = 'ng-error';
      }
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Проверяем…';

    try {
      await checkWorkerPhone(phone);
      await authenticateWithWorker(phone, pin);
      closeSheet();

      window.dispatchEvent(new CustomEvent('neogram:authenticated', {
        detail: { phone },
      }));

      await syncWorkerData();
      renderPage();
    } catch (error) {
      if (errorContainer) {
        errorContainer.textContent = error instanceof Error
          ? error.message
          : String(error);
        errorContainer.className = 'ng-error';
      }

      submit.disabled = false;
      submit.textContent = 'Войти';
    }
  });
}

function createNavigation(): HTMLElement {
  const nav = document.createElement('nav');
  nav.id = 'neogram-navigation';
  nav.setAttribute('aria-label', 'NeoGram');

  TABS.forEach((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ng-tab';
    button.dataset.tab = tab.id;
    button.innerHTML = `${tab.icon}<span>${tab.label}</span>`;

    button.addEventListener('click', () => {
      activeTab = tab.id;
      renderPage();
    });

    nav.appendChild(button);
  });

  return nav;
}

function createScreen(id: NeoGramTab): HTMLElement {
  const screen = document.createElement('main');
  screen.className = 'ng-screen';
  screen.dataset.screen = id;
  screen.hidden = true;

  return screen;
}

function createPinnedChat(
  title: string,
  description: string,
  icon: string,
  chat?: WorkerChat,
): string {
  const chatId = chat ? getChatId(chat) : '';

  return `
    <button
      type="button"
      class="ng-list-item"
      ${chatId ? `data-open-chat="${escapeHtml(chatId)}"` : 'data-pinned-placeholder="true"'}
    >
      <span class="ng-list-icon">${icon}</span>
      <span class="ng-list-copy">
        <span class="ng-list-name">${escapeHtml(title)}</span>
        <span class="ng-list-description">${escapeHtml(description)}</span>
      </span>
      <span class="ng-chevron">›</span>
    </button>
  `;
}

function renderFeed(screen: HTMLElement): void {
  const official = chats.find((chat) => {
    const value = `${chat.title || ''} ${chat.name || ''} ${chat.username || ''}`.toLowerCase();
    return value.includes('official') || value.includes('официаль');
  });

  screen.innerHTML = `
    <h1 class="ng-screen-title">Лента</h1>
    <p class="ng-screen-subtitle">Новости и события NeoGram</p>
    <section class="ng-card">
      <h2 class="ng-card-title">Добро пожаловать в NeoGram</h2>
      <p class="ng-muted">Твоя лента сообщества, игровые события и обновления платформы.</p>
    </section>
    <h2 class="ng-card-title">Закреплённое</h2>
    <div class="ng-list">
      ${createPinnedChat(
        'Официальный канал',
        official ? getChatTitle(official) : 'Официальные новости NeoGram',
        '✦',
        official,
      )}
      ${createPinnedChat(
        'Общий чат',
        'Общение участников NeoGram',
        '◎',
        chats.find((chat) => {
          const value = `${chat.title || ''} ${chat.name || ''}`.toLowerCase();
          return value.includes('общий') || value.includes('general');
        }),
      )}
    </div>
  `;

  bindPinnedChatActions(screen);
}

function renderGames(screen: HTMLElement): void {
  screen.innerHTML = `
    <h1 class="ng-screen-title">Игры</h1>
    <p class="ng-screen-subtitle">Игровой раздел NeoGram</p>
    <section class="ng-card">
      <h2 class="ng-card-title">Игровой центр</h2>
      <p class="ng-muted">Здесь будут доступны игры, игровые события и достижения NeoGram.</p>
    </section>
    <section class="ng-card">
      <h2 class="ng-card-title">Скоро</h2>
      <p class="ng-muted">Игровые функции подключаются отдельно от Telegram MTProto.</p>
    </section>
  `;
}

function renderChats(screen: HTMLElement): void {
  const items = chats.map((chat) => `
    <button type="button" class="ng-list-item" data-open-chat="${escapeHtml(getChatId(chat))}">
      <span class="ng-list-icon">✉</span>
      <span class="ng-list-copy">
        <span class="ng-list-name">${escapeHtml(getChatTitle(chat))}</span>
        <span class="ng-list-description">${escapeHtml(chat.last_message || 'Открыть переписку')}</span>
      </span>
      <span class="ng-chevron">›</span>
    </button>
  `).join('');

  screen.innerHTML = `
    <h1 class="ng-screen-title">Чаты</h1>
    <p class="ng-screen-subtitle">Твои переписки NeoGram</p>
    <div class="ng-list">
      ${items || '<div class="ng-empty">Чаты пока не загружены</div>'}
    </div>
  `;

  bindPinnedChatActions(screen);
}

function renderSettings(screen: HTMLElement): void {
  const tokenPresent = Boolean(getWorkerToken());

  screen.innerHTML = `
    <h1 class="ng-screen-title">Настройки</h1>
    <section class="ng-card">
      <h2 class="ng-card-title">Аккаунт NeoGram</h2>
      <p class="ng-muted">${tokenPresent ? 'Сессия авторизации активна.' : 'Нет активной сессии NeoGram.'}</p>
      <button type="button" class="ng-primary-button" id="ng-change-number">
        ${tokenPresent ? 'Добавить или сменить номер' : 'Выбрать номер +888'}
      </button>
    </section>
    <section class="ng-card">
      <h2 class="ng-card-title">О приложении</h2>
      <p class="ng-muted">NeoGram — интерфейс поверх Telegram с отдельным REST Worker для функций NeoGram.</p>
    </section>
  `;

  screen.querySelector('#ng-change-number')?.addEventListener('click', () => {
    void loadPhoneNumbers();
  });
}

function renderChatConversation(chatId: string): void {
  const chat = chats.find((item) => getChatId(item) === chatId);

  if (!chat || !page) return;

  currentChatId = chatId;

  page.innerHTML = `
    <section class="ng-screen">
      <button type="button" class="ng-secondary-button" id="ng-back-chats">‹ Назад к чатам</button>
      <h1 class="ng-screen-title">${escapeHtml(getChatTitle(chat))}</h1>
      <div id="ng-message-list" class="ng-list">
        <div class="ng-loading">Загружаем сообщения…</div>
      </div>
      <form id="ng-send-form" class="ng-card">
        <input id="ng-message-input" type="text" placeholder="Сообщение…" autocomplete="off">
        <button class="ng-primary-button" type="submit">Отправить</button>
      </form>
    </section>
  `;

  page.querySelector('#ng-back-chats')?.addEventListener('click', () => {
    currentChatId = '';
    activeTab = 'chats';
    renderPage();
  });

  const messageList = page.querySelector<HTMLElement>('#ng-message-list');

  void fetchWorkerMessages(chatId)
    .then((messages) => {
      if (!messageList) return;

      messageList.innerHTML = (messages as unknown as WorkerMessage[]).map((message) => `
        <article class="ng-card">
          <p>${escapeHtml(message.text || message.body || message.message || '')}</p>
          <span class="ng-muted">${escapeHtml(message.created_at || '')}</span>
        </article>
      `).join('') || '<div class="ng-empty">Сообщений пока нет</div>';
    })
    .catch((error) => {
      if (messageList) {
        messageList.innerHTML = '';
        showError(messageList, error);
      }
    });

  page.querySelector('#ng-send-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const input = page?.querySelector<HTMLInputElement>('#ng-message-input');
    const text = input?.value.trim();

    if (!text) return;

    const button = page?.querySelector<HTMLButtonElement>('#ng-send-form button[type="submit"]');
    if (button) button.disabled = true;

    try {
      await sendWorkerMessage(chatId, text);
      if (input) input.value = '';

      const messages = await fetchWorkerMessages(chatId);
      if (messageList) {
        messageList.innerHTML = (messages as unknown as WorkerMessage[]).map((message) => `
          <article class="ng-card">
            <p>${escapeHtml(message.text || message.body || message.message || '')}</p>
            <span class="ng-muted">${escapeHtml(message.created_at || '')}</span>
          </article>
        `).join('') || '<div class="ng-empty">Сообщений пока нет</div>';
      }
    } catch (error) {
      if (messageList) showError(messageList, error);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function bindPinnedChatActions(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('[data-open-chat]').forEach((item) => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.openChat;
      if (chatId) renderChatConversation(chatId);
    });
  });

  container.querySelectorAll<HTMLElement>('[data-pinned-placeholder]').forEach((item) => {
    item.addEventListener('click', () => {
      const status = document.createElement('p');
      status.className = 'ng-status';
      status.textContent = 'Этот чат ещё не найден в списке чатов Worker.';
      item.insertAdjacentElement('afterend', status);
    });
  });
}

function renderPage(): void {
  if (!root || !page || !navigation) return;

  page.replaceChildren();

  const screens: Record<NeoGramTab, HTMLElement> = {
    feed: createScreen('feed'),
    games: createScreen('games'),
    chats: createScreen('chats'),
    settings: createScreen('settings'),
  };

  Object.values(screens).forEach((screen) => page?.appendChild(screen));

  renderFeed(screens.feed);
  renderGames(screens.games);
  renderChats(screens.chats);
  renderSettings(screens.settings);

  Object.entries(screens).forEach(([id, screen]) => {
    screen.hidden = id !== activeTab;
  });

  navigation.querySelectorAll<HTMLButtonElement>('.ng-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === activeTab);
    button.setAttribute('aria-current', button.dataset.tab === activeTab ? 'page' : 'false');
  });
}

async function loadChats(): Promise<void> {
  if (isLoadingChats) return;

  isLoadingChats = true;

  try {
    chats = await fetchWorkerChats() as unknown as WorkerChat[];
  } catch (error) {
    console.error('[NeoGram] Chat loading failed:', error);
  } finally {
    isLoadingChats = false;
    renderPage();
  }
}

function openBossPanel(): void {
  const existing = root?.querySelector<HTMLElement>('#ng-boss-panel');
  if (!existing) return;

  existing.hidden = !existing.hidden;
}

function createBossButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ng-boss-button';
  button.textContent = 'BOSS777';
  button.setAttribute('aria-label', 'Открыть панель BOSS777');

  button.addEventListener('click', openBossPanel);

  return button;
}

function createBossPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.id = 'ng-boss-panel';
  panel.className = 'ng-boss-panel';
  panel.hidden = true;

  panel.innerHTML = `
    <h2 class="ng-card-title">BOSS777 · Админка</h2>
    <p class="ng-muted">Административные API-методы Worker не входят в текущий публичный контракт. Панель не отправляет неподтверждённые команды.</p>
    <p class="ng-muted">Статус сессии: <strong>${getWorkerToken() ? 'авторизована' : 'не авторизована'}</strong></p>
  `;

  return panel;
}

function mountNeoGram(): void {
  if (mounted || document.getElementById('neogram-root')) return;

  mounted = true;

  root = document.createElement('div');
  root.id = 'neogram-root';

  page = document.createElement('div');
  page.id = 'neogram-pages';
  page.style.cssText = 'display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden;';

  navigation = createNavigation();

  root.append(page, navigation, createBossButton());

  const bossPanel = createBossPanel();
  page.appendChild(bossPanel);

  document.body.appendChild(root);

  sheet = createSheet();

  renderPage();

  if (getWorkerToken()) {
    void syncWorkerData()
      .then(loadChats)
      .catch((error) => console.error('[NeoGram] Initial sync failed:', error));
  } else {
    void loadPhoneNumbers();
  }

  console.info('[NeoGram] Interface mounted');
}

function handleTelegramReady(): void {
  mountNeoGram();
}

function handleAuthenticated(): void {
  void syncWorkerData()
    .then(loadChats)
    .catch((error) => console.error('[NeoGram] Sync after auth failed:', error));
}

window.addEventListener('neogram:telegram-ready', handleTelegramReady);
window.addEventListener('neogram:authenticated', handleAuthenticated);

export {
  mountNeoGram,
  API_URL,
};
