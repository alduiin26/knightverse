// Supabase edge function "api" (Deno). Connects straight to the project database
// with the built-in SUPABASE_DB_URL secret and hands every request to handler.js.
// Optional secrets (Supabase dashboard > Edge Functions > Secrets):
//   ADMIN_KEY        password for admin.html (or save its sha256 as kv_settings 'admin_key_sha256')
//   IP_SALT          any random text, used to hash visitor IPs for the sign-up limit
//   X_CLIENT_ID      Client ID of the X app (can also be set from the admin panel)
//   X_CLIENT_SECRET  only for "Web App" type X apps; "Native App" needs none
//   X_REDIRECT_URI   only if the InfoFi page moves to another address
import postgres from 'npm:postgres@3.4.5';
import { createHandler } from './handler.js';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 4, idle_timeout: 20 });
const handle = createHandler({
  query: (text: string, params: unknown[] = []) => sql.unsafe(text, params as any[]),
  env: {
    ADMIN_KEY: Deno.env.get('ADMIN_KEY') || '',
    IP_SALT: Deno.env.get('IP_SALT') || 'knightverse',
    X_CLIENT_ID: Deno.env.get('X_CLIENT_ID') || '',
    X_CLIENT_SECRET: Deno.env.get('X_CLIENT_SECRET') || '',
    X_REDIRECT_URI: Deno.env.get('X_REDIRECT_URI') || '',
  },
  fetch: (url: string, init?: RequestInit) => fetch(url, { ...init, signal: AbortSignal.timeout(10000) }),
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  try {
    const out = await handle(String(body?.action || ''), body || {}, { ip });
    return json({ ok: true, ...out });
  } catch (e: any) {
    if (e && e.userError) return json({ ok: false, error: e.code, ...e.extra });
    console.error(e);
    return json({ ok: false, error: 'server_error' }, 500);
  }
});
