// KnightVerse Arena - where the site's pictures and sounds live.
// The game data (data.js, bosses.js) keeps plain file names because the server shares those
// files; the game adds the folder here, so moving the art only means changing this file.
export const ASSET_DIR = {
  heroes: 'assets/img/heroes/',
  bosses: 'assets/img/bosses/',
  media: 'assets/media/',
};

export const heroArt = file => ASSET_DIR.heroes + file;
export const bossArt = file => ASSET_DIR.bosses + file;
// picture for any fighter on the field (a hero NFT or the raid boss)
export const artOf = nft => (nft.cls === 'boss' ? bossArt(nft.img) : heroArt(nft.img));
export const MUSIC = ASSET_DIR.media + 'theme.mp3';
