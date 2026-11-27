import React, { useCallback, useEffect, useRef, useState } from "react";

type AdminSection = "dashboard" | "users" | "economy" | "gifts" | "numbers";

type NeoGramAdminModalProps = {
  apiBase?: string;
  onClose?: () => void;
};

type AdminResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
};

const DEFAULT_API_BASE = "https://tg-api.neogram.workers.dev";

const SECTIONS: { id: AdminSection; label: string; icon: string }[] = [
  { id: "dashboard", label: "Обзор", icon: "⌂" },
  { id: "users", label: "Пользователи", icon: "♙" },
  { id: "economy", label: "Экономика", icon: "◆" },
  { id: "gifts", label: "Подарки", icon: "♢" },
  { id: "numbers", label: "Fragment", icon: "№" },
];

export default function NeoGramAdminModal({
  apiBase = DEFAULT_API_BASE,
  onClose,
}: NeoGramAdminModalProps) {
  const [opened, setOpened] = useState(false);
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [lastResult, setLastResult] = useState<AdminResult | null>(null);

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(
    null,
  );
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);

  const [giftName, setGiftName] = useState("");
  const [giftDescription, setGiftDescription] = useState("");
  const [giftPrice, setGiftPrice] = useState("1000");
  const [giftSupply, setGiftSupply] = useState("100");
  const [giftSkin, setGiftSkin] = useState("neon");
  const [giftIcon, setGiftIcon] = useState("🎁");
  const [giftImage, setGiftImage] = useState("");
  const [giftLimited, setGiftLimited] = useState(false);

  const [numberType, setNumberType] = useState<"666" | "777">("666");
  const [numberPrice, setNumberPrice] = useState("666");
  const [numberQuantity, setNumberQuantity] = useState("1");
  const [numberOwner, setNumberOwner] = useState("");
  const [numberListing, setNumberListing] = useState(true);

  const [targetUser, setTargetUser] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [userAction, setUserAction] = useState<"ban" | "unban">("ban");

  const [economyAction, setEconomyAction] = useState<
    "credit" | "debit" | "set"
  >("credit");
  const [economyAmount, setEconomyAmount] = useState("");
  const [economyReason, setEconomyReason] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    left: 0,
    top: 0,
  });

  const [position, setPosition] = useState({ left: 18, top: 90 });

  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 390,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const notify = useCallback((message: string, error = false) => {
    setNotice(message);
    setNoticeError(error);
  }, []);

  const request = useCallback(
    async <T extends AdminResult = AdminResult>(
      path: string,
      method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
      body?: unknown,
    ): Promise<T> => {
      if (!adminKey.trim()) {
        throw new Error("Сначала введите административный ключ.");
      }

      const base = apiBase.replace(/\/+$/, "");
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;

      const response = await fetch(`${base}${normalizedPath}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const text = await response.text();
      let data: T;

      try {
        data = text ? (JSON.parse(text) as T) : ({} as T);
      } catch {
        data = { message: text } as T;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `Ошибка сервера: HTTP ${response.status}`,
        );
      }

      if (data.ok === false) {
        throw new Error(data.error || data.message || "Операция отклонена.");
      }

      return data;
    },
    [adminKey, apiBase],
  );

  const runRequest = async (
    path: string,
    method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
    body?: unknown,
  ) => {
    setBusy(true);
    setLastResult(null);

    try {
      const result = await request(path, method, body);
      setLastResult(result);
      notify(
        result.message ||
          (method === "GET" ? "Данные загружены." : "Операция выполнена."),
      );
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка.";
      notify(message, true);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadDashboard = async () => {
    const result = await runRequest("/admin/dashboard");

    if (result) {
      setDashboard(result);
    }
  };

  const loadUsers = async () => {
    const result = await runRequest("/admin/users");

    if (!result) return;

    const rows = Array.isArray(result.users)
      ? result.users
      : Array.isArray(result.data)
        ? result.data
        : [];

    setUsers(rows as Record<string, unknown>[]);
  };

  const createGift = async () => {
    const price = Number(giftPrice);
    const supply = Number(giftSupply);

    if (!giftName.trim()) {
      notify("Введите название подарка.", true);
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      notify("Укажите корректную цену в GRAM.", true);
      return;
    }

    if (!Number.isInteger(supply) || supply < 1) {
      notify("Тираж должен быть целым числом больше нуля.", true);
      return;
    }

    await runRequest("/admin/gifts/create", "POST", {
      name: giftName.trim(),
      description: giftDescription.trim(),
      price,
      supply,
      skin: giftSkin,
      icon: giftIcon,
      image: giftImage.trim() || undefined,
      limited: giftLimited,
    });
  };

  const issueRareNumbers = async () => {
    const price = Number(numberPrice);
    const quantity = Number(numberQuantity);

    if (!Number.isFinite(price) || price <= 0) {
      notify("Цена номера должна быть больше нуля.", true);
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      notify("Тираж должен быть от 1 до 10 000.", true);
      return;
    }

    await runRequest("/admin/fragment/numbers/issue", "POST", {
      number: numberType,
      priceGram: price,
      quantity,
      owner: numberOwner.trim() || undefined,
      publishToFragment: numberListing,
    });
  };

  const updateUserBalance = async () => {
    const amount = Number(balanceAmount);

    if (!targetUser.trim()) {
      notify("Укажите ID или username пользователя.", true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Введите сумму больше нуля.", true);
      return;
    }

    if (!balanceReason.trim()) {
      notify("Укажите причину изменения баланса.", true);
      return;
    }

    await runRequest("/admin/users/balance", "POST", {
      user: targetUser.trim(),
      amount,
      reason: balanceReason.trim(),
    });
  };

  const moderateUser = async () => {
    if (!targetUser.trim()) {
      notify("Укажите ID или username пользователя.", true);
      return;
    }

    await runRequest(
      `/admin/users/${encodeURIComponent(targetUser.trim())}/${userAction}`,
      "POST",
      { reason: balanceReason.trim() || "Действие администратора" },
    );
  };

  const runEconomyAction = async () => {
    const amount = Number(economyAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Введите корректную сумму GRAM.", true);
      return;
    }

    if (!economyReason.trim()) {
      notify("Укажите причину операции.", true);
      return;
    }

    await runRequest("/admin/economy/adjust", "POST", {
      action: economyAction,
      amount,
      reason: economyReason.trim(),
    });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const panel = panelRef.current;
    if (!panel) return;

    const width = panel.offsetWidth;
    const height = panel.offsetHeight;

    const nextLeft = drag.left + event.clientX - drag.startX;
    const nextTop = drag.top + event.clientY - drag.startY;

    setPosition({
      left: Math.max(8, Math.min(viewport.width - width - 8, nextLeft)),
      top: Math.max(8, Math.min(viewport.height - height - 8, nextTop)),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
  };

  const closePanel = () => {
    setOpened(false);
    onClose?.();
  };

  const renderDashboard = () => (
    <div className="na-content">
      <div className="na-section-title">
        <div>
          <h3>Панель управления</h3>
          <p>Состояние NeoGram и основные показатели.</p>
        </div>
        <button
          className="na-button na-button-muted"
          onClick={loadDashboard}
          disabled={busy}
          type="button"
        >
          ↻ Обновить
        </button>
      </div>

      <div className="na-stat-grid">
        {[
          ["Пользователи", "users"],
          ["GRAM в системе", "totalGram"],
          ["Подарки", "gifts"],
          ["Активность", "activeUsers"],
        ].map(([label, key]) => (
          <div className="na-stat" key={key}>
            <span>{label}</span>
            <strong>
              {dashboard?.[key] === undefined
                ? "—"
                : String(dashboard[key])}
            </strong>
          </div>
        ))}
      </div>

      <div className="na-info">
        <strong>Быстрые действия</strong>
        <p>Выберите раздел слева, чтобы управлять проектом.</p>
        <p>
          Данные показателей появляются после ответа серверного маршрута
          <code> /admin/dashboard</code>.
        </p>
      </div>

      {lastResult && (
        <pre className="na-json">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="na-content">
      <div className="na-section-title">
        <div>
          <h3>Пользователи</h3>
          <p>Поиск по ID или username и управление аккаунтами.</p>
        </div>
        <button
          className="na-button na-button-muted"
          onClick={loadUsers}
          disabled={busy}
          type="button"
        >
          ↻ Загрузить
        </button>
      </div>

      <label className="na-label">
        ID или username пользователя
        <input
          className="na-input"
          value={targetUser}
          onChange={(event) => setTargetUser(event.target.value)}
          placeholder="@username или ID"
        />
      </label>

      <div className="na-divider" />

      <h4>Баланс пользователя</h4>

      <label className="na-label">
        Сумма GRAM
        <input
          className="na-input"
          type="number"
          min="0"
          value={balanceAmount}
          onChange={(event) => setBalanceAmount(event.target.value)}
          placeholder="1000"
        />
      </label>

      <label className="na-label">
        Причина
        <input
          className="na-input"
          value={balanceReason}
          onChange={(event) => setBalanceReason(event.target.value)}
          placeholder="Причина изменения баланса"
        />
      </label>

      <button
        className="na-button na-button-primary na-wide"
        onClick={updateUserBalance}
        disabled={busy}
        type="button"
      >
        Изменить баланс
      </button>

      <div className="na-divider" />

      <h4>Модерация аккаунта</h4>

      <select
        className="na-input"
        value={userAction}
        onChange={(event) =>
          setUserAction(event.target.value as "ban" | "unban")
        }
      >
        <option value="ban">Заблокировать</option>
        <option value="unban">Снять блокировку</option>
      </select>

      <button
        className="na-button na-button-danger na-wide"
        onClick={moderateUser}
        disabled={busy}
        type="button"
      >
        Выполнить действие
      </button>

      <div className="na-divider" />

      <h4>Список пользователей</h4>

      {users.length === 0 ? (
        <div className="na-empty">
          Список пока не загружен. Нажмите «Загрузить».
        </div>
      ) : (
        <div className="na-user-list">
          {users.map((user, index) => (
            <div className="na-user-row" key={String(user.id ?? index)}>
              <div>
                <strong>
                  {String(user.name ?? user.username ?? "Пользователь")}
                </strong>
                <span>
                  {String(user.username ?? user.id ?? "Без ID")}
                </span>
              </div>
              <span className="na-user-balance">
                {user.gram === undefined ? "—" : `${String(user.gram)} GRAM`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEconomy = () => (
    <div className="na-content">
      <div className="na-section-title">
        <div>
          <h3>Экономика GRAM</h3>
          <p>Административная корректировка внутренней экономики.</p>
        </div>
      </div>

      <div className="na-warning">
        Изменение балансов должно проверяться Worker на стороне сервера.
        Не доверяйте суммам, переданным клиентом.
      </div>

      <label className="na-label">
        Тип операции
        <select
          className="na-input"
          value={economyAction}
          onChange={(event) =>
            setEconomyAction(
              event.target.value as "credit" | "debit" | "set",
            )
          }
        >
          <option value="credit">Начислить GRAM</option>
          <option value="debit">Списать GRAM</option>
          <option value="set">Установить значение</option>
        </select>
      </label>

      <label className="na-label">
        Количество GRAM
        <input
          className="na-input"
          type="number"
          min="0"
          value={economyAmount}
          onChange={(event) => setEconomyAmount(event.target.value)}
          placeholder="Введите сумму"
        />
      </label>

      <label className="na-label">
        Причина операции
        <input
          className="na-input"
          value={economyReason}
          onChange={(event) => setEconomyReason(event.target.value)}
          placeholder="Например: компенсация"
        />
      </label>

      <button
        className="na-button na-button-primary na-wide"
        onClick={runEconomyAction}
        disabled={busy}
        type="button"
      >
        Подтвердить операцию
      </button>

      <div className="na-info">
        <strong>Важно</strong>
        <p>
          Все начисления и списания должны записываться в серверный журнал
          транзакций с ID администратора, временем и причиной.
        </p>
      </div>
    </div>
  );

  const renderGifts = () => (
    <div className="na-content">
      <div className="na-section-title">
        <div>
          <h3>Создание подарка</h3>
          <p>Настройте внешний вид, стоимость и тираж.</p>
        </div>
      </div>

      <div className="na-gift-preview">
        <div className="na-gift-preview-icon">{giftIcon || "🎁"}</div>
        <div>
          <strong>{giftName || "Новый подарок"}</strong>
          <span>
            {giftPrice ? `${giftPrice} GRAM` : "Цена не задана"} · тираж{" "}
            {giftSupply || "—"}
          </span>
        </div>
        <span className="na-preview-skin">{giftSkin}</span>
      </div>

      <label className="na-label">
        Название подарка
        <input
          className="na-input"
          value={giftName}
          maxLength={60}
          onChange={(event) => setGiftName(event.target.value)}
          placeholder="Например: Неоновая корона"
        />
      </label>

      <label className="na-label">
        Описание
        <textarea
          className="na-input na-textarea"
          value={giftDescription}
          maxLength={300}
          onChange={(event) => setGiftDescription(event.target.value)}
          placeholder="Описание подарка..."
        />
      </label>

      <div className="na-two-columns">
        <label className="na-label">
          Цена, GRAM
          <input
            className="na-input"
            type="number"
            min="0"
            value={giftPrice}
            onChange={(event) => setGiftPrice(event.target.value)}
          />
        </label>

        <label className="na-label">
          Тираж
          <input
            className="na-input"
            type="number"
            min="1"
            step="1"
            value={giftSupply}
            onChange={(event) => setGiftSupply(event.target.value)}
          />
        </label>
      </div>

      <div className="na-two-columns">
        <label className="na-label">
          Иконка
          <input
            className="na-input"
            value={giftIcon}
            maxLength={8}
            onChange={(event) => setGiftIcon(event.target.value)}
            placeholder="🎁"
          />
        </label>

        <label className="na-label">
          Скин
          <select
            className="na-input"
            value={giftSkin}
            onChange={(event) => setGiftSkin(event.target.value)}
          >
            <option value="neon">Neon</option>
            <option value="hologram">Hologram</option>
            <option value="gold">Gold</option>
            <option value="crystal">Crystal</option>
            <option value="animated">Animated</option>
            <option value="legendary">Legendary</option>
          </select>
        </label>
      </div>

      <label className="na-label">
        URL изображения (необязательно)
        <input
          className="na-input"
          type="url"
          value={giftImage}
          onChange={(event) => setGiftImage(event.target.value)}
          placeholder="https://..."
        />
      </label>

      <label className="na-check">
        <input
          type="checkbox"
          checked={giftLimited}
          onChange={(event) => setGiftLimited(event.target.checked)}
        />
        <span>Отметить как лимитированный подарок</span>
      </label>

      <button
        className="na-button na-button-primary na-wide na-create-gift"
        onClick={createGift}
        disabled={busy}
        type="button"
      >
        ＋ Создать подарок
      </button>
    </div>
  );

  const renderNumbers = () => (
    <div className="na-content">
      <div className="na-section-title">
        <div>
          <h3>Редкие номера Fragment</h3>
          <p>Выпуск коллекционных номеров с ручной ценой в GRAM.</p>
        </div>
      </div>

      <div className="na-number-showcase">
        <button
          className={`na-number-choice ${numberType === "666" ? "selected" : ""}`}
          onClick={() => setNumberType("666")}
          type="button"
        >
          <span>Редкий номер</span>
          <strong>+666</strong>
        </button>

        <button
          className={`na-number-choice ${numberType === "777" ? "selected" : ""}`}
          onClick={() => setNumberType("777")}
          type="button"
        >
          <span>Редкий номер</span>
          <strong>+777</strong>
        </button>
      </div>

      <label className="na-label">
        Цена за номер, GRAM
        <input
          className="na-input"
          type="number"
          min="1"
          value={numberPrice}
          onChange={(event) => setNumberPrice(event.target.value)}
          placeholder="Установите цену вручную"
        />
      </label>

      <label className="na-label">
        Количество номеров
        <input
          className="na-input"
          type="number"
          min="1"
          max="10000"
          step="1"
          value={numberQuantity}
          onChange={(event) => setNumberQuantity(event.target.value)}
        />
      </label>

      <label className="na-label">
        Получатель (необязательно)
        <input
          className="na-input"
          value={numberOwner}
          onChange={(event) => setNumberOwner(event.target.value)}
          placeholder="@username или ID"
        />
      </label>

      <label className="na-check">
        <input
          type="checkbox"
          checked={numberListing}
          onChange={(event) => setNumberListing(event.target.checked)}
        />
        <span>Опубликовать для продажи через Fragment</span>
      </label>

      <div className="na-info">
        <strong>Параметры выпуска</strong>
        <div className="na-summary-line">
          <span>Номер</span>
          <b>+{numberType}</b>
        </div>
        <div className="na-summary-line">
          <span>Цена за единицу</span>
          <b>{Number(numberPrice || 0).toLocaleString("ru-RU")} GRAM</b>
        </div>
        <div className="na-summary-line">
          <span>Тираж</span>
          <b>{numberQuantity}</b>
        </div>
        <div className="na-summary-line">
          <span>Общая стоимость тиража</span>
          <b>
            {(
              Number(numberPrice || 0) * Number(numberQuantity || 0)
            ).toLocaleString("ru-RU")}{" "}
            GRAM
          </b>
        </div>
      </div>

      <button
        className="na-button na-button-primary na-wide"
        onClick={issueRareNumbers}
        disabled={busy}
        type="button"
      >
        Выпустить +{numberType}
      </button>

      <p className="na-footnote">
        Выпуск и публикация станут реальными только после реализации
        серверного маршрута и интеграции с Fragment. Интерфейс не создаёт
        Telegram-коллекционные номера самостоятельно.
      </p>
    </div>
  );

  const contentBySection: Record<AdminSection, () => React.ReactNode> = {
    dashboard: renderDashboard,
    users: renderUsers,
    economy: renderEconomy,
    gifts: renderGifts,
    numbers: renderNumbers,
  };

  return (
    <>
      <style>{`
        .ng-admin-root {
          --na-bg: #080d18;
          --na-panel: #101a2b;
          --na-panel2: #14223a;
          --na-text: #f3f7ff;
          --na-muted: #91a1bb;
          --na-border: rgba(145,175,220,.18);
          --na-blue: #168dff;
          color:var(--na-text);
          font-family:inherit;
        }

        .ng-admin-root * { box-sizing:border-box; }

        .na-launcher {
          position:fixed;
          z-index:9990;
          right:16px;
          bottom:calc(18px + env(safe-area-inset-bottom, 0px));
          width:53px;
          height:53px;
          border:1px solid rgba(110,190,255,.5);
          border-radius:18px;
          background:linear-gradient(145deg,#168fff,#1536a9);
          box-shadow:0 8px 30px rgba(0,100,255,.35);
          color:white;
          font-size:22px;
          font-weight:900;
          cursor:pointer;
        }

        .na-panel {
          position:fixed;
          z-index:9991;
          width:min(580px,calc(100vw - 16px));
          height:min(690px,calc(100dvh - 24px));
          min-height:400px;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          border:1px solid rgba(72,153,255,.35);
          border-radius:19px;
          background:var(--na-bg);
          box-shadow:0 22px 80px rgba(0,0,0,.62),0 0 35px rgba(0,105,255,.12);
          color:var(--na-text);
        }

        .na-topbar {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:12px 14px;
          min-height:57px;
          border-bottom:1px solid var(--na-border);
          background:linear-gradient(110deg,#10264a,#10192d);
          cursor:grab;
          touch-action:none;
          user-select:none;
        }

        .na-topbar:active { cursor:grabbing; }

        .na-brand {
          display:flex;
          align-items:center;
          gap:9px;
          min-width:0;
        }

        .na-brand-icon {
          width:34px;
          height:34px;
          display:grid;
          place-items:center;
          flex-shrink:0;
          border-radius:11px;
          background:linear-gradient(140deg,#1b9cff,#1838b8);
          font-size:17px;
          font-weight:950;
        }

        .na-brand-text { min-width:0; }
        .na-brand-text strong {
          display:block;
          font-size:13px;
          letter-spacing:.4px;
        }
        .na-brand-text span {
          display:block;
          color:#80baff;
          font-size:9px;
          margin-top:2px;
        }

        .na-top-actions { display:flex; gap:6px; }

        .na-icon-button {
          width:31px;
          height:31px;
          border:1px solid var(--na-border);
          border-radius:9px;
          background:rgba(255,255,255,.06);
          color:white;
          cursor:pointer;
          font-size:14px;
        }

        .na-auth {
          display:flex;
          align-items:center;
          gap:8px;
          padding:10px 12px;
          background:#0b1424;
          border-bottom:1px solid var(--na-border);
        }

        .na-auth input {
          min-width:0;
          flex:1;
          border:1px solid var(--na-border);
          border-radius:9px;
          background:#111e33;
          color:white;
          padding:9px 10px;
          font:inherit;
          font-size:12px;
          outline:none;
        }

        .na-auth button {
          border:1px solid var(--na-border);
          background:#172944;
          color:white;
          border-radius:9px;
          padding:9px 10px;
          font:inherit;
          font-size:10px;
          cursor:pointer;
        }

        .na-layout {
          display:flex;
          flex:1;
          min-height:0;
        }

        .na-sidebar {
          width:126px;
          flex-shrink:0;
          padding:9px 7px;
          border-right:1px solid var(--na-border);
          background:#0c1423;
          overflow-y:auto;
        }

        .na-side-button {
          width:100%;
          display:flex;
          align-items:center;
          gap:8px;
          text-align:left;
          padding:10px 8px;
          margin-bottom:5px;
          border:1px solid transparent;
          border-radius:10px;
          background:transparent;
          color:var(--na-muted);
          font:inherit;
          font-size:11px;
          font-weight:750;
          cursor:pointer;
        }

        .na-side-button.active {
          color:white;
          border-color:rgba(38,147,255,.32);
          background:linear-gradient(110deg,rgba(0,130,255,.25),rgba(40,70,170,.15));
        }

        .na-side-icon {
          width:20px;
          text-align:center;
          font-size:16px;
        }

        .na-main {
          min-width:0;
          flex:1;
          overflow-y:auto;
          overscroll-behavior:contain;
        }

        .na-content { padding:14px; }

        .na-section-title {
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:10px;
          margin-bottom:15px;
        }

        .na-section-title h3 {
          margin:0;
          font-size:16px;
          font-weight:900;
        }

        .na-section-title p {
          margin:5px 0 0;
          color:var(--na-muted);
          font-size:10px;
          line-height:1.45;
        }

        .na-stat-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:9px;
        }

        .na-stat {
          padding:13px;
          border:1px solid var(--na-border);
          border-radius:13px;
          background:linear-gradient(145deg,#13243d,#0d1728);
          min-width:0;
        }

        .na-stat span {
          display:block;
          color:var(--na-muted);
          font-size:10px;
        }

        .na-stat strong {
          display:block;
          margin-top:8px;
          font-size:20px;
          overflow-wrap:anywhere;
        }

        .na-info, .na-warning {
          padding:12px;
          margin-top:13px;
          border:1px solid var(--na-border);
          border-radius:12px;
          background:rgba(40,95,160,.1);
          font-size:11px;
          line-height:1.55;
        }

        .na-info p { margin:6px 0 0; color:var(--na-muted); }
        .na-info code { color:#80caff; }

        .na-warning {
          color:#ffd58b;
          border-color:rgba(255,175,55,.25);
          background:rgba(255,165,30,.07);
          margin:0 0 13px;
        }

        .na-button {
          border:1px solid transparent;
          border-radius:10px;
          padding:10px 12px;
          color:white;
          font:inherit;
          font-size:11px;
          font-weight:850;
          cursor:pointer;
        }

        .na-button:disabled { opacity:.5; cursor:not-allowed; }

        .na-button-primary {
          background:linear-gradient(120deg,#087fff,#2545c4);
          box-shadow:0 4px 15px rgba(0,100,255,.17);
        }

        .na-button-muted {
          background:#182942;
          border-color:var(--na-border);
        }

        .na-button-danger {
          background:linear-gradient(120deg,#bd344d,#80203b);
        }

        .na-wide { width:100%; margin-top:10px; }

        .na-label {
          display:flex;
          flex-direction:column;
          gap:6px;
          margin:11px 0;
          color:#aabbd4;
          font-size:10px;
          font-weight:750;
        }

        .na-input {
          display:block;
          width:100%;
          min-width:0;
          border:1px solid var(--na-border);
          border-radius:10px;
          padding:10px 11px;
          background:#0c1627;
          color:white;
          font:inherit;
          font-size:12px;
          outline:none;
        }

        .na-input:focus, .na-auth input:focus {
          border-color:#238fff;
          box-shadow:0 0 0 2px rgba(35,143,255,.1);
        }

        .na-textarea { min-height:70px; resize:vertical; }

        .na-divider {
          height:1px;
          background:var(--na-border);
          margin:16px 0;
        }

        .na-content h4 {
          font-size:12px;
          margin:10px 0;
        }

        .na-two-columns {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:9px;
        }

        .na-check {
          display:flex;
          align-items:center;
          gap:8px;
          margin:13px 0;
          color:#c1cee0;
          font-size:11px;
          cursor:pointer;
        }

        .na-check input {
          accent-color:#168dff;
          width:16px;
          height:16px;
        }

        .na-gift-preview {
          display:flex;
          align-items:center;
          gap:11px;
          padding:11px;
          border:1px solid rgba(35,140,255,.28);
          border-radius:13px;
          background:linear-gradient(110deg,rgba(0,115,255,.14),rgba(0,0,0,.12));
          margin-bottom:13px;
          min-width:0;
        }

        .na-gift-preview-icon {
          width:46px;
          height:46px;
          display:grid;
          place-items:center;
          flex-shrink:0;
          border-radius:12px;
          background:#122c50;
          font-size:25px;
        }

        .na-gift-preview > div:nth-child(2) { min-width:0; flex:1; }
        .na-gift-preview strong { display:block; font-size:12px; }
        .na-gift-preview span {
          display:block;
          color:var(--na-muted);
          font-size:9px;
          margin-top:4px;
        }

        .na-gift-preview .na-preview-skin {
          color:#7ccaff;
          padding:5px 7px;
          border:1px solid var(--na-border);
          border-radius:7px;
          font-size:9px;
        }

        .na-create-gift { padding:13px; font-size:12px; }

        .na-number-showcase {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:9px;
          margin-bottom:15px;
        }

        .na-number-choice {
          padding:15px 8px;
          border:1px solid var(--na-border);
          border-radius:13px;
          background:#101e33;
          color:white;
          cursor:pointer;
        }

        .na-number-choice.selected {
          border-color:#168dff;
          background:linear-gradient(145deg,rgba(0,125,255,.25),#101d34);
          box-shadow:inset 0 0 18px rgba(0,120,255,.1);
        }

        .na-number-choice span {
          display:block;
          color:var(--na-muted);
          font-size:9px;
        }

        .na-number-choice strong {
          display:block;
          margin-top:5px;
          font-size:25px;
        }

        .na-summary-line {
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-top:7px;
          font-size:10px;
        }

        .na-summary-line span { color:var(--na-muted); }
        .na-summary-line b { text-align:right; }

        .na-footnote {
          color:var(--na-muted);
          font-size:9px;
          line-height:1.55;
          margin:12px 0 0;
        }

        .na-empty {
          padding:18px 10px;
          color:var(--na-muted);
          text-align:center;
          font-size:11px;
          border:1px dashed var(--na-border);
          border-radius:10px;
        }

        .na-user-list { display:flex; flex-direction:column; gap:7px; }

        .na-user-row {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:8px;
          padding:9px;
          border:1px solid var(--na-border);
          border-radius:10px;
          background:rgba(255,255,255,.025);
        }

        .na-user-row strong, .na-user-row span {
          display:block;
          font-size:10px;
        }

        .na-user-row span {
          color:var(--na-muted);
          margin-top:3px;
        }

        .na-user-row .na-user-balance {
          color:#77c8ff;
          white-space:nowrap;
        }

        .na-json {
          overflow:auto;
          max-height:160px;
          padding:10px;
          border-radius:9px;
          background:#050a12;
          color:#9ed1ff;
          font-size:9px;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
        }

        .na-notice {
          position:fixed;
          z-index:10000;
          left:50%;
          bottom:calc(16px + env(safe-area-inset-bottom, 0px));
          transform:translateX(-50%);
          width:max-content;
          max-width:calc(100vw - 24px);
          padding:11px 14px;
          border:1px solid rgba(65,155,255,.4);
          border-radius:11px;
          background:#10233e;
          color:white;
          box-shadow:0 8px 28px rgba(0,0,0,.4);
          font-size:11px;
          font-weight:750;
          text-align:center;
        }

        .na-notice.error {
          border-color:rgba(255,90,110,.5);
          background:#401b2b;
        }

        @media(max-width:440px) {
          .na-panel {
            width:calc(100vw - 12px);
            height:min(720px,calc(100dvh - 16px));
            min-height:360px;
          }
          .na-sidebar { width:102px; padding:8px 5px; }
          .na-side-button { gap:5px; padding:10px 5px; font-size:10px; }
          .na-content { padding:11px; }
          .na-auth { padding:8px; }
          .na-two-columns { gap:7px; }
        }

        @media(prefers-reduced-motion:reduce) {
          .ng-admin-root * { scroll-behavior:auto !important; }
        }
      `}</style>

      <div className="ng-admin-root">
        {!opened && (
          <button
            className="na-launcher"
            onClick={() => setOpened(true)}
            type="button"
            aria-label="Открыть админку NeoGram"
            title="Админка BOSS777"
          >
            ⚙
          </button>
        )}

        {opened && (
          <div
            className="na-panel"
            ref={panelRef}
            style={{
              left: `${Math.min(
                position.left,
                Math.max(8, viewport.width - 320),
              )}px`,
              top: `${Math.min(
                position.top,
                Math.max(8, viewport.height - 250),
              )}px`,
            }}
          >
            <div
              className="na-topbar"
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className="na-brand">
                <div className="na-brand-icon">N</div>
                <div className="na-brand-text">
                  <strong>NEOGRAM ADMIN</strong>
                  <span>BOSS777 · CONTROL CENTER</span>
                </div>
              </div>

              <div className="na-top-actions">
                <button
                  className="na-icon-button"
                  onClick={() => setPosition({ left: 18, top: 90 })}
                  title="Вернуть панель"
                  type="button"
                >
                  ⌖
                </button>
                <button
                  className="na-icon-button"
                  onClick={closePanel}
                  title="Закрыть"
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="na-auth">
              <input
                type={showKey ? "text" : "password"}
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Административный ключ"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setShowKey((value) => !value)}
                type="button"
              >
                {showKey ? "Скрыть" : "Показать"}
              </button>
            </div>

            <div className="na-layout">
              <nav className="na-sidebar">
                {SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    className={`na-side-button ${
                      section === item.id ? "active" : ""
                    }`}
                    onClick={() => setSection(item.id)}
                    type="button"
                  >
                    <span className="na-side-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <main className="na-main">
                {busy && (
                  <div
                    style={{
                      padding: "7px 13px",
                      color: "#7fc8ff",
                      fontSize: 10,
                      borderBottom: "1px solid rgba(145,175,220,.14)",
                    }}
                  >
                    Выполняется запрос к серверу...
                  </div>
                )}
                {contentBySection[section]()}
              </main>
            </div>
          </div>
        )}

        {notice && (
          <div className={`na-notice ${noticeError ? "error" : ""}`}>
            {notice}
          </div>
        )}
      </div>
    </>
  );
}
