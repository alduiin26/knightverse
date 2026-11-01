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

class UserError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; this.extra = extra; this.userError = true; }
}
const fail = (code, extra) => { throw new UserError(code, extra); };

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sha256(text) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
function randomToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); return hex(a); }
function randomSeed() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 1; }
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

export function createHandler({ query, env = {} }) {
  const q = async (sql, params = []) => query(sql, params);
  const one = async (sql, params) => (await q(sql, params))[0] || null;

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
    return { nickname: p.nickname, x_handle: p.x_handle, game_points: p.game_points, infofi_points: p.infofi_points, wins: p.wins, battles: p.battles };
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

  function requireAdmin(body) {
    if (!env.ADMIN_KEY) fail('admin_not_configured');
    if (!safeEqual(String(body.admin_key || ''), env.ADMIN_KEY)) fail('admin_denied');
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

    async set_x(body) {
      const p = await auth(body);
      const m = XHANDLE.exec(String(body.x_handle || '').trim());
      if (!m) fail('bad_x_handle');
      const taken = await one('select 1 as x from players where lower(x_handle) = lower($1) and id <> $2', [m[1], p.id]);
      if (taken) fail('x_taken');
      const r = await one('update players set x_handle = $1 where id = $2 returning *', [m[1], p.id]);
      return { profile: profile(r) };
    },

    async leaderboard(body) {
      const kind = body.kind === 'infofi' ? 'infofi' : 'game';
      const col = kind === 'infofi' ? 'infofi_points' : 'game_points';
      const rows = await q(`select nickname, x_handle, ${col} as points, wins, battles from players where not banned and ${col} > 0 order by ${col} desc, created_at asc limit 500`);
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
      return { tasks: await taskState(p), profile: p ? profile(p) : null, ranks: p ? await ranks(p) : null };
    },

    async task_start(body) {
      const p = await auth(body);
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
      if (!p.x_handle) fail('link_x_first');
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
      requireAdmin(body);
      const c = await one(`select (select count(*)::int from players) as players,
        (select count(*)::int from players where last_seen > now() - interval '1 day') as active_today,
        (select count(*)::int from battles where day = (now() at time zone 'utc')::date) as battles_today,
        (select count(*)::int from post_submissions where status = 'pending') as pending_posts`);
      const tasks = await q('select kind, tweet_url, tweet_id, round, points, updated_at from daily_tasks order by kind');
      const claims = await q(`select c.task, count(*)::int as n from task_claims c join daily_tasks t on t.kind = c.task and t.round = c.round where c.claimed_at is not null group by c.task`);
      return { counts: c, tasks, claims };
    },

    async admin_set_task(body) {
      requireAdmin(body);
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
      requireAdmin(body);
      const status = ['pending', 'approved', 'rejected'].includes(body.status) ? body.status : 'pending';
      const rows = await q(`select s.id, s.url, s.status, s.created_at, p.nickname, p.x_handle, p.infofi_points
        from post_submissions s join players p on p.id = s.player_id where s.status = $1 order by s.created_at ${status === 'pending' ? 'asc' : 'desc'} limit 200`, [status]);
      return { rows: rows.map(r => ({ ...r, id: Number(r.id) })) };
    },

    async admin_review(body) {
      requireAdmin(body);
      const r = await one('select * from kv_review_post($1, $2, $3)', [Number(body.id), !!body.approve, QUEST.post.points]);
      if (r.status === 'not_pending') fail('not_pending');
      return { status: r.status };
    },

    async admin_ban(body) {
      requireAdmin(body);
      const r = await one('update players set banned = $1 where lower(nickname) = lower($2) returning nickname, banned', [!!body.banned, String(body.nickname || '')]);
      if (!r) fail('player_not_found');
      return { player: r };
    },

    async config() {
      return {
        version: await fingerprint(),
        rules: RULES, quest: QUEST,
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
