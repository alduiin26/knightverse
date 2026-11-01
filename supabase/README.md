# Server (Supabase)

The site is hosted on GitHub Pages; Supabase stores the data (players, points, battles, quests).

- `migrations/001_knightverse_init.sql` - tables and database functions.
- `functions/api/` - the `api` edge function every page talks to (`arena/api.js` holds its URL).
  - `handler.js` - all actions (accounts, battles, rankings, InfoFi quests, admin).
  - `engine.js`, `data.js`, `bosses.js` - copies of the game rules from `arena/`, so the server
    can replay every battle and check the result. After changing those files in `arena/`, run
    `sh supabase/sync-engine.sh` and redeploy the function.
- Secrets (Supabase dashboard > Edge Functions > Secrets):
  - `ADMIN_KEY` - password for `admin.html`.
  - `IP_SALT` - any random text (used to hash visitor IPs for the sign-up limit).

Rules: 3 battles per hero per day (UTC). PvP: win +10 / lose +3 per hero. Boss raid: lose +3 per hero,
win +12 (Spider), +15 (Troll King), +20 (Mor Ultima), +30 (Ancient Dragon) per hero. Forfeit: 0.
InfoFi: follow +50 (once), daily like +10, retweet +15, reply +15, approved post +30 (one per day).
