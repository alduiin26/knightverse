# 3D models

Put `.glb` files here and register them in `arena/hero.js` (`MODEL_LIBRARY`).
Anything without a model uses the built-in procedural model, so the game always works.

| Key | What |
| --- | --- |
| `human-warrior`, `human-rogue`, `human-mage`, `human-priest` | Human heroes (one model per class; rarity colors are added by the game) |
| `orc-warrior`, `orc-rogue`, `orc-mage`, `orc-priest` | Orc heroes |
| `boss-spider`, `boss-troll`, `boss-ultima`, `boss-dragon` | Raid bosses |
| `env-rock` | Replaces every floating rock around the arena |
| `env-tower` | Replaces every pillar / tower around the arena |

Size and facing can be fixed per model in `MODEL_SETTINGS` (same file): `height` and `rotateY` (degrees).
Animation clips inside a `.glb` are used automatically when their names contain
`idle`, `attack`, `cast`, `hit` or `death`.
