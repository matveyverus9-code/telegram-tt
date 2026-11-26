const API_BASE = 'https://tg-api.matveyverus9.workers.dev';

const STORAGE_KEY = 'neogram_game_best';

const styles = `
.ngg-wrap{padding:0 16px 24px;color:var(--ng-text)}
.ngg-hero{padding:22px;border-radius:22px;background:linear-gradient(135deg,#2358c8,#824fe0);color:#fff;margin:8px 0 22px}
.ngg-hero-icon{font-size:38px;margin-bottom:8px}
.ngg-hero-title{font-size:24px;font-weight:800;letter-spacing:-.5px}
.ngg-hero-sub{font-size:14px;line-height:20px;opacity:.82;margin-top:6px}
.ngg-section{font-size:12px;font-weight:750;letter-spacing:.5px;text-transform:uppercase;color:var(--ng-secondary);margin:20px 0 9px}
.ngg-card{padding:16px;border-radius:18px;background:var(--ng-card);margin-bottom:12px}
.ngg-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.ngg-card-title{font-size:18px;font-weight:750}
.ngg-muted{font-size:13px;line-height:19px;color:var(--ng-secondary);margin-top:4px}
.ngg-pill{padding:6px 10px;border-radius:20px;background:var(--ng-input);font-size:11px;font-weight:700;color:var(--ng-secondary)}
.ngg-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}
.ngg-stat{padding:14px;border-radius:14px;background:var(--ng-input)}
.ngg-stat-value{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
.ngg-stat-label{font-size:11px;color:var(--ng-secondary);margin-top:3px}
.ngg-target{width:100%;height:180px;border:0;border-radius:19px;background:linear-gradient(145deg,#2678ee,#7957d5);color:#fff;font-size:30px;font-weight:850;touch-action:manipulation}
.ngg-target:disabled{opacity:.55}
.ngg-start{width:100%;height:48px;margin-top:12px;border:0;border-radius:14px;background:var(--ng-blue);color:#fff;font-size:16px;font-weight:750}
.ngg-start:disabled{opacity:.5}
.ngg-hint{text-align:center;color:var(--ng-secondary);font-size:13px;margin-top:11px;min-height:20px}
.ngg-leader{display:flex;align-items:center;gap:12px;padding:13px 14px;border-bottom:1px solid var(--ng-separator)}
.ngg-leader:last-child{border-bottom:0}
.ngg-rank{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:var(--ng-input);font-weight:800}
.ngg-player{flex:1;min-width:0;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ngg-points{font-size:13px;color:var(--ng-secondary);font-weight:700}
`;

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function bestScore() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

async function request(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const data = await response.json();
  if (!response.ok || data?.ok === false || data?.error) {
    throw new Error(data?.detail || data?.message || data?.error || 'Ошибка сервера');
  }
  return data;
}

export function renderGamesModule(options = {}) {
  const score = Number(options.score || 0);
  const running = Boolean(options.running);
  const best = bestScore();

  return `
    <div class="ngg-wrap">
      <style>${styles}</style>

      <section class="ngg-hero">
        <div class="ngg-hero-icon">🎮</div>
        <div class="ngg-hero-title">Игровой мир NeoGram</div>
        <div class="ngg-hero-sub">
          Проверяй реакцию, устанавливай рекорды и соревнуйся с другими игроками.
        </div>
      </section>

      <div class="ngg-section">Мини-игры</div>

      <section class="ngg-card">
        <div class="ngg-card-head">
          <div>
            <div class="ngg-card-title">Tap Game</div>
            <div class="ngg-muted">Набери максимум нажатий за 10 секунд</div>
          </div>
          <span class="ngg-pill">Реакция</span>
        </div>

        <div class="ngg-stats">
          <div class="ngg-stat">
            <div class="ngg-stat-value" data-ngg-score>${score}</div>
            <div class="ngg-stat-label">Текущий результат</div>
          </div>
          <div class="ngg-stat">
            <div class="ngg-stat-value" data-ngg-best>${best}</div>
            <div class="ngg-stat-label">Твой рекорд</div>
          </div>
        </div>

        <button class="ngg-target" data-ngg-tap ${running ? '' : 'disabled'}>
          ${running ? 'НАЖИМАЙ!' : '🎯'}
        </button>

        <button class="ngg-start" data-ngg-start ${running ? 'disabled' : ''}>
          ${running ? 'Игра идёт…' : 'Начать игру'}
        </button>

        <div class="ngg-hint" data-ngg-hint>
          ${running ? 'Нажимай на большую кнопку!' : 'У тебя будет 10 секунд'}
        </div>
      </section>

      <div class="ngg-section">Рейтинг сообщества</div>

      <section class="ngg-card" data-ngg-leaderboard>
        <div class="ngg-hint">Нажми «Обновить рейтинг», чтобы загрузить результаты.</div>
      </section>

      <button class="ngg-start" data-ngg-refresh style="margin-top:0">
        Обновить рейтинг
      </button>
    </div>
  `;
}

export function bindGamesModule(container, options = {}) {
  if (!container) return () => {};

  const token = options.token || '';
  let score = 0;
  let seconds = 10;
  let running = false;
  let timer = null;

  const scoreNode = container.querySelector('[data-ngg-score]');
  const bestNode = container.querySelector('[data-ngg-best]');
  const hint = container.querySelector('[data-ngg-hint]');
  const target = container.querySelector('[data-ngg-tap]');
  const start = container.querySelector('[data-ngg-start]');
  const board = container.querySelector('[data-ngg-leaderboard]');

  function updateScore() {
    if (scoreNode) scoreNode.textContent = String(score);
  }

  function stopGame() {
    clearInterval(timer);
    timer = null;
    running = false;

    const best = Math.max(bestScore(), score);

    try {
      localStorage.setItem(STORAGE_KEY, String(best));
    } catch {}

    if (bestNode) bestNode.textContent = String(best);
    if (target) {
      target.disabled = true;
      target.textContent = '🏁';
    }
    if (start) {
      start.disabled = false;
      start.textContent = 'Играть ещё раз';
    }
    if (hint) hint.textContent = `Время вышло! Результат: ${score}`;

    fetch(`${API_BASE}/game/tap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ score })
    }).catch(() => {});
  }

  function tap() {
    if (!running) return;
    score += 1;
    updateScore();
  }

  function begin() {
    if (running) return;

    score = 0;
    seconds = 10;
    running = true;
    updateScore();

    if (target) {
      target.disabled = false;
      target.textContent = 'НАЖИМАЙ!';
    }
    if (start) {
      start.disabled = true;
      start.textContent = 'Игра идёт…';
    }
    if (hint) hint.textContent = `Осталось ${seconds} секунд`;

    timer = setInterval(() => {
      seconds -= 1;
      if (hint) hint.textContent = `Осталось ${seconds} секунд`;
      if (seconds <= 0) stopGame();
    }, 1000);
  }

  async function loadLeaderboard() {
    if (!board) return;
    board.innerHTML = '<div class="ngg-hint">Загружаем рейтинг…</div>';

    try {
      const result = await request('/leaderboard', token);
      const list = Array.isArray(result)
        ? result
        : result.leaderboard || result.players || result.users || result.results || [];

      if (!Array.isArray(list) || !list.length) {
        board.innerHTML = '<div class="ngg-hint">Рейтинг пока пуст.</div>';
        return;
      }

      board.innerHTML = list.slice(0, 20).map((player, index) => `
        <div class="ngg-leader">
          <div class="ngg-rank">${['🥇','🥈','🥉'][index] || index + 1}</div>
          <div class="ngg-player">${escape(player.username || player.name || `Игрок ${index + 1}`)}</div>
          <div class="ngg-points">${escape(player.score ?? player.points ?? player.value ?? 0)} очков</div>
        </div>
      `).join('');
    } catch (error) {
      board.innerHTML = `<div class="ngg-hint">${escape(error.message || 'Не удалось загрузить рейтинг')}</div>`;
    }
  }

  target?.addEventListener('click', tap);
  start?.addEventListener('click', begin);
  container.querySelector('[data-ngg-refresh]')?.addEventListener('click', loadLeaderboard);

  loadLeaderboard();

  return () => {
    clearInterval(timer);
    timer = null;
  };
}
