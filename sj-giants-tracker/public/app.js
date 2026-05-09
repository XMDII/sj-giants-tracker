// SJ Giants Tracker — Main App
const SUPABASE_URL = 'https://qdxeahzgprqxlfgyaylc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3PSSAYYy92RVQxUffBMAIA_vKQXIaKz';
const MLB_PROXY = '/api/mlb';
const SJ_TEAM_ID = 476; // San Jose Giants MLB Stats API team ID

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ────────────────────────────────────────────────────────────
let state = {
  games: [],
  players: [],
  prospects: [],
  activeScreen: 'home',
  gameDetail: null,
};

// ── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  setupNav();
  await loadData();
  renderAll();
}

async function loadData() {
  const [gamesRes, playersRes, prospectsRes] = await Promise.all([
    sb.from('games').select('*').order('date', { ascending: false }),
    sb.from('players').select('*'),
    sb.from('prospect_db').select('*'),
  ]);
  state.games = gamesRes.data || [];
  state.players = playersRes.data || [];
  state.prospects = prospectsRes.data || [];
}

// ── Navigation ───────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const screen = tab.dataset.screen;
      switchScreen(screen);
    });
  });
}

function switchScreen(name) {
  state.activeScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.screen === name);
  });
  renderScreen(name);
}

function renderAll() {
  renderScreen('home');
}

function renderScreen(name) {
  if (name === 'home') renderHome();
  if (name === 'games') renderGames();
  if (name === 'players') renderPlayers();
  if (name === 'prospects') renderProspects();
  if (name === 'record') renderRecord();
}

// ── Helpers ──────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1] + ' ' + +day;
}

function fmtAvg(h, ab) {
  if (!ab) return '—';
  const a = (h / ab).toFixed(3);
  return a.startsWith('0') ? a.slice(1) : a;
}

function prospectBadges(player) {
  if (!player) return '';
  let html = '';
  if (player.org_rank && player.org) {
    const cls = player.org === 'SF' ? 'badge-sf' : 'badge-opp';
    html += `<span class="badge ${cls}">#${player.org_rank} ${player.org}</span>`;
  }
  if (player.mlb_top100 && player.mlb_rank) {
    html += `<span class="badge badge-100">MLB #${player.mlb_rank}</span>`;
  }
  return html;
}

function getPlayerProspect(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return state.prospects.find(p => p.name_lower === lower || p.name.toLowerCase() === lower) || null;
}

// ── Home Screen ──────────────────────────────────────────────────────
function renderHome() {
  const el = document.getElementById('screen-home');
  const games = state.games;
  const W = games.filter(g => g.result === 'W').length;
  const L = games.filter(g => g.result === 'L').length;
  const pct = games.length ? Math.round(W / games.length * 100) : 0;

  // Count MLB top-100 prospects seen
  const top100seen = new Set();
  state.prospects.filter(p => p.mlb_top100).forEach(p => top100seen.add(p.name.toLowerCase()));

  const opponents = new Set(games.map(g => g.opponent));

  el.innerHTML = `
    <div class="top-nav">
      <div>
        <div class="top-nav-title">⚾ My Giants</div>
        <div class="top-nav-sub">2026 season</div>
      </div>
      <button class="top-nav-btn" onclick="openAddGame()"><i class="ti ti-plus"></i> Add game</button>
    </div>
    <div style="height:12px"></div>
    <div class="stat-grid-2">
      <div class="stat-box"><div class="val">${games.length}</div><div class="lbl">Games attended</div></div>
      <div class="stat-box"><div class="val">${W}–${L}</div><div class="lbl">Fan record</div><div class="sub">${pct}% win rate</div></div>
      <div class="stat-box"><div class="val">${top100seen.size}</div><div class="lbl">MLB top-100s seen</div></div>
      <div class="stat-box"><div class="val">${opponents.size}</div><div class="lbl">Opponents faced</div></div>
    </div>
    <div class="section-header"><div class="section-title">Recent games</div><div class="section-action" onclick="switchScreen('games')">See all</div></div>
    <div class="game-list">
      ${games.length === 0 ? '<div class="empty">No games yet — tap Add game!</div>' : games.slice(0, 5).map(g => `
        <div class="game-row" onclick="openGameDetail(${g.id})">
          <div class="game-date">${fmtDate(g.date)}</div>
          <div class="game-info">
            <div class="game-opp">${g.opponent}</div>
            <div class="game-meta">${g.location === 'home' ? 'Home' : 'Away'} · ${g.result === 'W' ? 'W' : g.result === 'L' ? 'L' : 'T'} ${g.sj_score}–${g.opp_score}</div>
          </div>
          <span class="chip chip-${g.result}">${g.result}</span>
          <i class="ti ti-chevron-right chevron"></i>
        </div>`).join('')}
    </div>
    ${renderMVPSection()}
  `;
}

function renderMVPSection() {
  // Build cumulative stats from game_stats stored in players table
  // We'll use a simplified version pulling from state
  return `
    <div class="section-header"><div class="section-title">⭐ Your star player</div><div class="section-action" onclick="switchScreen('players')">Full leaderboard</div></div>
    <div id="mvp-section"><div class="loading"><div class="spinner"></div>Loading...</div></div>
  `;
}

// ── Games Screen ─────────────────────────────────────────────────────
function renderGames() {
  const el = document.getElementById('screen-games');
  const games = state.games;
  el.innerHTML = `
    <div class="top-nav">
      <div class="top-nav-title">Games</div>
      <button class="top-nav-btn" onclick="openAddGame()"><i class="ti ti-plus"></i> Add game</button>
    </div>
    <div style="height:12px"></div>
    ${games.length === 0 ? '<div class="empty">No games logged yet.</div>' : `
    <div class="game-list" style="margin:0 16px 12px">
      ${games.map(g => `
        <div class="game-row" onclick="openGameDetail(${g.id})">
          <div class="game-date">${fmtDate(g.date)}</div>
          <div class="game-info">
            <div class="game-opp">${g.opponent}</div>
            <div class="game-meta">${g.location === 'home' ? 'Home' : 'Away'} · ${g.affiliate || ''}</div>
          </div>
          <span class="chip chip-${g.result}">${g.sj_score}–${g.opp_score}</span>
          <i class="ti ti-chevron-right chevron"></i>
        </div>`).join('')}
    </div>`}
  `;
}

// ── Game Detail ───────────────────────────────────────────────────────
async function openGameDetail(gameId) {
  const game = state.games.find(g => g.id === gameId);
  if (!game) return;

  // Fetch stats for this game
  const { data: stats } = await sb.from('game_stats')
    .select('*, players(*)')
    .eq('game_id', gameId);

  const homeStats = (stats || []).filter(s => s.team === 'home');
  const awayStats = (stats || []).filter(s => s.team === 'away');

  const playerRow = (s) => {
    const prospect = getPlayerProspect(s.players?.name || '');
    const badges = prospectBadges(prospect);
    const isPitcher = s.ip;
    const statStr = isPitcher
      ? `${s.ip} IP · ${s.k_pit || 0}K · ${s.er || 0}ER`
      : `${s.h || 0}-${s.ab || 0} · ${s.rbi || 0}RBI${s.hr ? ' · ' + s.hr + 'HR' : ''}`;
    return `
      <div class="player-row">
        <div class="player-info">
          <div class="player-name">${s.players?.name || '—'}</div>
          ${badges ? `<div class="player-badges">${badges}</div>` : ''}
        </div>
        <div class="player-stat">${statStr}</div>
      </div>`;
  };

  // Push a detail view
  const screens = document.getElementById('app');
  const detail = document.createElement('div');
  detail.id = 'screen-detail';
  detail.className = 'screen active';
  detail.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:var(--page-bg);z-index:50;overflow-y:auto;-webkit-overflow-scrolling:touch;';
  detail.innerHTML = `
    <div class="top-nav">
      <button class="back-btn" onclick="closeDetail()"><i class="ti ti-arrow-left"></i></button>
      <div>
        <div class="top-nav-title">${game.opponent}</div>
        <div class="top-nav-sub">${fmtDate(game.date)} · ${game.location === 'home' ? 'Home' : 'Away'} · ${game.affiliate || ''}</div>
      </div>
    </div>
    <div style="padding:12px 16px">
      <div class="score-display">
        <div class="score-team"><div class="score-team-name">SJ Giants</div><div class="score-num">${game.sj_score}</div></div>
        <div class="score-divider">final</div>
        <div class="score-team"><div class="score-team-name">${game.opponent}</div><div class="score-num">${game.opp_score}</div></div>
        <span class="chip chip-${game.result}" style="margin-left:12px">${game.result === 'W' ? 'Win' : game.result === 'L' ? 'Loss' : 'Tie'}</span>
      </div>
      ${game.notes ? `<div style="font-size:13px;color:var(--text-secondary);font-style:italic;margin-bottom:12px">"${game.notes}"</div>` : ''}
      <div class="section-header" style="padding:0 0 8px"><div class="section-title">SJ Giants</div></div>
      <div class="player-list" style="margin:0 0 14px">${homeStats.length ? homeStats.map(playerRow).join('') : '<div class="empty" style="padding:1rem">No stats logged</div>'}</div>
      <div class="section-header" style="padding:0 0 8px"><div class="section-title">${game.opponent}</div></div>
      <div class="player-list" style="margin:0">${awayStats.length ? awayStats.map(playerRow).join('') : '<div class="empty" style="padding:1rem">No stats logged</div>'}</div>
    </div>
  `;
  screens.appendChild(detail);
}

function closeDetail() {
  const d = document.getElementById('screen-detail');
  if (d) d.remove();
}

// ── Players Screen ───────────────────────────────────────────────────
async function renderPlayers() {
  const el = document.getElementById('screen-players');
  el.innerHTML = `
    <div class="top-nav"><div class="top-nav-title">Players</div></div>
    <div class="loading"><div class="spinner"></div>Loading stats...</div>
  `;

  const { data: stats } = await sb.from('game_stats')
    .select('*, players(*), games(result)')
    .eq('team', 'home');

  const pMap = {};
  (stats || []).forEach(s => {
    const name = s.players?.name;
    if (!name || !s.ab) return;
    if (!pMap[name]) pMap[name] = { name, games: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, r: 0, player: s.players };
    pMap[name].games++;
    pMap[name].ab += s.ab || 0;
    pMap[name].h += s.h || 0;
    pMap[name].hr += s.hr || 0;
    pMap[name].rbi += s.rbi || 0;
    pMap[name].bb += s.bb || 0;
    pMap[name].r += s.r || 0;
  });

  const batters = Object.values(pMap).filter(p => p.ab >= 3)
    .sort((a, b) => (b.h/b.ab) - (a.h/a.ab));

  const maxH = batters[0]?.h || 1;

  el.innerHTML = `
    <div class="top-nav"><div class="top-nav-title">Players</div></div>
    <div style="height:12px"></div>
    ${batters.length === 0 ? '<div class="empty">No batting stats yet.</div>' : `
    <div style="padding:0 16px;margin-bottom:12px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${['avg','hits','rbi','hr'].map(c => `<button onclick="sortPlayers('${c}',this)" class="tab-btn ${c==='avg'?'active':''}" style="flex:1;padding:7px 4px;border-radius:20px;border:0.5px solid var(--border);background:${c==='avg'?'var(--text)':'var(--card-bg)'};color:${c==='avg'?'var(--page-bg)':'var(--text-secondary)'};font-size:12px;cursor:pointer;font-family:inherit">${c.toUpperCase()}</button>`).join('')}
      </div>
      <div id="player-bars">
        ${renderPlayerBars(batters, 'avg', maxH)}
      </div>
    </div>
    <div class="section-header"><div class="section-title">All batters</div></div>
    <div class="player-list">
      ${batters.map((p, i) => {
        const prospect = getPlayerProspect(p.name);
        const badges = prospectBadges(prospect);
        return `<div class="player-row">
          <div style="font-size:14px;font-weight:600;color:var(--text-tertiary);min-width:24px">${i+1}</div>
          <div class="player-info">
            <div class="player-name">${p.name}</div>
            ${badges ? `<div class="player-badges">${badges}</div>` : ''}
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${p.games} game${p.games!==1?'s':''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:600;color:var(--text)">${fmtAvg(p.h,p.ab)}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${p.h}H · ${p.rbi}RBI · ${p.hr}HR</div>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  `;
}

function renderPlayerBars(batters, cat, max) {
  const top = batters.slice(0, 6).map(p => {
    const val = cat === 'avg' ? (p.ab ? p.h/p.ab : 0) : cat === 'hits' ? p.h : cat === 'rbi' ? p.rbi : p.hr;
    const disp = cat === 'avg' ? fmtAvg(p.h, p.ab) : val;
    const maxVal = cat === 'avg' ? (batters[0]?.ab ? batters[0].h/batters[0].ab : 1) :
      cat === 'hits' ? (batters[0]?.h || 1) : cat === 'rbi' ? (batters[0]?.rbi || 1) : (batters[0]?.hr || 1);
    const pct = maxVal > 0 ? Math.round(val / maxVal * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-name">${p.name.split(' ').pop()}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-val">${disp}</div>
    </div>`;
  }).join('');
  return top;
}

window.sortPlayers = function(cat, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.style.background = 'var(--card-bg)';
    b.style.color = 'var(--text-secondary)';
    b.classList.remove('active');
  });
  btn.style.background = 'var(--text)';
  btn.style.color = 'var(--page-bg)';
  btn.classList.add('active');
  // re-render bars
  const bars = document.getElementById('player-bars');
  if (!bars) return;
  // quick re-sort
  const rows = document.querySelectorAll('.player-list .player-row');
  // just re-render whole screen
  renderPlayers();
};

// ── Prospects Screen ─────────────────────────────────────────────────
async function renderProspects() {
  const el = document.getElementById('screen-prospects');
  el.innerHTML = `<div class="top-nav"><div class="top-nav-title">Prospects</div></div><div class="loading"><div class="spinner"></div>Loading...</div>`;

  const { data: stats } = await sb.from('game_stats')
    .select('*, players(*), games(opponent, date)')
    .order('created_at');

  const sfProspects = {};
  const oppProspects = {};

  (stats || []).forEach(s => {
    const name = s.players?.name;
    if (!name) return;
    const p = getPlayerProspect(name);
    if (!p) return;
    if (s.team === 'home' && p.org === 'SF') {
      if (!sfProspects[name]) sfProspects[name] = { p, games: 0, ab: 0, h: 0, hr: 0, rbi: 0 };
      sfProspects[name].games++;
      sfProspects[name].ab += s.ab || 0;
      sfProspects[name].h += s.h || 0;
      sfProspects[name].hr += s.hr || 0;
      sfProspects[name].rbi += s.rbi || 0;
    } else if (s.team === 'away') {
      if (!oppProspects[name]) oppProspects[name] = { p, games: 0, opponent: s.games?.opponent };
      oppProspects[name].games++;
    }
  });

  const sfList = Object.values(sfProspects).sort((a,b) => (a.p.org_rank||99)-(b.p.org_rank||99));
  const oppList = Object.values(oppProspects).sort((a,b) => (a.p.mlb_rank||999)-(b.p.mlb_rank||999));
  const top100count = [...sfList,...oppList].filter(x => x.p.mlb_top100).length;

  el.innerHTML = `
    <div class="top-nav">
      <div>
        <div class="top-nav-title">Prospects</div>
        <div class="top-nav-sub">${top100count} MLB top-100 · ${sfList.length + oppList.length} total seen</div>
      </div>
    </div>
    <div style="height:12px"></div>
    <div class="section-header"><div class="section-title">SF Giants</div></div>
    ${sfList.length === 0 ? '<div class="empty">None yet.</div>' : sfList.map(({p, games, ab, h, hr, rbi}) => `
      <div class="card" style="background:var(--purple-light);border-color:transparent">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--purple-dark)">${p.name}</div>
            <div style="font-size:11px;color:var(--purple-mid);margin-top:2px">SF #${p.org_rank} · seen ${games} game${games!==1?'s':''}</div>
          </div>
          <div style="display:flex;gap:4px">
            <span class="badge badge-sf">#${p.org_rank} SF</span>
            ${p.mlb_top100 ? `<span class="badge badge-100">MLB #${p.mlb_rank}</span>` : ''}
          </div>
        </div>
        ${ab > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
          <div style="text-align:center"><div style="font-size:16px;font-weight:600;color:var(--purple-dark)">${fmtAvg(h,ab)}</div><div style="font-size:10px;color:var(--purple-mid)">AVG</div></div>
          <div style="text-align:center"><div style="font-size:16px;font-weight:600;color:var(--purple-dark)">${h}</div><div style="font-size:10px;color:var(--purple-mid)">H</div></div>
          <div style="text-align:center"><div style="font-size:16px;font-weight:600;color:var(--purple-dark)">${rbi}</div><div style="font-size:10px;color:var(--purple-mid)">RBI</div></div>
          <div style="text-align:center"><div style="font-size:16px;font-weight:600;color:var(--purple-dark)">${hr}</div><div style="font-size:10px;color:var(--purple-mid)">HR</div></div>
        </div>` : ''}
      </div>`).join('')}
    <div class="section-header" style="margin-top:4px"><div class="section-title">Opposing prospects seen</div></div>
    ${oppList.length === 0 ? '<div class="empty">None yet.</div>' : oppList.map(({p, games, opponent}) => `
      <div class="card" style="background:var(--orange-light);border-color:transparent">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--orange-dark)">${p.name}</div>
            <div style="font-size:11px;color:var(--orange-mid);margin-top:2px">${p.org} #${p.org_rank} · ${opponent || ''} · ${games} game${games!==1?'s':''}</div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            <span class="badge badge-opp">#${p.org_rank} ${p.org}</span>
            ${p.mlb_top100 ? `<span class="badge badge-100">MLB #${p.mlb_rank}</span>` : ''}
          </div>
        </div>
      </div>`).join('')}
  `;
}

// ── Record Screen ─────────────────────────────────────────────────────
function renderRecord() {
  const el = document.getElementById('screen-record');
  const games = state.games;
  const W = games.filter(g => g.result === 'W').length;
  const L = games.filter(g => g.result === 'L').length;
  const T = games.filter(g => g.result === 'T').length;
  const pct = games.length ? Math.round(W / games.length * 100) : 0;
  const hGames = games.filter(g => g.location === 'home');
  const aGames = games.filter(g => g.location === 'away');
  const hW = hGames.filter(g => g.result === 'W').length;
  const hL = hGames.filter(g => g.result === 'L').length;
  const aW = aGames.filter(g => g.result === 'W').length;
  const aL = aGames.filter(g => g.result === 'L').length;

  const byOpp = {};
  games.forEach(g => {
    if (!byOpp[g.opponent]) byOpp[g.opponent] = { W: 0, L: 0, T: 0 };
    byOpp[g.opponent][g.result]++;
  });

  el.innerHTML = `
    <div class="top-nav"><div class="top-nav-title">Fan record</div></div>
    <div style="padding:12px 16px">
      <div style="background:var(--card-bg);border-radius:14px;border:0.5px solid var(--border);padding:16px;margin-bottom:12px">
        <div style="font-size:32px;font-weight:700;color:var(--text)">${W} — ${L}${T > 0 ? ` — ${T}` : ''}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${pct}% win rate · ${games.length} game${games.length!==1?'s':''} attended</div>
        <div class="wl-bar"><div class="wl-fill" style="width:${pct}%"></div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:var(--card-bg);border-radius:12px;border:0.5px solid var(--border);padding:14px">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">At home</div>
          <div style="font-size:22px;font-weight:600">${hW}–${hL}</div>
        </div>
        <div style="background:var(--card-bg);border-radius:12px;border:0.5px solid var(--border);padding:14px">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">Away</div>
          <div style="font-size:22px;font-weight:600">${aW}–${aL}</div>
        </div>
      </div>
      <div class="section-header" style="padding:0 0 8px"><div class="section-title">By opponent</div></div>
      <div class="player-list">
        ${Object.keys(byOpp).length === 0 ? '<div class="empty">No games yet.</div>' : Object.entries(byOpp).map(([opp, rec]) => {
          const total = rec.W + rec.L + rec.T;
          const oppPct = total ? Math.round(rec.W / total * 100) : 0;
          return `<div class="player-row">
            <div class="player-info"><div class="player-name">${opp}</div></div>
            <div style="text-align:right">
              <div style="font-size:15px;font-weight:600">${rec.W}–${rec.L}${rec.T>0?'–'+rec.T:''}</div>
              <div style="font-size:11px;color:${oppPct===100?'var(--green-dark)':oppPct===0?'var(--red-dark)':'var(--text-secondary)'}">${oppPct}%</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ── Add Game Flow ─────────────────────────────────────────────────────
async function openAddGame() {
  const modal = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  modal.classList.remove('hidden');

  box.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Add game</div>
    <div class="loading"><div class="spinner"></div>Loading today's schedule...</div>
  `;

  // Fetch today's SJ Giants games from MLB API via proxy
  const today = new Date().toISOString().slice(0, 10);
  let games = [];
  try {
    const res = await fetch(`${MLB_PROXY}?endpoint=schedule&sportId=11&teamId=${SJ_TEAM_ID}&date=${today}&hydrate=team`);
    const data = await res.json();
    const dates = data?.dates || [];
    games = dates.flatMap(d => d.games || []);
  } catch (e) { games = []; }

  if (games.length > 0) {
    renderGamePicker(games, box);
  } else {
    renderManualEntry(box);
  }
}

function renderGamePicker(games, box) {
  box.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Select game</div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Today's games — tap the one you attended</div>
    ${games.map(g => {
      const isHome = g.teams?.home?.team?.id === SJ_TEAM_ID;
      const opp = isHome ? g.teams?.away?.team?.name : g.teams?.home?.team?.name;
      const time = g.gameDate ? new Date(g.gameDate).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
      return `<div class="game-option" onclick="selectMLBGame(${g.gamePk}, '${opp}', ${isHome})">
        <div class="game-option-title">${isHome ? 'vs' : '@'} ${opp}</div>
        <div class="game-option-sub">${time} · ${isHome ? 'Excite Ballpark' : 'Away'}</div>
      </div>`;
    }).join('')}
    <button class="btn-secondary" onclick="renderManualEntry(document.getElementById('modal-box'))">Enter manually instead</button>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
  `;
}

window.selectMLBGame = async function(gamePk, opponent, isHome) {
  const box = document.getElementById('modal-box');
  box.innerHTML = `<div class="modal-handle"></div><div class="loading"><div class="spinner"></div>Loading box score...</div>`;

  try {
    const res = await fetch(`${MLB_PROXY}?endpoint=game/${gamePk}/boxscore`);
    const data = await res.json();
    // parse teams and scores
    const teams = data?.teams;
    const homeTeam = teams?.home;
    const awayTeam = teams?.away;
    const isHomeGame = isHome;
    const sjTeam = isHomeGame ? homeTeam : awayTeam;
    const oppTeam = isHomeGame ? awayTeam : homeTeam;
    const sjScore = sjTeam?.teamStats?.batting?.runs ?? 0;
    const oppScore = oppTeam?.teamStats?.batting?.runs ?? 0;
    const result = sjScore > oppScore ? 'W' : sjScore < oppScore ? 'L' : 'T';

    // Auto-save game and stats
    await saveMLBGame({
      gamePk, opponent, isHome, sjScore, oppScore, result,
      sjPlayers: Object.values(sjTeam?.players || {}),
      oppPlayers: Object.values(oppTeam?.players || {}),
    });
  } catch(e) {
    box.innerHTML = `<div class="modal-handle"></div><div class="modal-title">Error loading box score</div><p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">Couldn't fetch the box score automatically. Please enter manually.</p><button class="btn-primary" onclick="renderManualEntry(document.getElementById('modal-box'))">Enter manually</button>`;
  }
};

async function saveMLBGame({ gamePk, opponent, isHome, sjScore, oppScore, result, sjPlayers, oppPlayers }) {
  const box = document.getElementById('modal-box');
  box.innerHTML = `<div class="modal-handle"></div><div class="loading"><div class="spinner"></div>Saving game & tagging prospects...</div>`;

  const today = new Date().toISOString().slice(0, 10);

  // Insert game
  const { data: game, error } = await sb.from('games').insert({
    date: today,
    location: isHome ? 'home' : 'away',
    opponent,
    sj_score: sjScore,
    opp_score: oppScore,
    result,
    mlb_game_pk: gamePk,
  }).select().single();

  if (error || !game) {
    box.innerHTML = `<div class="modal-handle"></div><div class="modal-title">Error saving</div><p style="color:var(--text-secondary);font-size:13px">${error?.message}</p><button class="btn-secondary" onclick="closeModal()">Close</button>`;
    return;
  }

  // Process players
  const allPlayers = [
    ...sjPlayers.map(p => ({ ...p, side: 'home' })),
    ...oppPlayers.map(p => ({ ...p, side: 'away' })),
  ];

  for (const p of allPlayers) {
    const name = p.person?.fullName;
    if (!name) continue;
    const batting = p.stats?.batting;
    const pitching = p.stats?.pitching;
    if (!batting?.atBats && !pitching?.inningsPitched) continue;

    // Upsert player
    const { data: player } = await sb.from('players').upsert({ name }, { onConflict: 'name' }).select().single();
    if (!player) continue;

    // Check prospect db
    const prospect = getPlayerProspect(name);

    // Insert stat
    await sb.from('game_stats').insert({
      game_id: game.id,
      player_id: player.id,
      team: p.side,
      position: p.allPositions?.[0]?.abbreviation || '',
      ab: batting?.atBats || 0,
      r: batting?.runs || 0,
      h: batting?.hits || 0,
      hr: batting?.homeRuns || 0,
      rbi: batting?.rbi || 0,
      bb: batting?.baseOnBalls || 0,
      k: batting?.strikeOuts || 0,
      ip: pitching?.inningsPitched || null,
      k_pit: pitching?.strikeOuts || null,
      er: pitching?.earnedRuns || null,
    });
  }

  // Refresh data
  await loadData();
  closeModal();
  renderAll();
  switchScreen('games');
}

function renderManualEntry(box) {
  const today = new Date().toISOString().slice(0, 10);
  box.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">Log game</div>
    <label class="form-label">Date</label>
    <input class="form-input" type="date" id="g-date" value="${today}">
    <label class="form-label">Opponent</label>
    <input class="form-input" type="text" id="g-opp" placeholder="e.g. Fresno Grizzlies">
    <label class="form-label">Affiliate (MLB org)</label>
    <input class="form-input" type="text" id="g-aff" placeholder="e.g. Colorado Rockies">
    <label class="form-label">Location</label>
    <select class="form-input" id="g-loc">
      <option value="home">Home (Excite Ballpark)</option>
      <option value="away">Away</option>
    </select>
    <div class="form-row" style="margin-top:12px">
      <div>
        <label class="form-label">SJ Giants score</label>
        <input class="form-input" type="number" id="g-sj" value="0" min="0">
      </div>
      <div>
        <label class="form-label">Opponent score</label>
        <input class="form-input" type="number" id="g-op" value="0" min="0">
      </div>
    </div>
    <label class="form-label">Notes (optional)</label>
    <input class="form-input" type="text" id="g-notes" placeholder="Walk-off HR, rain delay...">
    <button class="btn-primary" onclick="saveManualGame()">Save game</button>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
  `;
}

window.saveManualGame = async function() {
  const date = document.getElementById('g-date').value;
  const opp = document.getElementById('g-opp').value.trim();
  if (!date || !opp) { alert('Date and opponent are required.'); return; }
  const sj = parseInt(document.getElementById('g-sj').value) || 0;
  const op = parseInt(document.getElementById('g-op').value) || 0;
  const result = sj > op ? 'W' : sj < op ? 'L' : 'T';

  const { error } = await sb.from('games').insert({
    date, location: document.getElementById('g-loc').value,
    opponent: opp, affiliate: document.getElementById('g-aff').value.trim(),
    sj_score: sj, opp_score: op, result,
    notes: document.getElementById('g-notes').value.trim(),
  });

  if (error) { alert('Error saving: ' + error.message); return; }
  await loadData();
  closeModal();
  renderAll();
  switchScreen('games');
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.add('hidden');
};

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── Start ─────────────────────────────────────────────────────────────
boot();
