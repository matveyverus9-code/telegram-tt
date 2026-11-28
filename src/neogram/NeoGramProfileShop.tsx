import {
  useEffect,
  useMemo,
  useState,
} from '../lib/teact/teact';
import {
  apiGet,
  apiPost,
  getProfile,
  updateProfile as saveProfileApi,
  type NeoGramUser,
} from './api';

type Tab = 'profile' | 'wallet' | 'shop' | 'gifts' | 'faq';
type Layout = 'neogram' | 'discord' | 'twitter' | 'steam';
type AnyRecord = Record<string, any>;

const FEE = 0.1;

const FRAMES = [
  { id: 'blue-neon', name: 'Blue Neon', price: 500, color: '#299cff', icon: '🔵' },
  { id: 'prism', name: 'Prism', price: 3500, color: '#b66bff', icon: '🌈' },
  { id: 'aurora', name: 'Aurora', price: 2200, color: '#49e2c2', icon: '🌌' },
  { id: 'onyx', name: 'Onyx', price: 6000, color: '#777777', icon: '⚫' },
];

const NICK_STYLES = [
  { id: 'neon', name: 'Neon', price: 900, icon: '✨' },
  { id: 'hologram', name: 'Hologram', price: 4000, icon: '🪩' },
  { id: 'prism', name: 'Prism', price: 6500, icon: '💠' },
];

const FAQ = [
  {
    q: 'Что такое GRAM?',
    a: 'GRAM — внутренняя валюта NeoGram для покупок, подарков и операций на внутренней бирже.',
  },
  {
    q: 'Как работает комиссия биржи?',
    a: 'При покупке лота продавцу перечисляется 90% цены, 10% составляет комиссия NeoGram.',
  },
  {
    q: 'Как привязать редкий номер?',
    a: 'Выданный номер +777 или +666 можно привязать к текущему профилю, если он числится за вашим аккаунтом.',
  },
  {
    q: 'Можно ли активировать +777 или +666 как новый аккаунт?',
    a: 'Нет. Серии +777 и +666 выдаются вручную и привязываются к существующему профилю. Создание нового аккаунта через этот экран не поддерживается Worker.',
  },
  {
    q: 'Как получить #DEV?',
    a: 'Тег #DEV зарезервирован для Создателя. Обычный пользователь не может занять этот тег.',
  },
  {
    q: 'Поддерживается ли загрузка файлов аватара?',
    a: 'Текущая версия Worker принимает URL баннера, но не предоставляет серверный маршрут загрузки файлов или сохранения avatar_url.',
  },
];

const formatGram = (value: unknown) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const errorText = (error: unknown) => {
  const code = String((error as AnyRecord)?.code || (error as AnyRecord)?.message || error || '');
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'Сессия не найдена. Войдите в аккаунт NeoGram.',
    INSUFFICIENT_FUNDS: 'Недостаточно средств.',
    NOT_OWNED: 'Этот номер или предмет не принадлежит вашему аккаунту.',
    ALREADY_LISTED: 'Этот предмет уже выставлен на биржу.',
    UNAVAILABLE: 'Лот уже недоступен.',
    NOT_FOUND: 'Запись не найдена.',
    PROFILE_PHONE_LIMIT: 'Достигнут лимит привязанных номеров.',
    INVALID_LAYOUT: 'Недопустимый макет профиля.',
    RESERVED: 'Это имя зарезервировано.',
    TAKEN: 'Это имя уже занято.',
  };
  return messages[code] || code || 'Не удалось выполнить запрос.';
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? value as AnyRecord : {};
}

function prettyPhone(value: string) {
  const raw = String(value || '').replace(/\s/g, '');
  const match = raw.match(/^\+(\d{3})(\d{4,8})$/);
  if (!match) return value;
  const suffix = match[2];
  if (suffix.length === 4) return `+${match[1]} ${suffix[0]} ${suffix.slice(1)}`;
  if (suffix.length === 5) return `+${match[1]} ${suffix.slice(0, 2)} ${suffix.slice(2)}`;
  if (suffix.length === 6) return `+${match[1]} ${suffix.slice(0, 3)} ${suffix.slice(3)}`;
  if (suffix.length === 7) return `+${match[1]} ${suffix.slice(0, 3)} ${suffix.slice(3, 5)} ${suffix.slice(5)}`;
  return `+${match[1]} ${suffix.slice(0, 4)} ${suffix.slice(4)}`;
}

export default function NeoGramProfileShop() {
  const [tab, setTab] = useState<Tab>('profile');
  const [layout, setLayout] = useState<Layout>('neogram');
  const [user, setUser] = useState<NeoGramUser | null>(null);
  const [wallet, setWallet] = useState<AnyRecord>({});
  const [market, setMarket] = useState<AnyRecord>({ listings: [], commission: FEE });
  const [gifts, setGifts] = useState<AnyRecord>({ catalog: [], owned: [] });
  const [profile, setProfile] = useState<AnyRecord>({
    banner_url: '',
    links: {},
    channel: '',
    avatar_filter: 'none',
    banner_filter: 'none',
    avatar_frame: '',
    frame_color: '',
    nick_font: '',
    nick_color: '',
    nick_gradient: '',
    nick_glow: '',
  });
  const [bannerUrl, setBannerUrl] = useState('');
  const [discord, setDiscord] = useState('');
  const [twitter, setTwitter] = useState('');
  const [steam, setSteam] = useState('');
  const [username, setUsername] = useState('');
  const [usernamePrice, setUsernamePrice] = useState<number | null>(null);
  const [listingPrice, setListingPrice] = useState('100');
  const [listingAsset, setListingAsset] = useState('');
  const [fragmentSearch, setFragmentSearch] = useState('');
  const [fragmentResult, setFragmentResult] = useState<AnyRecord | null>(null);
  const [numberToBind, setNumberToBind] = useState('');
  const [selectedGift, setSelectedGift] = useState('');
  const [rouletteResult, setRouletteResult] = useState<AnyRecord | null>(null);
  const [rouletteBusy, setRouletteBusy] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isCreator = Number(user?.is_creator) === 1;
  const userProfile = asRecord(user?.profile);
  const socialLinks = asRecord(userProfile.links);
  const phones = Array.isArray(user?.phones) ? user!.phones as AnyRecord[] : [];
  const ownedGifts = Array.isArray(gifts.owned) ? gifts.owned as AnyRecord[] : [];
  const giftCatalog = Array.isArray(gifts.catalog) ? gifts.catalog as AnyRecord[] : [];
  const listings = Array.isArray(market.listings) ? market.listings as AnyRecord[] : [];
  const gram = Number(wallet.gram ?? user?.gram ?? 0);

  const notify = (message: string) => setNotice(message);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextUser, nextWallet, nextMarket, nextGifts] = await Promise.all([
        getProfile<NeoGramUser>(),
        apiGet<AnyRecord>('/wallet'),
        apiGet<AnyRecord>('/market'),
        apiGet<AnyRecord>('/gifts'),
      ]);

      setUser(nextUser);
      setWallet(nextWallet || {});
      setMarket(nextMarket || { listings: [], commission: FEE });
      setGifts(nextGifts || { catalog: [], owned: [] });

      const nextProfile = asRecord(nextUser.profile);
      setProfile(nextProfile);
      setBannerUrl(String(nextProfile.banner_url || ''));
      const links = asRecord(nextProfile.links);
      setDiscord(String(links.discord || ''));
      setTwitter(String(links.twitter || ''));
      setSteam(String(links.steam || ''));
      setUsername(String(nextUser.username || ''));
    } catch (error) {
      notify(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const setProfileValue = (key: string, value: unknown) => {
    setProfile((previous: AnyRecord) => ({ ...previous, [key]: value }));
  };

  const persistProfile = async (patch: AnyRecord) => {
    setBusy(true);
    try {
      const result = await saveProfileApi(patch);
      const saved = asRecord(result);
      const next = asRecord(saved.profile || { ...profile, ...patch });
      setProfile(next);
      notify('Профиль сохранён на сервере.');
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const saveSocialLinks = async () => {
    await persistProfile({
      links: { discord: discord.trim(), twitter: twitter.trim(), steam: steam.trim() },
    });
  };

  const saveBanner = async () => {
    const value = bannerUrl.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      notify('Укажите полный HTTP(S) URL изображения.');
      return;
    }
    await persistProfile({ banner_url: value });
  };

  const claimUsername = async () => {
    const name = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,10}$/.test(name)) {
      notify('Ник должен содержать 3–10 символов: латиница, цифры и _.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiPost<AnyRecord>('/usernames/claim', { username: name });
      setUsername(String(result.username || `@${name}`).replace(/^@/, ''));
      setUsernamePrice(Number(result.price_gram || 0));
      notify(`Ник @${name} приобретён за ${formatGram(result.price_gram)} GRAM.`);
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const bindPhone = async (phone: string) => {
    setBusy(true);
    try {
      await apiPost('/assets/use-phone', { phone: phone.replace(/\s/g, '') });
      notify(`${prettyPhone(phone)} привязан к профилю.`);
      setNumberToBind('');
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const searchFragment = async () => {
    if (!fragmentSearch.trim()) {
      notify('Введите номер или @username.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiGet<AnyRecord>('/fragment/info', { q: fragmentSearch.trim() });
      setFragmentResult(result);
    } catch (error) {
      setFragmentResult(null);
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const buyListing = async (listingId: number) => {
    setBusy(true);
    try {
      const result = await apiPost<AnyRecord>('/market/buy', { listing_id: listingId });
      notify(`Покупка завершена. Комиссия: ${formatGram(result.fee)} GRAM.`);
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const sellPhone = async () => {
    const phone = listingAsset.replace(/\s/g, '');
    const price = Number(listingPrice);
    if (!phone || !Number.isFinite(price) || price <= 0) {
      notify('Выберите номер и укажите цену больше нуля.');
      return;
    }
    setBusy(true);
    try {
      await apiPost('/market/sell', { asset_type: 'phone', asset_key: phone, price });
      notify('Номер выставлен на внутреннюю биржу.');
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const buyFrame = async (frame: AnyRecord) => {
    setBusy(true);
    try {
      await apiPost('/shop/buy', {
        kind: 'frame',
        frame: frame.id,
        frame_color: frame.color,
        price: frame.price,
      });
      notify(`Рамка «${frame.name}» приобретена.`);
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const buyNickStyle = async (style: AnyRecord) => {
    setBusy(true);
    try {
      await apiPost('/shop/buy', {
        kind: 'style',
        style: style.id,
        target: 'player',
        price: style.price,
      });
      notify(`Стиль ника «${style.name}» приобретён.`);
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const upgradeGift = async (gift: AnyRecord) => {
    if (rouletteBusy || !gift.gift_id) return;
    setRouletteBusy(true);
    setRouletteResult(null);
    try {
      const result = await apiPost<AnyRecord>('/gifts/upgrade', { gift_id: gift.gift_id });
      setRouletteResult({
        ...gift,
        model: result.model,
        rarity: result.rarity_percent,
        bg: result.bg || gift.bg,
        pattern: result.pattern || gift.pattern,
      });
      notify(`Улучшение завершено: ${result.model || 'новая форма'}, редкость ${result.rarity_percent || 0}%.`);
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setRouletteBusy(false);
    }
  };

  const sellGift = async (gift: AnyRecord) => {
    if (!gift.gift_id) return;
    const price = Number(window.prompt('Цена продажи в GRAM:', '100'));
    if (!Number.isFinite(price) || price <= 0) return;
    setBusy(true);
    try {
      await apiPost('/market/sell', {
        asset_type: 'gift',
        asset_key: String(gift.gift_id),
        price,
      });
      notify('Подарок выставлен на биржу.');
      await refresh();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const visibleListings = useMemo(() => listings.filter((item) => item.status === 'open'), [listings]);

  const styles = `
    .ngps{--a:var(--color-primary,#299cff);--bg:var(--color-background,#080d19);--card:var(--color-background-secondary,#111a2b);--txt:var(--color-text,#f4f7ff);--muted:var(--color-text-secondary,#93a1b8);--line:var(--color-borders,rgba(145,170,210,.17));color:var(--txt);width:100%;min-width:0;padding:12px;box-sizing:border-box;font-family:inherit}
    .ngps *{box-sizing:border-box}
    .ngps button,.ngps input,.ngps select{font:inherit}
    .ngps button{cursor:pointer}
    .ngps button:disabled{opacity:.48;cursor:default}
    .ngps-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .ngps-title{font-size:23px;font-weight:850;letter-spacing:-.6px}
    .ngps-sub{font-size:12px;color:var(--muted);margin-top:3px}
    .ngps-refresh{border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--txt);padding:9px 12px}
    .ngps-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;margin-bottom:8px}
    .ngps-tab{flex:0 0 auto;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--muted);padding:9px 13px}
    .ngps-tab.active{background:color-mix(in srgb,var(--a) 18%,var(--card));border-color:var(--a);color:var(--txt)}
    .ngps-panel{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:12px;min-width:0}
    .ngps-panel h3{font-size:16px;margin:0 0 12px;font-weight:800}
    .ngps-muted{color:var(--muted);font-size:12px;line-height:1.5}
    .ngps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}
    .ngps-field{display:flex;flex-direction:column;gap:6px;margin:10px 0}
    .ngps-field label{font-size:12px;color:var(--muted)}
    .ngps-field input,.ngps-field select{width:100%;min-width:0;border:1px solid var(--line);border-radius:11px;background:var(--bg);color:var(--txt);padding:12px;font-size:16px;outline:none}
    .ngps-btn{border:0;border-radius:12px;background:var(--a);color:#fff;padding:11px 14px;font-weight:750}
    .ngps-btn.secondary{background:rgba(125,150,185,.14);border:1px solid var(--line);color:var(--txt)}
    .ngps-btn.danger{background:#a83c52}
    .ngps-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .ngps-between{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .ngps-balance{font-size:28px;font-weight:900;letter-spacing:-.7px}
    .ngps-preview{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:var(--bg)}
    .ngps-banner{height:118px;background:linear-gradient(120deg,#163d73,#4e2c80 55%,#111a2b);background-size:cover;background-position:center}
    .ngps-preview-body{padding:0 15px 15px}
    .ngps-avatar{width:66px;height:66px;border-radius:22px;border:4px solid var(--card);margin-top:-32px;background:linear-gradient(135deg,#299cff,#a64bff);display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:900}
    .ngps-name{font-size:19px;font-weight:850;margin-top:8px}
    .ngps-tag{display:inline-block;margin-left:7px;border-radius:7px;background:linear-gradient(90deg,#ffbd55,#ff6d9c);color:#24152a;padding:3px 6px;font-size:10px;font-weight:900}
    .ngps-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .ngps-badge{border:1px solid var(--line);border-radius:8px;padding:4px 7px;font-size:10px;color:var(--muted)}
    .ngps-card{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px;min-width:0}
    .ngps-icon{font-size:26px;margin-bottom:8px}
    .ngps-price{font-weight:850;margin:8px 0}
    .ngps-pill{display:inline-block;border-radius:99px;background:rgba(41,156,255,.13);color:var(--a);padding:4px 8px;font-size:10px}
    .ngps-empty{padding:18px;text-align:center;color:var(--muted);font-size:13px}
    .ngps-faq{border-top:1px solid var(--line);padding:12px 0}
    .ngps-faq button{width:100%;display:flex;justify-content:space-between;gap:10px;border:0;background:none;color:var(--txt);text-align:left;font-weight:750;padding:2px 0}
    .ngps-faq p{color:var(--muted);font-size:13px;line-height:1.55;margin:10px 0 0}
    .ngps-reels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
    .ngps-reel{min-height:88px;border-radius:14px;border:1px solid var(--line);background:linear-gradient(145deg,#07090f,#202b3d);display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:800;padding:8px;animation:ngps-pulse 1.1s ease-in-out infinite alternate}
    .ngps-reel:nth-child(2){animation-delay:.15s}.ngps-reel:nth-child(3){animation-delay:.3s}
    @keyframes ngps-pulse{from{transform:translateY(0);filter:brightness(.85)}to{transform:translateY(-3px);filter:brightness(1.35)}}
    .ngps-notice{position:sticky;bottom:10px;margin-top:10px;padding:12px 14px;border-radius:12px;background:#172b43;border:1px solid rgba(75,160,255,.35);box-shadow:0 8px 28px #0005;font-size:13px}
    .ngps-table{width:100%;border-collapse:collapse;font-size:12px}
    .ngps-table td{padding:9px 5px;border-bottom:1px solid var(--line);vertical-align:middle}
    @media(min-width:650px){.ngps-profile-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:12px}.ngps-profile-grid>.ngps-panel{margin-bottom:0}}
  `;

  const platformLabels: Record<Layout, string> = {
    neogram: 'NeoGram',
    discord: 'Discord',
    twitter: 'Twitter / X',
    steam: 'Steam',
  };

  return (
    <section className="ngps">
      <style>{styles}</style>

      <div className="ngps-head">
        <div>
          <div className="ngps-title">Профиль и магазин</div>
          <div className="ngps-sub">NeoGram · GRAM · внутренняя биржа</div>
        </div>
        <button className="ngps-refresh" type="button" onClick={() => void refresh()}>
          ↻ Обновить
        </button>
      </div>

      <div className="ngps-tabs">
        {([
          ['profile', 'Профиль'],
          ['wallet', 'Кошелёк'],
          ['shop', 'Магазин'],
          ['gifts', 'Подарки'],
          ['faq', 'FAQ'],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`ngps-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="ngps-panel ngps-empty">Загружаем данные с сервера…</div>}

      {!loading && !user && (
        <div className="ngps-panel ngps-empty">Не удалось загрузить профиль. Проверьте авторизацию и нажмите «Обновить».</div>
      )}

      {!loading && user && tab === 'profile' && (
        <>
          <div className="ngps-profile-grid">
            <div className="ngps-panel">
              <h3>Предпросмотр профиля</h3>
              <div className="ngps-row" style={{ marginBottom: 12 }}>
                {(Object.keys(platformLabels) as Layout[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`ngps-tab ${layout === item ? 'active' : ''}`}
                    onClick={() => setLayout(item)}
                  >
                    {platformLabels[item]}
                  </button>
                ))}
              </div>

              <div className={`ngps-preview ngps-preview-${layout}`}>
                <div
                  className="ngps-banner"
                  style={userProfile.banner_url ? { backgroundImage: `url("${String(userProfile.banner_url)}")` } : undefined}
                />
                <div className="ngps-preview-body">
                  <div className="ngps-avatar">{String(user.username || 'N').charAt(0).toUpperCase()}</div>
                  <div className="ngps-name">
                    {user.username ? `@${user.username}` : `Player #${user.id}`}
                    {isCreator && <span className="ngps-tag">#DEV</span>}
                  </div>
                  <div className="ngps-muted">{platformLabels[layout]} · {prettyPhone(user.phone)}</div>
                  <div className="ngps-badges">
                    {isCreator && <span className="ngps-badge">✦ Создатель</span>}
                    {Number(user.is_creator_badge) === 1 && <span className="ngps-badge">✓ Verified</span>}
                    {Number(user.hold_badge) === 1 && <span className="ngps-badge">Hold</span>}
                    {Number(user.major_badge) === 1 && <span className="ngps-badge">Major</span>}
                  </div>
                  <div className="ngps-grid" style={{ marginTop: 14 }}>
                    <div className="ngps-card"><div className="ngps-balance">{formatGram(gram)}</div><div className="ngps-muted">GRAM</div></div>
                    <div className="ngps-card"><div className="ngps-balance">{phones.length}</div><div className="ngps-muted">Номеров</div></div>
                  </div>
                  <div className="ngps-muted" style={{ marginTop: 12 }}>
                    Discord: {socialLinks.discord || '—'}<br />
                    Twitter: {socialLinks.twitter || '—'}<br />
                    Steam: {socialLinks.steam || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="ngps-panel">
              <h3>Настройки профиля</h3>
              <div className="ngps-field">
                <label>Баннер — URL изображения</label>
                <input value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://…" />
              </div>
              <button className="ngps-btn" type="button" disabled={busy} onClick={() => void saveBanner()}>
                Сохранить баннер
              </button>
              <p className="ngps-muted">Worker сохраняет banner_url. Загрузка файла с устройства и avatar_url пока не реализованы на сервере.</p>

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
            <h3>Никнейм и тег</h3>
            <div className="ngps-field">
              <label>Username (3–10 символов)</label>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" />
            </div>
            <div className="ngps-row">
              <button className="ngps-btn" type="button" disabled={busy} onClick={() => void claimUsername()}>
                Купить / занять ник
              </button>
              {usernamePrice !== null && <span className="ngps-pill">Цена: {formatGram(usernamePrice)} GRAM</span>}
            </div>
            <p className="ngps-muted">#DEV зарезервирован сервером для Создателя. Цвета номеров +777 и +666 не продаются в магазине ников.</p>
            {isCreator && (
              <div className="ngps-card" style={{ marginTop: 12 }}>
                <strong>#DEV · Создатель</strong>
                <p className="ngps-muted">Личный мастер-номер +666 6 666: 666 666 666 666 GRAM. Ник @dev: 1 000 000 000 GRAM. Покупка мастер-номера через этот экран отключена: он закреплён за Создателем сервером.</p>
              </div>
            )}
          </div>

          <div className="ngps-panel">
            <h3>Редкие номера в вашем кошельке</h3>
            <p className="ngps-muted">Показываются номера, выданные вашему аккаунту. Привязка выполняется сервером.</p>
            {phones.length === 0 && <div className="ngps-empty">Выданных дополнительных номеров пока нет.</div>}
            {phones.map((item, index) => {
              const phone = String(item.phone || '');
              const series = phone.startsWith('+777') ? '+777' : phone.startsWith('+666') ? '+666' : '+888';
              return (
                <div className="ngps-between" key={`${phone}-${index}`} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <strong>{prettyPhone(phone)}</strong>
                    <div className="ngps-muted">{series} · {Number(item.primary_phone) === 1 ? 'Основной номер' : 'Выданный номер'}</div>
                  </div>
                  <span className="ngps-pill">{Number(item.price || 0) ? `${formatGram(item.price)} GRAM` : 'Владение'}</span>
                </div>
              );
            })}
            <div className="ngps-field">
              <label>Привязать выданный номер</label>
              <select value={numberToBind} onChange={(event) => setNumberToBind(event.target.value)}>
                <option value="">Выберите номер</option>
                {phones.filter((item) => Number(item.primary_phone) !== 1).map((item, index) => (
                  <option key={`${item.phone}-${index}`} value={String(item.phone)}>{prettyPhone(String(item.phone))}</option>
                ))}
              </select>
            </div>
            <button className="ngps-btn" type="button" disabled={busy || !numberToBind} onClick={() => void bindPhone(numberToBind)}>
              Привязать к профилю
            </button>
            <p className="ngps-muted">Создание нового аккаунта через +777/+666 не поддерживается текущим Worker; доступна привязка к текущему профилю.</p>
          </div>
        </>
      )}

      {!loading && user && tab === 'wallet' && (
        <>
          <div className="ngps-panel">
            <div className="ngps-muted">Баланс GRAM</div>
            <div className="ngps-balance">{formatGram(gram)} GRAM</div>
            <div className="ngps-muted">Stars: {formatGram(wallet.stars ?? user.stars ?? 0)}</div>
          </div>

          <div className="ngps-panel">
            <h3>Fragment · внутренняя биржа</h3>
            <p className="ngps-muted">Биржа NeoGram работает внутри Worker. Комиссия при продаже составляет 10%; внешний Fragment API не подключён.</p>
            <div className="ngps-field">
              <label>Поиск номера или @username</label>
              <input value={fragmentSearch} onChange={(event) => setFragmentSearch(event.target.value)} placeholder="+777… или @username" />
            </div>
            <button className="ngps-btn secondary" type="button" disabled={busy} onClick={() => void searchFragment()}>
              Найти актив
            </button>
            {fragmentResult && (
              <div className="ngps-card" style={{ marginTop: 12 }}>
                <strong>{fragmentResult.owner || fragmentResult.username || fragmentResult.phone}</strong>
                <div className="ngps-muted">{fragmentResult.phone ? prettyPhone(String(fragmentResult.phone)) : 'Username'}</div>
                <div className="ngps-price">{formatGram(fragmentResult.value_gram)} GRAM</div>
              </div>
            )}
          </div>

          <div className="ngps-panel">
            <h3>Выставить номер на биржу</h3>
            <div className="ngps-field">
              <label>Номер из вашего кошелька</label>
              <select value={listingAsset} onChange={(event) => setListingAsset(event.target.value)}>
                <option value="">Выберите номер</option>
                {phones.map((item, index) => (
                  <option key={`${item.phone}-${index}`} value={String(item.phone)}>{prettyPhone(String(item.phone))}</option>
                ))}
              </select>
            </div>
            <div className="ngps-field">
              <label>Цена в GRAM</label>
              <input type="number" min="1" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} />
            </div>
            <div className="ngps-muted">Комиссия: {formatGram(Number(listingPrice || 0) * FEE)} GRAM · вы получите {formatGram(Number(listingPrice || 0) * (1 - FEE))} GRAM.</div>
            <button className="ngps-btn" type="button" disabled={busy} onClick={() => void sellPhone()}>
              Выставить номер
            </button>
          </div>

          <div className="ngps-panel">
            <h3>Открытые лоты</h3>
            {visibleListings.length === 0 && <div className="ngps-empty">Открытых лотов нет.</div>}
            {visibleListings.map((item) => (
              <div className="ngps-between" key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{item.asset_type === 'phone' ? prettyPhone(String(item.asset_key || '')) : `${item.asset_type} #${item.asset_id}`}</strong>
                  <div className="ngps-muted">Продавец: {item.seller_username || `ID ${item.seller_id}`}</div>
                  <div className="ngps-price">{formatGram(item.price)} GRAM</div>
                </div>
                <button className="ngps-btn" type="button" disabled={busy || Number(item.seller_id) === user.id} onClick={() => void buyListing(Number(item.id))}>
                  Купить
                </button>
              </div>
            ))}
          </div>

          <div className="ngps-panel">
            <h3>История кошелька</h3>
            {(Array.isArray(wallet.transactions) ? wallet.transactions : []).length === 0 && <div className="ngps-empty">Операций пока нет.</div>}
            {(Array.isArray(wallet.transactions) ? wallet.transactions : []).map((item: AnyRecord) => (
              <div className="ngps-between" key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{item.kind}</strong>
                  <div className="ngps-muted">{item.created_at}</div>
                </div>
                <span>{formatGram(item.amount)} {item.currency}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && user && tab === 'shop' && (
        <>
          <div className="ngps-panel">
            <h3>Магазин рамок</h3>
            <div className="ngps-grid">
              {FRAMES.map((item) => (
                <div className="ngps-card" key={item.id}>
                  <div className="ngps-icon">{item.icon}</div>
                  <strong>{item.name}</strong>
                  <div className="ngps-price">{formatGram(item.price)} GRAM</div>
                  <button className="ngps-btn" type="button" disabled={busy} onClick={() => void buyFrame(item)}>
                    Купить
                  </button>
                </div>
              ))}
            </div>
            <p className="ngps-muted" style={{ marginTop: 10 }}>Покупка рамки обрабатывается через POST /shop/buy (kind: frame).</p>
          </div>

          <div className="ngps-panel">
            <h3>Магазин переливающихся ников</h3>
            <div className="ngps-grid">
              {NICK_STYLES.map((item) => (
                <div className="ngps-card" key={item.id}>
                  <div className="ngps-icon">{item.icon}</div>
                  <strong>{item.name}</strong>
                  <div className="ngps-price">{formatGram(item.price)} GRAM</div>
                  <button className="ngps-btn" type="button" disabled={busy} onClick={() => void buyNickStyle(item)}>
                    Купить
                  </button>
                </div>
              ))}
            </div>
            <p className="ngps-muted" style={{ marginTop: 10 }}>В магазине нет эксклюзивных цветов или оформления номеров +777 и +666.</p>
          </div>

          <div className="ngps-panel">
            <h3>Подарки из каталога Worker</h3>
            <div className="ngps-grid">
              {giftCatalog.map((item) => (
                <div className="ngps-card" key={item.id}>
                  <div className="ngps-icon">🎁</div>
                  <strong>{item.name}</strong>
                  <div className="ngps-muted">Остаток: {item.supply}</div>
                  <div className="ngps-price">{formatGram(item.base_value)} GRAM · {formatGram(item.price_stars)} Stars</div>
                  <span className="ngps-pill">Каталог сервера</span>
                </div>
              ))}
            </div>
            <p className="ngps-muted" style={{ marginTop: 10 }}>В предоставленном Worker есть чтение каталога и улучшение подарков, но нет пользовательского маршрута покупки подарка из каталога. Кнопка покупки не имитируется.</p>
          </div>
        </>
      )}

      {!loading && user && tab === 'gifts' && (
        <>
          <div className="ngps-panel">
            <h3>Мой инвентарь подарков</h3>
            {ownedGifts.length === 0 && <div className="ngps-empty">Подарков пока нет. Каталог доступен во вкладке «Магазин».</div>}
            <div className="ngps-grid">
              {ownedGifts.map((gift) => (
                <div className="ngps-card" key={gift.gift_id}>
                  <div className="ngps-icon">🎁</div>
                  <strong>{gift.name}</strong>
                  <div className="ngps-muted">{gift.model || 'Classic'} · {gift.bg || 'Blue'} · {gift.pattern || 'Plain'}</div>
                  <div className="ngps-price">Редкость: {formatGram(gift.rarity)}%</div>
                  <div className="ngps-row">
                    <button className="ngps-btn" type="button" disabled={busy || rouletteBusy} onClick={() => void upgradeGift(gift)}>
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
            <h3>3D · рулетка улучшения подарка</h3>
            <p className="ngps-muted">Три барабана показывают результат серверного улучшения. Стоимость и итог проверяются Worker, а не браузером.</p>
            <div className="ngps-field">
              <label>Подарок для улучшения</label>
              <select value={selectedGift} onChange={(event) => setSelectedGift(event.target.value)}>
                <option value="">Выберите подарок</option>
                {ownedGifts.map((gift) => (
                  <option key={gift.gift_id} value={String(gift.gift_id)}>{gift.name} · #{gift.gift_id}</option>
                ))}
              </select>
            </div>
            <div className="ngps-reels">
              <div className="ngps-reel">{rouletteBusy ? '✦ ✧ ✦' : rouletteResult?.model || 'MODEL'}</div>
              <div className="ngps-reel">{rouletteBusy ? '◈ ◆ ◈' : rouletteResult?.bg || 'BACKGROUND'}</div>
              <div className="ngps-reel">{rouletteBusy ? '✺ ✹ ✺' : rouletteResult?.pattern || 'PATTERN'}</div>
            </div>
            {rouletteResult && (
              <div className="ngps-card">
                <strong>{rouletteResult.name}</strong>
                <div className="ngps-muted">Модель: {rouletteResult.model} · Фон: {rouletteResult.bg} · Узор: {rouletteResult.pattern}</div>
                <div className="ngps-price">Редкость: {formatGram(rouletteResult.rarity)}%</div>
              </div>
            )}
            <button
              className="ngps-btn"
              type="button"
              disabled={busy || rouletteBusy || !selectedGift}
              onClick={() => {
                const gift = ownedGifts.find((item) => String(item.gift_id) === selectedGift);
                if (gift) void upgradeGift(gift);
              }}
            >
              {rouletteBusy ? 'Барабаны вращаются…' : 'Запустить 3D-улучшение'}
            </button>
            <p className="ngps-muted" style={{ marginTop: 10 }}>Worker выбирает модель, фон и узор на сервере. Доступные фоны в текущем коде: Blue, Purple, Gold, Black (Onyx), Rainbow; узоры: Plain, Stars, Geometric, Galaxy. Результат отображается после ответа сервера.</p>
          </div>
        </>
      )}

      {!loading && user && tab === 'faq' && (
        <div className="ngps-panel">
          <h3>Частые вопросы</h3>
          {FAQ.map((item, index) => (
            <div className="ngps-faq" key={item.q}>
              <button type="button" onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}>
                {item.q}<span>{expandedFaq === index ? '−' : '+'}</span>
              </button>
              {expandedFaq === index && <p>{item.a}</p>}
            </div>
          ))}
          <div className="ngps-card" style={{ marginTop: 14 }}>
            <strong>Возможности NeoGram</strong>
            <p className="ngps-muted">Нету</p>
          </div>
        </div>
      )}

      {notice && <div className="ngps-notice" role="status">{notice}</div>}
    </section>
  );
}
