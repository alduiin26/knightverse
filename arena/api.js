// KnightVerse - connection to the game server (accounts, points, rankings, quests).
// Used by arena.html, leaderboard.html, infofi.html and admin.html.
export const API_URL = 'https://ghnyalgjoahltifsjsqb.supabase.co/functions/v1/api';
const TOKEN_KEY = 'kv_token';

let memToken = null;
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || memToken; } catch { return memToken; }
}
export function setToken(t) {
  memToken = t || null;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

// local testing only: ?api=http://localhost:8787 (read once, so later URL changes don't matter)
const OVERRIDE = (() => {
  try {
    const o = new URLSearchParams(location.search).get('api');
    return o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : null;
  } catch { return null; }
})();
const endpoint = () => OVERRIDE || API_URL;

export class ApiError extends Error {
  constructor(code, data = {}) { super(code); this.code = code; this.data = data; }
}

export async function api(action, body = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token: getToken(), ...body }),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError('offline');
  } finally {
    clearTimeout(timer);
  }
  let data;
  try { data = await res.json(); } catch { throw new ApiError('server_error'); }
  if (!data || !data.ok) {
    const code = (data && data.error) || 'server_error';
    if (code === 'no_account') setToken(null);
    throw new ApiError(code, data || {});
  }
  return data;
}

// current player, or null if there is no account; { offline: true } if the server can't be reached
export async function loadMe() {
  if (!getToken()) return null;
  try { return await api('me'); }
  catch (e) { if (e.code === 'no_account') return null; return { offline: true, error: e.code }; }
}

export const MESSAGES = {
  offline: "Can't reach the KnightVerse server. Check your connection and try again.",
  server_error: 'The server had a problem. Please try again in a moment.',
  no_account: 'Create your fighter name first.',
  banned: 'This account is suspended.',
  bad_nickname: 'Names are 3 to 16 characters: letters, numbers or _ only.',
  nickname_taken: 'That name is already taken. Try another one.',
  too_many_accounts: 'Too many new accounts from this network today. Please try again tomorrow.',
  bad_x_handle: 'Enter a valid X username, for example @yourname.',
  x_taken: 'That X account is already linked to another player.',
  no_uses: 'One of the selected heroes has no battles left today.',
  team_size: 'Wrong number of heroes for this mode.',
  battle_invalid: 'This battle could not be verified, so no points were added.',
  battle_expired: 'This battle took too long and expired, so no points were added.',
  battle_closed: 'This battle was already recorded.',
  battle_not_found: 'Battle not found.',
  task_not_available: 'This task has no post yet. Check back later.',
  too_early: 'Not yet. Wait until the timer ends, then check again.',
  not_started: 'Open the task first, then come back and check.',
  already_done: 'Already completed.',
  link_x_first: 'Link your X username first.',
  bad_post_url: 'Paste the link to your post, for example https://x.com/you/status/123...',
  post_not_yours: 'That post belongs to a different X account than the one you linked.',
  post_duplicate: 'This post was already submitted.',
  post_daily_limit: 'You already submitted a post today. Come back tomorrow.',
  admin_denied: 'Wrong admin password.',
  admin_not_configured: 'The admin password is not set on the server yet.',
  not_pending: 'This post was already reviewed.',
  player_not_found: 'Player not found.',
};
export const errText = e => MESSAGES[e && e.code] || MESSAGES.server_error;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Account window: create a fighter name, restore with a recovery code, or view the code.
// Resolves with the 'me' data when the player has an account, or null if closed.
// ---------------------------------------------------------------------------
const CSS = `
.kvacc-bg{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:16px;font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(4px)}
.kvacc{width:min(94vw,420px);background:#0f0d12;border:1px solid rgba(255,211,107,.35);border-radius:14px;padding:22px;color:#ece6da;box-shadow:0 20px 60px rgba(0,0,0,.6);position:relative}
.kvacc h3{margin:0 0 6px;font:700 20px Cinzel,Georgia,serif;color:#ffd36b;letter-spacing:.04em}
.kvacc p{margin:0 0 14px;color:#a9a08c;font-size:13px;line-height:1.5}
.kvacc input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:#18151c;color:#fff;font:600 14px Inter,system-ui,sans-serif;outline:none}
.kvacc input:focus{border-color:#ffd36b}
.kvacc .row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.kvacc button{cursor:pointer;border-radius:9px;padding:10px 16px;font:800 13px Inter,system-ui,sans-serif}
.kvacc .gold{border:0;color:#1a1205;background:linear-gradient(180deg,#ffe9a3,#ffd04d 45%,#d9a22a)}
.kvacc .gold:disabled{filter:grayscale(1) brightness(.6);cursor:wait}
.kvacc .ghost{color:#ffd36b;background:rgba(255,211,107,.06);border:1px solid rgba(255,211,107,.4)}
.kvacc .link{background:none;border:0;color:#9a927f;padding:6px 0;font-weight:600;text-decoration:underline}
.kvacc .msg{min-height:18px;margin-top:10px;font-size:12.5px;color:#ff8a7a}
.kvacc .msg.ok{color:#7dff8a}
.kvacc .code{font:700 12px ui-monospace,Menlo,monospace;word-break:break-all;background:#18151c;border:1px dashed rgba(255,211,107,.4);border-radius:8px;padding:10px;color:#ffe08a;user-select:all}
.kvacc .x{position:absolute;top:10px;right:12px;background:none;border:0;color:#9a927f;font-size:22px;padding:4px 8px}
`;

export function openAccount({ startWith = 'create', reason = '' } = {}) {
  if (!document.getElementById('kvacc-css')) {
    const st = document.createElement('style'); st.id = 'kvacc-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'kvacc-bg';
    document.body.appendChild(bg);
    let result = null;
    const close = () => { bg.remove(); resolve(result); };
    bg.addEventListener('pointerdown', e => { if (e.target === bg) close(); });

    const viewCreate = () => {
      bg.innerHTML = `<div class="kvacc"><button class="x" aria-label="Close">&times;</button>
        <h3>Create your fighter</h3>
        <p>${reason ? esc(reason) + ' ' : ''}Pick a name for the rankings. No email or wallet needed for now.</p>
        <input id="kvNick" maxlength="16" placeholder="Fighter name (3-16 letters, numbers, _)" autocomplete="off">
        <div class="row"><button class="gold" id="kvGo">Create</button><button class="link" id="kvHave">I already have a recovery code</button></div>
        <div class="msg" id="kvMsg"></div></div>`;
      bg.querySelector('.x').onclick = close;
      bg.querySelector('#kvHave').onclick = viewRestore;
      const inp = bg.querySelector('#kvNick'), go = bg.querySelector('#kvGo'), msg = bg.querySelector('#kvMsg');
      const submit = async () => {
        const nickname = inp.value.trim();
        if (!/^[A-Za-z0-9_]{3,16}$/.test(nickname)) { msg.textContent = MESSAGES.bad_nickname; return; }
        go.disabled = true; msg.textContent = '';
        try {
          const r = await api('register', { nickname, token: null });
          setToken(r.token);
          result = r;
          viewCode(r.token, true);
        } catch (e) { msg.textContent = errText(e); go.disabled = false; }
      };
      go.onclick = submit;
      inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
      setTimeout(() => inp.focus(), 50);
    };

    const viewRestore = () => {
      bg.innerHTML = `<div class="kvacc"><button class="x" aria-label="Close">&times;</button>
        <h3>Use my recovery code</h3>
        <p>Paste the recovery code you saved when you created your fighter.</p>
        <input id="kvCode" placeholder="Recovery code" autocomplete="off">
        <div class="row"><button class="gold" id="kvGo">Continue</button><button class="link" id="kvNew">Create a new fighter instead</button></div>
        <div class="msg" id="kvMsg"></div></div>`;
      bg.querySelector('.x').onclick = close;
      bg.querySelector('#kvNew').onclick = viewCreate;
      const inp = bg.querySelector('#kvCode'), go = bg.querySelector('#kvGo'), msg = bg.querySelector('#kvMsg');
      const submit = async () => {
        const code = inp.value.trim();
        if (code.length < 20) { msg.textContent = 'That code looks too short.'; return; }
        go.disabled = true; msg.textContent = '';
        try {
          const r = await api('me', { token: code });
          setToken(code); result = r;
          msg.className = 'msg ok'; msg.textContent = `Welcome back, ${r.profile.nickname}!`;
          setTimeout(close, 700);
        } catch (e) { msg.textContent = e.code === 'no_account' ? 'No fighter found with that code.' : errText(e); go.disabled = false; }
      };
      go.onclick = submit;
      inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
      setTimeout(() => inp.focus(), 50);
    };

    const viewCode = (token, fresh) => {
      bg.innerHTML = `<div class="kvacc"><button class="x" aria-label="Close">&times;</button>
        <h3>${fresh ? 'Fighter created!' : 'Your account'}</h3>
        <p>This is your <b>recovery code</b>. Save it somewhere safe: it is the only way to use your fighter on another device or browser. Do not share it with anyone.</p>
        <div class="code" id="kvTok">${esc(token)}</div>
        <div class="row"><button class="gold" id="kvCopy">Copy code</button><button class="ghost" id="kvDone">${fresh ? 'Done' : 'Close'}</button>
        ${fresh ? '' : '<button class="link" id="kvOut">Use a different fighter</button>'}</div>
        <div class="msg" id="kvMsg"></div></div>`;
      bg.querySelector('.x').onclick = close;
      bg.querySelector('#kvDone').onclick = close;
      const out = bg.querySelector('#kvOut');
      if (out) out.onclick = () => { if (confirmSwitch()) { setToken(null); result = null; viewCreate(); } };
      bg.querySelector('#kvCopy').onclick = async () => {
        const msg = bg.querySelector('#kvMsg');
        try { await navigator.clipboard.writeText(token); msg.className = 'msg ok'; msg.textContent = 'Copied.'; }
        catch { msg.className = 'msg'; msg.textContent = 'Select the code above and copy it manually.'; }
      };
    };
    const confirmSwitch = () => true;

    if (startWith === 'code' && getToken()) { result = 'unchanged'; viewCode(getToken(), false); }
    else if (startWith === 'restore') viewRestore();
    else viewCreate();
  }).then(r => (r === 'unchanged' ? null : r));
}
