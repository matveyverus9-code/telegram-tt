
const API_URL = 'https://tg-api.matveyverus9.workers.dev';

type NeoGramTab = 'feed' | 'chats' | 'games' | 'profile';

const TABS: Array<{ id: NeoGramTab; label: string; icon: string }> = [
  { id: 'feed', label: 'Лента', icon: '◉' },
  { id: 'chats', label: 'Чаты', icon: '☏' },
  { id: 'games', label: 'Игры', icon: '♟' },
  { id: 'profile', label: 'Профиль', icon: '◉' },
];

let mounted = false;
let activeTab: NeoGramTab = 'feed';

function createStyles() {
  if (document.getElementById('neogram-styles')) return;

  const style = document.createElement('style');
  style.id = 'neogram-styles';

  style.textContent = `
    #neogram-root {
      position: fixed;
      z-index: 999;
      left: 0;
      right: 0;
      bottom: 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: var(--color-background);
      border-top: 1px solid var(--color-borders);
      color: var(--color-text);
      font-family: inherit;
    }

    #neogram-navigation {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      min-height: 58px;
    }

    .neogram-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border: 0;
      background: transparent;
      color: var(--color-text-secondary);
      font: inherit;
      font-size: 11px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .neogram-tab-icon {
      font-size: 21px;
      line-height: 24px;
    }

    .neogram-tab.active {
      color: var(--color-primary);
    }

    #neogram-page {
      display: none;
      position: fixed;
      z-index: 998;
      inset: 0;
      bottom: calc(58px + env(safe-area-inset-bottom, 0px));
      overflow-y: auto;
      background: var(--color-background);
      color: var(--color-text);
      padding: 20px 16px;
      font-family: inherit;
    }

    #neogram-page.visible {
      display: block;
    }

    .neogram-heading {
      margin: 0 0 18px;
      font-size: 24px;
      font-weight: 700;
    }

    .neogram-card {
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid var(--color-borders);
      border-radius: 14px;
      background: var(--color-background-secondary);
    }

    .neogram-muted {
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    body.neogram-active #root {
      padding-bottom: calc(58px + env(safe-area-inset-bottom, 0px));
    }
  `;

  document.head.appendChild(style);
}

function createPage() {
  const page = document.createElement('main');
  page.id = 'neogram-page';
  page.setAttribute('aria-live', 'polite');

  return page;
}

function renderPage(page: HTMLElement) {
  const content: Record<NeoGramTab, { title: string; description: string }> = {
    feed: {
      title: 'Лента',
      description: 'Публикации сообщества NeoGram появятся здесь.',
    },
    chats: {
      title: 'Чаты',
      description: 'Оригинальные чаты Telegram остаются доступными без изменений.',
    },
    games: {
      title: 'Игры',
      description: 'Игры NeoGram появятся здесь.',
    },
    profile: {
      title: 'Профиль',
      description: 'Профиль и настройки NeoGram появятся здесь.',
    },
  };

  const current = content[activeTab];

  page.replaceChildren();

  const heading = document.createElement('h1');
  heading.className = 'neogram-heading';
  heading.textContent = current.title;

  const card = document.createElement('section');
  card.className = 'neogram-card';

  const description = document.createElement('div');
  description.className = 'neogram-muted';
  description.textContent = current.description;

  card.appendChild(description);
  page.append(heading, card);
}

function createNavigation(page: HTMLElement) {
  const navigation = document.createElement('nav');
  navigation.id = 'neogram-navigation';
  navigation.setAttribute('aria-label', 'NeoGram');

  TABS.forEach((tab) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'neogram-tab';
    button.dataset.tab = tab.id;

    const icon = document.createElement('span');
    icon.className = 'neogram-tab-icon';
    icon.textContent = tab.icon;

    const label = document.createElement('span');
    label.textContent = tab.label;

    button.append(icon, label);

    button.addEventListener('click', () => {
      activeTab = tab.id;

      navigation.querySelectorAll('.neogram-tab').forEach((item) => {
        item.classList.toggle(
          'active',
          (item as HTMLElement).dataset.tab === activeTab,
        );
      });

      renderPage(page);

      document.dispatchEvent(
        new CustomEvent('neogram:navigate', {
          detail: { tab: activeTab },
        }),
      );
    });

    navigation.appendChild(button);
  });

  return navigation;
}

function mountNeoGram() {
  if (mounted || document.getElementById('neogram-root')) return;

  mounted = true;

  createStyles();

  const container = document.createElement('div');
  container.id = 'neogram-root';

  const page = createPage();
  const navigation = createNavigation(page);

  container.appendChild(navigation);
  document.body.append(page, container);

  document.body.classList.add('neogram-active');

  renderPage(page);

  navigation.querySelector('[data-tab="feed"]')?.classList.add('active');

  console.info('[NeoGram] Interface mounted');
}

function handleTelegramReady() {
  mountNeoGram();
}

window.addEventListener(
  'neogram:telegram-ready',
  handleTelegramReady,
);

export { mountNeoGram, API_URL };
