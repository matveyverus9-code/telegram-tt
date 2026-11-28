
import { useEffect, useMemo, useState } from '../lib/teact/teact';
import {
  apiGet,
  apiPost,
  getProfile,
  updateProfile,
  type NeoGramUser,
} from './api';

type Tab = 'profile' | 'wallet' | 'shop' | 'gifts' | 'faq';
type Layout = 'neogram' | 'discord' | 'twitter' | 'steam';
type AnyRecord = Record<string, any>;

const COMMISSION = 0.1;

const FRAMES = [
  { id: 'blue-neon', name: 'Blue Neon', price: 500, icon: '🔵', color: '#299cff' },
  { id: 'prism', name: 'Prism', price: 3500, icon: '🌈', color: '#b66bff' },
  { id: 'aurora', name: 'Aurora', price: 2200, icon: '🌌', color: '#49e2c2' },
  { id: 'onyx', name: 'Onyx', price: 6000, icon: '⚫', color: '#777777' },
];

const NICK_STYLES = [
  { id: 'neon', name: 'Neon', price: 900, icon: '✨' },
  { id: 'hologram', name: 'Hologram', price: 4000, icon: '🪩' },
  { id: 'prism', name: 'Prism', price: 6500, icon: '💠' },
];

const FAQ = [
  {
    q: 'Что такое GRAM?',
    a: 'GRAM — внутренняя валюта NeoGram. Баланс и операции хранятся на сервере.',
  },
  {
    q: 'Какая комиссия на бирже?',
    a: 'Комиссия внутренней биржи — 10%. Продавец получает 90% цены лота.',
  },
  {
    q: 'Как получить редкий номер +777 или +666?',
    a: 'Эти номера выпускаются Создателем вручную. При выдаче конкретного номера с указанием владельца Worker сразу добавляет его в список номеров этого аккаунта.',
  },
  {
    q: 'Можно ли создать аккаунт через +777 или +666?',
    a: 'Нет. Текущий Worker запрещает создание нового аккаунта через специальные серии. Эти номера предназначены для выдачи и привязки к существующему профилю.',
  },
  {
    q: 'Можно ли загрузить аватар?',
    a: 'В текущем Worker нет маршрута загрузки файла аватара и нет поля avatar_url в разрешённых настройках профиля. Можно выбрать файл для локального предпросмотра, но сервер его не сохранит.',
  },
  {
    q: 'Можно ли загрузить баннер?',
    a: 'Да. Worker сохраняет banner_url. Укажите общедоступную ссылку на изображение и сохраните её.',
  },
  {
    q: 'Как работает улучшение подарка?',
    a: 'Улучшение стоит 300 Stars. Worker сам выбирает модель, фон, узор и редкость. После ответа сервера инвентарь перечитывается, чтобы показать сохранённый результат.',
  },
  {
    q: 'Можно ли купить подарок из каталога?',
    a: 'В текущем Worker есть каталог и улучшение уже принадлежащих подарков, но нет пользовательского маршрута покупки подарка из каталога.',
  },
  {
    q: 'Что такое #DEV?',
    a: '#DEV отображается только для аккаунта, которому Worker подтвердил статус Создателя. Обычный пользователь не может занять этот тег.',
  },
];

const formatNumber = (value: unknown) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0);

const formatGram = (value: unknown) => `${formatNumber(value)} GRAM`;
const formatStars = (value: unknown) => `${formatNumber(value)} Stars`;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRecord
    : {};
}

function prettyPhone(value: unknown): string {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  const match = raw.match(/^\+(\d{3})(\d{4,8})$/);
  if (!match) return raw || '—';

  const prefix = `+${match[1]}`;
  const suffix = match[2];

  if (suffix.length === 4) return `${prefix} ${suffix[0]} ${suffix.slice(1)}`;
  if (suffix.length === 5) return `${prefix} ${suffix.slice(0, 2)} ${suffix.slice(2)}`;
  if (suffix.length === 6) return `${prefix} ${suffix.slice(0, 3)} ${suffix.slice(3)}`;
  if (suffix.length === 7) return `${prefix} ${suffix.slice(0, 3)} ${suffix.slice(3, 5)} ${suffix.slice(5)}`;
  return `${prefix} ${suffix.slice(0, 4)} ${suffix.slice(4)}`;
}

function getErrorMessage(error: unknown): string {
  const code = String(
    (error as AnyRecord)?.code ||
    (error as AnyRecord)?.message ||
    error ||
    '',
  );

  const messages: Record<string, string> = {
    UNAUTHORIZED: 'Сессия не найдена. Войдите в NeoGram.',
    INSUFFICIENT_FUNDS: 'Недостаточно средств на балансе.',
    NOT_OWNED: 'Этот актив не принадлежит вашему аккаунту.',
    ALREADY_LISTED: 'Этот актив уже выставлен на биржу.',
    UNAVAILABLE: 'Лот уже недоступен.',
    ALREADY_SOLD: 'Лот уже куплен другим пользователем.',
    NOT_FOUND: 'Запись не найдена.',
    PROFILE_PHONE_LIMIT: 'Достигнут лимит привязанных номеров.',
    INVALID_LAYOUT: 'Недопустимый макет профиля.',
    RESERVED: 'Это имя зарезервировано.',
    TAKEN: 'Это имя уже занято.',
    INVALID_USERNAME: 'Username должен содержать 3–10 символов: латинские буквы, цифры или _.',
    SPECIAL_PHONE_ADMIN_ONLY: 'Создание аккаунта через +777/+666 запрещено.',
    INVALID_TRANSFER: 'Не удалось передать подарок.',
  };

  return messages[code] || code || 'Не удалось выполнить запрос.';
}

export default function NeoGramProfileShop() {
  const [tab, setTab] = useState<Tab>('profile');
  const [layout, setLayout] = useState<Layout>('neogram');

  const [user, setUser] = useState<NeoGramUser | null>(null);
  const [wallet, setWallet] = useState<AnyRecord>({});
  const [market, setMarket] = useState<AnyRecord>({ listings: [], commission: COMMISSION });
  const [gifts, setGifts] = useState<AnyRecord>({ catalog: [], owned: [] });

  const [bannerUrl, setBannerUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [discord, setDiscord] = useState('');
  const [twitter, setTwitter] = useState('');
  const [steam, setSteam] = useState('');
  const [username, setUsername] = useState('');
  const [fragmentSearch, setFragmentSearch] = useState('');
  const [fragmentResult, setFragmentResult] = useState<AnyRecord | null>(null);
  const [numberToAttach, setNumberToAttach] = useState('');

  const [listingAsset, setListingAsset] = useState('');
  const [listingPrice, setListingPrice] = useState('100');

  const [selectedGift, setSelectedGift] = useState('');
  const [rouletteResult, setRouletteResult] = useState<AnyRecord | null>(null);
  const [rouletteBusy, setRouletteBusy] = useState(false);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const profile = asRecord(user?.profile);
  const socialLinks = asRecord(profile.links);
  const phones = Array.isArray(user?.phones) ? user!.phones as AnyRecord[] : [];
  const ownedGifts = Array.isArray(gifts.owned) ? gifts.owned as AnyRecord[] : [];
  const giftCatalog = Array.isArray(gifts.catalog) ? gifts.catalog as AnyRecord[] : [];
  const listings = Array.isArray(market.listings) ? market.listings as AnyRecord[] : [];

  const isCreator = Number(user?.is_creator) === 1;
  const gram = Number(wallet.gram ?? user?.gram ?? 0);
  const stars = Number(wallet.stars ?? user?.stars ?? 0);

  const visibleListings = useMemo(
    () => listings.filter((item) => item.status === 'open'),
    [listings],
  );

  const refresh = async () => {
    const [profileResult, walletResult, marketResult, giftsResult] = await Promise.all([
      getProfile<NeoGramUser>(),
      apiGet<AnyRecord>('/wallet'),
      apiGet<AnyRecord>('/market'),
      apiGet<AnyRecord>('/gifts'),
    ]);

    setUser(profileResult);
    setWallet(walletResult || {});
    setMarket(marketResult || { listings: [], commission: COMMISSION });
    setGifts(giftsResult || { catalog: [], owned: [] });

    const savedProfile = asRecord(profileResult.profile);
    setBannerUrl(String(savedProfile.banner_url || ''));
    setDiscord(String(asRecord(savedProfile.links).discord || ''));
    setTwitter(String(asRecord(savedProfile.links).twitter || ''));
    setSteam(String(asRecord(savedProfile.links).steam || ''));

    if (profileResult.username) {
      setUsername(String(profileResult.username));
    }
  };

  useEffect(() => {
    let active = true;

    const initialLoad = async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (error) {
        if (active) setNotice(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialLoad();

    return () => {
      active = false;
    };
  }, []);

  const run = async (operation: () => Promise<unknown>, successMessage: string) => {
    if (busy) return;

    setBusy(true);
    setNotice('');

    try {
      await operation();
      await refresh();
      setNotice(successMessage);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveBanner = async () => {
    const value = bannerUrl.trim();

    if (value && !/^https?:\/\/\S+$/i.test(value)) {
      setNotice('Укажите корректную ссылку https:// на изображение.');
      return;
    }

    await run(
      () => updateProfile({ banner_url: value }),
      'Баннер сохранён на сервере.',
    );
  };

  const saveSocialLinks = async () => {
    await run(
      () => updateProfile({
        links: {
          discord: discord.trim(),
          twitter: twitter.trim(),
          steam: steam.trim(),
        },
      }),
      'Ссылки Discord, Twitter и Steam сохранены.',
    );
  };

  const saveLayout = async (nextLayout: Layout) => {
    setLayout(nextLayout);

    if (nextLayout === 'neogram') {
      setNotice('Макет NeoGram выбран для предпросмотра.');
      return;
    }

    await run(
      () => updateProfile({ layout: nextLayout }),
      `Макет ${nextLayout} сохранён.`,
    );
  };

  const claimUsername = async (requestedName?: string) => {
    const name = (requestedName || username).trim().replace(/^@/, '').toLowerCase();

    if (!/^[a-z0-9_]{3,10}$/.test(name)) {
      setNotice('Username должен содержать 3–10 символов: латинские буквы, цифры или _.');
      return;
    }

    await run(async () => {
      const result = await apiPost<AnyRecord>('/usernames/claim', { username: name });

      if (result.username) setUsername(String(result.username).replace(/^@/, ''));

      if (name === 'dev') {
        setNotice('Worker подтвердил регистрацию @dev. Обратите внимание: текущий маршрут Worker возвращает цену, но не списывает GRAM за username.');
      }
    }, `Username @${name} обработан сервером.`);
  };

  const searchFragment = async () => {
    const query = fragmentSearch.trim();

    if (!query) {
      setNotice('Введите номер или @username для поиска.');
      return;
    }

    setBusy(true);
    setFragmentResult(null);
    setNotice('');

    try {
      const result = await apiGet<AnyRecord>('/fragment/info', { q: query });
      setFragmentResult(result);
      setNotice('Информация получена из внутренней базы NeoGram.');
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const attachIssuedNumber = async () => {
    const phone = numberToAttach.replace(/[^\d+]/g, '');

    if (!phone) {
      setNotice('Введите номер, который уже выдан вашему ID Создателем.');
      return;
    }

    await run(
      () => apiPost('/assets/use-phone', { phone }),
      'Запрос на привязку номера выполнен.',
    );
  };

  const sellPhone = async () => {
    const price = Number(listingPrice);

    if (!listingAsset) {
      setNotice('Выберите номер для выставления.');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setNotice('Цена должна быть больше нуля.');
      return;
    }

    await run(
      () => apiPost('/market/sell', {
        asset_type: 'phone',
        asset_key: listingAsset,
        price,
      }),
      'Номер выставлен на внутреннюю биржу.',
    );
  };

  const sellGift = async (gift: AnyRecord) => {
    const giftId = Number(gift.gift_id);

    if (!giftId) {
      setNotice('Не удалось определить ID подарка.');
      return;
    }

    const input = typeof window !== 'undefined'
      ? window.prompt('Цена продажи в GRAM:', '100')
      : null;

    if (input === null) return;

    const price = Number(input);

    if (!Number.isFinite(price) || price <= 0) {
      setNotice('Введите корректную цену.');
      return;
    }

    await run(
      () => apiPost('/market/sell', {
        asset_type: 'gift',
        asset_key: String(giftId),
        price,
      }),
      'Подарок выставлен на биржу.',
    );
  };

  const buyListing = async (listingId: number) => {
    if (!listingId) return;

    await run(
      () => apiPost('/market/buy', { listing_id: listingId }),
      'Покупка лота завершена. Комиссия биржи — 10%.',
    );
  };

  const buyFrame = async (frame: AnyRecord) => {
    await run(
      () => apiPost('/shop/buy', {
        kind: 'frame',
        frame: frame.id,
        frame_color: frame.color,
        price: frame.price,
      }),
      `Рамка ${frame.name} приобретена за Stars.`,
    );
  };

  const buyNickStyle = async (style: AnyRecord) => {
    await run(
      () => apiPost('/shop/buy', {
        kind: 'style',
        style: style.id,
        target: 'player',
        price: style.price,
      }),
      `Стиль ника ${style.name} приобретён за Stars.`,
    );
  };

  const upgradeGift = async (gift: AnyRecord) => {
    const giftId = Number(gift.gift_id);

    if (!giftId) {
      setNotice('Не удалось определить ID подарка.');
      return;
    }

    if (stars < 300) {
      setNotice('Для улучшения необходимо 300 Stars.');
      return;
    }

    setRouletteBusy(true);
    setRouletteResult(null);
    setNotice('');

    try {
      await apiPost('/gifts/upgrade', { gift_id: giftId });

      const [updatedGifts, updatedWallet] = await Promise.all([
        apiGet<AnyRecord>('/gifts'),
        apiGet<AnyRecord>('/wallet'),
      ]);

      setGifts(updatedGifts || { catalog: [], owned: [] });
      setWallet(updatedWallet || {});

      const updatedOwned = Array.isArray(updatedGifts?.owned)
        ? updatedGifts.owned as AnyRecord[]
        : [];

      const result = updatedOwned.find(
        (item) => Number(item.gift_id) === giftId,
      );

      if (result) {
        setRouletteResult(result);
        setSelectedGift(String(giftId));
      }

      setNotice('Worker завершил улучшение. Результат загружен из инвентаря.');
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setRouletteBusy(false);
    }
  };

  const chooseAvatarFile = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice('Выберите файл изображения.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Размер изображения не должен превышать 5 МБ.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarPreview(reader.result);
        setNotice('Аватар показан в локальном предпросмотре. Текущий Worker не умеет сохранять загруженный файл.');
      }
    };

    reader.onerror = () => setNotice('Не удалось прочитать изображение.');
    reader.readAsDataURL(file);
  };

  const renderProfilePreview = () => {
    const displayName = user?.username
      ? `@${user.username}`
      : `Player #${user?.id || ''}`;

    return (
      <div className={`ngps-preview ngps-preview-${layout}`}>
        <div
          className="ngps-banner"
          style={profile.banner_url
            ? { backgroundImage: `url("${String(profile.banner_url)}")` }
            : undefined}
        />

        <div className="ngps-preview-body">
          <div className="ngps-avatar">
            {avatarPreview
              ? <img src={avatarPreview} alt="Предпросмотр аватара" />
              : String(user?.username || 'N').charAt(0).toUpperCase()}
          </div>

          <div className="ngps-name">
            {displayName}
            {isCreator && <span className="ngps-dev-tag">#DEV</span>}
          </div>

          <div className="ngps-muted">
            {layout.toUpperCase()} · {prettyPhone(user?.phone)}
          </div>

          <div className="ngps-badges">
            {isCreator && <span className="ngps-badge creator">✦ Создатель</span>}
            {Number(user?.is_creator_badge) === 1 && <span className="ngps-badge">✓ Verified</span>}
            {Number(user?.hold_badge) === 1 && <span className="ngps-badge">Hold</span>}
            {Number(user?.major_badge) === 1 && <span className="ngps-badge">Major</span>}
          </div>

          <div className="ngps-grid ngps-preview-stats">
            <div className="ngps-card">
              <div className="ngps-balance">{formatNumber(gram)}</div>
              <div className="ngps-muted">GRAM</div>
            </div>
            <div className="ngps-card">
              <div className="ngps-balance">{phones.length}</div>
              <div className="ngps-muted">Номеров</div>
            </div>
          </div>

          <div className="ngps-social-preview">
            <div>Discord: {socialLinks.discord || '—'}</div>
            <div>Twitter: {socialLinks.twitter || '—'}</div>
            <div>Steam: {socialLinks.steam || '—'}</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="ngps-root">
        <style>{styles}</style>
        <div className="ngps-loading">Подключение к NeoGram Worker…</div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="ngps-root">
        <style>{styles}</style>
        <div className="ngps-panel">
          <h3>NeoGram</h3>
          <p className="ngps-muted">Не удалось загрузить профиль. Проверьте авторизацию и подключение к Worker.</p>
          <button className="ngps-btn" type="button" onClick={() => {
            setLoading(true);
            void refresh()
              .catch((error) => setNotice(getErrorMessage(error)))
              .finally(() => setLoading(false));
          }}>
            Повторить загрузку
          </button>
          {notice && <div className="ngps-notice">{notice}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="ngps-root">
      <style>{styles}</style>

      <header className="ngps-header">
        <div>
          <div className="ngps-brand">NEOGRAM</div>
          <div className="ngps-header-sub">PROFILE · WALLET · MARKET</div>
        </div>
        <div className="ngps-header-balance">
          <strong>{formatNumber(gram)}</strong>
          <span>GRAM</span>
        </div>
      </header>

      <nav className="ngps-tabs">
        {([
          ['profile', 'Профиль'],
          ['wallet', 'Кошелёк'],
          ['shop', 'Магазин'],
          ['gifts', 'Подарки'],
          ['faq', 'FAQ'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            type="button"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'profile' && (
        <>
          <div className="ngps-profile-layout">
            <div className="ngps-panel">
              <div className="ngps-panel-heading">
                <div>
                  <h3>Предпросмотр профиля</h3>
                  <p className="ngps-muted">NeoGram / Discord / Twitter / Steam</p>
                </div>
                <button className="ngps-btn secondary small" type="button" disabled={busy} onClick={() => void refresh()}>
                  ↻
                </button>
              </div>

              <div className="ngps-layout-picker">
                {([
                  ['neogram', 'NeoGram'],
                  ['discord', 'Discord'],
                  ['twitter', 'Twitter'],
                  ['steam', 'Steam'],
                ] as [Layout, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={layout === id ? 'active' : ''}
                    onClick={() => void saveLayout(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {renderProfilePreview()}
            </div>

            <div className="ngps-panel">
              <h3>Баннер профиля</h3>
              <div className="ngps-field">
                <label>Публичная ссылка на изображение</label>
                <input
                  value={bannerUrl}
                  onChange={(event) => setBannerUrl(event.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
              <button className="ngps-btn" type="button" disabled={busy} onClick={() => void saveBanner()}>
                Сохранить баннер на сервере
              </button>

              <div className="ngps-divider" />

              <h3>Аватар профиля</h3>
              <label className="ngps-file-button">
                <span>Выбрать изображение</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => chooseAvatarFile(event.target.files?.[0])}
                />
              </label>
              <p className="ngps-muted">
                Файл используется только для предпросмотра на этом экране. В Worker отсутствует маршрут загрузки аватара, поэтому после перезагрузки он не сохранится.
              </p>

              <div className="ngps-divider" />

              <h3>Социальные профили</h3>
              <div className="ngps-field">
                <label>Discord</label>
                <input value={discord} onChange={(event) => setDiscord(event.target.value)} placeholder="username или ссылка" />
              </div>
              <div className="ngps-field">
                <label>Twitter / X</label>
                <input value={twitter} onChange={(event) => setTwitter(event.target.value)} placeholder="@username или ссылка" />
              </div>
              <div className="ngps-field">
                <label>Steam</label>
                <input value={steam} onChange={(event) => setSteam(event.target.value)} placeholder="SteamID или ссылка" />
              </div>
              <button className="ngps-btn" type="button" disabled={busy} onClick={() => void saveSocialLinks()}>
                Сохранить социальные ссылки
              </button>
            </div>
          </div>

          <div className="ngps-panel">
            <h3>Username и специальные теги</h3>
            <div className="ngps-field">
              <label>Username · 3–10 символов</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="username"
                maxLength={10}
              />
            </div>
            <button className="ngps-btn" type="button" disabled={busy} onClick={() => void claimUsername()}>
              Зарегистрировать username
            </button>
            <p className="ngps-muted">
              Worker рассчитывает цену username и проверяет занятость. В текущем Worker маршрут регистрации не списывает GRAM автоматически.
            </p>

            {isCreator && (
              <div className="ngps-creator-card">
                <div className="ngps-creator-mark">✦</div>
                <div>
                  <strong>#DEV · Создатель</strong>
                  <p>Мастер-номер: +666 6 666</p>
                  <p>Цена мастер-номера: 666 666 666 666 GRAM</p>
                  <p>@dev: 1 000 000 000 GRAM</p>
                  <button
                    className="ngps-btn secondary"
                    type="button"
                    disabled={busy || String(user.username || '').toLowerCase() === 'dev'}
                    onClick={() => void claimUsername('dev')}
                  >
                    {String(user.username || '').toLowerCase() === 'dev' ? '@dev уже установлен' : 'Зарегистрировать @dev'}
                  </button>
                  <p className="ngps-muted">
                    Worker разрешает username dev только Создателю. Отображение #DEV определяется серверным is_creator. Цены показаны по заданию проекта, но текущий маршрут не выполняет списание этих сумм.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="ngps-panel">
            <div className="ngps-panel-heading">
              <div>
                <h3>Бейджи профиля</h3>
                <p className="ngps-muted">Статусы, полученные из ответа Worker.</p>
              </div>
            </div>
            <div className="ngps-badges ngps-badges-large">
              {isCreator && <span className="ngps-badge creator">✦ Создатель</span>}
              {Number(user.is_creator_badge) === 1 && <span className="ngps-badge">✓ Hold / Verified</span>}
              {Number(user.hold_badge) === 1 && <span className="ngps-badge hold">Hold</span>}
              {Number(user.major_badge) === 1 && <span className="ngps-badge major">Major</span>}
              {!isCreator && !Number(user.is_creator_badge) && !Number(user.hold_badge) && !Number(user.major_badge) && (
                <span className="ngps-muted">Пока нет специальных бейджей.</span>
              )}
            </div>
            <p className="ngps-muted">
              Бейджи отображаются по серверным полям. Самостоятельно назначить их через профиль нельзя.
            </p>
          </div>

          <div className="ngps-panel">
            <h3>Кошелёк номеров +777 / +666</h3>
            <p className="ngps-muted">
              Номера должны быть заранее выпущены Создателем с указанием вашего ID или username. В этом случае Worker добавляет их в профиль при выдаче.
            </p>

            {phones.length === 0 && (
              <div className="ngps-empty">Дополнительных выданных номеров пока нет.</div>
            )}

            {phones.map((item, index) => {
              const phone = String(item.phone || '');
              const series = phone.startsWith('+777')
                ? '+777'
                : phone.startsWith('+666')
                  ? '+666'
                  : '+888';

              return (
                <div className="ngps-between ngps-list-row" key={`${phone}-${index}`}>
                  <div>
                    <strong>{prettyPhone(phone)}</strong>
                    <div className="ngps-muted">
                      {series} · {Number(item.primary_phone) === 1 ? 'Основной номер' : 'Дополнительный номер'}
                    </div>
                  </div>
                  <span className="ngps-pill">
                    {Number(item.price || 0) > 0 ? formatGram(item.price) : 'Привязан'}
                  </span>
                </div>
              );
            })}

            <div className="ngps-divider" />
            <h4>Привязать уже выданный номер</h4>
            <div className="ngps-field">
              <label>Точный номер</label>
              <input
                value={numberToAttach}
                onChange={(event) => setNumberToAttach(event.target.value)}
                placeholder="+777 1234 или +666 1234"
              />
            </div>
            <button className="ngps-btn secondary" type="button" disabled={busy || !numberToAttach.trim()} onClick={() => void attachIssuedNumber()}>
              Отправить запрос на привязку
            </button>
            <p className="ngps-muted">
              Worker проверит, что номер уже выдан именно вашему аккаунту. Создать новый аккаунт через +777/+666 нельзя. Если номер уже отображается выше, повторно привязывать его не нужно.
            </p>
          </div>
        </>
      )}

      {tab === 'wallet' && (
        <>
          <div className="ngps-wallet-grid">
            <div className="ngps-wallet-card">
              <span>Баланс GRAM</span>
              <strong>{formatNumber(gram)}</strong>
              <small>Внутренняя валюта</small>
            </div>
            <div className="ngps-wallet-card stars">
              <span>Баланс Stars</span>
              <strong>{formatNumber(stars)}</strong>
              <small>Покупки и улучшения</small>
            </div>
          </div>

          <div className="ngps-panel">
            <h3>Fragment · внутренняя биржа NeoGram</h3>
            <p className="ngps-muted">
              Биржа работает через Worker и D1. Комиссия с продажи — 10%. Внешний Fragment API не используется.
            </p>

            <div className="ngps-field">
              <label>Поиск номера или username</label>
              <input
                value={fragmentSearch}
                onChange={(event) => setFragmentSearch(event.target.value)}
                placeholder="+777… или @username"
              />
            </div>
            <button className="ngps-btn secondary" type="button" disabled={busy} onClick={() => void searchFragment()}>
              Найти актив
            </button>

            {fragmentResult && (
              <div className="ngps-card ngps-search-result">
                <strong>{fragmentResult.owner || fragmentResult.username || fragmentResult.phone || 'Актив'}</strong>
                <div className="ngps-muted">
                  {fragmentResult.phone ? prettyPhone(fragmentResult.phone) : fragmentResult.username || 'Профиль'}
                </div>
                <div className="ngps-price">{formatGram(fragmentResult.value_gram)}</div>
                <div className="ngps-muted">Источник: {fragmentResult.marketplace || 'NeoGram Worker'}</div>
              </div>
            )}
          </div>

          <div className="ngps-panel">
            <h3>Выставить номер на биржу</h3>
            <div className="ngps-field">
              <label>Номер из вашего профиля</label>
              <select value={listingAsset} onChange={(event) => setListingAsset(event.target.value)}>
                <option value="">Выберите номер</option>
                {phones.map((item, index) => (
                  <option key={`${item.phone}-${index}`} value={String(item.phone)}>
                    {prettyPhone(item.phone)}
                  </option>
                ))}
              </select>
            </div>

            <div className="ngps-field">
              <label>Цена в GRAM</label>
              <input type="number" min="1" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} />
            </div>

            <div className="ngps-fee-line">
              <span>Комиссия 10%</span>
              <strong>{formatGram(Number(listingPrice || 0) * COMMISSION)}</strong>
            </div>
            <div className="ngps-fee-line">
              <span>Вы получите 90%</span>
              <strong>{formatGram(Number(listingPrice || 0) * (1 - COMMISSION))}</strong>
            </div>

            <button className="ngps-btn" type="button" disabled={busy} onClick={() => void sellPhone()}>
              Выставить номер
            </button>
          </div>

          <div className="ngps-panel">
            <h3>Открытые лоты</h3>
            {visibleListings.length === 0 && <div className="ngps-empty">Открытых лотов нет.</div>}

            {visibleListings.map((item) => (
              <div className="ngps-market-row" key={item.id}>
                <div className="ngps-market-info">
                  <strong>
                    {item.asset_type === 'phone'
                      ? prettyPhone(item.asset_key)
                      : item.asset_type === 'gift'
                        ? `Подарок #${item.asset_id || item.asset_key}`
                        : `@${item.asset_key}`}
                  </strong>
                  <span>Продавец: {item.seller_username || `ID ${item.seller_id}`}</span>
                  <b>{formatGram(item.price)}</b>
                  <small>Комиссия 10% · продавец получит {formatGram(Number(item.price) * 0.9)}</small>
                </div>
                <button
                  className="ngps-btn"
                  type="button"
                  disabled={busy || Number(item.seller_id) === Number(user.id)}
                  onClick={() => void buyListing(Number(item.id))}
                >
                  Купить
                </button>
              </div>
            ))}
          </div>

          <div className="ngps-panel">
            <h3>История кошелька</h3>
            {(!Array.isArray(wallet.transactions) || wallet.transactions.length === 0) && (
              <div className="ngps-empty">Операций пока нет.</div>
            )}
            {(Array.isArray(wallet.transactions) ? wallet.transactions : []).map((item: AnyRecord) => (
              <div className="ngps-between ngps-list-row" key={item.id}>
                <div>
                  <strong>{item.kind || 'Операция'}</strong>
                  <div className="ngps-muted">{item.created_at || ''}</div>
                </div>
                <span className="ngps-pill">
                  {formatNumber(item.amount)} {String(item.currency || '').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'shop' && (
        <>
          <div className="ngps-panel">
            <h3>Магазин рамок</h3>
            <p className="ngps-muted">Стоимость списывается в Stars серверным маршрутом /shop/buy.</p>
            <div className="ngps-grid">
              {FRAMES.map((item) => (
                <div className="ngps-card ngps-shop-card" key={item.id}>
                  <div className="ngps-frame-sample" style={{ borderColor: item.color, boxShadow: `0 0 18px ${item.color}55` }}>
                    {item.icon}
                  </div>
                  <strong>{item.name}</strong>
                  <div className="ngps-price">{formatStars(item.price)}</div>
                  <button className="ngps-btn" type="button" disabled={busy} onClick={() => void buyFrame(item)}>
                    Купить
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ngps-panel">
            <h3>Магазин стилей ника</h3>
            <p className="ngps-muted">Покупка стиля обрабатывается Worker. Цвета и оформление номеров +777/+666 не продаются.</p>
            <div className="ngps-grid">
              {NICK_STYLES.map((item) => (
                <div className="ngps-card ngps-shop-card" key={item.id}>
                  <div className="ngps-icon">{item.icon}</div>
                  <strong>{item.name}</strong>
                  <div className="ngps-price">{formatStars(item.price)}</div>
                  <button className="ngps-btn" type="button" disabled={busy} onClick={() => void buyNickStyle(item)}>
                    Купить
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ngps-panel">
            <h3>Каталог 3D-подарков</h3>
            <p className="ngps-muted">Каталог загружается из Worker. Покупка из каталога пока не подключена в серверном API.</p>
            {giftCatalog.length === 0 && <div className="ngps-empty">Каталог пока пуст.</div>}
            <div className="ngps-grid">
              {giftCatalog.map((item) => (
                <div className="ngps-card ngps-shop-card" key={item.id}>
                  <div className="ngps-icon">{item.visual?.icon || '🎁'}</div>
                  <strong>{item.name}</strong>
                  <div className="ngps-muted">Остаток: {item.supply}</div>
                  <div className="ngps-price">{formatNumber(item.base_value)} GRAM</div>
                  <div className="ngps-muted">{formatStars(item.price_stars)}</div>
                  <span className="ngps-pill">3D · Black Onyx ready</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'gifts' && (
        <>
          <div className="ngps-panel">
            <div className="ngps-panel-heading">
              <div>
                <h3>Мой инвентарь подарков</h3>
                <p className="ngps-muted">Предметы, принадлежащие вашему аккаунту.</p>
              </div>
              <button className="ngps-btn secondary small" type="button" disabled={busy} onClick={() => void refresh()}>
                ↻
              </button>
            </div>

            {ownedGifts.length === 0 && (
              <div className="ngps-empty">В инвентаре пока нет подарков.</div>
            )}

            <div className="ngps-grid">
              {ownedGifts.map((gift) => (
                <div className="ngps-card ngps-gift-card" key={gift.gift_id}>
                  <div className="ngps-gift-3d">🎁</div>
                  <strong>{gift.name}</strong>
                  <div className="ngps-muted">{gift.model || 'Classic'}</div>
                  <div className="ngps-muted">
                    Фон: {gift.bg || 'Blue'} · Узор: {gift.pattern || 'Plain'}
                  </div>
                  <div className="ngps-price">Редкость: {formatNumber(gift.rarity)}%</div>
                  <div className="ngps-row">
                    <button className="ngps-btn" type="button" disabled={busy || rouletteBusy || stars < 300} onClick={() => void upgradeGift(gift)}>
                      Улучшить · 300 Stars
                    </button>
                    <button className="ngps-btn secondary" type="button" disabled={busy} onClick={() => void sellGift(gift)}>
                      На биржу
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ngps-panel">
            <h3>3D · рулетка улучшения</h3>
            <p className="ngps-muted">
              Три барабана показывают сохранённые Worker параметры: модель, фон и узор. Цена попытки — 300 Stars.
            </p>

            <div className="ngps-field">
              <label>Подарок для улучшения</label>
              <select value={selectedGift} onChange={(event) => setSelectedGift(event.target.value)}>
                <option value="">Выберите подарок</option>
                {ownedGifts.map((gift) => (
                  <option key={gift.gift_id} value={String(gift.gift_id)}>
                    {gift.name} · #{gift.gift_id}
                  </option>
                ))}
              </select>
            </div>

            <div className={`ngps-reels ${rouletteBusy ? 'spinning' : ''}`}>
              <div className="ngps-reel">
                <span>MODEL</span>
                <strong>{rouletteBusy ? '✦ ✧ ✦' : rouletteResult?.model || '—'}</strong>
              </div>
              <div className="ngps-reel">
                <span>BACKGROUND</span>
                <strong>{rouletteBusy ? '◈ ◆ ◈' : rouletteResult?.bg || '—'}</strong>
              </div>
              <div className="ngps-reel">
                <span>PATTERN</span>
                <strong>{rouletteBusy ? '✺ ✹ ✺' : rouletteResult?.pattern || '—'}</strong>
              </div>
            </div>

            {rouletteResult && (
              <div className="ngps-card ngps-result-card">
                <strong>{rouletteResult.name}</strong>
                <div className="ngps-muted">
                  {rouletteResult.model} · {rouletteResult.bg} · {rouletteResult.pattern}
                </div>
                <div className="ngps-price">
                  Редкость: {formatNumber(rouletteResult.rarity)}%
                </div>
              </div>
            )}

            <button
              className="ngps-btn"
              type="button"
              disabled={busy || rouletteBusy || !selectedGift || stars < 300}
              onClick={() => {
                const gift = ownedGifts.find((item) => String(item.gift_id) === selectedGift);
                if (gift) void upgradeGift(gift);
              }}
            >
              {rouletteBusy ? 'Барабаны вращаются…' : 'Запустить улучшение'}
            </button>

            <div className="ngps-backgrounds">
              <span>Blue</span>
              <span>Purple</span>
              <span>Gold</span>
              <span className="onyx">Black / Onyx</span>
              <span>Rainbow</span>
            </div>
            <p className="ngps-muted">
              Worker выбирает фон случайно из Blue, Purple, Gold, Black и Rainbow; узор — Plain, Stars, Geometric или Galaxy. Вариант Black соответствует Onyx.
            </p>
          </div>
        </>
      )}

      {tab === 'faq' && (
        <div className="ngps-panel">
          <h3>Частые вопросы</h3>
          {FAQ.map((item, index) => (
            <div className="ngps-faq" key={item.q}>
              <button type="button" onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}>
                <span>{item.q}</span>
                <b>{expandedFaq === index ? '−' : '+'}</b>
              </button>
              {expandedFaq === index && <p>{item.a}</p>}
            </div>
          ))}

          <div className="ngps-card ngps-capabilities">
            <strong>Возможности NeoGram</strong>
            <p>Нету</p>
          </div>
        </div>
      )}

      {notice && <div className="ngps-notice" role="status">{notice}</div>}
    </section>
  );
}

const styles = `
.ngps-root {
  --bg:#080d18;
  --panel:#101a2b;
  --panel2:#13233b;
  --line:rgba(145,175,220,.17);
  --text:#f3f7ff;
  --muted:#91a1bb;
  --blue:#168fff;
  position:relative;
  width:100%;
  min-width:0;
  padding:12px 12px calc(28px + env(safe-area-inset-bottom,0px));
  color:var(--text);
  font-family:inherit;
}
.ngps-root * {box-sizing:border-box;}
.ngps-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:15px 16px;
  border:1px solid rgba(75,150,255,.2);
  border-radius:17px;
  background:linear-gradient(115deg,#112c50,#10182b 75%);
  box-shadow:0 12px 35px rgba(0,0,0,.16);
}
.ngps-brand {font-size:17px;font-weight:950;letter-spacing:1.6px;}
.ngps-header-sub {margin-top:4px;color:#83baff;font-size:9px;letter-spacing:1.1px;}
.ngps-header-balance {text-align:right;}
.ngps-header-balance strong {display:block;font-size:20px;}
.ngps-header-balance span {color:var(--muted);font-size:9px;}
.ngps-tabs {
  display:flex;
  gap:5px;
  margin:12px 0;
  padding:5px;
  overflow-x:auto;
  border:1px solid var(--line);
  border-radius:13px;
  background:#0b1423;
  scrollbar-width:none;
}
.ngps-tabs button {
  flex:1 0 auto;
  min-height:38px;
  padding:8px 12px;
  border:1px solid transparent;
  border-radius:9px;
  background:transparent;
  color:var(--muted);
  font:inherit;
  font-size:11px;
  font-weight:800;
  cursor:pointer;
}
.ngps-tabs button.active {
  border-color:rgba(40,145,255,.3);
  background:linear-gradient(120deg,rgba(0,132,255,.25),rgba(70,80,200,.16));
  color:#fff;
}
.ngps-panel {
  min-width:0;
  margin:12px 0;
  padding:15px;
  border:1px solid var(--line);
  border-radius:15px;
  background:linear-gradient(145deg,rgba(18,31,51,.98),rgba(11,19,33,.98));
  box-shadow:0 8px 24px rgba(0,0,0,.12);
}
.ngps-panel h3 {margin:0 0 9px;font-size:15px;font-weight:900;}
.ngps-panel h4 {margin:13px 0 8px;font-size:12px;}
.ngps-panel-heading {display:flex;align-items:center;justify-content:space-between;gap:10px;}
.ngps-muted {color:var(--muted);font-size:11px;line-height:1.55;}
.ngps-profile-layout {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
.ngps-layout-picker {display:flex;flex-wrap:wrap;gap:5px;margin:12px 0;}
.ngps-layout-picker button {
  padding:7px 9px;
  border:1px solid var(--line);
  border-radius:8px;
  background:#0c1728;
  color:var(--muted);
  font:inherit;
  font-size:10px;
}
.ngps-layout-picker button.active {border-color:#168fff;color:#fff;background:rgba(22,143,255,.17);}
.ngps-preview {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(85,150,240,.25);
  border-radius:14px;
  background:#0a1322;
}
.ngps-preview-discord {border-radius:18px;background:#232633;}
.ngps-preview-twitter {border-radius:8px;background:#071522;}
.ngps-preview-steam {border-radius:5px;background:#102234;}
.ngps-banner {
  height:95px;
  background:
    radial-gradient(circle at 75% 20%,rgba(0,183,255,.45),transparent 28%),
    linear-gradient(115deg,#174a85,#172044 55%,#281b58);
  background-size:cover;
  background-position:center;
}
.ngps-preview-body {position:relative;padding:0 13px 15px;}
.ngps-avatar {
  display:grid;
  place-items:center;
  width:58px;
  height:58px;
  margin-top:-27px;
  overflow:hidden;
  border:3px solid #101a2b;
  border-radius:19px;
  background:linear-gradient(145deg,#168fff,#513ac4);
  color:white;
  font-size:25px;
  font-weight:950;
}
.ngps-preview-discord .ngps-avatar {border-radius:50%;}
.ngps-preview-twitter .ngps-avatar {border-radius:50%;}
.ngps-preview-steam .ngps-avatar {border-radius:8px;}
.ngps-avatar img {width:100%;height:100%;object-fit:cover;}
.ngps-name {display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:8px;font-size:14px;font-weight:900;overflow-wrap:anywhere;}
.ngps-dev-tag {
  padding:3px 6px;
  border:1px solid rgba(255,195,90,.45);
  border-radius:6px;
  background:rgba(255,178,60,.13);
  color:#ffd27b;
  font-size:9px;
  letter-spacing:.5px;
}
.ngps-badges {display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;}
.ngps-badge {
  display:inline-flex;
  align-items:center;
  padding:5px 8px;
  border:1px solid rgba(110,165,255,.24);
  border-radius:7px;
  background:rgba(40,100,180,.14);
  color:#bcd8ff;
  font-size:9px;
  font-weight:800;
}
.ngps-badge.creator {border-color:rgba(255,194,88,.35);background:rgba(255,177,55,.1);color:#ffd27b;}
.ngps-badge.hold {border-color:rgba(255,173,85,.3);color:#ffbd80;}
.ngps-badge.major {border-color:rgba(180,120,255,.35);color:#d1adff;}
.ngps-badges-large {margin:13px 0;}
.ngps-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
.ngps-preview-stats {margin-top:13px;}
.ngps-card {
  min-width:0;
  padding:12px;
  border:1px solid var(--line);
  border-radius:11px;
  background:rgba(255,255,255,.025);
}
.ngps-balance {font-size:18px;font-weight:950;overflow-wrap:anywhere;}
.ngps-social-preview {display:grid;gap:5px;margin-top:12px;color:#b1c2dc;font-size:10px;overflow-wrap:anywhere;}
.ngps-field {display:flex;flex-direction:column;gap:6px;margin:12px 0;}
.ngps-field label {color:#b4c5dc;font-size:10px;font-weight:800;}
.ngps-field input,.ngps-field select,.ngps-field textarea {
  display:block;
  width:100%;
  min-width:0;
  min-height:42px;
  padding:10px 11px;
  border:1px solid var(--line);
  border-radius:9px;
  outline:none;
  background:#0a1424;
  color:white;
  font:inherit;
  font-size:16px;
}
.ngps-field textarea {min-height:90px;resize:vertical;}
.ngps-field input:focus,.ngps-field select:focus,.ngps-field textarea:focus {border-color:#168fff;box-shadow:0 0 0 2px rgba(22,143,255,.1);}
.ngps-btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  min-height:39px;
  padding:9px 13px;
  border:1px solid transparent;
  border-radius:9px;
  background:linear-gradient(120deg,#087fff,#2545c4);
  color:white;
  font:inherit;
  font-size:11px;
  font-weight:850;
  cursor:pointer;
}
.ngps-btn:disabled {opacity:.48;cursor:default;}
.ngps-btn.secondary {border-color:var(--line);background:#172942;color:#dceaff;}
.ngps-btn.small {min-width:34px;min-height:32px;padding:5px 9px;}
.ngps-file-button {
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:42px;
  padding:10px;
  border:1px dashed rgba(65,155,255,.45);
  border-radius:9px;
  background:rgba(20,105,200,.1);
  color:#c8e3ff;
  font-size:11px;
  font-weight:850;
  cursor:pointer;
}
.ngps-file-button input {display:none;}
.ngps-divider {height:1px;margin:16px 0;background:var(--line);}
.ngps-creator-card {
  display:flex;
  gap:12px;
  margin-top:13px;
  padding:13px;
  border:1px solid rgba(255,192,83,.25);
  border-radius:12px;
  background:linear-gradient(120deg,rgba(190,123,30,.12),rgba(255,255,255,.02));
}
.ngps-creator-card p {margin:5px 0;color:#d4c6a9;font-size:10px;line-height:1.5;}
.ngps-creator-card .ngps-muted {color:var(--muted);}
.ngps-creator-mark {
  display:grid;
  place-items:center;
  flex:0 0 38px;
  width:38px;
  height:38px;
  border-radius:12px;
  background:rgba(255,183,64,.15);
  color:#ffd27b;
  font-size:22px;
}
.ngps-between {display:flex;align-items:center;justify-content:space-between;gap:10px;}
.ngps-list-row {padding:10px 0;border-bottom:1px solid var(--line);}
.ngps-list-row strong {font-size:11px;}
.ngps-pill {
  display:inline-flex;
  align-items:center;
  padding:5px 8px;
  border:1px solid var(--line);
  border-radius:20px;
  background:rgba(255,255,255,.035);
  color:#c9dcf5;
  font-size:9px;
  white-space:nowrap;
}
.ngps-wallet-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.ngps-wallet-card {
  display:flex;
  flex-direction:column;
  gap:6px;
  padding:15px;
  border:1px solid rgba(40,150,255,.25);
  border-radius:14px;
  background:linear-gradient(140deg,#123b67,#10213b);
}
.ngps-wallet-card.stars {border-color:rgba(182,125,255,.25);background:linear-gradient(140deg,#34265f,#171c39);}
.ngps-wallet-card span,.ngps-wallet-card small {color:#b0c5e1;font-size:10px;}
.ngps-wallet-card strong {font-size:23px;overflow-wrap:anywhere;}
.ngps-fee-line {display:flex;justify-content:space-between;gap:10px;margin:7px 0;color:var(--muted);font-size:10px;}
.ngps-fee-line strong {color:#dceaff;}
.ngps-search-result {margin-top:12px;}
.ngps-price {margin:7px 0;color:#7dc5ff;font-size:12px;font-weight:900;}
.ngps-market-row {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:12px 0;
  border-bottom:1px solid var(--line);
}
.ngps-market-info {display:flex;flex-direction:column;gap:4px;min-width:0;}
.ngps-market-info strong {font-size:11px;overflow-wrap:anywhere;}
.ngps-market-info span,.ngps-market-info small {color:var(--muted);font-size:9px;}
.ngps-market-info b {color:#7dc5ff;font-size:12px;}
.ngps-shop-card {display:flex;flex-direction:column;align-items:flex-start;gap:5px;}
.ngps-icon {font-size:27px;}
.ngps-frame-sample {
  display:grid;
  place-items:center;
  width:48px;
  height:48px;
  border:3px solid #299cff;
  border-radius:15px;
  background:#0a1424;
  font-size:22px;
}
.ngps-gift-3d {
  display:grid;
  place-items:center;
  width:62px;
  height:62px;
  border:1px solid rgba(120,165,255,.25);
  border-radius:16px;
  background:radial-gradient(circle at 35% 20%,#2d4d7b,#080d18 72%);
  box-shadow:inset 0 0 20px rgba(0,0,0,.7),0 8px 18px rgba(0,0,0,.2);
  font-size:30px;
}
.ngps-gift-card {display:flex;flex-direction:column;gap:6px;}
.ngps-row {display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;}
.ngps-reels {
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:7px;
  margin:14px 0;
  perspective:700px;
}
.ngps-reel {
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:10px;
  min-width:0;
  min-height:105px;
  padding:9px 5px;
  overflow:hidden;
  border:1px solid rgba(75,155,255,.32);
  border-radius:12px;
  background:linear-gradient(145deg,#132b4b,#070c16);
  box-shadow:inset 0 0 20px rgba(0,0,0,.55),0 7px 16px rgba(0,0,0,.2);
  text-align:center;
}
.ngps-reel span {color:#7795bd;font-size:8px;letter-spacing:.8px;}
.ngps-reel strong {font-size:12px;overflow-wrap:anywhere;}
.ngps-reels.spinning .ngps-reel {animation:ngps-spin .35s linear infinite;}
.ngps-reels.spinning .ngps-reel:nth-child(2) {animation-delay:.06s;}
.ngps-reels.spinning .ngps-reel:nth-child(3) {animation-delay:.12s;}
@keyframes ngps-spin {
  0% {transform:rotateX(0deg);filter:brightness(1);}
  50% {transform:rotateX(180deg);filter:brightness(1.7);}
  100% {transform:rotateX(360deg);filter:brightness(1);}
}
.ngps-result-card {margin:10px 0;border-color:rgba(75,165,255,.3);}
.ngps-backgrounds {display:flex;flex-wrap:wrap;gap:6px;margin-top:13px;}
.ngps-backgrounds span {
  padding:5px 8px;
  border:1px solid var(--line);
  border-radius:7px;
  background:#14223a;
  color:#c7d8f0;
  font-size:9px;
}
.ngps-backgrounds .onyx {border-color:#555;background:#030303;color:#eee;}
.ngps-empty {
  padding:17px;
  border:1px dashed var(--line);
  border-radius:10px;
  color:var(--muted);
  font-size:10px;
  text-align:center;
}
.ngps-faq {border-bottom:1px solid var(--line);}
.ngps-faq button {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  width:100%;
  padding:13px 2px;
  border:0;
  background:transparent;
  color:#e8f1ff;
  font:inherit;
  font-size:11px;
  font-weight:800;
  text-align:left;
}
.ngps-faq button b {color:#80bdff;font-size:17px;}
.ngps-faq p {margin:0 0 13px;color:var(--muted);font-size:10px;line-height:1.6;}
.ngps-capabilities {margin-top:15px;border-color:rgba(90,155,255,.2);}
.ngps-capabilities p {margin:7px 0 0;color:#9eb5d4;font-size:11px;}
.ngps-notice {
  position:sticky;
  z-index:20;
  bottom:calc(10px + env(safe-area-inset-bottom,0px));
  width:fit-content;
  max-width:100%;
  margin:12px auto 0;
  padding:10px 13px;
  border:1px solid rgba(65,155,255,.35);
  border-radius:10px;
  background:#10233e;
  color:#edf6ff;
  box-shadow:0 8px 24px rgba(0,0,0,.35);
  font-size:10px;
  line-height:1.45;
  text-align:center;
}
.ngps-loading {padding:30px;text-align:center;color:var(--muted);font-size:12px;}
@media(max-width:680px) {
  .ngps-profile-layout {grid-template-columns:1fr;}
  .ngps-panel {padding:13px;}
}
@media(max-width:360px) {
  .ngps-root {padding-left:8px;padding-right:8px;}
  .ngps-grid {gap:7px;}
  .ngps-card {padding:9px;}
  .ngps-reel {min-height:92px;}
  .ngps-reel strong {font-size:10px;}
}
`;
