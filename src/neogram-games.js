
const API_BASE = 'https://tg-api.matveyverus9.workers.dev';

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

const readBest = () => {
  try {
    return Number(localStorage.getItem('neogram_game_best') || 0);
  } catch {
    return 0;
  }
};

const saveBest = (score) => {
  try {
    localStorage.setItem('neogram_game_best', String(score));
  } catch {
    // Local storage may be unavailable.
  }
};

async function request(path, options = {}) {
  const token = (() => {
    try {
      return localStorage.getItem('neogram_token') || '';
    } catch {
      return '';
    }
  })();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Ошибка сервера: ${response.status}`);
  }

  return data;
}

export function renderGamesModule(options = {}) {
  const best = readBest();

  return `
    <section class="ngg-root">
      <style>
        .ngg-root {
          width: 100%;
          color: var(--text, #111);
          font-family: inherit;
        }

        .ngg-root * {
          box-sizing: border-box;
        }

        .ngg-hero {
          position: relative;
          overflow: hidden;
          padding: 22px;
          border-radius: 25px;
          background: linear-gradient(135deg, #725cff, #a34ce8 60%, #ed6ca7);
          color: #fff;
          margin-bottom: 16px;
        }

        .ngg-hero::after {
          content: "✦";
          position: absolute;
          right: 20px;
          top: 4px;
          font-size: 100px;
          opacity: .14;
          transform: rotate(15deg);
          pointer-events: none;
        }

        .ngg-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          opacity: .8;
        }

        .ngg-hero h2 {
          position: relative;
          z-index: 1;
          margin: 8px 0 5px;
          font-size: 27px;
          font-weight: 850;
          letter-spacing: -.8px;
        }

        .ngg-hero p {
          position: relative;
          z-index: 1;
          margin: 0;
          font-size: 13px;
          opacity: .86;
        }

        .ngg-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .ngg-stat {
          min-width: 0;
          padding: 15px;
          border: 1px solid var(--border, rgba(128,128,128,.18));
          border-radius: 19px;
          background: var(--card, rgba(128,128,128,.07));
        }

        .ngg-stat-label {
          color: var(--muted, #888);
          font-size: 12px;
          font-weight: 600;
        }

        .ngg-stat-value {
          margin-top: 5px;
          font-size: 24px;
          line-height: 1.2;
          font-weight: 850;
          font-variant-numeric: tabular-nums;
        }

        .ngg-card {
          padding: 17px;
          margin-bottom: 14px;
          border: 1px solid var(--border, rgba(128,128,128,.18));
          border-radius: 22px;
          background: var(--card, rgba(128,128,128,.07));
        }

        .ngg-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 13px;
        }

        .ngg-card-title {
          font-size: 17px;
          font-weight: 800;
        }

        .ngg-pill {
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(115, 91, 255, .13);
          color: #927cff;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .ngg-tap-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 0 8px;
        }

        .ngg-tap-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: min(60vw, 220px);
          height: min(60vw, 220px);
          max-width: 220px;
          max-height: 220px;
          border: 0;
          border-radius: 50%;
          color: #fff;
          background: radial-gradient(circle at 35% 25%, #b4a5ff, #7659ff 55%, #5639d6);
          box-shadow:
            0 12px 0 #4931b4,
            0 18px 30px rgba(100, 75, 240, .28),
            inset 0 4px 10px rgba(255,255,255,.25);
          font-size: 65px;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform .08s ease, box-shadow .08s ease;
        }

        .ngg-tap-button:active {
          transform: translateY(8px) scale(.97);
          box-shadow:
            0 4px 0 #4931b4,
            0 9px 18px rgba(100, 75, 240, .2),
            inset 0 4px 10px rgba(255,255,255,.25);
        }

        .ngg-tap-button:disabled {
          opacity: .55;
          cursor: default;
        }

        .ngg-score {
          margin-top: 20px;
          font-size: 38px;
          font-weight: 900;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        .ngg-score-caption {
          margin-top: 6px;
          color: var(--muted, #888);
          font-size: 12px;
        }

        .ngg-timer {
          width: 100%;
          height: 8px;
          overflow: hidden;
          margin-top: 18px;
          border-radius: 20px;
          background: rgba(128,128,128,.16);
        }

        .ngg-timer-fill {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #7659ff, #e56db5);
          transition: width .1s linear;
        }

        .ngg-time {
          margin-top: 9px;
          color: var(--muted, #888);
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .ngg-actions {
          display: flex;
          gap: 9px;
          width: 100%;
          margin-top: 17px;
        }

        .ngg-button {
          flex: 1;
          min-height: 44px;
          padding: 11px 14px;
          border: 0;
          border-radius: 14px;
          background: #7659ff;
          color: white;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .ngg-button.secondary {
          background: rgba(128,128,128,.13);
          color: var(--text, #111);
        }

        .ngg-button:disabled {
          opacity: .45;
          cursor: default;
        }

        .ngg-message {
          min-height: 18px;
          margin-top: 11px;
          color: var(--muted, #888);
          text-align: center;
          font-size: 12px;
        }

        .ngg-leaderboard {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ngg-player {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 11px 2px;
          border-bottom: 1px solid var(--border, rgba(128,128,128,.12));
        }

        .ngg-player:last-child {
          border-bottom: 0;
        }

        .ngg-rank {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          border-radius: 10px;
          background: rgba(128,128,128,.12);
          font-size: 12px;
          font-weight: 900;
        }

        .ngg-rank.first {
          color: #9a6b00;
          background: #ffdf83;
        }

        .ngg-rank.second {
          color: #555;
          background: #dce0e7;
        }

        .ngg-rank.third {
          color: #8d542b;
          background: #e9b58e;
        }

        .ngg-player-info {
          flex: 1;
          min-width: 0;
        }

        .ngg-player-name {
          overflow: hidden;
          font-size: 13px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ngg-player-sub {
          margin-top: 3px;
          color: var(--muted, #888);
          font-size: 11px;
        }

        .ngg-player-score {
          font-size: 14px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }

        .ngg-empty {
          padding: 20px 10px;
          color: var(--muted, #888);
          text-align: center;
          font-size: 13px;
        }

        .ngg-section-note {
          margin: 0 0 12px;
          color: var(--muted, #888);
          font-size: 12px;
          line-height: 1.5;
        }

        @media (prefers-reduced-motion: reduce) {
          .ngg-root *,
          .ngg-root *::before,
          .ngg-root *::after {
            transition-duration: .01ms !important;
          }
        }
      </style>

      <div class="ngg-hero">
        <div class="ngg-eyebrow">NEOGRAM ARCADE</div>
        <h2>Игровая зона</h2>
        <p>Играй, набирай очки и поднимайся в рейтинге</p>
      </div>

      <div class="ngg-stats">
        <div class="ngg-stat">
          <div class="ngg-stat-label">Твой рекорд</div>
          <div class="ngg-stat-value" data-ngg-best>${best}</div>
        </div>
        <div class="ngg-stat">
          <div class="ngg-stat-label">Время раунда</div>
          <div class="ngg-stat-value">10 сек.</div>
        </div>
      </div>

      <div class="ngg-card">
        <div class="ngg-card-head">
          <div class="ngg-card-title">⚡ NeoGram Tap</div>
          <span class="ngg-pill">АРКАДА</span>
        </div>

        <p class="ngg-section-note">
          Нажимай на фиолетовую сферу как можно быстрее.
          Раунд длится 10 секунд. Результат отправляется на сервер.
        </p>

        <div class="ngg-tap-zone">
          <button class="ngg-tap-button" type="button" data-ngg-tap aria-label="Нажать">
            ⚡
          </button>

          <div class="ngg-score" data-ngg-score>0</div>
          <div class="ngg-score-caption">нажатий за раунд</div>

          <div class="ngg-timer">
            <div class="ngg-timer-fill" data-ngg-timer-fill></div>
          </div>
          <div class="ngg-time" data-ngg-time>Нажми «Старт», чтобы начать</div>

          <div class="ngg-actions">
            <button class="ngg-button" type="button" data-ngg-start>
              Начать игру
            </button>
            <button class="ngg-button secondary" type="button" data-ngg-reset>
              Сбросить
            </button>
          </div>

          <div class="ngg-message" data-ngg-message></div>
        </div>
      </div>

      <div class="ngg-card">
        <div class="ngg-card-head">
          <div class="ngg-card-title">🏆 Таблица лидеров</div>
          <button class="ngg-button secondary" style="flex:0 0 auto;min-height:34px;padding:7px 11px" type="button" data-ngg-refresh>
            Обновить
          </button>
        </div>
        <p class="ngg-section-note">
          Лучшие результаты игроков NeoGram.
        </p>
        <div class="ngg-leaderboard" data-ngg-leaderboard>
          <div class="ngg-empty">Загружаем рейтинг…</div>
        </div>
      </div>
    </section>
  `;
}

export function bindGamesModule(container, options = {}) {
  if (!container) return () => {};

  const root = container.matches?.('.ngg-root')
    ? container
    : container.querySelector('.ngg-root');

  if (!root) return () => {};

  let score = 0;
  let timeLeft = 10;
  let running = false;
  let finished = false;
  let timer = null;
  let startedAt = 0;
  let best = readBest();
  let destroyed = false;

  const find = (selector) => root.querySelector(selector);

  const tapButton = find('[data-ngg-tap]');
  const startButton = find('[data-ngg-start]');
  const resetButton = find('[data-ngg-reset]');
  const refreshButton = find('[data-ngg-refresh]');
  const scoreNode = find('[data-ngg-score]');
  const timeNode = find('[data-ngg-time]');
  const timerFill = find('[data-ngg-timer-fill]');
  const messageNode = find('[data-ngg-message]');
  const bestNode = find('[data-ngg-best]');
  const leaderboardNode = find('[data-ngg-leaderboard]');

  if (!tapButton || !startButton || !scoreNode) return () => {};

  const setMessage = (message) => {
    if (messageNode) messageNode.textContent = message;
  };

  const updateScore = () => {
    scoreNode.textContent = String(score);
  };

  const updateTime = () => {
    if (timeNode) {
      timeNode.textContent = running
        ? `Осталось ${timeLeft.toFixed(1)} сек.`
        : finished
          ? 'Раунд завершён'
          : 'Нажми «Начать игру», чтобы начать';
    }

    if (timerFill) {
      timerFill.style.width = `${Math.max(0, Math.min(100, timeLeft * 10))}%`;
    }
  };

  const updateBest = () => {
    if (bestNode) bestNode.textContent = String(best);
  };

  const setRunningUI = (value) => {
    running = value;
    tapButton.disabled = !value;
    startButton.disabled = value;
    startButton.textContent = value ? 'Игра идёт…' : 'Играть снова';
  };

  const stopTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const loadLeaderboard = async () => {
    if (destroyed || !leaderboardNode) return;

    leaderboardNode.innerHTML = '<div class="ngg-empty">Загружаем рейтинг…</div>';

    try {
      const data = await request('/leaderboard');
      if (destroyed) return;

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.leaderboard)
          ? data.leaderboard
          : Array.isArray(data.players)
            ? data.players
            : Array.isArray(data.items)
              ? data.items
              : [];

      if (!rows.length) {
        leaderboardNode.innerHTML = '<div class="ngg-empty">Пока нет результатов. Стань первым!</div>';
        return;
      }

      leaderboardNode.innerHTML = rows.slice(0, 50).map((player, index) => {
        const rank = index + 1;
        const name = escapeHTML(
          player.username ||
          player.name ||
          player.first_name ||
          player.phone ||
          `Игрок ${rank}`
        );
        const points = Number(
          player.score ??
          player.points ??
          player.best ??
          player.taps ??
          0
        );

        const rankClass = rank === 1
          ? 'first'
          : rank === 2
            ? 'second'
            : rank === 3
              ? 'third'
              : '';

        return `
          <div class="ngg-player">
            <div class="ngg-rank ${rankClass}">${rank}</div>
            <div class="ngg-player-info">
              <div class="ngg-player-name">${name}</div>
              <div class="ngg-player-sub">NeoGram player</div>
            </div>
            <div class="ngg-player-score">${Number.isFinite(points) ? points : 0}</div>
          </div>
        `;
      }).join('');
    } catch (error) {
      if (!destroyed) {
        leaderboardNode.innerHTML = `
          <div class="ngg-empty">
            Не удалось загрузить рейтинг.<br>
            ${escapeHTML(error.message)}
          </div>
        `;
      }
    }
  };

  const submitResult = async (finalScore, duration) => {
    try {
      await request('/game/tap', {
        method: 'POST',
        body: JSON.stringify({
          score: finalScore,
          duration,
          game: 'tap'
        })
      });

      if (!destroyed) {
        setMessage('Результат сохранён на сервере');
        loadLeaderboard();
      }
    } catch (error) {
      if (!destroyed) {
        setMessage(`Не удалось сохранить результат: ${error.message}`);
      }
    }
  };

  const finishGame = () => {
    if (!running || finished) return;

    stopTimer();
    finished = true;
    timeLeft = 0;

    setRunningUI(false);
    updateTime();

    const previousBest = best;
    if (score > best) {
      best = score;
      saveBest(best);
      updateBest();
    }

    setMessage(
      score > previousBest
        ? `🎉 Новый личный рекорд: ${score}!`
        : `Раунд завершён. Твой результат: ${score}`
    );

    const duration = Math.max(0, Date.now() - startedAt);
    submitResult(score, duration);
  };

  const startGame = () => {
    if (running || destroyed) return;

    stopTimer();
    score = 0;
    timeLeft = 10;
    finished = false;
    startedAt = Date.now();

    updateScore();
    updateTime();
    setMessage('Поехали! Нажимай быстрее!');
    setRunningUI(true);

    timer = setInterval(() => {
      if (destroyed || !running) {
        stopTimer();
        return;
      }

      const elapsed = (Date.now() - startedAt) / 1000;
      timeLeft = Math.max(0, 10 - elapsed);
      updateTime();

      if (timeLeft <= 0) finishGame();
    }, 50);
  };

  const tap = () => {
    if (!running || destroyed) return;

    score += 1;
    updateScore();

    if (score > best) {
      best = score;
      updateBest();
    }
  };

  const resetGame = () => {
    stopTimer();
    running = false;
    finished = false;
    score = 0;
    timeLeft = 10;

    setRunningUI(false);
    updateScore();
    updateTime();
    setMessage('Раунд сброшен');
  };

  const onTap = (event) => {
    event.preventDefault();
    tap();
  };

  const onStart = () => startGame();
  const onReset = () => resetGame();
  const onRefresh = () => loadLeaderboard();

  tapButton.addEventListener('pointerdown', onTap);
  startButton.addEventListener('click', onStart);
  resetButton?.addEventListener('click', onReset);
  refreshButton?.addEventListener('click', onRefresh);

  tapButton.disabled = true;
  updateScore();
  updateTime();
  updateBest();
  loadLeaderboard();

  return () => {
    destroyed = true;
    stopTimer();

    tapButton.removeEventListener('pointerdown', onTap);
    startButton.removeEventListener('click', onStart);
    resetButton?.removeEventListener('click', onReset);
    refreshButton?.removeEventListener('click', onRefresh);
  };
}
