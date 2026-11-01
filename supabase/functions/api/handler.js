// KnightVerse API: all requests from the site go through here.
// Plain JavaScript so it runs in the Supabase edge function (Deno) and in local tests (Node).
// query(sql, params) must return an array of row objects.
import { RULES, battlePoints, makeOpponent, rivalName, validateTeam, replayBattle, Engine, mulberry32 } from './engine.js';
import { BOSSES, BOSS_PHASES } from './bosses.js';
import { ROSTER, SKILLS, STATUS_INFO, derive } from './data.js';

export const QUEST = {
  follow: { points: 50, handle: '_KnightVerse' },
  post: { points: 30, mention: '@_KnightVerse', tag: '#KnightVerse' },
  waitSeconds: 30,
};
const DAILY = ['like', 'retweet', 'reply'];
const BATTLE_TTL_HOURS = 3;
const MAX_ACCOUNTS_PER_IP_PER_DAY = 3;

// "Connect with X" (OAuth 2.0 with PKCE). We only ask to read the account, to learn who it is.
export const X_LOGIN = {
  authorize: 'https://x.com/i/oauth2/authorize',
  token: 'https://api.x.com/2/oauth2/token',
  me: 'https://api.x.com/2/users/me',
  revoke: 'https://api.x.com/2/oauth2/revoke',
  scope: 'tweet.read users.read',
  redirect: 'https://alduiin26.github.io/knightverse/infofi.html',
  loginMinutes: 15,
};

class UserError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; this.extra = extra; this.userError = true; }
}
const fail = (code, extra) => { throw new UserError(code, extra); };

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
function randomToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); return hex(a); }
function randomSeed() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 1; }
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const NICK = /^[A-Za-z0-9_]{3,16}$/;
const XHANDLE = /^@?([A-Za-z0-9_]{1,15})$/;
const TWEET = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/i;
export function parseTweet(url) {
  const m = TWEET.exec(String(url || '').trim());
  return m ? { user: m[1], id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` } : null;
}

// hash of the rules + code this server runs, to confirm a deploy matches the game files
export async function fingerprint() {
  const code = [Engine, replayBattle, mulberry32, makeOpponent, rivalName, validateTeam, battlePoints, derive, createHandler, parseTweet].map(f => f.toString()).join('\n');
  return (await sha256(JSON.stringify({ ROSTER, SKILLS, STATUS_INFO, BOSSES, BOSS_PHASES, RULES, QUEST }) + code)).slice(0, 16);
}

export function createHandler({ query, env = {}, fetch: fetchImpl }) {
  const q = async (sql, params = []) => query(sql, params);
  const one = async (sql, params) => (await q(sql, params))[0] || null;
  const http = fetchImpl || ((...a) => globalThis.fetch(...a));

  async function setting(key) {
    const r = await one('select value from kv_settings where key = $1', [key]);
    return r ? r.value : '';
  }
  // X app settings: Client ID comes from the admin panel (or the X_CLIENT_ID secret).
  // A Client Secret is only needed for "Web App" type X apps and must be a function secret.
  async function xConfig() {
    return {
      clientId: env.X_CLIENT_ID || await setting('x_client_id'),
      secret: env.X_CLIENT_SECRET || '',
      redirect: env.X_REDIRECT_URI || X_LOGIN.redirect,
    };
  }

  async function auth(body) {
    const token = String(body.token || '');
    if (token.length < 20) fail('no_account');
    const p = await one('select * from players where token_hash = $1', [await sha256(token)]);
    if (!p) fail('no_account');
    if (p.banned) fail('banned');
    return p;
  }

  async function ranks(p) {
    const g = await one(`select 1 + count(*)::int as r from players o where not o.banned and (o.game_points > $1 or (o.game_points = $1 and o.created_at < $2))`, [p.game_points, p.created_at]);
    const i = await one(`select 1 + count(*)::int as r from players o where not o.banned and (o.infofi_points > $1 or (o.infofi_points = $1 and o.created_at < $2))`, [p.infofi_points, p.created_at]);
    return { game: p.game_points > 0 ? g.r : null, infofi: p.infofi_points > 0 ? i.r : null };
  }

  function profile(p) {
    return { nickname: p.nickname, x_handle: p.x_id ? p.x_handle : null, game_points: p.game_points, infofi_points: p.infofi_points, wins: p.wins, battles: p.battles };
  }

  async function usesToday(p) {
    const rows = await q(`select nft_id, uses from hero_uses where player_id = $1 and day = (now() at time zone 'utc')::date and uses > 0`, [p.id]);
    const out = {}; for (const r of rows) out[r.nft_id] = Number(r.uses);
    return out;
  }

  async function taskState(p) {
    const tasks = await q('select kind, tweet_url, tweet_id, round, points from daily_tasks order by kind');
    const claims = p ? await q('select task, round, started_at, claimed_at from task_claims where player_id = $1', [p.id]) : [];
    const find = (task, round) => claims.find(c => c.task === task && Number(c.round) === Number(round));
    const state = (task, round) => {
      const c = find(task, round);
      if (!c) return { state: 'todo' };
      if (c.claimed_at) return { state: 'done' };
      const left = Math.max(0, QUEST.waitSeconds - Math.floor((Date.now() - new Date(c.started_at).getTime()) / 1000));
      return { state: 'started', wait_left: left };
    };
    const post = p ? await one(`select url, status, created_at from post_submissions where player_id = $1 and day = (now() at time zone 'utc')::date order by id desc limit 1`, [p.id]) : null;
    return {
      follow: { points: QUEST.follow.points, handle: QUEST.follow.handle, ...state('follow', 0) },
      daily: tasks.map(t => ({ kind: t.kind, url: t.tweet_url, tweet_id: t.tweet_id, round: Number(t.round), points: Number(t.points), ...(t.tweet_id ? state(t.kind, t.round) : { state: 'none' }) })),
      post: { points: QUEST.post.points, mention: QUEST.post.mention, tag: QUEST.post.tag, today: post ? { url: post.url, status: post.status } : null },
      wait_seconds: QUEST.waitSeconds,
    };
  }

  // admin password: the ADMIN_KEY secret, or its sha256 saved in kv_settings
  async function requireAdmin(body) {
    const given = String(body.admin_key || '');
    if (env.ADMIN_KEY && safeEqual(given, env.ADMIN_KEY)) return;
    const saved = await setting('admin_key_sha256');
    if (!saved && !env.ADMIN_KEY) fail('admin_not_configured');
    if (saved && given && safeEqual(await sha256(given), saved)) return;
    fail('admin_denied');
  }

  function requireX(p) { if (!p.x_id || !p.x_handle) fail('link_x_first'); }

  // swap the one-time code from X for a token, ask X who the user is, then hand the token back
  async function xWhoAmI(x, code, verifier) {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (x.secret) headers.Authorization = 'Basic ' + btoa(`${x.clientId}:${x.secret}`);
    const form = obj => new URLSearchParams(obj).toString();
    let token;
    try {
      const r = await http(X_LOGIN.token, { method: 'POST', headers, body: form({ code, grant_type: 'authorization_code', redirect_uri: x.redirect, code_verifier: verifier, client_id: x.clientId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) { console.error('x token', r.status, JSON.stringify(j).slice(0, 300)); fail('x_failed'); }
      token = j.access_token;
    } catch (e) { if (e.userError) throw e; console.error('x token request', String(e)); fail('x_failed'); }
    try {
      const r = await http(X_LOGIN.me, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.data || !j.data.id) {
        console.error('x users/me', r.status, JSON.stringify(j).slice(0, 300));
        fail(r.status === 429 || r.status === 402 || r.status === 403 ? 'x_busy' : 'x_failed');
      }
      return { id: String(j.data.id), username: String(j.data.username || '') };
    } catch (e) { if (e.userError) throw e; console.error('x users/me request', String(e)); fail('x_failed'); }
    finally {
      // we never keep the token: it is only used for this one lookup
      try { await http(X_LOGIN.revoke, { method: 'POST', headers, body: form({ token, token_type_hint: 'access_token', client_id: x.clientId }) }); } catch { /* it expires in 2 hours anyway */ }
    }
  }

  const actions = {
    // ------------------------------------------------------------ accounts
    async register(body, meta) {
      const nickname = String(body.nickname || '').trim();
      if (!NICK.test(nickname)) fail('bad_nickname');
      const ipHash = meta.ip ? await sha256((env.IP_SALT || 'kv') + meta.ip) : null;
      if (ipHash) {
        const c = await one(`select count(*)::int as n from players where ip_hash = $1 and created_at > now() - interval '1 day'`, [ipHash]);
        if (c.n >= MAX_ACCOUNTS_PER_IP_PER_DAY) fail('too_many_accounts');
      }
      const taken = await one('select 1 as x from players where lower(nickname) = lower($1)', [nickname]);
      if (taken) fail('nickname_taken');
      const token = randomToken();
      const p = await one('insert into players (token_hash, nickname, ip_hash) values ($1, $2, $3) returning *', [await sha256(token), nickname, ipHash]);
      return { token, profile: profile(p), ranks: { game: null, infofi: null }, uses: {} };
    },

    async me(body) {
      const p = await auth(body);
      await q('update players set last_seen = now() where id = $1 returning id', [p.id]);
      return { profile: profile(p), ranks: await ranks(p), uses: await usesToday(p), limit: RULES.dailyUses };
    },

    // ------------------------------------------------------------ Connect with X
    async x_auth_start(body) {
      const p = await auth(body);
      const x = await xConfig();
      if (!x.clientId) fail('x_not_configured');
      await q(`delete from x_logins where player_id = $1 or created_at < now() - interval '${X_LOGIN.loginMinutes} minutes' returning state`, [p.id]);
      const state = randomToken();
      const v = new Uint8Array(32); crypto.getRandomValues(v);
      const verifier = b64url(v);
      const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      await q('insert into x_logins (state, player_id, verifier) values ($1, $2, $3) returning state', [state, p.id, verifier]);
      const params = new URLSearchParams({ response_type: 'code', client_id: x.clientId, redirect_uri: x.redirect, scope: X_LOGIN.scope, state, code_challenge: challenge, code_challenge_method: 'S256' });
      return { url: `${X_LOGIN.authorize}?${params.toString().replace(/\+/g, '%20')}` };
    },

    async x_auth_finish(body) {
      const p = await auth(body);
      const x = await xConfig();
      if (!x.clientId) fail('x_not_configured');
      const code = String(body.code || ''), state = String(body.state || '');
      const login = await one(`delete from x_logins where state = $1 and player_id = $2 returning verifier, (created_at > now() - interval '${X_LOGIN.loginMinutes} minutes') as fresh`, [state, p.id]);
      if (!login || !login.fresh || !code) fail('x_expired');
      const user = await xWhoAmI(x, code, login.verifier);
      if (!XHANDLE.test(user.username)) fail('x_failed');
      // one X account belongs to one player, forever
      const bound = await one(`insert into x_accounts (x_id, player_id, username) values ($1, $2, $3)
        on conflict (x_id) do update set username = excluded.username where x_accounts.player_id = excluded.player_id returning player_id`, [user.id, p.id, user.username]);
      if (!bound) fail('x_taken');
      const other = await one('select 1 as x from players where x_id = $1 and id <> $2', [user.id, p.id]);
      if (other) fail('x_taken');
      // someone renamed on X and this name now belongs to a different account: drop the stale label
      await q('update players set x_handle = null where lower(x_handle) = lower($1) and id <> $2 returning id', [user.username, p.id]);
      const r = await one('update players set x_id = $1, x_handle = $2, x_verified_at = now() where id = $3 returning *', [user.id, user.username, p.id]);
      return { profile: profile(r) };
    },

    async leaderboard(body) {
      const kind = body.kind === 'infofi' ? 'infofi' : 'game';
      const col = kind === 'infofi' ? 'infofi_points' : 'game_points';
      const rows = await q(`select nickname, case when x_id is not null then x_handle end as x_handle, ${col} as points, wins, battles from players where not banned and ${col} > 0 order by ${col} desc, created_at asc limit 500`);
      return { kind, rows: rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname, x_handle: r.x_handle, points: Number(r.points), wins: Number(r.wins), battles: Number(r.battles) })) };
    },

    // ------------------------------------------------------------ arena
    async battle_start(body) {
      const p = await auth(body);
      const mode = body.mode === 'boss' ? 'boss' : 'pvp';
      const team = Array.isArray(body.team) ? body.team.map(String) : [];
      const boss = mode === 'boss' ? String(body.boss || '') : null;
      const err = validateTeam(mode, team, boss);
      if (err) fail(err);
      const seed = randomSeed();
      const enemy = mode === 'pvp' ? makeOpponent(team, seed) : [];
      const rival = mode === 'pvp' ? rivalName(seed) : BOSSES[boss].name;
      let row;
      try {
        row = await one('select kv_start_battle($1, $2, $3, string_to_array($4, \',\'), string_to_array($5, \',\'), $6, $7, $8) as id',
          [p.id, mode, boss, team.join(','), enemy.join(','), rival, seed, RULES.dailyUses]);
      } catch (e) {
        const m = /no_uses:(\w+)/.exec(String(e.message || e));
        if (m) fail('no_uses', { nft: m[1] });
        throw e;
      }
      return { battle_id: row.id, seed, enemy, rival, mode, boss, team };
    },

    async battle_finish(body) {
      const p = await auth(body);
      const b = await one(`select *, (created_at < now() - interval '${BATTLE_TTL_HOURS} hours') as expired from battles where id = $1 and player_id = $2`, [String(body.battle_id || ''), p.id]);
      if (!b) fail('battle_not_found');
      if (b.status !== 'started') fail('battle_closed');
      if (b.expired) { await q(`update battles set status = 'void', finished_at = now() where id = $1 returning id`, [b.id]); fail('battle_expired'); }
      const log = Array.isArray(body.log) ? body.log.slice(0, 1500).map(c => ({ u: String(c && c.u), s: Number(c && c.s), t: c && c.t ? String(c.t) : null })) : [];
      const team = b.team, enemy = b.enemy || [];
      const res = replayBattle({ mode: b.mode, team, enemy, boss: b.boss_id, seed: Number(b.seed), log, forfeit: !!body.forfeit });
      if (res.error) {
        await q(`update battles set status = 'void', finished_at = now() where id = $1 returning id`, [b.id]);
        fail('battle_invalid', { reason: res.error });
      }
      // quitting gives no points, so instant forfeits can't be farmed
      const points = body.forfeit ? 0 : battlePoints(b.mode, b.boss_id, res.win, team.length);
      const r = await one('select * from kv_finish_battle($1, $2, $3, $4, $5)', [b.id, p.id, res.win, points, res.turns]);
      const fresh = { ...p, game_points: Number(r.game_points) };
      return { win: res.win, points, game_points: Number(r.game_points), wins: Number(r.wins), battles: Number(r.battles), rank: (await ranks(fresh)).game, uses: await usesToday(p) };
    },

    // ------------------------------------------------------------ InfoFi quests
    async tasks(body) {
      let p = null;
      if (body.token) { try { p = await auth(body); } catch { p = null; } }
      return { tasks: await taskState(p), profile: p ? profile(p) : null, ranks: p ? await ranks(p) : null, x_login: !!(await xConfig()).clientId };
    },

    async task_start(body) {
      const p = await auth(body);
      requireX(p);
      const task = String(body.task || '');
      let round = 0;
      if (DAILY.includes(task)) {
        const t = await one('select round, tweet_id from daily_tasks where kind = $1', [task]);
        if (!t || !t.tweet_id) fail('task_not_available');
        round = Number(t.round);
      } else if (task !== 'follow') fail('bad_task');
      await q('insert into task_claims (player_id, task, round) values ($1, $2, $3) on conflict (player_id, task, round) do nothing returning task', [p.id, task, round]);
      return { tasks: await taskState(p) };
    },

    async task_claim(body) {
      const p = await auth(body);
      requireX(p);
      const task = String(body.task || '');
      let round = 0, points = QUEST.follow.points;
      if (DAILY.includes(task)) {
        const t = await one('select round, points, tweet_id from daily_tasks where kind = $1', [task]);
        if (!t || !t.tweet_id) fail('task_not_available');
        round = Number(t.round); points = Number(t.points);
      } else if (task !== 'follow') fail('bad_task');
      const r = await one('select * from kv_claim_task($1, $2, $3, $4, $5)', [p.id, task, round, points, QUEST.waitSeconds]);
      if (r.status !== 'ok') fail(r.status, r.wait_left != null ? { wait_left: Number(r.wait_left) } : {});
      const fresh = { ...p, infofi_points: Number(r.infofi_points) };
      return { points, infofi_points: fresh.infofi_points, rank: (await ranks(fresh)).infofi, tasks: await taskState(fresh) };
    },

    async submit_post(body) {
      const p = await auth(body);
      requireX(p);
      const t = parseTweet(body.url);
      if (!t) fail('bad_post_url');
      if (t.user.toLowerCase() !== p.x_handle.toLowerCase()) fail('post_not_yours');
      const dup = await one('select 1 as x from post_submissions where tweet_id = $1', [t.id]);
      if (dup) fail('post_duplicate');
      const today = await one(`select 1 as x from post_submissions where player_id = $1 and day = (now() at time zone 'utc')::date and status <> 'rejected'`, [p.id]);
      if (today) fail('post_daily_limit');
      await q('insert into post_submissions (player_id, url, tweet_id) values ($1, $2, $3) returning id', [p.id, t.url, t.id]);
      return { tasks: await taskState(p) };
    },

    // ------------------------------------------------------------ admin panel
    async admin_overview(body) {
      await requireAdmin(body);
      const c = await one(`select (select count(*)::int from players) as players,
        (select count(*)::int from players where last_seen > now() - interval '1 day') as active_today,
        (select count(*)::int from battles where day = (now() at time zone 'utc')::date) as battles_today,
        (select count(*)::int from post_submissions where status = 'pending') as pending_posts,
        (select count(*)::int from players where x_id is not null) as x_connected`);
      const tasks = await q('select kind, tweet_url, tweet_id, round, points, updated_at from daily_tasks order by kind');
      const claims = await q(`select c.task, count(*)::int as n from task_claims c join daily_tasks t on t.kind = c.task and t.round = c.round where c.claimed_at is not null group by c.task`);
      const xc = await xConfig();
      const x = { on: !!xc.clientId, client_id_end: xc.clientId ? xc.clientId.slice(-4) : '', from_secret: !!env.X_CLIENT_ID, redirect: xc.redirect };
      return { counts: c, tasks, claims, x };
    },

    // Client ID of the X app (from the X developer portal). It is not secret.
    async admin_set_x(body) {
      await requireAdmin(body);
      const id = String(body.client_id || '').trim();
      if (!id) { await q(`delete from kv_settings where key = 'x_client_id' returning key`); return { on: false }; }
      if (!/^[A-Za-z0-9_\-:.]{10,120}$/.test(id)) fail('bad_client_id');
      await q(`insert into kv_settings (key, value) values ('x_client_id', $1) on conflict (key) do update set value = excluded.value, updated_at = now() returning key`, [id]);
      return { on: true };
    },

    async admin_set_task(body) {
      await requireAdmin(body);
      const kind = String(body.kind || '');
      if (!DAILY.includes(kind)) fail('bad_task');
      const t = parseTweet(body.url);
      if (!t) fail('bad_post_url');
      const cur = await one('select tweet_id from daily_tasks where kind = $1', [kind]);
      if (cur && cur.tweet_id === t.id) return { changed: false };
      await q('update daily_tasks set tweet_url = $1, tweet_id = $2, round = round + 1, updated_at = now() where kind = $3 returning kind', [t.url, t.id, kind]);
      return { changed: true };
    },

    async admin_posts(body) {
      await requireAdmin(body);
      const status = ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'pending';
      const rows = await q(`select s.id, s.url, s.status, s.created_at, p.nickname, p.x_handle, p.infofi_points
        from post_submissions s join players p on p.id = s.player_id where s.status = $1 order by s.created_at ${status === 'pending' ? 'asc' : 'desc'} limit 200`, [status]);
      return { rows: rows.map(r => ({ ...r, id: Number(r.id) })) };
    },

    async admin_review(body) {
      await requireAdmin(body);
      const r = await one('select * from kv_review_post($1, $2, $3)', [Number(body.id), !!body.approve, QUEST.post.points]);
      if (r.status === 'not_pending') fail('not_pending');
      return { status: r.status };
    },

    async admin_ban(body) {
      await requireAdmin(body);
      const r = await one('update players set banned = $1 where lower(nickname) = lower($2) returning nickname, banned', [!!body.banned, String(body.nickname || '')]);
      if (!r) fail('player_not_found');
      return { player: r };
    },

    async config() {
      return {
        version: await fingerprint(),
        rules: RULES, quest: QUEST, x_login: !!(await xConfig()).clientId,
        bosses: Object.values(BOSSES).map(b => ({ id: b.id, name: b.name, winPoints: b.winPoints })),
        heroes: ROSTER.length,
      };
    },
  };

  return async function handle(action, body = {}, meta = {}) {
    const fn = Object.prototype.hasOwnProperty.call(actions, action) ? actions[action] : null;
    if (!fn) fail('unknown_action');
    return fn(body, meta);
  };
}
