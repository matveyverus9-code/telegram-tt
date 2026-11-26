
const PREFIX = 'neogram:';

export type NeoGramTab = 'feed' | 'chats' | 'games' | 'profile';

export interface NeoGramSettings {
  activeTab: NeoGramTab;
  animations: boolean;
  sound: boolean;
  compactMode: boolean;
}

const DEFAULT_SETTINGS: NeoGramSettings = {
  activeTab: 'feed',
  animations: true,
  sound: true,
  compactMode: false,
};

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getItem<T>(key: string, fallback: T): T {
  const storage = getStorage();

  if (!storage) return fallback;

  try {
    const value = storage.getItem(PREFIX + key);

    return value === null ? fallback : JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): boolean {
  const storage = getStorage();

  if (!storage) return false;

  try {
    storage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  getStorage()?.removeItem(PREFIX + key);
}

export function getSettings(): NeoGramSettings {
  const saved = getItem<Partial<NeoGramSettings>>(
    'settings',
    {},
  );

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    activeTab: isValidTab(saved.activeTab)
      ? saved.activeTab
      : 'feed',
  };
}

export function saveSettings(
  settings: Partial<NeoGramSettings>,
): NeoGramSettings {
  const updated = {
    ...getSettings(),
    ...settings,
  };

  if (!isValidTab(updated.activeTab)) {
    updated.activeTab = 'feed';
  }

  setItem('settings', updated);

  return updated;
}

export function isValidTab(value: unknown): value is NeoGramTab {
  return (
    value === 'feed'
    || value === 'chats'
    || value === 'games'
    || value === 'profile'
  );
}

export function getActiveTab(): NeoGramTab {
  return getSettings().activeTab;
}

export function setActiveTab(tab: NeoGramTab): void {
  if (!isValidTab(tab)) return;

  saveSettings({ activeTab: tab });
}

export function clearNeoGramStorage(): void {
  const storage = getStorage();

  if (!storage) return;

  try {
    const keys: string[] = [];

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);

      if (key?.startsWith(PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage may be unavailable.
  }
}

export default {
  getItem,
  setItem,
  removeItem,
  getSettings,
  saveSettings,
  getActiveTab,
  setActiveTab,
  clearNeoGramStorage,
};
