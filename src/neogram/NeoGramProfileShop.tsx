import React, { useEffect, useMemo, useState } from "react";

type ProfilePlatform = "neogram" | "discord" | "twitter" | "steam";
type ShopTab = "profile" | "wallet" | "shop" | "gifts" | "faq";
type ShopCategory = "all" | "numbers" | "gifts" | "frames" | "backgrounds" | "names";

type ProfileData = {
  name: string;
  username: string;
  bio: string;
  avatar: string;
  banner: string;
  discord: string;
  twitter: string;
  steam: string;
  isCreator: boolean;
};

type ShopItem = {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
  icon: string;
  rarity: string;
  preview?: string;
};

const CREATOR_NUMBER_PRICE = 666666666666;
const FRAGMENT_FEE = 0.1;

const INITIAL_PROFILE: ProfileData = {
  name: "NeoGram User",
  username: "neogram_user",
  bio: "Добро пожаловать в мой профиль!",
  avatar: "",
  banner: "",
  discord: "",
  twitter: "",
  steam: "",
  isCreator: false,
};

const SHOP_ITEMS: ShopItem[] = [
  {
    id: "gift-rose",
    name: "Неоновая роза",
    description: "Подарок с переливающимся неоновым свечением.",
    category: "gifts",
    price: 250,
    icon: "🌹",
    rarity: "Обычный",
  },
  {
    id: "gift-crystal",
    name: "Кристалл Neo",
    description: "Редкий подарок с голографическим эффектом.",
    category: "gifts",
    price: 1500,
    icon: "💎",
    rarity: "Редкий",
  },
  {
    id: "gift-crown",
    name: "Корона создателя",
    description: "Особенный подарок для коллекции.",
    category: "gifts",
    price: 12000,
    icon: "👑",
    rarity: "Эпический",
  },
  {
    id: "frame-blue",
    name: "Blue Neon",
    description: "Голубая неоновая рамка аватара.",
    category: "frames",
    price: 500,
    icon: "🔵",
    rarity: "Редкий",
  },
  {
    id: "frame-rainbow",
    name: "Prism",
    description: "Переливающаяся радужная рамка.",
    category: "frames",
    price: 3500,
    icon: "🌈",
    rarity: "Эпический",
  },
  {
    id: "background-space",
    name: "Космос",
    description: "Космический фон профиля.",
    category: "backgrounds",
    price: 700,
    icon: "🌌",
    rarity: "Редкий",
  },
  {
    id: "background-aurora",
    name: "Aurora",
    description: "Северное сияние в оформлении профиля.",
    category: "backgrounds",
    price: 2200,
    icon: "🌠",
    rarity: "Эпический",
  },
  {
    id: "name-neon",
    name: "Neon Nickname",
    description: "Анимированное свечение имени.",
    category: "names",
    price: 900,
    icon: "✨",
    rarity: "Редкий",
  },
  {
    id: "name-hologram",
    name: "Hologram Nickname",
    description: "Голографический перелив ника.",
    category: "names",
    price: 4000,
    icon: "🪩",
    rarity: "Эпический",
  },
  {
    id: "number-666",
    name: "+666",
    description: "Редкий номер. Цена устанавливается вручную.",
    category: "numbers",
    price: 0,
    icon: "🔢",
    rarity: "Лимитированный",
  },
  {
    id: "number-777",
    name: "+777",
    description: "Редкий номер. Цена устанавливается вручную.",
    category: "numbers",
    price: 0,
    icon: "🍀",
    rarity: "Лимитированный",
  },
];

const FAQ = [
  {
    q: "Что такое GRAM?",
    a: "GRAM — внутренняя валюта NeoGram для покупок, подарков и оформления профиля.",
  },
  {
    q: "Как работает обмен через Fragment?",
    a: "При обмене через Fragment применяется комиссия 10%. Итоговая сумма отображается до подтверждения операции.",
  },
  {
    q: "Можно ли вернуть купленный предмет?",
    a: "Покупки отображаются в инвентаре. Возможность возврата зависит от правил конкретной операции.",
  },
  {
    q: "Как получить редкий номер?",
    a: "Редкие номера +666 и +777 выставляются с индивидуальной ценой.",
  },
  {
    q: "Как получить статус Создателя?",
    a: "Статус Создателя назначается администрацией NeoGram.",
  },
];

const formatGram = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value);

const safeNumber = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export default function NeoGramProfileShop() {
  const [tab, setTab] = useState<ShopTab>("profile");
  const [platform, setPlatform] = useState<ProfilePlatform>("neogram");
  const [profile, setProfile] = useState<ProfileData>(INITIAL_PROFILE);
  const [gram, setGram] = useState(10000);
  const [fragmentAmount, setFragmentAmount] = useState("1000");
  const [shopCategory, setShopCategory] = useState<ShopCategory>("all");
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string>>({});
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [giftTarget, setGiftTarget] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [rouletteItem, setRouletteItem] = useState<ShopItem | null>(null);
  const [rouletteBusy, setRouletteBusy] = useState(false);
  const [showCreatorOffer, setShowCreatorOffer] = useState(false);
  const [saving, setSaving] = useState(false);

  const fragmentValue = safeNumber(fragmentAmount);
  const fragmentFee = fragmentValue * FRAGMENT_FEE;
  const fragmentFinal = fragmentValue - fragmentFee;

  const filteredItems = useMemo(
    () =>
      SHOP_ITEMS.filter(
        (item) =>
          shopCategory === "all" || item.category === shopCategory,
      ),
    [shopCategory],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("neogram-profile-shop-v1");
      if (!saved) return;

      const data = JSON.parse(saved);

      if (data.profile) setProfile({ ...INITIAL_PROFILE, ...data.profile });
      if (typeof data.gram === "number") setGram(data.gram);
      if (Array.isArray(data.inventory)) setInventory(data.inventory);
      if (data.equipped) setEquipped(data.equipped);
    } catch {
      // Повреждённые локальные данные не блокируют интерфейс.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "neogram-profile-shop-v1",
        JSON.stringify({ profile, gram, inventory, equipped }),
      );
    } catch {
      // Хранилище браузера может быть недоступно.
    }
  }, [profile, gram, inventory, equipped]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const updateProfile = (key: keyof ProfileData, value: string | boolean) => {
    setProfile((previous) => ({ ...previous, [key]: value }));
  };

  const buyItem = (item: ShopItem) => {
    if (item.price <= 0) {
      notify("Для этого предмета требуется индивидуальная цена.");
      return;
    }

    if (inventory.includes(item.id)) {
      notify("Этот предмет уже есть в вашем инвентаре.");
      return;
    }

    if (gram < item.price) {
      notify("Недостаточно GRAM на балансе.");
      return;
    }

    setGram((previous) => previous - item.price);
    setInventory((previous) => [...previous, item.id]);
    notify(`Покупка «${item.name}» выполнена.`);
  };

  const equipItem = (item: ShopItem) => {
    if (!inventory.includes(item.id)) {
      notify("Сначала приобретите предмет.");
      return;
    }

    setEquipped((previous) => ({
      ...previous,
      [item.category]: item.id,
    }));

    notify(`«${item.name}» применён.`);
  };

  const exchangeFragment = () => {
    if (fragmentValue <= 0) {
      notify("Введите сумму обмена.");
      return;
    }

    notify(
      `Заявка на обмен ${formatGram(fragmentFinal)} GRAM после комиссии создана. Для реального обмена требуется подключение Fragment API.`,
    );
  };

  const sendGift = () => {
    if (!giftTarget.trim()) {
      notify("Укажите получателя подарка.");
      return;
    }

    if (!giftMessage.trim()) {
      notify("Выберите или введите название подарка.");
      return;
    }

    notify(
      `Подарок подготовлен для ${giftTarget}. Отправка требует подключения серверного API.`,
    );
  };

  const startRoulette = () => {
    if (rouletteBusy) return;

    const available = SHOP_ITEMS.filter(
      (item) => item.category === "gifts" && inventory.includes(item.id),
    );

    if (available.length === 0) {
      notify("Для улучшения нужен хотя бы один подарок в инвентаре.");
      return;
    }

    setRouletteBusy(true);
    setRouletteItem(null);

    window.setTimeout(() => {
      const result =
        available[Math.floor(Math.random() * available.length)];

      setRouletteItem(result);
      setRouletteBusy(false);
    }, 1800);
  };

  const saveProfile = async () => {
    setSaving(true);

    try {
      await Promise.resolve();
      notify("Изменения профиля сохранены на этом устройстве.");
    } finally {
      setSaving(false);
    }
  };

  const platformName: Record<ProfilePlatform, string> = {
    neogram: "NeoGram",
    discord: "Discord",
    twitter: "Twitter / X",
    steam: "Steam",
  };

  const categoryName: Record<ShopCategory, string> = {
    all: "Всё",
    numbers: "Номера",
    gifts: "Подарки",
    frames: "Рамки",
    backgrounds: "Фоны",
    names: "Ники",
  };

  const renderProfilePreview = () => (
    <div className={`ng-profile-preview ng-platform-${platform}`}>
      <div
        className="ng-profile-banner"
        style={
          profile.banner
            ? { backgroundImage: `url("${profile.banner}")` }
            : undefined
        }
      >
        <span className="ng-banner-label">{platformName[platform]}</span>
      </div>

      <div className="ng-profile-preview-body">
        <div className="ng-profile-avatar-wrap">
          {profile.avatar ? (
            <img src={profile.avatar} alt="Аватар" />
          ) : (
            <span>{profile.name.trim().charAt(0).toUpperCase() || "N"}</span>
          )}
          {profile.isCreator && <i className="ng-creator-dot">✦</i>}
        </div>

        <div className="ng-profile-title">
          <div className="ng-profile-name-line">
            <strong>{profile.name || "Ваше имя"}</strong>
            {profile.isCreator && <span className="ng-dev-tag">#DEV</span>}
          </div>
          <span className="ng-profile-username">
            @{profile.username || "username"}
          </span>
        </div>

        <p className="ng-profile-bio">{profile.bio || "Описание профиля"}</p>

        <div className="ng-social-links">
          {profile.discord && <span>◈ {profile.discord}</span>}
          {profile.twitter && <span>𝕏 {profile.twitter}</span>}
          {profile.steam && <span>♨ {profile.steam}</span>}
        </div>

        <div className="ng-profile-stats">
          <div>
            <strong>{formatGram(gram)}</strong>
            <span>GRAM</span>
          </div>
          <div>
            <strong>{inventory.length}</strong>
            <span>Предметов</span>
          </div>
          <div>
            <strong>{profile.isCreator ? "DEV" : "USER"}</strong>
            <span>Статус</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="ng-profile-shop">
      <style>{`
        .ng-profile-shop {
          --ng-accent: var(--color-primary, #168cff);
          --ng-bg: var(--color-background, #080d19);
          --ng-card: var(--color-background-secondary, #111a2b);
          --ng-text: var(--color-text, #f5f8ff);
          --ng-muted: var(--color-text-secondary, #8d9bb2);
          --ng-border: var(--color-borders, rgba(145,170,210,.17));
          color: var(--ng-text);
          width: 100%;
          min-width: 0;
          padding: 12px;
          box-sizing: border-box;
          font-family: inherit;
        }

        .ng-profile-shop * { box-sizing: border-box; }

        .ng-shop-header {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:16px;
        }

        .ng-shop-heading h2 {
          margin:0;
          font-size:23px;
          font-weight:850;
          letter-spacing:-.7px;
        }

        .ng-shop-heading p {
          margin:4px 0 0;
          color:var(--ng-muted);
          font-size:12px;
        }

        .ng-wallet-pill {
          flex-shrink:0;
          border:1px solid rgba(30,145,255,.35);
          background:linear-gradient(135deg,rgba(0,132,255,.19),rgba(0,60,180,.12));
          padding:10px 12px;
          border-radius:14px;
          font-weight:850;
          font-size:13px;
          color:#65baff;
        }

        .ng-shop-tabs {
          display:flex;
          gap:7px;
          overflow-x:auto;
          padding:2px 0 10px;
          scrollbar-width:none;
        }

        .ng-shop-tabs::-webkit-scrollbar { display:none; }

        .ng-shop-tabs button, .ng-platform-tabs button {
          border:1px solid var(--ng-border);
          color:var(--ng-muted);
          background:var(--ng-card);
          border-radius:12px;
          padding:10px 13px;
          font:inherit;
          font-size:12px;
          font-weight:750;
          white-space:nowrap;
          cursor:pointer;
        }

        .ng-shop-tabs button.active, .ng-platform-tabs button.active {
          color:white;
          border-color:rgba(35,145,255,.55);
          background:linear-gradient(135deg,#087cff,#1746bd);
          box-shadow:0 5px 20px rgba(0,105,255,.2);
        }

        .ng-shop-panel {
          background:var(--ng-card);
          border:1px solid var(--ng-border);
          border-radius:19px;
          padding:14px;
          margin-top:10px;
          min-width:0;
        }

        .ng-panel-heading {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:13px;
        }

        .ng-panel-heading h3 {
          font-size:16px;
          margin:0;
          font-weight:850;
        }

        .ng-muted { color:var(--ng-muted); }

        .ng-profile-preview {
          border:1px solid var(--ng-border);
          border-radius:18px;
          overflow:hidden;
          background:#101a2b;
          margin-bottom:15px;
        }

        .ng-profile-banner {
          height:112px;
          position:relative;
          background:
            radial-gradient(ellipse at 70% 20%,rgba(0,200,255,.6),transparent 40%),
            linear-gradient(125deg,#061c43,#0757a8 50%,#111b55);
          background-size:cover;
          background-position:center;
        }

        .ng-banner-label {
          position:absolute;
          right:10px;
          top:10px;
          border:1px solid rgba(255,255,255,.2);
          background:rgba(0,0,0,.35);
          padding:5px 9px;
          border-radius:20px;
          font-size:10px;
          color:#fff;
          backdrop-filter:blur(8px);
        }

        .ng-profile-preview-body { padding:0 14px 14px; }

        .ng-profile-avatar-wrap {
          width:76px;
          height:76px;
          margin-top:-38px;
          position:relative;
          border-radius:50%;
          border:4px solid #101a2b;
          background:linear-gradient(145deg,#168fff,#153cbd);
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:visible;
          color:white;
          font-size:29px;
          font-weight:900;
        }

        .ng-profile-avatar-wrap img {
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:50%;
        }

        .ng-creator-dot {
          position:absolute;
          right:-3px;
          bottom:-1px;
          width:23px;
          height:23px;
          display:grid;
          place-items:center;
          border-radius:50%;
          background:#087cff;
          color:white;
          border:2px solid #101a2b;
          font-style:normal;
          font-size:12px;
        }

        .ng-profile-title { margin-top:8px; }
        .ng-profile-name-line {
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:7px;
        }
        .ng-profile-name-line strong { font-size:18px; }

        .ng-dev-tag {
          display:inline-flex;
          padding:3px 7px;
          border-radius:6px;
          color:#7bd5ff;
          background:rgba(0,144,255,.16);
          border:1px solid rgba(0,157,255,.35);
          font-size:10px;
          font-weight:900;
        }

        .ng-profile-username { color:var(--ng-muted); font-size:12px; }
        .ng-profile-bio { font-size:13px; line-height:1.5; margin:10px 0; }

        .ng-social-links {
          display:flex;
          flex-wrap:wrap;
          gap:7px;
        }

        .ng-social-links span {
          background:rgba(130,160,210,.1);
          border:1px solid var(--ng-border);
          padding:6px 9px;
          border-radius:8px;
          font-size:11px;
        }

        .ng-profile-stats {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:7px;
          margin-top:14px;
        }

        .ng-profile-stats div {
          border:1px solid var(--ng-border);
          background:rgba(0,0,0,.12);
          border-radius:11px;
          padding:9px 5px;
          display:flex;
          flex-direction:column;
          gap:3px;
          min-width:0;
        }

        .ng-profile-stats strong {
          font-size:13px;
          overflow-wrap:anywhere;
        }

        .ng-profile-stats span { color:var(--ng-muted); font-size:9px; }

        .ng-platform-tabs {
          display:flex;
          gap:7px;
          overflow-x:auto;
          margin-bottom:12px;
          scrollbar-width:none;
        }

        .ng-form-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .ng-field { min-width:0; display:flex; flex-direction:column; gap:6px; }
        .ng-field.full { grid-column:1/-1; }

        .ng-field label {
          color:var(--ng-muted);
          font-size:11px;
          font-weight:700;
        }

        .ng-field input, .ng-field textarea, .ng-field select {
          width:100%;
          min-width:0;
          border:1px solid var(--ng-border);
          border-radius:11px;
          background:rgba(0,0,0,.16);
          color:var(--ng-text);
          padding:11px;
          font:inherit;
          font-size:13px;
          outline:none;
        }

        .ng-field textarea { min-height:76px; resize:vertical; }
        .ng-field input:focus, .ng-field textarea:focus {
          border-color:var(--ng-accent);
        }

        .ng-primary-btn, .ng-secondary-btn {
          border:0;
          border-radius:11px;
          padding:11px 14px;
          font:inherit;
          font-size:12px;
          font-weight:850;
          cursor:pointer;
        }

        .ng-primary-btn {
          color:white;
          background:linear-gradient(120deg,#078bff,#2149d8);
          box-shadow:0 5px 18px rgba(0,110,255,.18);
        }

        .ng-secondary-btn {
          color:var(--ng-text);
          background:rgba(130,160,210,.12);
          border:1px solid var(--ng-border);
        }

        .ng-primary-btn:disabled { opacity:.5; cursor:not-allowed; }

        .ng-full-btn { width:100%; margin-top:12px; }

        .ng-creator-card {
          border:1px solid rgba(0,160,255,.35);
          border-radius:15px;
          padding:13px;
          margin-top:14px;
          background:
            radial-gradient(ellipse at top right,rgba(0,145,255,.2),transparent 55%),
            rgba(0,100,220,.06);
        }

        .ng-creator-card h4 { margin:0 0 7px; font-size:14px; }
        .ng-creator-card p { color:var(--ng-muted); font-size:12px; line-height:1.5; }
        .ng-creator-price { color:#6dc5ff; font-weight:900; font-size:17px; }

        .ng-balance-card {
          padding:18px;
          border-radius:17px;
          background:linear-gradient(135deg,#0755c9,#092b77 75%,#111b53);
          border:1px solid rgba(95,180,255,.3);
          margin-bottom:12px;
        }

        .ng-balance-card span { color:#b6d8ff; font-size:12px; }
        .ng-balance-card strong {
          display:block;
          font-size:29px;
          letter-spacing:-1px;
          margin-top:6px;
          overflow-wrap:anywhere;
        }

        .ng-exchange-info {
          border:1px solid var(--ng-border);
          background:rgba(0,0,0,.13);
          padding:12px;
          border-radius:12px;
          font-size:12px;
          line-height:1.55;
          margin:12px 0;
        }

        .ng-item-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .ng-item-card {
          min-width:0;
          position:relative;
          border:1px solid var(--ng-border);
          background:rgba(0,0,0,.12);
          border-radius:15px;
          padding:12px;
          overflow:hidden;
          transition:transform .2s,border-color .2s;
        }

        .ng-item-card:hover {
          transform:translateY(-2px);
          border-color:rgba(40,150,255,.45);
        }

        .ng-item-icon {
          width:100%;
          height:84px;
          display:grid;
          place-items:center;
          border-radius:11px;
          background:
            radial-gradient(circle at 50% 20%,rgba(30,145,255,.24),transparent 70%),
            rgba(100,130,180,.08);
          font-size:38px;
          margin-bottom:10px;
          perspective:500px;
          transform-style:preserve-3d;
        }

        .ng-item-card:hover .ng-item-icon {
          transform:rotateY(9deg) rotateX(5deg);
        }

        .ng-item-card h4 { font-size:13px; margin:0 0 5px; }
        .ng-item-card p {
          color:var(--ng-muted);
          font-size:10px;
          line-height:1.45;
          min-height:30px;
          margin:0 0 9px;
        }

        .ng-item-rarity {
          display:inline-block;
          color:#80caff;
          background:rgba(0,140,255,.12);
          border-radius:6px;
          padding:4px 6px;
          font-size:9px;
          margin-bottom:8px;
        }

        .ng-item-price {
          font-size:12px;
          font-weight:900;
          margin-bottom:9px;
        }

        .ng-item-card button { width:100%; padding:9px 6px; font-size:10px; }

        .ng-category-list {
          display:flex;
          gap:6px;
          overflow-x:auto;
          padding-bottom:11px;
          scrollbar-width:none;
        }

        .ng-category-list button {
          border:1px solid var(--ng-border);
          background:transparent;
          color:var(--ng-muted);
          border-radius:20px;
          padding:7px 11px;
          font:inherit;
          font-size:10px;
          white-space:nowrap;
          cursor:pointer;
        }

        .ng-category-list button.active {
          background:rgba(0,125,255,.18);
          border-color:var(--ng-accent);
          color:#82caff;
        }

        .ng-gift-box {
          border:1px solid var(--ng-border);
          border-radius:14px;
          padding:13px;
          margin-bottom:12px;
        }

        .ng-gift-box h4 { margin:0 0 10px; font-size:14px; }

        .ng-roulette {
          border:1px solid rgba(0,145,255,.3);
          border-radius:15px;
          padding:14px;
          text-align:center;
          background:radial-gradient(ellipse at center,rgba(0,110,255,.16),transparent 75%);
        }

        .ng-roulette-result {
          min-height:85px;
          display:grid;
          place-items:center;
          font-size:42px;
          margin:8px 0;
        }

        .ng-faq-item {
          border-bottom:1px solid var(--ng-border);
          padding:12px 0;
        }

        .ng-faq-question {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          width:100%;
          color:var(--ng-text);
          border:0;
          background:none;
          text-align:left;
          font:inherit;
          font-size:13px;
          font-weight:800;
          cursor:pointer;
        }

        .ng-faq-answer {
          color:var(--ng-muted);
          font-size:12px;
          line-height:1.6;
          padding:9px 22px 0 0;
        }

        .ng-empty {
          text-align:center;
          color:var(--ng-muted);
          padding:25px 10px;
          font-size:12px;
        }

        .ng-notice {
          position:fixed;
          z-index:9999;
          left:50%;
          bottom:calc(22px + env(safe-area-inset-bottom, 0px));
          transform:translateX(-50%);
          max-width:min(90vw,420px);
          padding:12px 16px;
          border-radius:13px;
          background:#12233e;
          border:1px solid rgba(60,160,255,.4);
          box-shadow:0 10px 35px rgba(0,0,0,.35);
          color:white;
          font-size:12px;
          font-weight:700;
          text-align:center;
        }

        .ng-section-note {
          color:var(--ng-muted);
          font-size:11px;
          line-height:1.5;
          margin:0 0 12px;
        }

        @media (max-width:380px) {
          .ng-profile-shop { padding:8px; }
          .ng-item-grid { gap:7px; }
          .ng-item-card { padding:9px; }
          .ng-form-grid { grid-template-columns:1fr; }
          .ng-field.full { grid-column:auto; }
          .ng-shop-heading h2 { font-size:20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ng-profile-shop * { transition:none !important; }
        }
      `}</style>

      <header className="ng-shop-header">
        <div className="ng-shop-heading">
          <h2>Профиль и магазин</h2>
          <p>Настрой свой NeoGram</p>
        </div>
        <div className="ng-wallet-pill">◆ {formatGram(gram)} GRAM</div>
      </header>

      <nav className="ng-shop-tabs">
        {(
          [
            ["profile", "👤 Профиль"],
            ["wallet", "◆ Кошелёк"],
            ["shop", "🛍 Магазин"],
            ["gifts", "🎁 Подарки"],
            ["faq", "❔ FAQ"],
          ] as [ShopTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "profile" && (
        <>
          <div className="ng-shop-panel">
            <div className="ng-panel-heading">
              <h3>Предпросмотр профиля</h3>
              <span className="ng-muted" style={{ fontSize: 10 }}>
                Макеты платформ
              </span>
            </div>

            <div className="ng-platform-tabs">
              {(
                [
                  ["neogram", "NeoGram"],
                  ["discord", "Discord"],
                  ["twitter", "Twitter / X"],
                  ["steam", "Steam"],
                ] as [ProfilePlatform, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={platform === key ? "active" : ""}
                  onClick={() => setPlatform(key)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {renderProfilePreview()}
            <p className="ng-section-note">
              Это визуальные макеты профиля. Изменения отображаются здесь;
              синхронизация с внешними Discord, X и Steam требует их
              авторизации и API.
            </p>
          </div>

          <div className="ng-shop-panel">
            <div className="ng-panel-heading">
              <h3>Редактирование</h3>
            </div>

            <div className="ng-form-grid">
              <div className="ng-field">
                <label>Имя профиля</label>
                <input
                  value={profile.name}
                  maxLength={48}
                  onChange={(e) => updateProfile("name", e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>

              <div className="ng-field">
                <label>Username</label>
                <input
                  value={profile.username}
                  maxLength={32}
                  onChange={(e) =>
                    updateProfile(
                      "username",
                      e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                    )
                  }
                  placeholder="username"
                />
              </div>

              <div className="ng-field full">
                <label>Описание</label>
                <textarea
                  value={profile.bio}
                  maxLength={180}
                  onChange={(e) => updateProfile("bio", e.target.value)}
                  placeholder="Расскажите о себе..."
                />
              </div>

              <div className="ng-field full">
                <label>Ссылка на аватар</label>
                <input
                  value={profile.avatar}
                  onChange={(e) => updateProfile("avatar", e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="ng-field full">
                <label>Ссылка на баннер</label>
                <input
                  value={profile.banner}
                  onChange={(e) => updateProfile("banner", e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="ng-field">
                <label>Discord</label>
                <input
                  value={profile.discord}
                  maxLength={40}
                  onChange={(e) => updateProfile("discord", e.target.value)}
                  placeholder="username"
                />
              </div>

              <div className="ng-field">
                <label>Twitter / X</label>
                <input
                  value={profile.twitter}
                  maxLength={40}
                  onChange={(e) => updateProfile("twitter", e.target.value)}
                  placeholder="@username"
                />
              </div>

              <div className="ng-field full">
                <label>Steam</label>
                <input
                  value={profile.steam}
                  maxLength={80}
                  onChange={(e) => updateProfile("steam", e.target.value)}
                  placeholder="Steam profile"
                />
              </div>
            </div>

            <button
              className="ng-primary-btn ng-full-btn"
              onClick={saveProfile}
              disabled={saving}
              type="button"
            >
              {saving ? "Сохранение..." : "Сохранить профиль"}
            </button>
          </div>

          <div className="ng-creator-card">
            <h4>✦ Статус Создателя</h4>
            <p>
              Для аккаунта Создателя предусмотрен тег #DEV и специальный
              коллекционный номер.
            </p>
            {profile.isCreator ? (
              <span className="ng-dev-tag">#DEV · Создатель</span>
            ) : (
              <button
                className="ng-secondary-btn"
                onClick={() => setShowCreatorOffer((value) => !value)}
                type="button"
              >
                Посмотреть специальное предложение
              </button>
            )}

            {showCreatorOffer && !profile.isCreator && (
              <div style={{ marginTop: 12 }}>
                <p>
                  Коллекционный номер <strong>+666 6 666</strong>.
                  Стоимость предложения:
                </p>
                <div className="ng-creator-price">
                  {formatGram(CREATOR_NUMBER_PRICE)} GRAM
                </div>
                <p>
                  Покупка номера сама по себе не выдаёт статус Создателя.
                  Назначение #DEV выполняется администрацией.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "wallet" && (
        <>
          <div className="ng-shop-panel">
            <div className="ng-balance-card">
              <span>Ваш баланс NeoGram</span>
              <strong>{formatGram(gram)} GRAM</strong>
              <span>Внутренний кошелёк</span>
            </div>

            <div className="ng-panel-heading">
              <h3>Обмен Fragment</h3>
              <span className="ng-dev-tag">Комиссия 10%</span>
            </div>

            <p className="ng-section-note">
              Укажите сумму. Система покажет расчёт с учётом комиссии.
            </p>

            <div className="ng-field">
              <label>Сумма обмена</label>
              <input
                type="number"
                min="0"
                value={fragmentAmount}
                onChange={(e) => setFragmentAmount(e.target.value)}
                placeholder="1000"
              />
            </div>

            <div className="ng-exchange-info">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Сумма</span>
                <strong>{formatGram(fragmentValue)} GRAM</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 7,
                }}
              >
                <span>Комиссия 10%</span>
                <strong>{formatGram(fragmentFee)} GRAM</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                  color: "#70c6ff",
                }}
              >
                <strong>Итого после комиссии</strong>
                <strong>{formatGram(fragmentFinal)} GRAM</strong>
              </div>
            </div>

            <button
              className="ng-primary-btn ng-full-btn"
              onClick={exchangeFragment}
              type="button"
            >
              Продолжить обмен
            </button>

            <p className="ng-section-note" style={{ marginTop: 12 }}>
              Расчёт комиссии работает в интерфейсе. Реальное зачисление,
              списание и обмен требуют серверной проверки и интеграции
              Fragment. Баланс на этой странице является локальным
              демонстрационным значением.
            </p>
          </div>
        </>
      )}

      {tab === "shop" && (
        <div className="ng-shop-panel">
          <div className="ng-panel-heading">
            <h3>Магазин NeoGram</h3>
            <span className="ng-muted" style={{ fontSize: 11 }}>
              {inventory.length} в инвентаре
            </span>
          </div>

          <div className="ng-category-list">
            {(Object.keys(categoryName) as ShopCategory[]).map((category) => (
              <button
                key={category}
                className={shopCategory === category ? "active" : ""}
                onClick={() => setShopCategory(category)}
                type="button"
              >
                {categoryName[category]}
              </button>
            ))}
          </div>

          <div className="ng-item-grid">
            {filteredItems.map((item) => {
              const owned = inventory.includes(item.id);

              return (
                <article className="ng-item-card" key={item.id}>
                  <div className="ng-item-icon">{item.icon}</div>
                  <span className="ng-item-rarity">{item.rarity}</span>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>

                  {item.price > 0 ? (
                    <div className="ng-item-price">
                      ◆ {formatGram(item.price)} GRAM
                    </div>
                  ) : (
                    <div className="ng-item-price">Цена индивидуальная</div>
                  )}

                  {owned ? (
                    <button
                      className="ng-secondary-btn"
                      onClick={() => equipItem(item)}
                      type="button"
                    >
                      {equipped[item.category] === item.id
                        ? "Применено ✓"
                        : "Применить"}
                    </button>
                  ) : (
                    <button
                      className="ng-primary-btn"
                      onClick={() => buyItem(item)}
                      type="button"
                    >
                      {item.price > 0 ? "Купить" : "Подробнее"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === "gifts" && (
        <>
          <div className="ng-shop-panel">
            <div className="ng-panel-heading">
              <h3>🎁 Подарки</h3>
            </div>

            <p className="ng-section-note">
              Выберите подарок в магазине, затем укажите получателя. Здесь
              также отображаются приобретённые подарки.
            </p>

            <div className="ng-gift-box">
              <h4>Отправить подарок</h4>
              <div className="ng-field">
                <label>Получатель — username</label>
                <input
                  value={giftTarget}
                  onChange={(e) => setGiftTarget(e.target.value)}
                  placeholder="@username"
                />
              </div>
              <div className="ng-field" style={{ marginTop: 10 }}>
                <label>Подарок из инвентаря</label>
                <select
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                >
                  <option value="">Выберите подарок</option>
                  {SHOP_ITEMS.filter(
                    (item) =>
                      item.category === "gifts" &&
                      inventory.includes(item.id),
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon} {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="ng-primary-btn ng-full-btn"
                onClick={sendGift}
                type="button"
              >
                Подготовить отправку
              </button>
            </div>

            <div className="ng-panel-heading">
              <h3>Мой инвентарь подарков</h3>
            </div>

            <div className="ng-item-grid">
              {SHOP_ITEMS.filter(
                (item) =>
                  item.category === "gifts" && inventory.includes(item.id),
              ).map((item) => (
                <div className="ng-item-card" key={item.id}>
                  <div className="ng-item-icon">{item.icon}</div>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                  <span className="ng-item-rarity">В коллекции</span>
                </div>
              ))}
            </div>

            {!SHOP_ITEMS.some(
              (item) =>
                item.category === "gifts" && inventory.includes(item.id),
            ) && (
              <div className="ng-empty">
                Пока нет подарков. Загляните в магазин.
              </div>
            )}
          </div>

          <div className="ng-shop-panel">
            <div className="ng-panel-heading">
              <h3>🎰 Рулетка улучшений</h3>
            </div>

            <p className="ng-section-note">
              Демонстрация анимации выбора среди подарков в вашем инвентаре.
              Результат не изменяет редкость и свойства предмета.
            </p>

            <div className="ng-roulette">
              <div className="ng-roulette-result">
                {rouletteBusy
                  ? "✨"
                  : rouletteItem
                    ? rouletteItem.icon
                    : "🎁"}
              </div>

              <strong>
                {rouletteBusy
                  ? "Выбираем..."
                  : rouletteItem
                    ? rouletteItem.name
                    : "Готовы к улучшению?"}
              </strong>

              <button
                className="ng-primary-btn ng-full-btn"
                onClick={startRoulette}
                disabled={rouletteBusy}
                type="button"
              >
                {rouletteBusy ? "Крутится..." : "Запустить рулетку"}
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "faq" && (
        <div className="ng-shop-panel">
          <div className="ng-panel-heading">
            <h3>Частые вопросы</h3>
          </div>

          {FAQ.map((item, index) => (
            <div className="ng-faq-item" key={item.q}>
              <button
                className="ng-faq-question"
                onClick={() =>
                  setExpandedFaq((previous) =>
                    previous === index ? null : index,
                  )
                }
                type="button"
              >
                {item.q}
                <span>{expandedFaq === index ? "−" : "+"}</span>
              </button>

              {expandedFaq === index && (
                <div className="ng-faq-answer">{item.a}</div>
              )}
            </div>
          ))}

          <div className="ng-creator-card">
            <h4>Возможности NeoGram</h4>
            <p>Нету</p>
          </div>
        </div>
      )}

      {notice && <div className="ng-notice">{notice}</div>}
    </section>
  );
}
