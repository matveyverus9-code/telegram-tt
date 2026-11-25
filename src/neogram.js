
const API_BASE = 'https://tg-api.matveyverus9.workers.dev';

const STORAGE = {
  token: 'neogram_token',
  user: 'neogram_user',
  chats: 'neogram_chats',
  device: 'neogram_device_id',
};

const PINNED_CHATS = [
  {
    id: 'official_channel',
    title: 'Официальный канал',
    subtitle: 'Новости и объявления NeoGram',
    kind: 'channel',
    pinned: true,
  },
  {
    id: 'global',
    title: 'Общий чат',
    subtitle: 'Общение сообщества NeoGram',
    kind: 'global',
    pinned: true,
  },
];

const state = {
  token: localStorage.getItem(STORAGE.token) || '',
  user: readJson(STORAGE.user, null),
  chats: readJson(STORAGE.chats, []),
  activeTab: 'chats',
  activeChat: null,
  messages: [],
  search: '',
  searchResults: [],
  searchLoading: false,
  searchError: '',
  messageDraft: '',
  loadingMessages: false,
  sendingMessage: false,
  screen: 'main',
  authPhone: '+888',
  authPin: '',
  authError: '',
  authLoading: false,
  profileTarget: null,
  toast: '',
  feedMessages: [],
  feedLoading: false,
  leaderboard: [],
  leaderboardLoading: false,
  wallet: null,
  walletLoading: false,
  numbers: [],
  numbersLoading: false,
  numbersError: '',
  sheet: '',
  selectedNumber: null,
  settingsTheme: localStorage.getItem('neogram_theme') || 'system',
};

let root;
let searchTimer;
let toastTimer;
let messagePollTimer;
let searchRequestNumber = 0;

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[NeoGram] Storage error:', error);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getDeviceId() {
  let id = localStorage.getItem(STORAGE.device);
  if (!id) {
    id = `ng-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(STORAGE.device, id);
  }
  return id;
}

function getHeaders(json = false) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return headers;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...getHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Некорректный ответ сервера (${response.status})`);
  }

  if (!response.ok || data?.ok === false || data?.error) {
    throw new Error(String(
      data?.detail || data?.message || data?.error || `Ошибка сервера (${response.status})`
    ));
  }
  return data;
}

function showToast(message) {
  state.toast = message;
  renderToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = '';
    renderToast();
  }, 2600);
}

function renderToast() {
  const existing = document.querySelector('.ng-toast');
  if (!state.toast) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = state.toast;
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'ng-toast';
  toast.textContent = state.toast;
  document.body.appendChild(toast);
}

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const user = raw.user || raw.profile || raw.player || raw;
  const id = user.id ?? user.user_id ?? user.uid ?? user.telegram_id;
  if (id === undefined || id === null) return null;

  return {
    id: String(id),
    username: user.username || user.user_name || user.nick || '',
    firstName: user.first_name || user.firstName || user.name || user.username || 'Игрок',
    lastName: user.last_name || user.lastName || '',
    phone: user.phone || user.phone_number || '',
    avatar: user.avatar || user.photo || user.photo_url || user.avatar_url || '',
    isCreator: Boolean(user.is_creator || user.isCreator || user.creator),
    isHold: Boolean(user.is_hold || user.isHold || user.hold),
    isMajor: Boolean(user.is_major || user.isMajor || user.major),
    raw: user,
  };
}

function getUserName(user) {
  if (!user) return 'Игрок';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.username || 'Игрок';
}

function getInitials(user) {
  return escapeHtml(getUserName(user).slice(0, 1).toUpperCase() || 'N');
}

function getAvatar(user, extraClass = '') {
  if (user?.avatar) {
    return `<div class="ng-avatar ${extraClass}">
      <img src="${escapeHtml(user.avatar)}" alt="" referrerpolicy="no-referrer">
    </div>`;
  }
  return `<div class="ng-avatar ${extraClass}">${getInitials(user)}</div>`;
}

function getUserBadges(user) {
  if (!user) return '';
  const badges = [];
  if (user.isCreator) badges.push('<span class="ng-badge creator">Создатель</span>');
  if (user.isHold) badges.push('<span class="ng-badge hold">Hold</span>');
  if (user.isMajor) badges.push('<span class="ng-badge major">Major</span>');
  return badges.join('');
}

function getCurrentUserId() {
  return state.user?.id ?? state.user?.user_id ?? null;
}

function normalizeChatList() {
  const unique = new Map();
  PINNED_CHATS.forEach((chat) => unique.set(chat.id, chat));
  state.chats.forEach((chat) => {
    if (chat?.id && !unique.has(chat.id)) unique.set(chat.id, chat);
  });
  state.chats = [...unique.values()].filter((chat) => !chat.pinned);
  saveJson(STORAGE.chats, state.chats);
}

function getAllChats() {
  normalizeChatList();
  return [...PINNED_CHATS, ...state.chats];
}

function makeDirectChatId(firstId, secondId) {
  const ids = [String(firstId), String(secondId)].sort((a, b) => {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right)
      ? left - right : a.localeCompare(b);
  });
  return `dm_${ids[0]}_${ids[1]}`;
}

function saveDirectChat(user) {
  const myId = getCurrentUserId();
  if (!myId || !user?.id || String(myId) === String(user.id)) return null;

  const id = makeDirectChatId(myId, user.id);
  let chat = state.chats.find((item) => item.id === id);
  const updated = {
    id,
    title: getUserName(user),
    subtitle: user.username ? `@${user.username}` : (user.phone || 'Личный чат'),
    kind: 'direct',
    user,
    updatedAt: Date.now(),
    pinned: false,
  };

  if (chat) Object.assign(chat, updated);
  else {
    chat = updated;
    state.chats.unshift(chat);
  }
  saveJson(STORAGE.chats, state.chats);
  return chat;
}

function renderStyles() {
  if (document.getElementById('neogram-styles')) return;

  const style = document.createElement('style');
  style.id = 'neogram-styles';
  style.textContent = `
    :root {
      color-scheme: light dark;
      --ng-bg:#f2f2f7; --ng-card:rgba(255,255,255,.88); --ng-solid:#fff;
      --ng-text:#111116; --ng-secondary:#8e8e93; --ng-separator:rgba(60,60,67,.14);
      --ng-blue:#007aff; --ng-green:#30b45a; --ng-input:rgba(118,118,128,.12);
      --ng-glass:rgba(249,249,249,.78); --ng-shadow:0 10px 35px rgba(0,0,0,.12);
    }
    @media(prefers-color-scheme:dark) {
      :root:not([data-ng-theme="light"]) {
        --ng-bg:#000; --ng-card:rgba(28,28,30,.92); --ng-solid:#1c1c1e;
        --ng-text:#fff; --ng-secondary:#98989f; --ng-separator:rgba(84,84,88,.55);
        --ng-blue:#0a84ff; --ng-green:#30d158; --ng-input:rgba(118,118,128,.24);
        --ng-glass:rgba(28,28,30,.82); --ng-shadow:0 10px 35px rgba(0,0,0,.35);
      }
    }
    :root[data-ng-theme="dark"] {
      color-scheme:dark; --ng-bg:#000; --ng-card:rgba(28,28,30,.92); --ng-solid:#1c1c1e;
      --ng-text:#fff; --ng-secondary:#98989f; --ng-separator:rgba(84,84,88,.55);
      --ng-blue:#0a84ff; --ng-green:#30d158; --ng-input:rgba(118,118,128,.24);
      --ng-glass:rgba(28,28,30,.82); --ng-shadow:0 10px 35px rgba(0,0,0,.35);
    }
    :root[data-ng-theme="light"] { color-scheme:light; }
    * {box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html,body,#root,#neogram-root {width:100%;height:100%;min-height:100%;margin:0}
    body {
      overflow:hidden;background:var(--ng-bg);color:var(--ng-text);
      font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif;
      -webkit-font-smoothing:antialiased;overscroll-behavior:none;-webkit-text-size-adjust:100%;
    }
    #neogram-root {
      position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
      padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);
      background:var(--ng-bg);overflow:hidden;user-select:none;-webkit-user-select:none;
    }
    #neogram-root input,#neogram-root textarea {user-select:text;-webkit-user-select:text;font-size:16px}
    button {font-family:inherit}
    .ng-screen {min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}
    .ng-header {flex:0 0 auto;padding:10px 16px 8px;background:var(--ng-bg)}
    .ng-header-line {display:flex;align-items:center;justify-content:space-between;min-height:42px;gap:12px}
    .ng-title {font-size:32px;line-height:38px;font-weight:760;letter-spacing:-.8px}
    .ng-header-action,.ng-link {border:0;background:transparent;color:var(--ng-blue);font:inherit;font-size:16px;padding:8px 2px;cursor:pointer}
    .ng-search-wrap {margin-top:8px;position:relative}
    .ng-search {width:100%;height:38px;border:0;border-radius:11px;outline:none;padding:0 14px 0 36px;color:var(--ng-text);background:var(--ng-input);font:inherit;appearance:none}
    .ng-search-icon {position:absolute;left:12px;top:8px;font-size:18px;color:var(--ng-secondary);pointer-events:none}
    .ng-scroll {flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 0 22px}
    .ng-section-label {padding:20px 16px 7px;color:var(--ng-secondary);font-size:12px;font-weight:650;letter-spacing:.45px;text-transform:uppercase}
    .ng-list {margin:0 16px;overflow:hidden;border-radius:13px;background:var(--ng-card)}
    .ng-chat-row,.ng-result {width:100%;min-height:72px;display:flex;align-items:center;gap:12px;padding:10px 14px;border:0;border-bottom:1px solid var(--ng-separator);background:transparent;color:var(--ng-text);text-align:left;font:inherit;cursor:pointer}
    .ng-chat-row:last-child,.ng-result:last-child {border-bottom:0}
    .ng-chat-row:active,.ng-result:active {background:var(--ng-input)}
    .ng-avatar {flex:0 0 50px;width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,#70b7ff,#7668dc);color:white;font-size:22px;font-weight:650}
    .ng-avatar img {width:100%;height:100%;object-fit:cover}
    .ng-avatar.small {width:44px;height:44px;flex-basis:44px;font-size:18px}
    .ng-chat-copy,.ng-result-copy {min-width:0;flex:1}
    .ng-chat-title {font-size:16px;font-weight:650;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ng-chat-subtitle {color:var(--ng-secondary);font-size:14px;line-height:19px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ng-chevron {color:var(--ng-secondary);font-size:23px;font-weight:300}
    .ng-bottom {flex:0 0 auto;display:flex;justify-content:space-around;padding:7px 5px 5px;min-height:61px;border-top:1px solid var(--ng-separator);background:var(--ng-glass);-webkit-backdrop-filter:blur(25px) saturate(180%);backdrop-filter:blur(25px) saturate(180%)}
    .ng-tab {flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:transparent;color:var(--ng-secondary);font:inherit;font-size:10px;font-weight:600;cursor:pointer}
    .ng-tab.active {color:var(--ng-blue)}
    .ng-tab-icon {font-size:22px;line-height:24px}
    .ng-empty {padding:28px 18px;color:var(--ng-secondary);text-align:center;font-size:14px;line-height:21px}
    .ng-result-name {font-size:16px;font-weight:650;line-height:22px}
    .ng-result-meta {margin-top:3px;color:var(--ng-secondary);font-size:13px;line-height:18px;overflow-wrap:anywhere}
    .ng-badges {display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
    .ng-badge {display:inline-flex;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:700;line-height:14px}
    .ng-badge.creator {background:rgba(0,122,255,.14);color:var(--ng-blue)}
    .ng-badge.hold {background:rgba(255,149,0,.16);color:#d97706}
    .ng-badge.major {background:rgba(48,180,90,.16);color:#249447}
    .ng-chat-screen-header {min-height:50px;display:flex;align-items:center;gap:12px;padding:5px 14px 9px;border-bottom:1px solid var(--ng-separator)}
    .ng-back {border:0;background:transparent;color:var(--ng-blue);font:inherit;font-size:16px;padding:7px 0;cursor:pointer}
    .ng-chat-screen-title {flex:1;min-width:0;text-align:center;font-size:16px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ng-messages {flex:1;min-height:0;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:7px;-webkit-overflow-scrolling:touch}
    .ng-message {max-width:84%;padding:9px 12px 7px;border-radius:17px;background:var(--ng-card);color:var(--ng-text);font-size:16px;line-height:21px;overflow-wrap:anywhere;box-shadow:0 1px 2px rgba(0,0,0,.04)}
    .ng-message.mine {align-self:flex-end;color:white;background:var(--ng-blue);border-bottom-right-radius:5px}
    .ng-message.theirs {align-self:flex-start;border-bottom-left-radius:5px}
    .ng-message-author {margin-bottom:3px;font-size:12px;font-weight:700;opacity:.8}
    .ng-message-time {margin-top:4px;text-align:right;font-size:10px;opacity:.65}
    .ng-composer {flex:0 0 auto;display:flex;align-items:flex-end;gap:8px;padding:9px 12px calc(9px + env(safe-area-inset-bottom));border-top:1px solid var(--ng-separator);background:var(--ng-glass);backdrop-filter:blur(20px)}
    .ng-composer textarea {flex:1;min-height:38px;max-height:110px;resize:none;border:1px solid var(--ng-separator);border-radius:19px;outline:none;padding:9px 13px;color:var(--ng-text);background:var(--ng-card);font:inherit;line-height:20px}
    .ng-send {width:38px;height:38px;flex:0 0 38px;border:0;border-radius:50%;background:var(--ng-blue);color:white;font-size:18px;cursor:pointer}
    .ng-send:disabled {opacity:.45}
    .ng-card {margin:12px 16px;padding:16px;border-radius:16px;background:var(--ng-card);box-shadow:0 1px 2px rgba(0,0,0,.025)}
    .ng-card-title {font-size:18px;font-weight:720;margin-bottom:5px}
    .ng-muted {color:var(--ng-secondary);font-size:14px;line-height:20px}
    .ng-action-card {width:100%;display:flex;align-items:center;gap:13px;padding:15px;border:0;border-bottom:1px solid var(--ng-separator);background:transparent;color:var(--ng-text);text-align:left;font:inherit;cursor:pointer}
    .ng-action-card:last-child {border-bottom:0}
    .ng-action-icon {width:44px;height:44px;flex:0 0 44px;border-radius:13px;display:grid;place-items:center;background:var(--ng-input);font-size:23px}
    .ng-action-copy {flex:1;min-width:0}
    .ng-action-title {font-size:16px;font-weight:650}
    .ng-action-sub {font-size:13px;color:var(--ng-secondary);margin-top:3px}
    .ng-primary,.ng-secondary-button {width:100%;min-height:48px;border:0;border-radius:13px;background:var(--ng-blue);color:white;font:inherit;font-size:16px;font-weight:650;cursor:pointer}
    .ng-secondary-button {border:1px solid var(--ng-separator);background:var(--ng-card);color:var(--ng-blue)}
    .ng-primary:disabled {opacity:.55}
    .ng-profile {padding:28px 20px;text-align:center}
    .ng-profile>.ng-avatar {width:92px;height:92px;margin:0 auto 14px;font-size:38px}
    .ng-profile-name {font-size:25px;font-weight:750}
    .ng-profile-meta {margin-top:7px;color:var(--ng-secondary);font-size:14px;line-height:22px}
    .ng-profile-actions {display:flex;flex-direction:column;gap:10px;margin-top:25px}
    .ng-auth {flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 24px;overflow-y:auto}
    .ng-logo {margin-bottom:12px;text-align:center;font-size:54px}
    .ng-auth-title {margin-bottom:8px;text-align:center;font-size:30px;font-weight:760;letter-spacing:-.6px}
    .ng-auth-caption {margin:0 auto 28px;max-width:310px;color:var(--ng-secondary);text-align:center;font-size:15px;line-height:21px}
    .ng-field {width:100%;min-height:52px;margin-bottom:12px;padding:0 15px;border:1px solid var(--ng-separator);border-radius:13px;outline:none;color:var(--ng-text);background:var(--ng-card);font:inherit;font-size:17px}
    .ng-auth-error {min-height:20px;margin:5px 0;color:#ff453a;text-align:center;font-size:13px}
    .ng-number {padding:14px;border-bottom:1px solid var(--ng-separator)}
    .ng-number:last-child {border:0}
    .ng-number-phone {font-size:19px;font-weight:750;letter-spacing:.3px}
    .ng-number-meta {margin-top:5px;color:var(--ng-secondary);font-size:13px}
    .ng-number-price {margin-top:6px;font-size:14px;font-weight:650}
    .ng-number button {margin-top:10px}
    .ng-sheet-backdrop {position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.38);display:flex;align-items:flex-end;justify-content:center}
    .ng-sheet {width:min(100%,560px);max-height:82%;overflow:auto;padding:10px 16px calc(22px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:var(--ng-bg);animation:ng-sheet-in .22s ease-out}
    .ng-sheet-handle {width:38px;height:5px;border-radius:5px;background:var(--ng-secondary);opacity:.45;margin:0 auto 18px}
    .ng-sheet-title {font-size:22px;font-weight:750;margin-bottom:7px}
    .ng-toast {position:fixed;z-index:100002;left:18px;right:18px;bottom:calc(78px + env(safe-area-inset-bottom));padding:12px 16px;border-radius:13px;background:rgba(35,35,38,.92);color:white;text-align:center;font-size:14px;box-shadow:var(--ng-shadow);animation:ng-toast-in .2s ease-out}
    @keyframes ng-toast-in {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ng-sheet-in {from{transform:translateY(35px);opacity:.6}to{transform:translateY(0);opacity:1}}
    @media(min-width:700px) {#neogram-root{left:50%;width:min(100%,560px);transform:translateX(-50%);border-left:1px solid var(--ng-separator);border-right:1px solid var(--ng-separator)}}
    @media(prefers-reduced-motion:reduce) {*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
  `;
  document.head.appendChild(style);
}

function mountRoot() {
  document.getElementById('root')?.replaceChildren();
  root = document.createElement('div');
  root.id = 'neogram-root';
  document.body.appendChild(root);
  applyTheme();
}

function applyTheme() {
  if (state.settingsTheme === 'light') document.documentElement.dataset.ngTheme = 'light';
  else if (state.settingsTheme === 'dark') document.documentElement.dataset.ngTheme = 'dark';
  else delete document.documentElement.dataset.ngTheme;
}

function render() {
  if (!root) return;
  if (!state.token || !state.user) return renderAuth();
  if (state.activeChat) return renderChat();
  if (state.profileTarget) return renderProfile();
  renderMain();
}

function renderAuth() {
  if (state.screen === 'pin') {
    root.innerHTML = `
      <main class="ng-auth">
        <div class="ng-logo">💎</div>
        <div class="ng-auth-title">Введите PIN-код</div>
        <p class="ng-auth-caption">Введите четырёхзначный PIN для входа в NeoGram</p>
        <input id="ng-pin" class="ng-field" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" value="${escapeHtml(state.authPin)}">
        <div class="ng-auth-error">${escapeHtml(state.authError)}</div>
        <button class="ng-primary" id="ng-auth-submit" ${state.authLoading ? 'disabled' : ''}>${state.authLoading ? 'Входим…' : 'Войти'}</button>
        <button class="ng-link" id="ng-auth-back" style="margin-top:16px">Назад</button>
      </main>`;
    root.querySelector('#ng-pin')?.addEventListener('input', (event) => {
      state.authPin = event.target.value.replace(/\D/g, '').slice(0, 4);
      event.target.value = state.authPin;
    });
    root.querySelector('#ng-auth-submit')?.addEventListener('click', login);
    root.querySelector('#ng-auth-back')?.addEventListener('click', () => {
      state.screen = 'phone';
      state.authError = '';
      render();
    });
    return;
  }

  root.innerHTML = `
    <main class="ng-auth">
      <div class="ng-logo">💎</div>
      <div class="ng-auth-title">NeoGram</div>
      <p class="ng-auth-caption">Общайся, играй и открывай новые возможности</p>
      <button class="ng-secondary-button" id="ng-collection-open" style="margin-bottom:14px">💎 Коллекционные номера ›</button>
      <input id="ng-phone" class="ng-field" type="tel" inputmode="tel" autocomplete="tel" placeholder="+888 | 0000 0000" value="${escapeHtml(state.authPhone)}">
      <div class="ng-auth-error">${escapeHtml(state.authError)}</div>
      <button class="ng-primary" id="ng-phone-continue">Продолжить</button>
      <p class="ng-auth-caption" style="margin-top:18px;margin-bottom:0">Используй свой номер NeoGram</p>
    </main>`;

  root.querySelector('#ng-phone')?.addEventListener('input', (event) => {
    let value = event.target.value.replace(/[^\d+]/g, '');
    if (!value.startsWith('+888') && !value.startsWith('+777') && !value.startsWith('+666')) {
      const digits = value.replace(/\D/g, '');
      value = `+888${digits.replace(/^(888|777|666)/, '')}`;
    }
    state.authPhone = value;
  });

  root.querySelector('#ng-phone-continue')?.addEventListener('click', () => {
    const phone = state.authPhone.replace(/\s/g, '');
    if (!/^\+(888|777|666)\d{4,8}$/.test(phone)) {
      state.authError = 'Проверь номер. Пример: +88800000000';
      render();
      return;
    }
    state.authPhone = phone;
    state.authError = '';
    state.authPin = '';
    state.screen = 'pin';
    render();
  });

  root.querySelector('#ng-collection-open')?.addEventListener('click', () => {
    showToast('Коллекционные номера доступны после входа в аккаунт');
  });
}

async function login() {
  const phone = state.authPhone.replace(/\s/g, '');
  const pin = state.authPin;
  if (!/^\d{4}$/.test(pin)) {
    state.authError = 'PIN должен состоять из 4 цифр';
    render();
    return;
  }

  state.authLoading = true;
  state.authError = '';
  render();

  try {
    const result = await api('/auth', {
      method: 'POST',
      body: { phone, pin, device_id: getDeviceId() },
    });
    if (!result.token || !result.user) throw new Error('Сервер не вернул токен или профиль');

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem(STORAGE.token, state.token);
    saveJson(STORAGE.user, state.user);
    state.screen = 'main';
    state.authLoading = false;
    normalizeChatList();
    render();
  } catch (error) {
    state.authError = error.message || 'Не удалось войти';
    state.authLoading = false;
    render();
  }
}

function renderMain() {
  const tabs = {
    feed: renderFeed(),
    games: renderGames(),
    chats: renderChats(),
    settings: renderSettings(),
  };

  root.innerHTML = `
    <main class="ng-screen">
      ${tabs[state.activeTab] || tabs.chats}
      <nav class="ng-bottom">
        ${renderTab('feed', '▤', 'Лента')}
        ${renderTab('games', '♧', 'Игры')}
        ${renderTab('chats', '▢', 'Чаты')}
        ${renderTab('settings', '⚙', 'Настройки')}
      </nav>
    </main>`;

  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.tab;
      if (next === state.activeTab) return;
      state.activeTab = next;
      state.search = '';
      state.searchResults = [];
      state.profileTarget = null;
      render();
      if (next === 'feed' && !state.feedMessages.length) loadFeed();
      if (next === 'games' && !state.leaderboard.length) loadLeaderboard();
      if (next === 'settings' && !state.wallet) loadWallet();
    });
  });

  bindMainActions();
}

function renderTab(id, icon, title) {
  return `<button class="ng-tab ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">
    <span class="ng-tab-icon">${icon}</span><span>${title}</span>
  </button>`;
}

function renderChats() {
  const chats = getAllChats();
  const searching = Boolean(state.search.trim());

  return `
    <header class="ng-header">
      <div class="ng-header-line">
        <div class="ng-title">Чаты</div>
        <button class="ng-header-action" id="ng-my-profile">Профиль</button>
      </div>
      <div class="ng-search-wrap">
        <span class="ng-search-icon">⌕</span>
        <input id="ng-global-search" class="ng-search" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Поиск игроков" value="${escapeHtml(state.search)}">
      </div>
    </header>
    <div class="ng-scroll" id="ng-main-scroll">
      ${searching ? renderSearchResults() : renderChatList(chats)}
    </div>`;
}

function renderChatList(chats) {
  const pinned = chats.filter((chat) => chat.pinned);
  const regular = chats.filter((chat) => !chat.pinned);
  return `
    <div class="ng-section-label">Закреплённые</div>
    <div class="ng-list">${pinned.map(renderChatRow).join('')}</div>
    <div class="ng-section-label">Личные переписки</div>
    <div class="ng-list">${regular.length
      ? regular.map(renderChatRow).join('')
      : '<div class="ng-empty">Здесь появятся личные переписки. Найди игрока через поиск.</div>'}</div>`;
}

function renderChatRow(chat) {
  const avatar = chat.user ? getAvatar(chat.user)
    : `<div class="ng-avatar">${chat.kind === 'channel' ? '💎' : '🌐'}</div>`;
  return `<button class="ng-chat-row" data-chat-id="${escapeHtml(chat.id)}">
    ${avatar}<div class="ng-chat-copy">
      <div class="ng-chat-title">${escapeHtml(chat.title)}</div>
      <div class="ng-chat-subtitle">${escapeHtml(chat.subtitle || '')}</div>
    </div><span class="ng-chevron">›</span>
  </button>`;
}

function renderSearchResults() {
  if (state.searchLoading) return '<div class="ng-empty">Ищем игроков…</div>';
  if (state.searchError) return `<div class="ng-empty">${escapeHtml(state.searchError)}</div>`;
  if (!state.searchResults.length) return '<div class="ng-empty">Ничего не найдено</div>';
  return `<div class="ng-section-label">Результаты поиска</div><div class="ng-list">${state.searchResults.map((user) => `
    <button class="ng-result" data-user-id="${escapeHtml(user.id)}">
      ${getAvatar(user)}<div class="ng-result-copy">
        <div class="ng-result-name">${escapeHtml(getUserName(user))}</div>
        <div class="ng-result-meta">${escapeHtml(user.username ? `@${user.username}` : 'Без username')} · ID ${escapeHtml(user.id)}</div>
        <div class="ng-badges">${getUserBadges(user)}</div>
      </div><span class="ng-chevron">›</span>
    </button>`).join('')}</div>`;
}

function bindMainActions() {
  root.querySelector('#ng-global-search')?.addEventListener('input', (event) => {
    state.search = event.target.value;
    clearTimeout(searchTimer);
    const value = state.search.trim();
    if (!value) {
      state.searchResults = [];
      state.searchError = '';
      state.searchLoading = false;
      updateSearchArea();
      return;
    }
    searchTimer = setTimeout(() => searchUsers(value), 400);
  });

  root.querySelector('#ng-my-profile')?.addEventListener('click', () => {
    state.profileTarget = normalizeUser(state.user);
    render();
  });

  root.querySelector('#ng-settings-profile')?.addEventListener('click', () => {
    state.profileTarget = normalizeUser(state.user);
    render();
  });

  root.querySelector('#ng-logout')?.addEventListener('click', logout);
  root.querySelector('#ng-open-numbers')?.addEventListener('click', openNumbers);
  root.querySelector('#ng-reload-feed')?.addEventListener('click', loadFeed);
  root.querySelector('#ng-reload-leaders')?.addEventListener('click', loadLeaderboard);
  root.querySelector('#ng-wallet-refresh')?.addEventListener('click', loadWallet);

  root.querySelectorAll('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      state.settingsTheme = button.dataset.theme;
      localStorage.setItem('neogram_theme', state.settingsTheme);
      applyTheme();
      render();
    });
  });

  root.querySelectorAll('[data-chat-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const chat = getAllChats().find((item) => item.id === button.dataset.chatId);
      if (chat) openChat(chat);
    });
  });

  root.querySelectorAll('[data-user-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = state.searchResults.find((item) => item.id === button.dataset.userId);
      if (user) {
        state.profileTarget = user;
        render();
      }
    });
  });
}

function updateSearchArea() {
  const scroll = root?.querySelector('#ng-main-scroll');
  if (!scroll) return;
  scroll.innerHTML = state.search.trim()
    ? renderSearchResults()
    : renderChatList(getAllChats());

  scroll.querySelectorAll('[data-user-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = state.searchResults.find((item) => item.id === button.dataset.userId);
      if (user) {
        state.profileTarget = user;
        render();
      }
    });
  });
  scroll.querySelectorAll('[data-chat-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const chat = getAllChats().find((item) => item.id === button.dataset.chatId);
      if (chat) openChat(chat);
    });
  });
}

function extractSearchUsers(data) {
  let candidates = [];
  if (Array.isArray(data)) candidates = data;
  else if (Array.isArray(data?.users)) candidates = data.users;
  else if (Array.isArray(data?.results)) candidates = data.results;
  else if (Array.isArray(data?.players)) candidates = data.players;
  else if (data?.user || data?.player || data?.profile) candidates = [data.user || data.player || data.profile];
  else if (data?.id !== undefined || data?.user_id !== undefined) candidates = [data];
  return candidates.map(normalizeUser).filter(Boolean);
}

async function searchUsers(query) {
  const requestId = ++searchRequestNumber;
  state.searchLoading = true;
  state.searchError = '';
  updateSearchArea();

  try {
    const result = await api(`/fragment/info?q=${encodeURIComponent(query)}`);
    if (requestId !== searchRequestNumber) return;
    state.searchResults = extractSearchUsers(result);
  } catch (error) {
    if (requestId !== searchRequestNumber) return;
    state.searchResults = [];
    state.searchError = error.message || 'Не удалось выполнить поиск';
  }

  if (requestId === searchRequestNumber) {
    state.searchLoading = false;
    updateSearchArea();
  }
}

function renderFeed() {
  const messages = state.feedMessages;
  return `
    <header class="ng-header"><div class="ng-header-line">
      <div class="ng-title">Лента</div>
      <button class="ng-header-action" id="ng-reload-feed">Обновить</button>
    </div></header>
    <div class="ng-scroll">
      <div class="ng-card" style="display:flex;align-items:center;gap:12px">
        <div class="ng-avatar">💎</div>
        <div style="flex:1"><div class="ng-card-title">NeoGram</div><div class="ng-muted">Официальные новости и объявления</div></div>
      </div>
      ${state.feedLoading ? '<div class="ng-empty">Загружаем публикации…</div>' : ''}
      ${messages.length ? messages.map((message) => `
        <article class="ng-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div class="ng-avatar small">💎</div>
            <div><div style="font-weight:700">NeoGram</div><div class="ng-muted">${formatDate(message.created_at)}</div></div>
          </div>
          <div style="font-size:15px;line-height:22px;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(message.body ?? message.text ?? '')}</div>
        </article>`).join('') : (!state.feedLoading
          ? '<div class="ng-empty">Пока нет публикаций в официальном канале.</div>' : '')}
      <div class="ng-card"><div class="ng-muted">Публикации отображаются из официального канала NeoGram.</div>
        <button class="ng-secondary-button" id="ng-open-official" style="margin-top:12px">Открыть канал</button>
      </div>
    </div>`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

async function loadFeed() {
  state.feedLoading = true;
  if (state.activeTab === 'feed') render();
  try {
    const result = await api('/messages?chat=official_channel');
    state.feedMessages = Array.isArray(result.messages) ? result.messages.slice().reverse() : [];
  } catch (error) {
    showToast(error.message || 'Не удалось загрузить ленту');
  }
  state.feedLoading = false;
  if (state.activeTab === 'feed') {
    render();
    root.querySelector('#ng-open-official')?.addEventListener('click', () => {
      openChat(PINNED_CHATS[0]);
    });
  }
}

function renderGames() {
  return `
    <header class="ng-header"><div class="ng-header-line">
      <div class="ng-title">Игры</div>
      <button class="ng-header-action" id="ng-reload-leaders">Обновить</button>
    </div></header>
    <div class="ng-scroll">
      <div class="ng-card" style="background:linear-gradient(135deg,#2358c8,#824fe0);color:white">
        <div style="font-size:34px">🎮</div>
        <div class="ng-card-title" style="font-size:23px">Игровой мир NeoGram</div>
        <div style="opacity:.86;font-size:14px;line-height:20px">Играй, соревнуйся и следи за результатами сообщества.</div>
      </div>
      <div class="ng-section-label">Игровые режимы</div>
      <div class="ng-list">
        <div class="ng-action-card"><div class="ng-action-icon">👆</div><div class="ng-action-copy"><div class="ng-action-title">Tap Game</div><div class="ng-action-sub">Мини-игра на реакцию · подключение игрового режима появится отдельно</div></div></div>
        <div class="ng-action-card"><div class="ng-action-icon">🖱️</div><div class="ng-action-copy"><div class="ng-action-title">Mouse Game</div><div class="ng-action-sub">Игровой режим NeoGram</div></div></div>
        <div class="ng-action-card"><div class="ng-action-icon">🏆</div><div class="ng-action-copy"><div class="ng-action-title">Таблица лидеров</div><div class="ng-action-sub">Рейтинг игроков сообщества</div></div></div>
      </div>
      <div class="ng-section-label">Лидеры</div>
      <div class="ng-list">
        ${state.leaderboardLoading ? '<div class="ng-empty">Загружаем рейтинг…</div>' : ''}
        ${state.leaderboard.length ? state.leaderboard.map((item, index) => `
          <div class="ng-chat-row">
            <div class="ng-avatar small">${index < 3 ? ['🥇','🥈','🥉'][index] : index + 1}</div>
            <div class="ng-chat-copy"><div class="ng-chat-title">${escapeHtml(item.username || item.name || `Игрок ${index + 1}`)}</div>
              <div class="ng-chat-subtitle">${escapeHtml(item.score ?? item.points ?? item.value ?? '—')} очков</div></div>
          </div>`).join('') : (!state.leaderboardLoading ? '<div class="ng-empty">Рейтинг пока пуст или недоступен.</div>' : '')}
      </div>
    </div>`;
}

async function loadLeaderboard() {
  state.leaderboardLoading = true;
  if (state.activeTab === 'games') render();
  try {
    const result = await api('/leaderboard');
    const list = Array.isArray(result) ? result
      : result.leaderboard || result.players || result.users || result.results || [];
    state.leaderboard = Array.isArray(list) ? list : [];
  } catch (error) {
    showToast(error.message || 'Не удалось загрузить рейтинг');
  }
  state.leaderboardLoading = false;
  if (state.activeTab === 'games') render();
}

function renderSettings() {
  const user = normalizeUser(state.user);
  const wallet = state.wallet;
  const walletText = wallet
    ? Object.entries(wallet).filter(([, value]) => ['string','number'].includes(typeof value))
      .slice(0, 4).map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`).join(' · ')
    : 'Информация о балансе';

  return `
    <header class="ng-header"><div class="ng-title">Настройки</div></header>
    <div class="ng-scroll">
      <div class="ng-list" style="margin-top:8px">
        <button class="ng-chat-row" id="ng-settings-profile">
          ${getAvatar(user, 'small')}
          <div class="ng-chat-copy"><div class="ng-chat-title">${escapeHtml(getUserName(user))}</div>
            <div class="ng-chat-subtitle">${escapeHtml(user?.username ? `@${user.username}` : user?.phone || 'Мой профиль')}</div></div>
          <span class="ng-chevron">›</span>
        </button>
      </div>
      <div class="ng-section-label">Аккаунт</div>
      <div class="ng-list">
        <button class="ng-action-card" id="ng-open-numbers"><div class="ng-action-icon">💎</div><div class="ng-action-copy"><div class="ng-action-title">Коллекционные номера</div><div class="ng-action-sub">Подбор доступных номеров</div></div><span class="ng-chevron">›</span></button>
        <button class="ng-action-card" id="ng-wallet-refresh"><div class="ng-action-icon">👛</div><div class="ng-action-copy"><div class="ng-action-title">Кошелёк</div><div class="ng-action-sub">${state.walletLoading ? 'Загрузка…' : walletText}</div></div><span class="ng-chevron">›</span></button>
      </div>
      <div class="ng-section-label">Оформление</div>
      <div class="ng-list">
        <div class="ng-number"><div style="font-weight:650;margin-bottom:10px">Тема приложения</div>
          <div style="display:flex;gap:8px">
            ${[['system','Системная'],['light','Светлая'],['dark','Тёмная']].map(([value,label]) =>
              `<button class="ng-secondary-button" data-theme="${value}" style="min-height:40px;flex:1;${state.settingsTheme === value ? 'background:var(--ng-blue);color:white;border-color:var(--ng-blue)' : ''}">${label}</button>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="ng-section-label">Приложение</div>
      <div class="ng-list">
        <div class="ng-number"><div style="font-weight:650">NeoGram</div><div class="ng-muted">Версия интерфейса 1.0</div></div>
        <button class="ng-chat-row" id="ng-logout"><div class="ng-chat-copy"><div class="ng-chat-title" style="color:#ff453a">Выйти из аккаунта</div></div></button>
      </div>
    </div>`;
}

async function loadWallet() {
  state.walletLoading = true;
  if (state.activeTab === 'settings') render();
  try {
    state.wallet = await api('/wallet');
  } catch (error) {
    showToast(error.message || 'Не удалось загрузить кошелёк');
  }
  state.walletLoading = false;
  if (state.activeTab === 'settings') render();
}

async function openNumbers() {
  state.numbers = [];
  state.numbersError = '';
  state.numbersLoading = true;
  state.sheet = 'numbers';
  renderSheet();
  try {
    const result = await api('/generate-phone');
    state.numbers = Array.isArray(result.numbers) ? result.numbers : [];
  } catch (error) {
    state.numbersError = error.message || 'Не удалось получить номера';
  }
  state.numbersLoading = false;
  renderSheet();
}

function renderSheet() {
  document.querySelector('.ng-sheet-backdrop')?.remove();
  if (!state.sheet) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'ng-sheet-backdrop';
  const content = state.sheet === 'numbers' ? `
    <div class="ng-sheet-handle"></div>
    <div class="ng-sheet-title">💎 Коллекционные номера</div>
    <div class="ng-muted">Подбор красивых номеров +888 с оценкой в USD и GRAM.</div>
    ${state.numbersLoading ? '<div class="ng-empty">Подбираем номера…</div>' : ''}
    ${state.numbersError ? `<div class="ng-empty">${escapeHtml(state.numbersError)}</div>` : ''}
    ${state.numbers.map((number) => `
      <div class="ng-number">
        <div class="ng-number-phone">${escapeHtml(number.phone)}</div>
        <div class="ng-number-meta">Оценка номера · ${escapeHtml(number.color || 'Стандартный')}</div>
        <div class="ng-number-price">${number.price_usd != null ? `$${escapeHtml(number.price_usd)}` : 'Цена уточняется'}${number.price_gram != null ? ` · ${escapeHtml(number.price_gram)} GRAM` : ''}</div>
      </div>`).join('')}
    <button class="ng-secondary-button" id="ng-numbers-close" style="margin-top:14px">Закрыть</button>
  ` : '';

  backdrop.innerHTML = `<section class="ng-sheet">${content}</section>`;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeSheet();
  });
  backdrop.querySelector('#ng-numbers-close')?.addEventListener('click', closeSheet);
  document.body.appendChild(backdrop);
}

function closeSheet() {
  state.sheet = '';
  document.querySelector('.ng-sheet-backdrop')?.remove();
}

function renderProfile() {
  const user = state.profileTarget;
  if (!user) {
    state.profileTarget = null;
    renderMain();
    return;
  }
  const isMe = String(user.id) === String(getCurrentUserId());

  root.innerHTML = `
    <main class="ng-screen">
      <header class="ng-chat-screen-header">
        <button class="ng-back" id="ng-profile-back">‹ Назад</button>
        <div class="ng-chat-screen-title">Профиль</div><span style="width:42px"></span>
      </header>
      <div class="ng-scroll"><section class="ng-profile">
        ${getAvatar(user)}
        <div class="ng-profile-name">${escapeHtml(getUserName(user))}</div>
        <div class="ng-badges" style="justify-content:center">${getUserBadges(user)}</div>
        <div class="ng-profile-meta">
          ${user.username ? `@${escapeHtml(user.username)}<br>` : ''}
          ${user.phone ? `${escapeHtml(user.phone)}<br>` : ''}
          ID: ${escapeHtml(user.id)}
        </div>
        <div class="ng-profile-actions">
          ${isMe ? '<button class="ng-primary" id="ng-profile-close">Готово</button>' : '<button class="ng-primary" id="ng-profile-message">Написать сообщение</button>'}
        </div>
      </section></div>
    </main>`;

  root.querySelector('#ng-profile-back')?.addEventListener('click', () => {
    state.profileTarget = null;
    render();
  });
  root.querySelector('#ng-profile-close')?.addEventListener('click', () => {
    state.profileTarget = null;
    render();
  });
  root.querySelector('#ng-profile-message')?.addEventListener('click', () => {
    const chat = saveDirectChat(user);
    if (!chat) return showToast('Не удалось открыть личный чат');
    state.profileTarget = null;
    openChat(chat);
  });
}

async function openChat(chat) {
  state.activeChat = chat;
  state.messages = [];
  state.loadingMessages = true;
  state.messageDraft = '';
  render();
  await loadMessages();

  clearInterval(messagePollTimer);
  messagePollTimer = setInterval(() => {
    if (state.activeChat?.id === chat.id) loadMessages(true);
  }, 10000);
}

function closeChat() {
  clearInterval(messagePollTimer);
  messagePollTimer = null;
  state.activeChat = null;
  state.messages = [];
  state.messageDraft = '';
  render();
}

async function loadMessages(silent = false) {
  const chat = state.activeChat;
  if (!chat) return;
  if (!silent) {
    state.loadingMessages = true;
    render();
  }

  try {
    const result = await api(`/messages?chat=${encodeURIComponent(chat.id)}`);
    if (state.activeChat?.id !== chat.id) return;
    state.messages = Array.isArray(result.messages) ? result.messages.slice().reverse() : [];
    state.loadingMessages = false;
    renderChat(silent);
  } catch (error) {
    state.loadingMessages = false;
    if (!silent) {
      showToast(error.message || 'Не удалось загрузить сообщения');
      renderChat();
    }
  }
}

function renderChat(keepScroll = false) {
  const chat = state.activeChat;
  if (!chat) return;

  const oldMessages = root.querySelector('#ng-messages');
  const wasNearBottom = oldMessages
    ? oldMessages.scrollHeight - oldMessages.scrollTop - oldMessages.clientHeight < 100
    : true;

  const messagesHtml = state.messages.length
    ? state.messages.map(renderMessage).join('')
    : `<div class="ng-empty">${state.loadingMessages ? 'Загрузка сообщений…' : 'Пока нет сообщений. Напиши первым!'}</div>`;

  root.innerHTML = `
    <main class="ng-screen">
      <header class="ng-chat-screen-header">
        <button class="ng-back" id="ng-chat-back">‹ Чаты</button>
        <div class="ng-chat-screen-title">${escapeHtml(chat.title)}</div>
        <button class="ng-header-action" id="ng-chat-info">•••</button>
      </header>
      <div class="ng-messages" id="ng-messages">${messagesHtml}</div>
      <form class="ng-composer" id="ng-message-form">
        <textarea id="ng-message-input" rows="1" maxlength="2000" placeholder="Сообщение">${escapeHtml(state.messageDraft)}</textarea>
        <button class="ng-send" type="submit" ${state.sendingMessage ? 'disabled' : ''}>➤</button>
      </form>
    </main>`;

  const messageContainer = root.querySelector('#ng-messages');
  if (messageContainer && (!keepScroll || wasNearBottom)) {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  root.querySelector('#ng-chat-back')?.addEventListener('click', closeChat);
  root.querySelector('#ng-chat-info')?.addEventListener('click', () => {
    if (chat.user) {
      state.profileTarget = chat.user;
      state.activeChat = null;
      clearInterval(messagePollTimer);
      render();
    } else showToast(chat.title);
  });

  root.querySelector('#ng-message-input')?.addEventListener('input', (event) => {
    state.messageDraft = event.target.value;
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 110)}px`;
  });

  root.querySelector('#ng-message-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
  });
}

function renderMessage(message) {
  const mine = String(message.sender_id) === String(getCurrentUserId());
  const body = message.body ?? message.text ?? '';
  const date = message.created_at ? new Date(message.created_at) : null;
  const time = date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return `<div class="ng-message ${mine ? 'mine' : 'theirs'}">
    ${!mine && message.username ? `<div class="ng-message-author">${escapeHtml(message.username)}</div>` : ''}
    <div>${escapeHtml(body)}</div>
    ${time ? `<div class="ng-message-time">${escapeHtml(time)}</div>` : ''}
  </div>`;
}

async function sendMessage() {
  const chat = state.activeChat;
  const text = state.messageDraft.trim();
  if (!chat || !text || state.sendingMessage) return;

  state.sendingMessage = true;
  renderChat();

  try {
    await api('/messages/send', { method: 'POST', body: { chat: chat.id, text } });
    state.messageDraft = '';
    state.sendingMessage = false;
    await loadMessages(true);
    renderChat();
  } catch (error) {
    state.sendingMessage = false;
    showToast(error.message || 'Не удалось отправить сообщение');
    renderChat();
  }
}

function logout() {
  clearInterval(messagePollTimer);
  clearTimeout(searchTimer);
  state.token = '';
  state.user = null;
  state.chats = [];
  state.activeChat = null;
  state.profileTarget = null;
  state.search = '';
  state.searchResults = [];
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.user);
  localStorage.removeItem(STORAGE.chats);
  state.screen = 'phone';
  state.authPin = '';
  state.authError = '';
  render();
}

export async function startNeoGram() {
  try {
    renderStyles();
    mountRoot();

    if (state.token && state.user) {
      try {
        const profile = await api('/profile');
        if (profile.user) {
          state.user = profile.user;
          saveJson(STORAGE.user, state.user);
        }
      } catch (error) {
        console.warn('[NeoGram] Session validation failed:', error);
        state.token = '';
        state.user = null;
        localStorage.removeItem(STORAGE.token);
        localStorage.removeItem(STORAGE.user);
      }
    }

    normalizeChatList();
    render();

    return true;
  } catch (error) {
    console.error('[NeoGram] Startup failed:', error);
    return false;
  }
}
