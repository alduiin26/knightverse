#!/bin/sh
# Copies the battle rules from the game into the edge function, so the server checks
# battles with exactly the same rules the game uses. Run after changing arena/engine.js,
# arena/bosses.js or arena/data.js, then redeploy the "api" function.
cd "$(dirname "$0")/.."
for f in engine.js bosses.js data.js; do cp "arena/$f" "supabase/functions/api/$f"; done
echo "synced"
