
import { useState } from '../lib/teact/teact';
import { adminApiGet, adminApiPost } from './api';

type AdminSection = 'dashboard' | 'users' | 'economy' | 'gifts' | 'numbers';

type AdminResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
};

type Props = {
  apiBase?: string;
  onClose?: () => void;
};

const SECTIONS: { id: AdminSection; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Обзор', icon: '⌂' },
  { id: 'users', label: 'Игроки', icon: '♙' },
  { id: 'economy', label: 'Экономика', icon: '◆' },
  { id: 'gifts', label: 'Подарки', icon: '♢' },
  { id: 'numbers', label: 'Номера', icon: '№' },
];

export default function NeoGramAdminModal({ onClose }: Props) {
  const [opened, setOpened] = useState(false);
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [lastResult, setLastResult] = useState<AdminResult | null>(null);

  const [dashboard, setDashboard] = useState<AdminResult | null>(null);
  const [users, setUsers] = useState<Record<string, any>[]>([]);

  const [targetUser, setTargetUser] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceCurrency, setBalanceCurrency] = useState<'gram' | 'stars'>('gram');
  const [userAction, setUserAction] = useState<'ban' | 'unban' | 'verify' | 'unverify'>('ban');

  const [economyAction, setEconomyAction] = useState<'mint' | 'burn'>('mint');
  const [economyAmount, setEconomyAmount] = useState('');

  const [giftName, setGiftName] = useState('');
  const [giftDescription, setGiftDescription] = useState('');
  const [giftPrice, setGiftPrice] = useState('1000');
  const [giftSupply, setGiftSupply] = useState('100');
  const [giftSkin, setGiftSkin] = useState('3d');
  const [giftIcon, setGiftIcon] = useState('🎁');
  const [giftImage, setGiftImage] = useState('');
  const [giftLimited, setGiftLimited] = useState(false);

  const [numberType, setNumberType] = useState<'666' | '777'>('666');
  const [numberPrice, setNumberPrice] = useState('666');
  const [numberOwner, setNumberOwner] = useState('');
  const [exactNumbers, setExactNumbers] = useState('');

  const notify = (message: string, error = false) => {
    setNotice(message);
    setNoticeError(error);
  };

  const request = async (
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>,
  ): Promise<AdminResult | null> => {
    if (!adminKey.trim()) {
      notify('Введите административный ключ.', true);
      return null;
    }

    setBusy(true);
    setLastResult(null);

    try {
      const result = method === 'GET'
        ? await adminApiGet<AdminResult>(path, adminKey.trim())
        : await adminApiPost<AdminResult>(path, adminKey.trim(), body || {});

      if (result.ok === false) {
        throw new Error(result.error || 'Операция отклонена сервером.');
      }

      setLastResult(result);
      notify(result.message || 'Ответ сервера получен.');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка запроса.';
      notify(message, true);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadDashboard = async () => {
    const result = await request('/admin/dashboard');
    if (result) setDashboard(result);
  };

  const loadUsers = async () => {
    const result = await request('/admin/users');
    if (result) {
      setUsers(Array.isArray(result.users) ? result.users : []);
    }
  };

  const updateUserBalance = async () => {
    if (!targetUser.trim()) {
      notify('Укажите ID или username пользователя.', true);
      return;
    }

    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Введите сумму больше нуля.', true);
      return;
    }

    const result = await request('/admin/users/balance', 'POST', {
      user: targetUser.trim(),
      amount,
      currency: balanceCurrency,
    });

    if (result) {
      setBalanceAmount('');
      await loadUsers();
    }
  };

  const moderateUser = async () => {
    const id = Number(targetUser.trim());

    if (!Number.isInteger(id) || id < 1) {
      notify('Для модерации укажите числовой ID пользователя.', true);
      return;
    }

    const result = await request(`/admin/users/${id}/${userAction}`, 'POST');
    if (result) await loadUsers();
  };

  const runEconomyAction = async () => {
    const amount = Number(economyAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify('Введите корректную сумму GRAM.', true);
      return;
    }

    const result = await request('/admin/economy/adjust', 'POST', {
      action: economyAction,
      amount,
    });

    if (result) setEconomyAmount('');
  };

  const createGift = async () => {
    if (!giftName.trim()) {
      notify('Введите название подарка.', true);
      return;
    }

    const price = Number(giftPrice);
    const supply = Number(giftSupply);

    if (!Number.isFinite(price) || price < 0) {
      notify('Некорректная цена.', true);
      return;
    }

    if (!Number.isInteger(supply) || supply < 0) {
      notify('Тираж должен быть целым числом от нуля.', true);
      return;
    }

    const result = await request('/admin/gifts/create', 'POST', {
      name: giftName.trim(),
      description: giftDescription.trim(),
      priceGram: price,
      supply,
      skin: giftSkin,
      icon: giftIcon,
      image: giftImage.trim(),
      limited: giftLimited,
    });

    if (result) {
      setGiftName('');
      setGiftDescription('');
      notify('Подарок добавлен в серверный каталог.');
    }
  };

  const issueNumbers = async () => {
    const price = Number(numberPrice);
    const numbers = exactNumbers
      .split(/[\n,;]+/)
      .map((value) => value.trim().replace(/\s/g, ''))
      .filter(Boolean);

    if (!numbers.length) {
      notify('Вставьте конкретные номера, каждый с новой строки.', true);
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      notify('Цена номера должна быть больше нуля.', true);
      return;
    }

    const result = await request('/admin/fragment/numbers/issue', 'POST', {
      number: numberType,
      numbers,
      priceGram: price,
      owner: numberOwner.trim(),
    });

    if (result) {
      setExactNumbers('');
      notify(`Выпущено номеров: ${(result.issued || []).length}.`);
    }
  };

  const closePanel = () => {
    setOpened(false);
    onClose?.();
  };

  const renderDashboard = () => (
    <div className="na-content">
      <div className="na-heading">
        <div>
          <h3>Панель управления</h3>
          <p>Показатели из базы NeoGram.</p>
        </div>
        <button className="na-button na-muted" onClick={loadDashboard} disabled={busy}>
          ↻ Обновить
        </button>
      </div>

      <div className="na-stats">
        <div className="na-stat">
          <span>Пользователи</span>
          <strong>{dashboard?.users ?? '—'}</strong>
        </div>
        <div className="na-stat">
          <span>Онлайн</span>
          <strong>{dashboard?.online ?? '—'}</strong>
        </div>
        <div className="na-stat">
          <span>GRAM в системе</span>
          <strong>{dashboard?.gram_supply ?? '—'}</strong>
        </div>
        <div className="na-stat">
          <span>Открытые жалобы</span>
          <strong>{Array.isArray(dashboard?.reports) ? dashboard.reports.length : '—'}</strong>
        </div>
      </div>

      <div className="na-info">
        Статистика загружается непосредственно из Worker и D1. Нажмите «Обновить», чтобы получить актуальные данные.
      </div>

      {Array.isArray(dashboard?.reports) && dashboard.reports.length > 0 && (
        <>
          <h4>Открытые жалобы</h4>
          {dashboard.reports.map((report: any) => (
            <div className="na-row" key={report.id}>
              <strong>Жалоба #{report.id}</strong>
              <span>{report.reason || report.description || 'Без описания'}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="na-content">
      <div className="na-heading">
        <div>
          <h3>Пользователи</h3>
          <p>Баланс, блокировки и значок создателя.</p>
        </div>
        <button className="na-button na-muted" onClick={loadUsers} disabled={busy}>
          ↻ Загрузить
        </button>
      </div>

      <label className="na-label">
        ID или username
        <input className="na-input" value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="ID или @username" />
      </label>

      <h4>Изменение баланса</h4>
      <div className="na-grid-two">
        <label className="na-label">
          Валюта
          <select className="na-input" value={balanceCurrency} onChange={(e) => setBalanceCurrency(e.target.value as 'gram' | 'stars')}>
            <option value="gram">GRAM</option>
            <option value="stars">Stars</option>
          </select>
        </label>
        <label className="na-label">
          Сумма
          <input className="na-input" type="number" min="0" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="1000" />
        </label>
      </div>
      <button className="na-button na-primary na-wide" onClick={updateUserBalance} disabled={busy}>
        Изменить баланс
      </button>

      <div className="na-divider" />
      <h4>Модерация аккаунта</h4>
      <label className="na-label">
        Действие
        <select className="na-input" value={userAction} onChange={(e) => setUserAction(e.target.value as typeof userAction)}>
          <option value="ban">Заблокировать на 24 часа</option>
          <option value="unban">Снять блокировку</option>
          <option value="verify">Выдать значок создателя</option>
          <option value="unverify">Снять значок создателя</option>
        </select>
      </label>
      <button className="na-button na-danger na-wide" onClick={moderateUser} disabled={busy}>
        Выполнить действие по ID
      </button>

      <div className="na-divider" />
      <h4>Последние пользователи</h4>
      {users.length === 0 ? (
        <div className="na-empty">Нажмите «Загрузить».</div>
      ) : users.map((user) => (
        <div className="na-user" key={user.id}>
          <div>
            <strong>#{user.id} {user.username ? `@${user.username}` : ''}</strong>
            <span>{user.phone || 'Номер не указан'}</span>
          </div>
          <div className="na-user-balance">
            <strong>{user.gram ?? 0} GRAM</strong>
            <span>{user.stars ?? 0} Stars</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEconomy = () => (
    <div className="na-content">
      <h3>Экономика GRAM</h3>
      <p className="na-subtitle">Глобальное начисление или сжигание GRAM.</p>

      <div className="na-warning">
        Операция затрагивает балансы пользователей на сервере. Проверяйте сумму перед подтверждением.
      </div>

      <label className="na-label">
        Операция
        <select className="na-input" value={economyAction} onChange={(e) => setEconomyAction(e.target.value as 'mint' | 'burn')}>
          <option value="mint">Начислить GRAM</option>
          <option value="burn">Сжечь GRAM</option>
        </select>
      </label>

      <label className="na-label">
        Количество GRAM
        <input className="na-input" type="number" min="1" value={economyAmount} onChange={(e) => setEconomyAmount(e.target.value)} placeholder="Введите сумму" />
      </label>

      <button className="na-button na-primary na-wide" onClick={runEconomyAction} disabled={busy}>
        Подтвердить операцию
      </button>

      <div className="na-info">
        Сервер поддерживает операции <b>mint</b> и <b>burn</b>. Изменения выполняются в D1.
      </div>
    </div>
  );

  const renderGifts = () => (
    <div className="na-content">
      <h3>Создание подарка</h3>
      <p className="na-subtitle">Добавление подарка во внутренний каталог NeoGram.</p>

      <div className="na-gift-preview">
        <div className="na-gift-icon">{giftIcon || '🎁'}</div>
        <div>
          <strong>{giftName || 'Новый подарок'}</strong>
          <span>{giftPrice || '0'} GRAM · тираж {giftSupply || '0'}</span>
        </div>
      </div>

      <label className="na-label">
        Название
        <input className="na-input" value={giftName} maxLength={80} onChange={(e) => setGiftName(e.target.value)} placeholder="Неоновая корона" />
      </label>

      <label className="na-label">
        Описание
        <textarea className="na-input na-textarea" value={giftDescription} onChange={(e) => setGiftDescription(e.target.value)} placeholder="Описание подарка" />
      </label>

      <div className="na-grid-two">
        <label className="na-label">
          Цена, GRAM
          <input className="na-input" type="number" min="0" value={giftPrice} onChange={(e) => setGiftPrice(e.target.value)} />
        </label>
        <label className="na-label">
          Тираж
          <input className="na-input" type="number" min="0" value={giftSupply} onChange={(e) => setGiftSupply(e.target.value)} />
        </label>
      </div>

      <div className="na-grid-two">
        <label className="na-label">
          Иконка
          <input className="na-input" value={giftIcon} maxLength={8} onChange={(e) => setGiftIcon(e.target.value)} />
        </label>
        <label className="na-label">
          Скин
          <select className="na-input" value={giftSkin} onChange={(e) => setGiftSkin(e.target.value)}>
            <option value="3d">3D</option>
            <option value="neon">Neon</option>
            <option value="gold">Gold</option>
            <option value="diamond">Diamond</option>
          </select>
        </label>
      </div>

      <label className="na-label">
        URL изображения (необязательно)
        <input className="na-input" value={giftImage} onChange={(e) => setGiftImage(e.target.value)} placeholder="https://..." />
      </label>

      <label className="na-check">
        <input type="checkbox" checked={giftLimited} onChange={(e) => setGiftLimited(e.target.checked)} />
        Ограниченный выпуск
      </label>

      <button className="na-button na-primary na-wide" onClick={createGift} disabled={busy}>
        Создать подарок
      </button>
      <div className="na-info">
        Подарок и его параметры сохраняются на Worker. Визуальная модель рулетки определяется серверной логикой подарков.
      </div>
    </div>
  );

  const renderNumbers = () => (
    <div className="na-content">
      <h3>Выпуск редких номеров</h3>
      <p className="na-subtitle">Только ручной выпуск конкретных номеров. Автогенерации нет.</p>

      <div className="na-number-types">
        <button className={numberType === '666' ? 'selected' : ''} onClick={() => setNumberType('666')}>
          <span>Серия</span>
          <strong>+666</strong>
          <small>Лимит 5 номеров</small>
        </button>
        <button className={numberType === '777' ? 'selected' : ''} onClick={() => setNumberType('777')}>
          <span>Серия</span>
          <strong>+777</strong>
          <small>Лимит 10 номеров</small>
        </button>
      </div>

      <label className="na-label">
        Точные номера, каждый с новой строки
        <textarea className="na-input na-textarea na-numbers" value={exactNumbers} onChange={(e) => setExactNumbers(e.target.value)} placeholder={numberType === '666' ? '+666 1234\n+666 5678' : '+777 1234\n+777 5678'} />
      </label>

      <label className="na-label">
        Цена за каждый номер, GRAM
        <input className="na-input" type="number" min="1" value={numberPrice} onChange={(e) => setNumberPrice(e.target.value)} />
      </label>

      <label className="na-label">
        Получатель (необязательно)
        <input className="na-input" value={numberOwner} onChange={(e) => setNumberOwner(e.target.value)} placeholder="ID или @username" />
      </label>

      <button className="na-button na-primary na-wide" onClick={issueNumbers} disabled={busy}>
        Выпустить указанные номера
      </button>

      <div className="na-warning">
        Worker проверяет формат, уникальность и общий лимит серии. Номера не создаются автоматически. Внешняя интеграция Fragment не используется.
      </div>
    </div>
  );

  const content: Record<AdminSection, () => any> = {
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
          --na-bg:#080d18;
          --na-panel:#101a2b;
          --na-text:#f3f7ff;
          --na-muted:#91a1bb;
          --na-border:rgba(145,175,220,.18);
          color:var(--na-text);
          font-family:inherit;
        }
        .ng-admin-root * { box-sizing:border-box; }
        .na-launcher {
          position:fixed; z-index:9990; right:16px;
          bottom:calc(18px + env(safe-area-inset-bottom,0px));
          width:53px;height:53px;border:1px solid rgba(110,190,255,.5);
          border-radius:18px;background:linear-gradient(145deg,#168fff,#1536a9);
          box-shadow:0 8px 30px rgba(0,100,255,.35);
          color:white;font-size:22px;font-weight:900;cursor:pointer;
        }
        .na-panel {
          position:fixed;z-index:9991;inset:8px;
          width:auto;height:auto;display:flex;flex-direction:column;
          overflow:hidden;border:1px solid rgba(72,153,255,.35);
          border-radius:19px;background:var(--na-bg);
          box-shadow:0 22px 80px rgba(0,0,0,.62);
          color:var(--na-text);
        }
        .na-topbar {
          display:flex;align-items:center;justify-content:space-between;
          gap:10px;padding:12px 14px;min-height:58px;
          border-bottom:1px solid var(--na-border);
          background:linear-gradient(110deg,#10264a,#10192d);
        }
        .na-brand {display:flex;align-items:center;gap:10px;}
        .na-brand-icon {
          width:35px;height:35px;display:grid;place-items:center;
          border-radius:11px;background:linear-gradient(140deg,#1b9cff,#1838b8);
          font-size:18px;font-weight:950;
        }
        .na-brand strong {display:block;font-size:13px;letter-spacing:.4px;}
        .na-brand span {display:block;color:#80baff;font-size:9px;margin-top:3px;}
        .na-top-actions {display:flex;gap:6px;}
        .na-icon-button {
          width:34px;height:34px;border:1px solid var(--na-border);
          border-radius:10px;background:rgba(255,255,255,.06);
          color:white;font-size:18px;cursor:pointer;
        }
        .na-auth {
          display:flex;gap:8px;padding:9px 11px;
          background:#0b1424;border-bottom:1px solid var(--na-border);
        }
        .na-auth input {
          min-width:0;flex:1;border:1px solid var(--na-border);
          border-radius:9px;background:#111e33;color:white;
          padding:10px;font:inherit;font-size:16px;outline:none;
        }
        .na-auth button {
          border:1px solid var(--na-border);background:#172944;color:white;
          border-radius:9px;padding:8px 10px;font:inherit;font-size:11px;
        }
        .na-layout {display:flex;flex:1;min-height:0;}
        .na-sidebar {
          width:112px;flex-shrink:0;padding:9px 6px;
          border-right:1px solid var(--na-border);
          background:#0c1423;overflow-y:auto;
        }
        .na-side-button {
          width:100%;display:flex;align-items:center;gap:7px;
          text-align:left;padding:11px 7px;margin-bottom:5px;
          border:1px solid transparent;border-radius:10px;
          background:transparent;color:var(--na-muted);
          font:inherit;font-size:11px;font-weight:750;
        }
        .na-side-button.active {
          color:white;border-color:rgba(38,147,255,.32);
          background:linear-gradient(110deg,rgba(0,130,255,.25),rgba(40,70,170,.15));
        }
        .na-side-icon {width:18px;text-align:center;font-size:16px;}
        .na-main {min-width:0;flex:1;overflow-y:auto;overscroll-behavior:contain;}
        .na-content {padding:14px;max-width:680px;margin:0 auto;}
        .na-heading {display:flex;justify-content:space-between;align-items:center;gap:8px;}
        .na-content h3 {margin:0;font-size:17px;font-weight:900;}
        .na-content h4 {font-size:13px;margin:17px 0 9px;}
        .na-subtitle,.na-heading p {margin:5px 0 13px;color:var(--na-muted);font-size:11px;line-height:1.5;}
        .na-stats {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px;}
        .na-stat {padding:13px;border:1px solid var(--na-border);border-radius:13px;background:linear-gradient(145deg,#13243d,#0d1728);}
        .na-stat span {display:block;color:var(--na-muted);font-size:10px;}
        .na-stat strong {display:block;margin-top:8px;font-size:21px;overflow-wrap:anywhere;}
        .na-button {
          border:1px solid transparent;border-radius:10px;padding:11px 13px;
          color:white;font:inherit;font-size:12px;font-weight:850;cursor:pointer;
        }
        .na-button:disabled {opacity:.5;}
        .na-primary {background:linear-gradient(120deg,#087fff,#2545c4);}
        .na-muted {background:#182942;border-color:var(--na-border);}
        .na-danger {background:linear-gradient(120deg,#bd344d,#80203b);}
        .na-wide {width:100%;margin-top:10px;}
        .na-label {display:flex;flex-direction:column;gap:7px;margin:13px 0;color:#aabbd4;font-size:11px;font-weight:750;}
        .na-input {
          display:block;width:100%;min-width:0;border:1px solid var(--na-border);
          border-radius:10px;padding:11px;background:#0c1627;color:white;
          font:inherit;font-size:16px;outline:none;
        }
        .na-input:focus,.na-auth input:focus {border-color:#238fff;box-shadow:0 0 0 2px rgba(35,143,255,.1);}
        .na-textarea {min-height:80px;resize:vertical;}
        .na-grid-two {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
        .na-divider {height:1px;background:var(--na-border);margin:17px 0;}
        .na-info,.na-warning {
          padding:12px;margin-top:13px;border:1px solid var(--na-border);
          border-radius:12px;background:rgba(40,95,160,.1);
          font-size:11px;line-height:1.55;
        }
        .na-warning {color:#ffd58b;border-color:rgba(255,175,55,.25);background:rgba(255,165,30,.07);}
        .na-check {display:flex;align-items:center;gap:9px;margin:14px 0;color:#c1cee0;font-size:12px;}
        .na-check input {width:18px;height:18px;accent-color:#168dff;}
        .na-gift-preview {display:flex;align-items:center;gap:12px;padding:12px;margin:14px 0;border:1px solid rgba(35,140,255,.28);border-radius:13px;background:rgba(0,115,255,.1);}
        .na-gift-icon {width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:#122c50;font-size:26px;}
        .na-gift-preview strong,.na-gift-preview span {display:block;}
        .na-gift-preview span {margin-top:4px;color:var(--na-muted);font-size:10px;}
        .na-number-types {display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0;}
        .na-number-types button {padding:13px 8px;border:1px solid var(--na-border);border-radius:13px;background:#101e33;color:white;}
        .na-number-types button.selected {border-color:#168dff;background:rgba(0,125,255,.2);}
        .na-number-types span,.na-number-types small {display:block;color:var(--na-muted);font-size:10px;}
        .na-number-types strong {display:block;margin:5px 0;font-size:25px;}
        .na-numbers {min-height:120px;font-family:monospace;}
        .na-empty {padding:18px;text-align:center;color:var(--na-muted);border:1px dashed var(--na-border);border-radius:10px;font-size:11px;}
        .na-user,.na-row {display:flex;justify-content:space-between;align-items:center;gap:9px;padding:10px;margin-top:7px;border:1px solid var(--na-border);border-radius:10px;background:rgba(255,255,255,.025);}
        .na-user strong,.na-user span,.na-row strong,.na-row span {display:block;font-size:10px;overflow-wrap:anywhere;}
        .na-user span,.na-row span {color:var(--na-muted);margin-top:4px;}
        .na-user-balance {text-align:right;white-space:nowrap;}
        .na-user-balance strong {color:#77c8ff;}
        .na-notice {
          position:fixed;z-index:10000;left:50%;
          bottom:calc(16px + env(safe-area-inset-bottom,0px));
          transform:translateX(-50%);width:max-content;
          max-width:calc(100vw - 24px);padding:11px 14px;
          border:1px solid rgba(65,155,255,.4);border-radius:11px;
          background:#10233e;color:white;box-shadow:0 8px 28px rgba(0,0,0,.4);
          font-size:11px;font-weight:750;text-align:center;
        }
        .na-notice.error {border-color:rgba(255,90,110,.5);background:#401b2b;}
        @media(max-width:420px) {
          .na-sidebar {width:94px;padding:8px 4px;}
          .na-side-button {gap:5px;padding:10px 5px;font-size:10px;}
          .na-content {padding:11px;}
          .na-grid-two {gap:7px;}
        }
      `}</style>

      <div className="ng-admin-root">
        {!opened && (
          <button className="na-launcher" onClick={() => setOpened(true)} type="button" aria-label="Открыть админку">
            ⚙
          </button>
        )}

        {opened && (
          <div className="na-panel">
            <div className="na-topbar">
              <div className="na-brand">
                <div className="na-brand-icon">N</div>
                <div>
                  <strong>NEOGRAM ADMIN</strong>
                  <span>BOSS777 · CONTROL CENTER</span>
                </div>
              </div>
              <div className="na-top-actions">
                <button className="na-icon-button" onClick={closePanel} type="button" aria-label="Закрыть">×</button>
              </div>
            </div>

            <div className="na-auth">
              <input
                type={showKey ? 'text' : 'password'}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Административный ключ"
                autoComplete="off"
                spellCheck={false}
              />
              <button onClick={() => setShowKey((value) => !value)} type="button">
                {showKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>

            <div className="na-layout">
              <nav className="na-sidebar">
                {SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    className={`na-side-button ${section === item.id ? 'active' : ''}`}
                    onClick={() => setSection(item.id)}
                    type="button"
                  >
                    <span className="na-side-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <main className="na-main">
                {busy && <div style={{ padding: '9px 13px', color: '#7fc8ff', fontSize: 11 }}>Запрос к серверу...</div>}
                {content[section]()}
                {lastResult && (
                  <div className="na-content">
                    <h4>Последний ответ Worker</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 10, color: '#9ed1ff', background: '#050a12', padding: 10, borderRadius: 9 }}>
                      {JSON.stringify(lastResult, null, 2)}
                    </pre>
                  </div>
                )}
              </main>
            </div>
          </div>
        )}

        {notice && (
          <div className={`na-notice ${noticeError ? 'error' : ''}`}>
            {notice}
          </div>
        )}
      </div>
    </>
  );
}
