
import TeactDOM from './lib/teact/teact-dom';

import NeoGramShell from './neogram/NeoGramShell';
import {
  getProfile,
  type NeoGramUser,
} from './neogram/api';

import './styles/neogram.scss';

const WORKER_URL = 'https://tg-api.matveyverus9.workers.dev';

let mountElement: HTMLElement | undefined;
let currentProfile: NeoGramUser | null = null;
let profileRequestId = 0;
let mounted = false;

function isCreatorAccount(profile: NeoGramUser | null): boolean {
  return profile?.is_creator === 1;
}

function renderNeoGram(): void {
  if (!mountElement) return;

  TeactDOM.render(
    <NeoGramShell
      isCreator={isCreatorAccount(currentProfile)}
      adminApiBase={WORKER_URL}
      initialTab="feed"
      onOpenChat={(chatId) => {
        window.dispatchEvent(
          new CustomEvent('neogram:open-chat', {
            detail: { chatId },
          }),
        );
      }}
    />,
    mountElement,
  );
}

export async function refreshProfile(): Promise<void> {
  const requestId = ++profileRequestId;

  try {
    const profile = await getProfile<NeoGramUser>();

    if (requestId !== profileRequestId) return;

    currentProfile = profile;
    renderNeoGram();

    window.dispatchEvent(
      new CustomEvent('neogram:profile-loaded', {
        detail: {
          user: profile,
          isCreator: isCreatorAccount(profile),
        },
      }),
    );
  } catch {
    if (requestId !== profileRequestId) return;

    currentProfile = null;
    renderNeoGram();
  }
}

function createMountElement(): HTMLElement {
  const existing = document.getElementById('neogram-root');

  if (existing) return existing;

  const element = document.createElement('div');

  element.id = 'neogram-root';
  element.dataset.neogramApp = 'true';

  document.body.appendChild(element);

  return element;
}

export function mountNeoGram(): void {
  if (mounted || typeof document === 'undefined') return;

  if (!document.body) {
    document.addEventListener(
      'DOMContentLoaded',
      mountNeoGram,
      { once: true },
    );
    return;
  }

  mounted = true;
  mountElement = createMountElement();

  renderNeoGram();

  void refreshProfile();

  console.info('[NeoGram] Teact shell mounted.');
}

function handleAuthenticated(): void {
  void refreshProfile();
}

function handleAccountChanged(): void {
  currentProfile = null;
  renderNeoGram();

  void refreshProfile();
}

function handleLogout(): void {
  profileRequestId += 1;
  currentProfile = null;
  renderNeoGram();
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'neogram:authenticated',
    handleAuthenticated,
  );

  window.addEventListener(
    'neogram:account-changed',
    handleAccountChanged,
  );

  window.addEventListener(
    'neogram:logout',
    handleLogout,
  );

  mountNeoGram();
}

export default {
  mount: mountNeoGram,
  refreshProfile,
};
