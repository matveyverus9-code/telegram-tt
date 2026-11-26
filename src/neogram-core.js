
import { renderGamesModule, bindGamesModule } from './neogram-games.js';

const API = 'https://tg-api.matveyverus9.workers.dev';

const KEY = {
  token: 'neogram_token',
  user: 'neogram_user',
  chats: 'neogram_chats',
  accounts: 'neogram_accounts',
  theme: 'neogram_theme',
  device: 'neogram_device_id'
};

const pinnedChats = [
  { id: 'official_channel', title: 'NeoGram', subtitle: 'Официальный канал', kind: 'channel', pinned: true },
  { id: 'global', title: 'Общий чат', subtitle: 'Общение сообщества', kind: 'global', pinned: true }
];

const state = {
  token: localStorage.getItem(KEY.token) || '',
  user: read(KEY.user, null),
  chats: read(KEY.chats, []),
  accounts: read(KEY.accounts, []),
  tab: 'chats',
  chat: null,
  messages: [],
  search: '',
  results: [],
  loading: false,
  sending: false,
  screen: 'main',
  phone: '+888',
  pin: '',
  error: '',
  profile: null,
  sheet: '',
  theme: localStorage.getItem(KEY.theme) || 'system',
  wallet: null,
  market: null,
  feed: [],
  leaders: [],
  toast: '',
  gamesCleanup: null
};

let root;
let poll;
let searchTimer;
let toastTimer;
let searchVersion = 0;

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[NeoGram] Storage:', e);
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function id() {
  let value = localStorage.getItem(KEY.device);
  if (!value) {
    value = 'ng-' + crypto.randomUUID();
    localStorage.setItem(KEY.device, value);
  }
  return value;
}

function headers(json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    method: options.method || 'GET',
    headers: {
      ...headers(Boolean(options.body)),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Ошибка ответа сервера: ${response.status}`);
  }

  if (!response.ok || data?.ok === false || data?.error) {
    throw new Error(String(
      data?.detail || data?.message || data?.error ||
      `Ошибка сервера: ${response.status}`
    ));
  }

  return data;
}

function notify(message) {
  state.toast = message;
  let node = document.querySelector('.ng-toast');

  if (!node) {
    node = document.createElement('div');
    node.className = 'ng-toast';
    document.body.appendChild(node);
  }

  node.textContent = message;
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    node.remove();
    state.toast = '';
  }, 2600);
}

function user(raw) {
  if (!raw) return null;
  raw = raw.user || raw.profile || raw.player || raw;

  const uid = raw.id ?? raw.user_id ?? raw.uid;
  if (uid == null) return null;

  return {
    id: String(uid),
    username: raw.username || raw.user_name || '',
    firstName: raw.first_name || raw.firstName || raw.name || 'Игрок',
    lastName: raw.last_name || raw.lastName || '',
    phone: raw.phone || raw.phone_number || '',
    avatar: raw.avatar || raw.photo || raw.photo_url || '',
    isCreator: Boolean(raw.is_creator || raw.isCreator),
    isHold: Boolean(raw.is_hold || raw.isHold),
    isMajor: Boolean(raw.is_major || raw.isMajor),
    raw
  };
}

function name(u) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.username || 'Игрок';
}

function avatar(u, small = false) {
  const cls = small ? ' small' : '';
  return `<div class="ng-avatar${cls}">${
    u?.avatar
      ? `<img src="${esc(u.avatar)}" alt="">`
      : esc(name(u).slice(0, 1).toUpperCase())
  }</div>`;
}

function badges(u) {
  if (!u) return '';
  return [
    u.isCreator ? '<span class="ng-badge creator">Создатель</span>' : '',
    u.isHold ? '<span class="ng-badge hold">Hold</span>' : '',
    u.isMajor ? '<span class="ng-badge major">Major</span>' : ''
  ].join('');
}

function currentId() {
  return state.user?.id ?? state.user?.user_id;
}

function saveSession(token, profile) {
  state.token = token;
  state.user = profile;
  localStorage.setItem(KEY.token, token);
  save(KEY.user, profile);
  rememberAccount(token, profile);
}

function rememberAccount(token, profile) {
  const u = user(profile);
  if (!u) return;

  state.accounts = state.accounts.filter(a => a.id !== u.id);

  state.accounts.unshift({
    id: u.id,
    phone: u.phone || '',
    username: u.username,
    firstName: u.firstName,
    avatar: u.avatar,
    token,
    user: profile
  });

  state.accounts = state.accounts.slice(0, 3);
  save(KEY.accounts, state.accounts);
}

function applyTheme() {
  if (state.theme === 'system') {
    delete document.documentElement.dataset.ngTheme;
  } else {
    document.documentElement.dataset.ngTheme = state.theme;
  }
}

function styles() {
  if (document.getElementById('neogram-styles')) return;

  const css = document.createElement('style');
  css.id = 'neogram-styles';

  css.textContent = `
    :root {
      color-scheme:light dark;
      --ng-bg:#f2f2f7;
      --ng-card:rgba(255,255,255,.92);
      --ng-solid:#fff;
      --ng-text:#111116;
      --ng-secondary:#8e8e93;
      --ng-separator:rgba(60,60,67,.14);
      --ng-blue:#007aff;
      --ng-green:#30b45a;
      --ng-red:#ff453a;
      --ng-input:rgba(118,118,128,.12);
      --ng-glass:rgba(249,249,249,.78);
      --ng-shadow:0 10px 35px rgba(0,0,0,.12);
    }

    @media(prefers-color-scheme:dark) {
      :root:not([data-ng-theme="light"]) {
        color-scheme:dark;
        --ng-bg:#000;
        --ng-card:rgba(28,28,30,.94);
        --ng-solid:#1c1c1e;
        --ng-text:#fff;
        --ng-secondary:#98989f;
        --ng-separator:rgba(84,84,88,.55);
        --ng-blue:#0a84ff;
        --ng-input:rgba(118,118,128,.24);
        --ng-glass:rgba(28,28,30,.82);
      }
    }

    :root[data-ng-theme="dark"] {
      color-scheme:dark;
      --ng-bg:#000;
      --ng-card:#1c1c1e;
      --ng-solid:#1c1c1e;
      --ng-text:#fff;
      --ng-secondary:#98989f;
      --ng-separator:rgba(84,84,88,.55);
      --ng-blue:#0a84ff;
      --ng-input:rgba(118,118,128,.24);
      --ng-glass:rgba(28,28,30,.82);
    }

    * {
      box-sizing:border-box;
      -webkit-tap-highlight-color:transparent;
    }

    html,body,#root,#neogram-root {
      width:100%;
      height:100%;
      min-height:100%;
      margin:0;
    }

    body {
      overflow:hidden;
      background:var(--ng-bg);
      color:var(--ng-text);
      font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",
      "Helvetica Neue",Arial,sans-serif;
      -webkit-font-smoothing:antialiased;
      overscroll-behavior:none;
    }

    button,input,textarea {font:inherit}

    #neogram-root {
      position:fixed;
      inset:0;
      z-index:99999;
      display:flex;
      flex-direction:column;
      padding-top:env(safe-area-inset-top);
      padding-bottom:env(safe-area-inset-bottom);
      background:var(--ng-bg);
      overflow:hidden;
    }

    #neogram-root input,#neogram-root textarea {
      font-size:16px;
      user-select:text;
    }

    .ng-screen {
      min-height:0;
      flex:1;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    }

    .ng-header {
      padding:10px 16px 8px;
      background:var(--ng-bg);
    }

    .ng-header-line {
      display:flex;
      align-items:center;
      justify-content:space-between;
      min-height:42px;
      gap:12px;
    }

    .ng-title {
      font-size:32px;
      font-weight:760;
      letter-spacing:-.8px;
    }

    .ng-header-action,.ng-link,.ng-back {
      border:0;
      background:transparent;
      color:var(--ng-blue);
      padding:8px;
      cursor:pointer;
    }

    .ng-search-wrap {margin-top:8px;position:relative}

    .ng-search {
      width:100%;
      height:38px;
      border:0;
      border-radius:11px;
      outline:none;
      padding:0 14px 0 36px;
      color:var(--ng-text);
      background:var(--ng-input);
    }

    .ng-search-icon {
      position:absolute;
      left:12px;
      top:7px;
      color:var(--ng-secondary);
    }

    .ng-scroll {
      flex:1;
      min-height:0;
      overflow-y:auto;
      overscroll-behavior:contain;
      -webkit-overflow-scrolling:touch;
      padding-bottom:24px;
    }

    .ng-section-label {
      padding:20px 16px 7px;
      color:var(--ng-secondary);
      font-size:12px;
      font-weight:650;
      letter-spacing:.45px;
      text-transform:uppercase;
    }

    .ng-list {
      margin:0 16px;
      overflow:hidden;
      border-radius:13px;
      background:var(--ng-card);
    }

    .ng-chat-row,.ng-result {
      width:100%;
      min-height:72px;
      display:flex;
      align-items:center;
      gap:12px;
      padding:10px 14px;
      border:0;
      border-bottom:1px solid var(--ng-separator);
      background:transparent;
      color:var(--ng-text);
      text-align:left;
      cursor:pointer;
    }

    .ng-avatar {
      flex:0 0 50px;
      width:50px;
      height:50px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      background:linear-gradient(145deg,#70b7ff,#7668dc);
      color:white;
      font-size:22px;
      font-weight:650;
    }

    .ng-avatar img {width:100%;height:100%;object-fit:cover}
    .ng-avatar.small {width:44px;height:44px;flex-basis:44px}

    .ng-chat-copy,.ng-result-copy {min-width:0;flex:1}
    .ng-chat-title {font-size:16px;font-weight:650}
    .ng-chat-subtitle {font-size:14px;color:var(--ng-secondary);margin-top:4px}
    .ng-chevron {font-size:23px;color:var(--ng-secondary)}

    .ng-bottom {
      flex:0 0 auto;
      display:flex;
      justify-content:space-around;
      padding:7px 5px 5px;
      min-height:62px;
      border-top:1px solid var(--ng-separator);
      background:var(--ng-glass);
      -webkit-backdrop-filter:blur(25px) saturate(180%);
      backdrop-filter:blur(25px) saturate(180%);
    }

    .ng-tab {
      flex:1;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:3px;
      border:0;
      background:transparent;
      color:var(--ng-secondary);
      font-size:10px;
      font-weight:600;
    }

    .ng-tab.active {color:var(--ng-blue)}
    .ng-tab-icon {font-size:22px}

    .ng-empty {
      padding:28px 18px;
      color:var(--ng-secondary);
      text-align:center;
      font-size:14px;
      line-height:21px;
    }

    .ng-card {
      margin:12px 16px;
      padding:16px;
      border-radius:16px;
      background:var(--ng-card);
    }

    .ng-card-title {font-size:18px;font-weight:720}
    .ng-muted {color:var(--ng-secondary);font-size:14px;line-height:20px}

    .ng-action-card {
      width:100%;
      display:flex;
      align-items:center;
      gap:13px;
      padding:15px;
      border:0;
      border-bottom:1px solid var(--ng-separator);
      background:transparent;
      color:var(--ng-text);
      text-align:left;
    }

    .ng-action-icon {
      width:44px;
      height:44px;
      display:grid;
      place-items:center;
      border-radius:13px;
      background:var(--ng-input);
      font-size:23px;
    }

    .ng-action-copy {flex:1}
    .ng-action-title {font-weight:650}
    .ng-action-sub {font-size:13px;color:var(--ng-secondary);margin-top:3px}

    .ng-primary,.ng-secondary-button {
      width:100%;
      min-height:48px;
      border:0;
      border-radius:13px;
      background:var(--ng-blue);
      color:white;
      font-weight:650;
      cursor:pointer;
    }

    .ng-secondary-button {
      border:1px solid var(--ng-separator);
      background:var(--ng-card);
      color:var(--ng-blue);
    }

    .ng-profile {padding:28px 20px;text-align:center}
    .ng-profile>.ng-avatar {width:92px;height:92px;margin:0 auto 14px;font-size:38px}
    .ng-profile-name {font-size:25px;font-weight:750}
    .ng-profile-meta {margin-top:7px;color:var(--ng-secondary);font-size:14px;line-height:22px}
    .ng-profile-actions {display:flex;flex-direction:column;gap:10px;margin-top:25px}

    .ng-badges {display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
    .ng-badge {padding:3px 7px;border-radius:6px;font-size:10px;font-weight:700}
    .ng-badge.creator {background:#007aff22;color:var(--ng-blue)}
    .ng-badge.hold {background:#ff950022;color:#d97706}
    .ng-badge.major {background:#30b45a22;color:#249447}

    .ng-chat-screen-header {
      min-height:50px;
      display:flex;
      align-items:center;
      gap:12px;
      padding:5px 14px 9px;
      border-bottom:1px solid var(--ng-separator);
    }

    .ng-chat-screen-title {
      flex:1;
      text-align:center;
      font-weight:650;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .ng-messages {
      flex:1;
      min-height:0;
      overflow-y:auto;
      padding:14px 12px;
      display:flex;
      flex-direction:column;
      gap:7px;
    }

    .ng-message {
      max-width:84%;
      padding:9px 12px;
      border-radius:17px;
      background:var(--ng-card);
      color:var(--ng-text);
      overflow-wrap:anywhere;
    }

    .ng-message.mine {
      align-self:flex-end;
      color:white;
      background:var(--ng-blue);
      border-bottom-right-radius:5px;
    }

    .ng-message.theirs {align-self:flex-start;border-bottom-left-radius:5px}

    .ng-composer {
      display:flex;
      align-items:flex-end;
      gap:8px;
      padding:9px 12px;
      border-top:1px solid var(--ng-separator);
      background:var(--ng-glass);
      backdrop-filter:blur(20px);
    }

    .ng-composer textarea {
      flex:1;
      min-height:38px;
      max-height:110px;
      resize:none;
      border:1px solid var(--ng-separator);
      border-radius:19px;
      outline:none;
      padding:9px 13px;
      color:var(--ng-text);
      background:var(--ng-card);
    }

    .ng-send {
      width:38px;
      height:38px;
      border:0;
      border-radius:50%;
      background:var(--ng-blue);
      color:white;
    }

    .ng-auth {
      flex:1;
      display:flex;
      flex-direction:column;
      justify-content:center;
      padding:28px 24px;
      overflow-y:auto;
    }

    .ng-logo {text-align:center;font-size:54px;margin-bottom:12px}
    .ng-auth-title {text-align:center;font-size:30px;font-weight:760}
    .ng-auth-caption {text-align:center;color:var(--ng-secondary);margin:10px auto 28px;line-height:21px}

    .ng-field {
      width:100%;
      min-height:52px;
      margin-bottom:12px;
      padding:0 15px;
      border:1px solid var(--ng-separator);
      border-radius:13px;
      outline:none;
      color:var(--ng-text);
      background:var(--ng-card);
    }

    .ng-auth-error {min-height:20px;color:var(--ng-red);text-align:center;font-size:13px}

    .ng-sheet-backdrop {
      position:fixed;
      inset:0;
      z-index:100000;
      background:#0006;
      display:flex;
      align-items:flex-end;
    }

    .ng-sheet {
      width:100%;
      max-height:86%;
      overflow:auto;
      padding:18px 16px calc(22px + env(safe-area-inset-bottom));
      border-radius:22px 22px 0 0;
      background:var(--ng-bg);
    }

    .ng-sheet-title {font-size:22px;font-weight:750;margin-bottom:12px}
    .ng-setting-row {padding:14px;border-bottom:1px solid var(--ng-separator)}
    .ng-toast {
      position:fixed;
      z-index:100002;
      left:18px;
      right:18px;
      bottom:calc(78px + env(safe-area-inset-bottom));
      padding:12px 16px;
      border-radius:13px;
      background:#28282beF;
      color:white;
      text-align:center;
    }

    @media(min-width:700px) {
      #neogram-root {
        left:50%;
        width:min(100%,560px);
        transform:translateX(-50%);
        border-left:1px solid var(--ng-separator);
        border-right:1px solid var(--ng-separator);
      }
    }
  `;

  document.head.appendChild(css);
}

function mount() {
  document.getElementById('root')?.replaceChildren();
  root = document.createElement('div');
  root.id = 'neogram-root';
  document.body.appendChild(root);
  applyTheme();
}

function render() {
  if (!root) return;

  if (!state.token || !state.user) {
    renderAuth();
    return;
  }

  if (state.chat) {
    renderChat();
    return;
  }

  if (state.profile) {
    renderProfile();
    return;
  }

  renderMain();
}

function renderAuth() {
  if (state.screen === 'pin') {
    root.innerHTML = `
      <main class="ng-auth">
        <div class="ng-logo">💎</div>
        <div class="ng-auth-title">Введите PIN</div>
        <p class="ng-auth-caption">Четырёхзначный код NeoGram</p>
        <input id="ng-pin" class="ng-field" type="password"
          inputmode="numeric" maxlength="4" placeholder="••••">
        <div class="ng-auth-error">${esc(state.error)}</div>
        <button class="ng-primary" id="ng-login">Войти</button>
        <button class="ng-link" id="ng-back">Назад</button>
      </main>`;

    root.querySelector('#ng-pin').addEventListener('input', e => {
      state.pin = e.target.value.replace(/\D/g, '').slice(0, 4);
      e.target.value = state.pin;
    });

    root.querySelector('#ng-login').onclick = login;
    root.querySelector('#ng-back').onclick = () => {
      state.screen = 'phone';
      state.error = '';
      render();
    };
    return;
  }

  root.innerHTML = `
    <main class="ng-auth">
      <div class="ng-logo">💎</div>
      <div class="ng-auth-title">NeoGram</div>
      <p class="ng-auth-caption">Общайся, играй и открывай новые возможности</p>
      <input id="ng-phone" class="ng-field" type="tel"
        inputmode="tel" value="${esc(state.phone)}">
      <div class="ng-auth-error">${esc(state.error)}</div>
      <button class="ng-primary" id="ng-continue">Продолжить</button>
      <p class="ng-auth-caption">Вход по номеру NeoGram +888</p>
    </main>`;

  root.querySelector('#ng-phone').addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^888/, '').slice(0, 8);
    state.phone = '+888' + digits;
    e.target.value = state.phone;
  });

  root.querySelector('#ng-continue').onclick = () => {
    if (!/^\+888\d{4,8}$/.test(state.phone)) {
      state.error = 'Номер должен начинаться с +888';
      render();
      return;
    }
    state.error = '';
    state.pin = '';
    state.screen = 'pin';
    render();
  };
}

async function login() {
  if (!/^\d{4}$/.test(state.pin)) {
    state.error = 'PIN должен состоять из четырёх цифр';
    render();
    return;
  }

  state.loading = true;
  state.error = '';
  render();

  try {
    const result = await api('/auth', {
      method: 'POST',
      body: {
        phone: state.phone,
        pin: state.pin,
        device_id: id()
      }
    });

    if (!result.token || !result.user) {
      throw new Error('Сервер не вернул данные аккаунта');
    }

    saveSession(result.token, result.user);
    state.screen = 'main';
    state.loading = false;
    render();
    loadWallet();
  } catch (e) {
    state.error = e.message;
    state.loading = false;
    render();
  }
}

function renderTab(tab, icon, label) {
  return `<button class="ng-tab ${state.tab === tab ? 'active' : ''}" data-tab="${tab}">
    <span class="ng-tab-icon">${icon}</span>${label}
  </button>`;
}

function renderMain() {
  if (state.gamesCleanup) {
    state.gamesCleanup();
    state.gamesCleanup = null;
  }

  let content = '';

  if (state.tab === 'chats') content = renderChats();
  if (state.tab === 'feed') content = renderFeed();
  if (state.tab === 'games') content = renderGames();
  if (state.tab === 'settings') content = renderSettings();

  root.innerHTML = `
    <main class="ng-screen">
      ${content}
      <nav class="ng-bottom">
        ${renderTab('feed','▤','Лента')}
        ${renderTab('games','♧','Игры')}
        ${renderTab('chats','▢','Чаты')}
        ${renderTab('settings','⚙','Настройки')}
      </nav>
    </main>`;

  root.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => {
      state.tab = button.dataset.tab;
      render();

      if (state.tab === 'feed') loadFeed();
      if (state.tab === 'settings') loadWallet();
    };
  });

  bindMain();
}

function renderChats() {
  const chats = [...pinnedChats, ...state.chats];

  return `
    <header class="ng-header">
      <div class="ng-header-line">
        <div class="ng-title">Чаты</div>
        <button class="ng-header-action" id="ng-profile">Профиль</button>
      </div>
      <div class="ng-search-wrap">
        <span class="ng-search-icon">⌕</span>
        <input class="ng-search" id="ng-search"
          placeholder="Поиск по @юзу, номеру или ID"
          value="${esc(state.search)}">
      </div>
    </header>
    <div class="ng-scroll" id="ng-chat-list">
      ${state.search ? renderResults() : `
        <div class="ng-section-label">Закреплённые</div>
        <div class="ng-list">${chats.filter(c => c.pinned).map(chatRow).join('')}</div>
        <div class="ng-section-label">Личные переписки</div>
        <div class="ng-list">
          ${chats.filter(c => !c.pinned).map(chatRow).join('') ||
          '<div class="ng-empty">Найди игрока через поиск, чтобы начать общение.</div>'}
        </div>
      `}
    </div>`;
}

function chatRow(chat) {
  return `<button class="ng-chat-row" data-chat="${esc(chat.id)}">
    ${avatar(chat.user || { firstName: chat.kind === 'channel' ? '💎' : '🌐' })}
    <div class="ng-chat-copy">
      <div class="ng-chat-title">${esc(chat.title)}</div>
      <div class="ng-chat-subtitle">${esc(chat.subtitle || '')}</div>
    </div>
    <span class="ng-chevron">›</span>
  </button>`;
}

function renderResults() {
  if (state.loading) return '<div class="ng-empty">Ищем игроков…</div>';
  if (!state.results.length) return '<div class="ng-empty">Игроки не найдены</div>';

  return `<div class="ng-section-label">Результаты</div>
    <div class="ng-list">${state.results.map(u => `
      <button class="ng-result" data-user="${esc(u.id)}">
        ${avatar(u)}
        <div class="ng-result-copy">
          <div class="ng-chat-title">${esc(name(u))}</div>
          <div class="ng-chat-subtitle">@${esc(u.username)} · ID ${esc(u.id)}</div>
          <div class="ng-badges">${badges(u)}</div>
        </div>
        <span class="ng-chevron">›</span>
      </button>
    `).join('')}</div>`;
}

function bindMain() {
  root.querySelector('#ng-search')?.addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(searchTimer);

    if (!state.search.trim()) {
      state.results = [];
      renderSearchArea();
      return;
    }

    searchTimer = setTimeout(() => searchUsers(state.search), 400);
  });

  root.querySelector('#ng-profile')?.addEventListener('click', () => {
    state.profile = user(state.user);
    render();
  });

  root.querySelectorAll('[data-chat]').forEach(button => {
    button.onclick = () => {
      const chat = [...pinnedChats, ...state.chats]
        .find(c => c.id === button.dataset.chat);
      if (chat) openChat(chat);
    };
  });

  root.querySelectorAll('[data-user]').forEach(button => {
    button.onclick = () => {
      state.profile = state.results.find(u => u.id === button.dataset.user);
      render();
    };
  });

  root.querySelectorAll('[data-theme]').forEach(button => {
    button.onclick = () => {
      state.theme = button.dataset.theme;
      localStorage.setItem(KEY.theme, state.theme);
      applyTheme();
      render();
    };
  });

  root.querySelector('#ng-logout')?.addEventListener('click', logout);
  root.querySelector('#ng-wallet')?.addEventListener('click', loadWallet);
  root.querySelector('#ng-market')?.addEventListener('click', loadMarket);
  root.querySelector('#ng-accounts')?.addEventListener('click', accountSheet);
  root.querySelector('#ng-official')?.addEventListener('click', () => openChat(pinnedChats[0]));
  root.querySelector('#ng-global')?.addEventListener('click', () => openChat(pinnedChats[1]));
  root.querySelector('#ng-faq')?.addEventListener('click', () => {
    state.sheet = 'faq';
    renderSheet();
  });
}

function renderSearchArea() {
  const area = root.querySelector('#ng-chat-list');
  if (area) area.innerHTML = renderResults();

  area?.querySelectorAll('[data-user]').forEach(button => {
    button.onclick = () => {
      state.profile = state.results.find(u => u.id === button.dataset.user);
      render();
    };
  });
}

async function searchUsers(query) {
  const version = ++searchVersion;
  state.loading = true;
  renderSearchArea();

  try {
    const result = await api('/fragment/info?q=' + encodeURIComponent(query));
    if (version !== searchVersion) return;

    const list = Array.isArray(result) ? result :
      result.users || result.results || result.players ||
      (result.user ? [result.user] : []);

    state.results = list.map(user).filter(Boolean);
  } catch (e) {
    if (version !== searchVersion) return;
    state.results = [];
    notify(e.message);
  }

  if (version === searchVersion) {
    state.loading = false;
    renderSearchArea();
  }
}

function renderFeed() {
  return `
    <header class="ng-header">
      <div class="ng-header-line">
        <div class="ng-title">Лента</div>
        <button class="ng-header-action" id="ng-feed-refresh">Обновить</button>
      </div>
    </header>
    <div class="ng-scroll">
      <div class="ng-card">
        <div class="ng-card-title">💎 NeoGram</div>
        <div class="ng-muted">Новости и события сообщества</div>
      </div>
      ${state.feed.length ? state.feed.map(m => `
        <article class="ng-card">
          <div class="ng-card-title">NeoGram</div>
          <div class="ng-muted">${esc(m.created_at || '')}</div>
          <p>${esc(m.body || m.text || '')}</p>
        </article>
      `).join('') : '<div class="ng-empty">Публикаций пока нет</div>'}
      <div class="ng-card">
        <button class="ng-secondary-button" id="ng-official">Открыть официальный канал</button>
      </div>
    </div>`;
}

async function loadFeed() {
  try {
    const result = await api('/messages?chat=official_channel');
    state.feed = result.messages || [];
    if (state.tab === 'feed' && !state.chat) render();
  } catch (e) {
    notify(e.message);
  }
}

function renderGames() {
  return `
    <header class="ng-header">
      <div class="ng-title">Игры</div>
    </header>
    <div class="ng-scroll" id="ng-games-container">
      ${renderGamesModule({ token: state.token })}
    </div>`;
}

function renderSettings() {
  return `
    <header class="ng-header">
      <div class="ng-title">Настройки</div>
    </header>
    <div class="ng-scroll">
      <div class="ng-list" style="margin-top:8px">
        <button class="ng-chat-row" id="ng-profile">
          ${avatar(user(state.user), true)}
          <div class="ng-chat-copy">
            <div class="ng-chat-title">${esc(name(user(state.user)))}</div>
            <div class="ng-chat-subtitle">${esc(state.user.phone || '')}</div>
          </div>
          <span class="ng-chevron">›</span>
        </button>
      </div>

      <div class="ng-section-label">Аккаунт</div>
      <div class="ng-list">
        <button class="ng-action-card" id="ng-accounts">
          <div class="ng-action-icon">👥</div>
          <div class="ng-action-copy">
            <div class="ng-action-title">Аккаунты</div>
            <div class="ng-action-sub">${state.accounts.length}/3 аккаунта</div>
          </div>
        </button>
        <button class="ng-action-card" id="ng-wallet">
          <div class="ng-action-icon">👛</div>
          <div class="ng-action-copy">
            <div class="ng-action-title">Кошелёк GRAM</div>
            <div class="ng-action-sub">${state.wallet ? 'Баланс загружен' : 'Открыть кошелёк'}</div>
          </div>
        </button>
        <button class="ng-action-card" id="ng-market">
          <div class="ng-action-icon">🛍️</div>
          <div class="ng-action-copy">
            <div class="ng-action-title">Магазин и Fragment</div>
            <div class="ng-action-sub">Предложения и предметы</div>
          </div>
        </button>
      </div>

      <div class="ng-section-label">Оформление</div>
      <div class="ng-list">
        ${[['system','Системная'],['light','Светлая'],['dark','Тёмная']].map(([v,t]) => `
          <button class="ng-chat-row" data-theme="${v}">
            <div class="ng-chat-copy">${t}</div>
            ${state.theme === v ? '✓' : ''}
          </button>
        `).join('')}
      </div>

      <div class="ng-section-label">Помощь</div>
      <div class="ng-list">
        <button class="ng-chat-row" id="ng-faq">FAQ и помощь</button>
        <div class="ng-setting-row">
          <div class="ng-chat-title">Возможности NeoGram</div>
          <div class="ng-muted">Нету</div>
        </div>
      </div>

      <div class="ng-section-label">Приложение</div>
      <div class="ng-list">
        <button class="ng-chat-row" id="ng-logout">
          <span style="color:var(--ng-red)">Выйти из аккаунта</span>
        </button>
      </div>
    </div>`;
}

async function loadWallet() {
  try {
    state.wallet = await api('/wallet');
    if (state.tab === 'settings') render();
  } catch (e) {
    notify(e.message);
  }
}

async function loadMarket() {
  try {
    state.market = await api('/market');
    state.sheet = 'market';
    renderSheet();
  } catch (e) {
    notify(e.message);
  }
}

function renderProfile() {
  const u = state.profile;
  if (!u) {
    state.profile = null;
    render();
    return;
  }

  const mine = String(u.id) === String(currentId());

  root.innerHTML = `
    <main class="ng-screen">
      <header class="ng-chat-screen-header">
        <button class="ng-back" id="ng-profile-back">‹ Назад</button>
        <div class="ng-chat-screen-title">Профиль</div>
      </header>
      <div class="ng-scroll">
        <section class="ng-profile">
          ${avatar(u)}
          <div class="ng-profile-name">${esc(name(u))}</div>
          <div class="ng-badges" style="justify-content:center">${badges(u)}</div>
          <div class="ng-profile-meta">
            ${u.username ? '@' + esc(u.username) + '<br>' : ''}
            ${esc(u.phone || '')}<br>
            ID: ${esc(u.id)}
          </div>
          <div class="ng-profile-actions">
            ${mine
              ? '<button class="ng-primary" id="ng-profile-close">Готово</button>'
              : '<button class="ng-primary" id="ng-profile-message">Написать сообщение</button>'}
          </div>
        </section>
      </div>
    </main>`;

  root.querySelector('#ng-profile-back').onclick = () => {
    state.profile = null;
    render();
  };

  root.querySelector('#ng-profile-close')?.addEventListener('click', () => {
    state.profile = null;
    render();
  });

  root.querySelector('#ng-profile-message')?.addEventListener('click', () => {
    const chat = saveDirectChat(u);
    state.profile = null;
    openChat(chat);
  });
}

function saveDirectChat(u) {
  const my = String(currentId());
  const ids = [my, String(u.id)].sort();
  const chatId = `dm_${ids[0]}_${ids[1]}`;

  let chat = state.chats.find(c => c.id === chatId);

  if (!chat) {
    chat = {
      id: chatId,
      title: name(u),
      subtitle: u.username ? '@' + u.username : 'Личный чат',
      kind: 'direct',
      user: u
    };
    state.chats.unshift(chat);
  } else {
    Object.assign(chat, {
      title: name(u),
      subtitle: u.username ? '@' + u.username : 'Личный чат',
      user: u
    });
  }

  save(KEY.chats, state.chats);
  return chat;
}

async function openChat(chat) {
  state.chat = chat;
  state.messages = [];
  renderChat();

  await loadMessages();

  clearInterval(poll);
  poll = setInterval(() => {
    if (state.chat?.id === chat.id) loadMessages(true);
  }, 10000);
}

function renderChat() {
  const chat = state.chat;
  if (!chat) return;

  root.innerHTML = `
    <main class="ng-screen">
      <header class="ng-chat-screen-header">
        <button class="ng-back" id="ng-chat-back">‹ Чаты</button>
        <div class="ng-chat-screen-title">${esc(chat.title)}</div>
        <button class="ng-header-action" id="ng-chat-info">•••</button>
      </header>
      <div class="ng-messages" id="ng-messages">
        ${state.messages.length ? state.messages.map(renderMessage).join('') :
          '<div class="ng-empty">Пока нет сообщений</div>'}
      </div>
      <form class="ng-composer" id="ng-send-form">
        <textarea id="ng-message" rows="1" maxlength="2000"
          placeholder="Сообщение"></textarea>
        <button class="ng-send" type="submit">➤</button>
      </form>
    </main>`;

  const messages = root.querySelector('#ng-messages');
  messages.scrollTop = messages.scrollHeight;

  root.querySelector('#ng-chat-back').onclick = closeChat;

  root.querySelector('#ng-chat-info').onclick = () => {
    if (!chat.user) {
      notify(chat.title);
      return;
    }
    clearInterval(poll);
    state.profile = chat.user;
    state.chat = null;
    render();
  };

  root.querySelector('#ng-send-form').onsubmit = async e => {
    e.preventDefault();
    const input = root.querySelector('#ng-message');
    const text = input.value.trim();
    if (!text || state.sending) return;

    state.sending = true;
    input.value = '';

    try {
      await api('/messages/send', {
        method: 'POST',
        body: { chat: chat.id, text }
      });
      await loadMessages(true);
    } catch (error) {
      notify(error.message);
      input.value = text;
    }

    state.sending = false;
  };
}

function renderMessage(m) {
  const mine = String(m.sender_id) === String(currentId());
  return `<div class="ng-message ${mine ? 'mine' : 'theirs'}">
    ${esc(m.body ?? m.text ?? '')}
    <div style="font-size:10px;text-align:right;opacity:.65">
      ${m.created_at ? esc(new Date(m.created_at).toLocaleTimeString([], {
        hour:'2-digit', minute:'2-digit'
      })) : ''}
    </div>
  </div>`;
}

async function loadMessages(silent = false) {
  const chat = state.chat;
  if (!chat) return;

  try {
    const result = await api('/messages?chat=' + encodeURIComponent(chat.id));
    if (state.chat?.id !== chat.id) return;

    state.messages = Array.isArray(result.messages)
      ? result.messages.slice().reverse()
      : [];

    if (silent) {
      const node = root.querySelector('#ng-messages');
      if (node) {
        const bottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
        node.innerHTML = state.messages.map(renderMessage).join('') ||
          '<div class="ng-empty">Пока нет сообщений</div>';
        if (bottom) node.scrollTop = node.scrollHeight;
      }
    } else {
      renderChat();
    }
  } catch (e) {
    if (!silent) notify(e.message);
  }
}

function closeChat() {
  clearInterval(poll);
  poll = null;
  state.chat = null;
  state.messages = [];
  render();
}

function accountSheet() {
  state.sheet = 'accounts';
  renderSheet();
}

function renderSheet() {
  document.querySelector('.ng-sheet-backdrop')?.remove();

  let content = '';

  if (state.sheet === 'accounts') {
    content = `
      <div class="ng-sheet-title">Аккаунты</div>
      <div class="ng-muted">Можно хранить до трёх аккаунтов на устройстве.</div>
      ${state.accounts.map(a => `
        <div class="ng-setting-row">
          <div class="ng-chat-title">${esc(a.firstName || a.username || a.phone)}</div>
          <div class="ng-muted">${esc(a.phone)}</div>
          <button class="ng-secondary-button" data-account="${esc(a.id)}"
            style="margin-top:8px">
            ${String(a.id) === String(currentId()) ? 'Текущий аккаунт' : 'Переключить'}
          </button>
        </div>
      `).join('')}
      <button class="ng-primary" id="ng-add-account" style="margin-top:14px"
        ${state.accounts.length >= 3 ? 'disabled' : ''}>
        Добавить аккаунт
      </button>
      <button class="ng-secondary-button" id="ng-sheet-close" style="margin-top:9px">
        Закрыть
      </button>`;
  }

  if (state.sheet === 'market') {
    const items = Array.isArray(state.market) ? state.market :
      state.market?.items || state.market?.offers || [];

    content = `
      <div class="ng-sheet-title">🛍️ Магазин и рынок</div>
      ${items.length ? items.map(item => `
        <div class="ng-setting-row">
          <div class="ng-chat-title">${esc(item.title || item.name || 'Предмет')}</div>
          <div class="ng-muted">${esc(item.description || '')}</div>
          <div>${esc(item.price ?? item.price_gram ?? 'Цена уточняется')}</div>
        </div>
      `).join('') : '<div class="ng-empty">Предложений пока нет</div>'}
      <button class="ng-secondary-button" id="ng-sheet-close">Закрыть</button>`;
  }

  if (state.sheet === 'faq') {
    content = `
      <div class="ng-sheet-title">FAQ NeoGram</div>
      <div class="ng-setting-row">
        <b>Как войти?</b>
        <p class="ng-muted">Введи номер +888 и четырёхзначный PIN.</p>
      </div>
      <div class="ng-setting-row">
        <b>Как сменить тему?</b>
        <p class="ng-muted">Открой Настройки и выбери оформление.</p>
      </div>
      <div class="ng-setting-row">
        <b>Как добавить аккаунт?</b>
        <p class="ng-muted">Настройки → Аккаунты → Добавить аккаунт.</p>
      </div>
      <button class="ng-secondary-button" id="ng-sheet-close">Закрыть</button>`;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'ng-sheet-backdrop';
  backdrop.innerHTML = `<section class="ng-sheet">${content}</section>`;

  backdrop.onclick = e => {
    if (e.target === backdrop) closeSheet();
  };

  backdrop.querySelector('#ng-sheet-close')?.addEventListener('click', closeSheet);

  backdrop.querySelector('#ng-add-account')?.addEventListener('click', () => {
    if (state.accounts.length >= 3) return;
    closeSheet();
    state.token = '';
    state.user = null;
    state.phone = '+888';
    state.pin = '';
    state.screen = 'phone';
    render();
  });

  backdrop.querySelectorAll('[data-account]').forEach(button => {
    button.onclick = () => switchAccount(button.dataset.account);
  });

  document.body.appendChild(backdrop);
}

function closeSheet() {
  state.sheet = '';
  document.querySelector('.ng-sheet-backdrop')?.remove();
}

function switchAccount(accountId) {
  const account = state.accounts.find(a => String(a.id) === String(accountId));
  if (!account) return;

  clearInterval(poll);
  state.chat = null;
  state.profile = null;

  state.token = account.token;
  state.user = account.user;

  localStorage.setItem(KEY.token, account.token);
  save(KEY.user, account.user);

  closeSheet();
  render();
  loadWallet();
}

function logout() {
  clearInterval(poll);
  clearTimeout(searchTimer);

  state.token = '';
  state.user = null;
  state.chat = null;
  state.profile = null;
  state.messages = [];
  state.wallet = null;
  state.search = '';
  state.screen = 'phone';
  state.phone = '+888';
  state.pin = '';

  localStorage.removeItem(KEY.token);
  localStorage.removeItem(KEY.user);

  render();
}

export async function startNeoGram() {
  try {
    styles();
    mount();

    if (state.token && state.user) {
      try {
        const result = await api('/profile');
        if (result.user) {
          state.user = result.user;
          save(KEY.user, state.user);
          rememberAccount(state.token, state.user);
        }
      } catch (e) {
        console.warn('[NeoGram] Session validation:', e);
        state.token = '';
        state.user = null;
        localStorage.removeItem(KEY.token);
        localStorage.removeItem(KEY.user);
      }
    }

    state.chats = read(KEY.chats, []);
    applyTheme();
    render();

    if (state.token) loadWallet();

    if (state.tab === 'games') {
      const container = root.querySelector('#ng-games-container');
      if (container) {
        state.gamesCleanup = bindGamesModule(container, {
          token: state.token
        });
      }
    }

    return true;
  } catch (e) {
    console.error('[NeoGram] Startup failed:', e);
    return false;
  }
}
