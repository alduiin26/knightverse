# KnightVerse

Website and browser game for KnightVerse: https://knightverse.online
(our own server, see `server/README.md`; https://alduiin26.github.io/knightverse/ stays as a mirror).

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Home page (trailer, Genesis mint, classes, bosses, tokenomics) |
| `arena.html` | The 3D Arena game: PvP and 5 vs boss raids (the Play buttons open it) |
| `leaderboard.html` | Arena and InfoFi rankings (top 500) |
| `infofi.html` | InfoFi quests: Connect with X, daily tasks, post submissions |
| `store.html` | Store preview |
| `whitepaper.html` | Whitepaper |
| `admin.html` | Admin panel (password protected, not indexed) |
| `game.html` | Old "coming soon" page, not linked from the site |
| `404.html` | Shown for missing addresses; sends old `play.html` links to the Arena |

Pages stay in the root folder so existing links (and the X login callback
`infofi.html`) keep working.

## Folders

```
assets/
  css/site.css        site styles (built from Tailwind, see below)
  js/icons.js         the Lucide icons the site uses
  img/brand/          logo (logo.webp), favicons
  img/heroes/         the 32 NFT character cards
  img/bosses/         raid boss art
  img/store/          store item images
  img/items/          chest and other item art
  media/              trailer video, theme music
  docs/               whitepaper PDF
arena/                game code (3D scene, battle rules, UI); arena/models/ for .glb models
supabase/             server: database migrations and the "api" edge function
server/               web server setup for knightverse.online (Caddy, firewall, auto publish)
design/source/        original full-size artwork (not loaded by the site)
tools/                helper scripts
```

## How to

- **Add or replace an image:** put the web version in the matching `assets/img/` folder and
  the original in `design/source/`. Prefer `.webp` for large art.
- **Add 3D models:** see `arena/models/README.md`.
- **New Tailwind classes in a page:** run `python3 tools/build-css.py` to rebuild
  `assets/css/site.css`.
- **New icon:** add it to `ICONS` in `assets/js/icons.js` (nodes from lucide.dev).
- **Server changes:** see `supabase/README.md`.

## Security notes

- No outside script runs from an unpinned address. Tailwind and the icons are served from this
  site; AOS and three.js load from jsDelivr with fixed versions and integrity hashes, so the
  browser refuses them if the files ever change.
- Every page has a Content Security Policy that only allows this site, jsDelivr, Google Fonts
  and the KnightVerse API.
- Points, battles and quests are checked on the server; the browser is never trusted with them.
- Secrets (database, X app) live only on Supabase, never in this repository.
