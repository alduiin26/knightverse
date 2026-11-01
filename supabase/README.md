# Server (Supabase)

The site is hosted on GitHub Pages; Supabase stores the data (players, points, battles, quests).

- `migrations/001_knightverse_init.sql` - tables and database functions.
- `migrations/002_x_login.sql` - "Connect with X" (verified X accounts) and the settings table.
- `functions/api/` - the `api` edge function every page talks to (`arena/api.js` holds its URL).
  - `handler.js` - all actions (accounts, battles, rankings, InfoFi quests, X login, admin).
  - `engine.js`, `data.js`, `bosses.js` - copies of the game rules from `arena/`, so the server
    can replay every battle and check the result. After changing those files in `arena/`, run
    `sh supabase/sync-engine.sh` and redeploy the function.
- Admin password: the sha256 of the password is stored in the `kv_settings` table
  (`admin_key_sha256`). An `ADMIN_KEY` function secret also works.
- Optional secrets (Supabase dashboard > Edge Functions > Secrets):
  - `IP_SALT` - any random text (used to hash visitor IPs for the sign-up limit).
  - `X_CLIENT_ID` - only if you prefer it over the admin panel field.
  - `X_CLIENT_SECRET` - only for a "Web App" type X app. A "Native App" needs none.

## Connect with X

Players must connect their X account before doing InfoFi quests. They press "Connect with X",
approve on X, and come back to `infofi.html`; the server asks X who they are (`GET /2/users/me`,
read-only) and throws the access away right after. One X account can belong to one player only.

X app settings (developer.x.com > your app > User authentication settings):
- OAuth 2.0 on, type **Native App**, permissions **Read**
- Callback URL: `https://alduiin26.github.io/knightverse/infofi.html`
- Website: `https://alduiin26.github.io/knightverse`

Then paste the app's **Client ID** in `admin.html` > X login. Each connection costs one X API
account read (pay-per-use credits in the X developer console).

## Rules

3 battles per hero per day (UTC). PvP: win +10 / lose +3 per hero. Boss raid: lose +3 per hero,
win +12 (Spider), +15 (Troll King), +20 (Mor Ultima), +30 (Ancient Dragon) per hero. Forfeit: 0.
InfoFi (needs a connected X account): follow +50 (once), daily like +10, retweet +15, reply +15,
approved post +30 (one per day).
