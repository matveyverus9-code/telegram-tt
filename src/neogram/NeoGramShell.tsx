import React, { useEffect, useState } from "react";
import NeoGramFeedTab from "./NeoGramFeedTab";
import NeoGramGamesTab from "./NeoGramGamesTab";
import NeoGramProfileShop from "./NeoGramProfileShop";
import NeoGramAdminModal from "./NeoGramAdminModal";

type TabId = "feed" | "games" | "chats" | "settings";

type ChatItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unread?: number;
};

type PrankItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: number;
};

type NeoGramShellProps = {
  /** Передайте сюда существующий компонент чатов Telegram. */
  chatsContent?: React.ReactNode;

  /** Открывает конкретный чат средствами существующего приложения. */
  onOpenChat?: (chatId: string) => void;

  /** True только для аккаунта, которому сервер подтвердил статус Создателя. */
  isCreator?: boolean;

  /** Базовый URL Cloudflare Worker для административных запросов. */
  adminApiBase?: string;

  /** Текущий стрик пользователя, полученный с сервера. */
  streakDays?: number;

  /** Обработчик покупки пранка. Реальное списание должно выполняться сервером. */
  onBuyPrank?: (prankId: string, price: number) => void;

  /** Обработчик получения ежедневного огонька. */
  onClaimStreak?: () => void;

  /** Начальная вкладка оболочки. */
  initialTab?: TabId;
};

const CHATS: ChatItem[] = [
  {
    id: "official",
    title: "Официальный канал NeoGram",
    description: "Новости, обновления и объявления проекта",
    icon: "📢",
  },
  {
    id: "general",
    title: "Общий чат",
    description: "Общение участников NeoGram",
    icon: "💬",
  },
];

const PRANKS: PrankItem[] = [
  {
    id: "confetti",
    title: "Конфетти",
    description: "Яркий эффект конфетти для выбранного пользователя.",
    icon: "🎊",
    price: 50,
  },
  {
    id: "shake",
    title: "Тряска",
    description: "Короткий визуальный эффект встряски.",
    icon: "📳",
    price: 100,
  },
  {
    id: "mouse",
    title: "Мышиный переполох",
    description: "Неожиданные мышки на экране получателя.",
    icon: "🐭",
    price: 250,
  },
];

function TabIcon({
  type,
  active,
}: {
  type: TabId;
  active: boolean;
}) {
  const color = active ? "currentColor" : "currentColor";

  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {type === "feed" && (
        <>
          <path
            {...common}
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"
          />
          <path {...common} d="M8 8h8M8 12h8M8 16h5" />
          <path {...common} d="M16.5 16.5h.01" />
        </>
      )}

      {type === "games" && (
        <>
          <path
            {...common}
            d="M7.5 8h9a4 4 0 0 1 3.85 2.92l1.1 4.1A2.3 2.3 0 0 1 17.7 17.5l-2.1-1.7H8.4l-2.1 1.7a2.3 2.3 0 0 1-3.75-2.48l1.1-4.1A4 4 0 0 1 7.5 8Z"
          />
          <path {...common} d="M8 10.5v4M6 12.5h4M16 11.5h.01M18 14h.01" />
        </>
      )}

      {type === "chats" && (
        <>
          <path
            {...common}
            d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2v-5.2A7.5 7.5 0 1 1 20 11.5Z"
          />
          <path {...common} d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" />
        </>
      )}

      {type === "settings" && (
        <>
          <path
            {...common}
            d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
          />
          <path
            {...common}
            d="m19.4 13.5 1.1.85-1.5 2.6-1.3-.5a7.8 7.8 0 0 1-1.5.85l-.2 1.4h-3l-.2-1.4a7.8 7.8 0 0 1-1.5-.85l-1.3.5-1.5-2.6 1.1-.85a7.4 7.4 0 0 1 0-1.7l-1.1-.85 1.5-2.6 1.3.5a7.8 7.8 0 0 1 1.5-.85l.2-1.4h3l.2 1.4a7.8 7.8 0 0 1 1.5.85l1.3-.5 1.5 2.6-1.1.85a7.4 7.4 0 0 1 0 1.7Z"
          />
        </>
      )}
    </svg>
  );
}

export default function NeoGramShell({
  chatsContent,
  onOpenChat,
  isCreator = false,
  adminApiBase,
  streakDays = 0,
  onBuyPrank,
  onClaimStreak,
  initialTab = "feed",
}: NeoGramShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pranksOpen, setPranksOpen] = useState(false);
  const [streakClaimed, setStreakClaimed] = useState(false);
  const [selectedPrank, setSelectedPrank] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (message: string) => {
    setToast(message);
  };

  const claimStreak = () => {
    if (streakClaimed) {
      showToast("Сегодняшний огонёк уже получен.");
      return;
    }

    if (!onClaimStreak) {
      showToast("Получение стрика ещё не подключено к серверу.");
      return;
    }

    onClaimStreak();
    setStreakClaimed(true);
    showToast("Запрос на получение огонька отправлен.");
  };

  const buyPrank = (prank: PrankItem) => {
    if (!onBuyPrank) {
      showToast("Покупка пранков пока не подключена к серверу.");
      return;
    }

    onBuyPrank(prank.id, prank.price);
    setSelectedPrank(prank.id);
    showToast(`Запрос на покупку «${prank.title}» отправлен.`);
  };

  const renderChats = () => (
    <div className="ng-shell-chats">
      <div className="ng-shell-section-heading">
        <div>
          <h2>Чаты</h2>
          <p>Ваше общение в NeoGram</p>
        </div>
        <span className="ng-shell-online-dot">● Онлайн</span>
      </div>

      <div className="ng-shell-pinned-label">
        <span>📌</span> Закреплённые чаты
      </div>

      {CHATS.map((chat) => (
        <button
          key={chat.id}
          className="ng-shell-chat-row"
          onClick={() => {
            if (onOpenChat) {
              onOpenChat(chat.id);
            } else {
              showToast("Подключите обработчик открытия родного чата в Main.tsx.");
            }
          }}
          type="button"
        >
          <span className="ng-shell-chat-icon">{chat.icon}</span>
          <span className="ng-shell-chat-info">
            <strong>{chat.title}</strong>
            <small>{chat.description}</small>
          </span>
          <span className="ng-shell-chat-arrow">›</span>
        </button>
      ))}

      <div className="ng-shell-native-chat">
        {chatsContent ? (
          chatsContent
        ) : (
          <div className="ng-shell-empty">
            <div className="ng-shell-empty-icon">💬</div>
            <strong>Родные чаты Telegram</strong>
            <p>
              Передайте существующий компонент чатов через свойство
              <code> chatsContent</code>, чтобы отображать его здесь без
              замены оригинальной системы сообщений.
            </p>
          </div>
        )}
      </div>

      <div className="ng-shell-prank-entry">
        <div>
          <strong>😈 Платные пранки</strong>
          <p>Отправляйте друзьям забавные визуальные эффекты.</p>
        </div>
        <button
          className="ng-shell-small-button"
          onClick={() => setPranksOpen(true)}
          type="button"
        >
          Открыть
        </button>
      </div>
    </div>
  );

  return (
    <div className="ng-shell">
      <style>{`
        .ng-shell {
          --ngs-bg: var(--color-background, #080d18);
          --ngs-card: var(--color-background-secondary, #111a2b);
          --ngs-text: var(--color-text, #f5f8ff);
          --ngs-muted: var(--color-text-secondary, #91a0b7);
          --ngs-border: var(--color-borders, rgba(145,170,210,.16));
          --ngs-blue: var(--color-primary, #168cff);
          min-height:100%;
          width:100%;
          min-width:0;
          background:var(--ngs-bg);
          color:var(--ngs-text);
          position:relative;
          font-family:inherit;
          padding-bottom:calc(78px + env(safe-area-inset-bottom, 0px));
          box-sizing:border-box;
        }

        .ng-shell * { box-sizing:border-box; }

        .ng-shell-content {
          width:100%;
          min-width:0;
          min-height:300px;
        }

        .ng-shell-tab-content {
          width:100%;
          min-width:0;
          animation:ngShellAppear .16s ease-out;
        }

        @keyframes ngShellAppear {
          from { opacity:.75; transform:translateY(3px); }
          to { opacity:1; transform:translateY(0); }
        }

        .ng-shell-bottom {
          position:fixed;
          z-index:9000;
          left:0;
          right:0;
          bottom:0;
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:2px;
          padding:7px 8px calc(7px + env(safe-area-inset-bottom, 0px));
          border-top:1px solid var(--ngs-border);
          background:color-mix(in srgb,var(--ngs-card) 91%,transparent);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
        }

        .ng-shell-tab {
          position:relative;
          min-width:0;
          min-height:55px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          gap:3px;
          border:0;
          border-radius:12px;
          background:transparent;
          color:var(--ngs-muted);
          font:inherit;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
        }

        .ng-shell-tab.active {
          color:var(--ngs-blue);
          background:rgba(22,140,255,.09);
        }

        .ng-shell-tab svg { display:block; }
        .ng-shell-tab-label {
          font-size:10px;
          font-weight:750;
          line-height:1.2;
        }

        .ng-shell-tab.active .ng-shell-tab-label { color:var(--ngs-blue); }

        .ng-shell-tab-indicator {
          position:absolute;
          top:3px;
          width:16px;
          height:3px;
          border-radius:5px;
          background:var(--ngs-blue);
        }

        .ng-shell-streak {
          position:fixed;
          z-index:8990;
          right:13px;
          bottom:calc(91px + env(safe-area-inset-bottom, 0px));
          display:flex;
          align-items:center;
          gap:6px;
          border:1px solid rgba(255,137,45,.28);
          border-radius:20px;
          padding:7px 10px;
          color:#ffb36b;
          background:rgba(40,24,20,.92);
          box-shadow:0 5px 18px rgba(0,0,0,.2);
          font-size:11px;
          font-weight:850;
          cursor:pointer;
          -webkit-tap-highlight-color:transparent;
        }

        .ng-shell-streak span:first-child { font-size:16px; }

        .ng-shell-section-heading {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          padding:17px 15px 13px;
        }

        .ng-shell-section-heading h2 {
          margin:0;
          font-size:22px;
          font-weight:900;
          letter-spacing:-.5px;
        }

        .ng-shell-section-heading p {
          color:var(--ngs-muted);
          font-size:12px;
          margin:4px 0 0;
        }

        .ng-shell-online-dot {
          color:#5fda9c;
          font-size:10px;
          font-weight:800;
        }

        .ng-shell-pinned-label {
          display:flex;
          gap:7px;
          align-items:center;
          padding:10px 15px;
          color:var(--ngs-muted);
          font-size:11px;
          font-weight:800;
        }

        .ng-shell-chat-row {
          width:calc(100% - 24px);
          margin:4px 12px;
          padding:12px;
          display:flex;
          align-items:center;
          gap:11px;
          text-align:left;
          border:1px solid var(--ngs-border);
          border-radius:15px;
          background:var(--ngs-card);
          color:var(--ngs-text);
          cursor:pointer;
        }

        .ng-shell-chat-icon {
          width:43px;
          height:43px;
          display:grid;
          place-items:center;
          flex-shrink:0;
          border-radius:14px;
          background:rgba(25,135,255,.14);
          font-size:21px;
        }

        .ng-shell-chat-info {
          flex:1;
          min-width:0;
        }

        .ng-shell-chat-info strong {
          display:block;
          font-size:13px;
          line-height:1.35;
        }

        .ng-shell-chat-info small {
          display:block;
          color:var(--ngs-muted);
          font-size:10px;
          margin-top:4px;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .ng-shell-chat-arrow {
          color:var(--ngs-muted);
          font-size:23px;
        }

        .ng-shell-native-chat {
          min-width:0;
          margin-top:13px;
        }

        .ng-shell-empty {
          margin:12px;
          padding:24px 16px;
          text-align:center;
          border:1px dashed var(--ngs-border);
          border-radius:16px;
          color:var(--ngs-muted);
        }

        .ng-shell-empty-icon { font-size:30px; margin-bottom:9px; }
        .ng-shell-empty strong { display:block; color:var(--ngs-text); font-size:13px; }
        .ng-shell-empty p { font-size:11px; line-height:1.6; }
        .ng-shell-empty code { color:#72bfff; }

        .ng-shell-prank-entry {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin:15px 12px;
          padding:13px;
          border:1px solid rgba(155,100,255,.25);
          border-radius:15px;
          background:linear-gradient(120deg,rgba(111,55,180,.12),rgba(25,40,75,.25));
        }

        .ng-shell-prank-entry strong { font-size:12px; }
        .ng-shell-prank-entry p {
          margin:5px 0 0;
          color:var(--ngs-muted);
          font-size:10px;
        }

        .ng-shell-small-button {
          flex-shrink:0;
          padding:9px 12px;
          border:0;
          border-radius:10px;
          color:white;
          background:linear-gradient(120deg,#8952dc,#4c56c8);
          font:inherit;
          font-size:10px;
          font-weight:850;
          cursor:pointer;
        }

        .ng-shell-modal-backdrop {
          position:fixed;
          z-index:9500;
          inset:0;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding:12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
          background:rgba(0,0,0,.62);
          backdrop-filter:blur(5px);
        }

        .ng-shell-prank-modal {
          width:min(480px,100%);
          max-height:min(80dvh,650px);
          overflow:auto;
          padding:17px;
          border:1px solid var(--ngs-border);
          border-radius:22px;
          background:var(--ngs-card);
          box-shadow:0 18px 70px rgba(0,0,0,.5);
        }

        .ng-shell-modal-header {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:14px;
        }

        .ng-shell-modal-header h3 {
          margin:0;
          font-size:17px;
        }

        .ng-shell-close {
          width:32px;
          height:32px;
          border:1px solid var(--ngs-border);
          border-radius:10px;
          color:var(--ngs-text);
          background:rgba(255,255,255,.05);
          font-size:17px;
          cursor:pointer;
        }

        .ng-shell-prank-card {
          display:flex;
          align-items:center;
          gap:11px;
          padding:12px 0;
          border-bottom:1px solid var(--ngs-border);
        }

        .ng-shell-prank-icon {
          width:43px;
          height:43px;
          display:grid;
          place-items:center;
          border-radius:13px;
          background:rgba(125,90,220,.15);
          font-size:21px;
          flex-shrink:0;
        }

        .ng-shell-prank-info { min-width:0; flex:1; }
        .ng-shell-prank-info strong { display:block; font-size:12px; }
        .ng-shell-prank-info p {
          margin:4px 0 0;
          color:var(--ngs-muted);
          font-size:10px;
          line-height:1.4;
        }

        .ng-shell-prank-buy {
          padding:8px 10px;
          border:0;
          border-radius:9px;
          background:linear-gradient(120deg,#8952dc,#4c56c8);
          color:white;
          font:inherit;
          font-size:10px;
          font-weight:850;
          white-space:nowrap;
          cursor:pointer;
        }

        .ng-shell-prank-buy:disabled { opacity:.55; }

        .ng-shell-toast {
          position:fixed;
          z-index:10000;
          left:50%;
          bottom:calc(160px + env(safe-area-inset-bottom, 0px));
          transform:translateX(-50%);
          max-width:calc(100vw - 30px);
          width:max-content;
          padding:11px 15px;
          border:1px solid rgba(70,150,255,.35);
          border-radius:12px;
          background:#142640;
          color:white;
          box-shadow:0 8px 30px rgba(0,0,0,.35);
          font-size:11px;
          font-weight:750;
          text-align:center;
        }

        @media(min-width:700px) {
          .ng-shell-bottom {
            left:50%;
            right:auto;
            width:min(560px,calc(100vw - 32px));
            transform:translateX(-50%);
            bottom:12px;
            border:1px solid var(--ngs-border);
            border-radius:18px;
            padding-bottom:7px;
          }

          .ng-shell {
            padding-bottom:100px;
          }

          .ng-shell-streak {
            bottom:100px;
          }
        }

        @media(prefers-reduced-motion:reduce) {
          .ng-shell-tab-content { animation:none; }
        }
      `}</style>

      <main className="ng-shell-content">
        {activeTab === "feed" && (
          <div className="ng-shell-tab-content">
            <NeoGramFeedTab />
          </div>
        )}

        {activeTab === "games" && (
          <div className="ng-shell-tab-content">
            <NeoGramGamesTab />
          </div>
        )}

        {activeTab === "chats" && (
          <div className="ng-shell-tab-content">{renderChats()}</div>
        )}

        {activeTab === "settings" && (
          <div className="ng-shell-tab-content">
            <NeoGramProfileShop />
          </div>
        )}
      </main>

      <button
        className="ng-shell-streak"
        onClick={claimStreak}
        type="button"
        title="Ежедневный огонёк"
      >
        <span>🔥</span>
        <span>{streakDays} дн.</span>
        <span>{streakClaimed ? "✓" : "+"}</span>
      </button>

      <nav className="ng-shell-bottom" aria-label="Основная навигация">
        {(
          [
            ["feed", "Лента"],
            ["games", "Игры"],
            ["chats", "Чаты"],
            ["settings", "Настройки"],
          ] as [TabId, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={`ng-shell-tab ${activeTab === id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(id);
              setPranksOpen(false);
            }}
            type="button"
            aria-label={label}
            aria-current={activeTab === id ? "page" : undefined}
          >
            {activeTab === id && (
              <span className="ng-shell-tab-indicator" />
            )}
            <TabIcon type={id} active={activeTab === id} />
            <span className="ng-shell-tab-label">{label}</span>
          </button>
        ))}
      </nav>

      {isCreator && (
        <NeoGramAdminModal
          apiBase={adminApiBase}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {isCreator && !adminOpen && (
        <button
          className="ng-shell-admin-launch"
          onClick={() => setAdminOpen(true)}
          type="button"
          aria-label="Админка BOSS777"
          title="Админка BOSS777"
        >
          <span>⚙</span>
          <small>BOSS777</small>
        </button>
      )}

      {pranksOpen && (
        <div
          className="ng-shell-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPranksOpen(false);
            }
          }}
        >
          <section
            className="ng-shell-prank-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Платные пранки"
          >
            <div className="ng-shell-modal-header">
              <h3>😈 Платные пранки</h3>
              <button
                className="ng-shell-close"
                onClick={() => setPranksOpen(false)}
                type="button"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <p style={{ color: "var(--ngs-muted)", fontSize: 11 }}>
              Выберите эффект. Цена указана в GRAM. Списание и отправка
              должны подтверждаться сервером.
            </p>

            {PRANKS.map((prank) => (
              <div className="ng-shell-prank-card" key={prank.id}>
                <div className="ng-shell-prank-icon">{prank.icon}</div>
                <div className="ng-shell-prank-info">
                  <strong>{prank.title}</strong>
                  <p>{prank.description}</p>
                  <p>◆ {prank.price} GRAM</p>
                </div>
                <button
                  className="ng-shell-prank-buy"
                  disabled={selectedPrank === prank.id}
                  onClick={() => buyPrank(prank)}
                  type="button"
                >
                  {selectedPrank === prank.id ? "Отправлено" : "Купить"}
                </button>
              </div>
            ))}
          </section>
        </div>
      )}

      {toast && <div className="ng-shell-toast">{toast}</div>}
    </div>
  );
}
