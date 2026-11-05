import type { MapDef, MapId, TerrainShape } from '../types.ts';

// Six battlefields, all larger than the 1440×750 camera viewport (the camera
// scrolls in both axes). Shapes and palettes match design/mockup/Scene.dc.html
// exactly; spawns and props match Battle.dc.html.

const shape = (base: number, waves: Array<[number, number, number]>, peaks: Array<[number, number, number]>, chasms: Array<[number, number]> = [], thickness = 0): TerrainShape => ({
  base,
  waves: waves.map(([amp, period, phase]) => ({ amp, period, phase })),
  peaks: peaks.map(([x, height, width]) => ({ x, height, width })),
  chasms: chasms.map(([x, width]) => ({ x, width })),
  thickness,
});

export const MAPS: Record<MapId, MapDef> = {
  cobalt: {
    id: 'cobalt', name: 'Cobalt Crags', sizeLabel: 'Medium · 4v4',
    description: 'Grassy ridgelines under a ringed gas giant. Floating isles hold the high ground and a central peak splits the teams.',
    width: 2400, height: 1000,
    terrain: shape(700, [[40, 150, 1], [22, 61, 0.4], [10, 27, 0]], [[1200, 230, 200], [520, 90, 120], [1880, 100, 130]]),
    palette: { skyTop: '#24407A', skyMid: '#5B8FD6', skyBot: '#F6C99A', far: '#5468A8', mid: '#3E6E86', near: '#2F5B5E', grass: '#6BCB5A', grassHi: '#B5EB78', dirt: '#8B5A3C', dirtDark: '#5E3A28', rock: '#8A93A8', foliage: '#4FB05A', foliageDark: '#2F7D45', trunk: '#6A4030', fall: '#8FE3FF', cloud: '#F5F1E8', mote: '#FFF4C2', glow: '#FFD166' },
    spawns: { red: [260, 460, 680, 880], blue: [2140, 1940, 1720, 1520] },
    props: { barrels: [1060, 1360], crates: [600, 1800, 1200] },
    hazard: { kind: 'void', level: 992 },
    backgroundAsset: 'assets/maps/cobalt-background.svg',
  },
  ember: {
    id: 'ember', name: 'Ember Basin', sizeLabel: 'Large · 4v4',
    description: 'A volcanic caldera at dusk. Lava pours off the isles and ash winds gust hard from the east.',
    width: 2800, height: 1000,
    terrain: shape(720, [[46, 170, 0.2], [18, 53, 1.1], [9, 31, 0]], [[800, 200, 140], [2000, 210, 150], [1400, -80, 220]]),
    palette: { skyTop: '#1E1030', skyMid: '#7A2E4A', skyBot: '#FF8A4C', far: '#4A2240', mid: '#3A1A30', near: '#2A1424', grass: '#E0703A', grassHi: '#FFB45E', dirt: '#5A2E2A', dirtDark: '#3A1C1C', rock: '#7A6268', foliage: '#3A2A2E', foliageDark: '#24181C', trunk: '#2A1A1E', fall: '#FF8A3D', cloud: '#C98080', mote: '#FFB45E', glow: '#FF8A3D' },
    spawns: { red: [240, 470, 1060, 1250], blue: [2560, 2330, 1740, 1560] },
    props: { barrels: [1400, 1500], crates: [800, 2000] },
    hazard: { kind: 'lava', level: 954 },
    backgroundAsset: 'assets/maps/ember-background.svg',
  },
  glacier: {
    id: 'glacier', name: 'Glacier Rift', sizeLabel: 'Medium · 4v4',
    description: 'A night-time ice shelf under the aurora. Snowcaps crumble fast — dig in or slide out.',
    width: 2600, height: 1050,
    terrain: shape(720, [[30, 140, 2], [24, 70, 0.3], [8, 25, 1]], [[1300, 190, 320], [450, 60, 100], [2150, 70, 110]]),
    palette: { skyTop: '#0B1530', skyMid: '#1F3D72', skyBot: '#6FA7D8', far: '#2C4A7E', mid: '#24406C', near: '#1C335A', grass: '#EAF4FF', grassHi: '#FFFFFF', dirt: '#5F8BB8', dirtDark: '#3E6694', rock: '#9FB4CF', foliage: '#2E6B6A', foliageDark: '#1F4E50', trunk: '#4A3A3A', fall: '#D7F3FF', cloud: '#C9D8F0', mote: '#FFFFFF', glow: '#8FE3FF' },
    spawns: { red: [220, 420, 700, 900], blue: [2380, 2180, 1900, 1700] },
    props: { barrels: [1150, 1450], crates: [1300] },
    hazard: { kind: 'water', level: 1004 },
    backgroundAsset: 'assets/maps/glacier-background.svg',
  },
  dunes: {
    id: 'dunes', name: 'Sunscar Dunes', sizeLabel: 'Huge · 4v4',
    description: 'Rolling desert under a white sun. Long sightlines, ancient columns and barrels buried in the sand.',
    width: 3000, height: 1000,
    terrain: shape(730, [[55, 260, 0.5], [24, 90, 1.7], [6, 20, 0]], [[1500, 140, 260], [620, 70, 150], [2380, 80, 160]]),
    palette: { skyTop: '#3E7CC9', skyMid: '#8EC3E8', skyBot: '#FFE2B0', far: '#D99A6C', mid: '#C98A58', near: '#B8784A', grass: '#F2C27A', grassHi: '#FFE6B0', dirt: '#D9954F', dirtDark: '#A86A38', rock: '#B98A6A', foliage: '#5ACB91', foliageDark: '#2F7D45', trunk: '#8A5A2E', fall: '#8FE3FF', cloud: '#FFF4E0', mote: '#FFE6B0', glow: '#FFD166' },
    spawns: { red: [260, 520, 860, 1100], blue: [2740, 2480, 2140, 1900] },
    props: { barrels: [700, 1400, 1620], crates: [1500, 2300] },
    hazard: { kind: 'void', level: 992 },
    backgroundAsset: 'assets/maps/dunes-background.svg',
  },
  skyreach: {
    id: 'skyreach', name: 'Skyreach Isles', sizeLabel: 'Large · 4v4',
    description: 'Three floating islands above the clouds. Knock rivals into the gaps — the void never misses.',
    width: 2800, height: 1100,
    terrain: shape(640, [[35, 120, 0.8], [15, 45, 2], [6, 22, 0]], [[1400, 150, 160], [420, 60, 120], [2380, 70, 120]], [[860, 150], [1930, 160]], 250),
    palette: { skyTop: '#2E6FD0', skyMid: '#7FB8F5', skyBot: '#E8F5FF', far: '#A9C8EE', mid: '#FFFFFF', near: '#F2F8FF', grass: '#7BD86A', grassHi: '#C4F28A', dirt: '#9A6B48', dirtDark: '#6B4630', rock: '#A9B3CC', foliage: '#5DC46A', foliageDark: '#2F8A4A', trunk: '#6A4030', fall: '#8FE3FF', cloud: '#FFFFFF', mote: '#FFFFFF', glow: '#FFD166' },
    spawns: { red: [180, 420, 640, 1080], blue: [2620, 2380, 2160, 1720] },
    props: { barrels: [1300, 1500], crates: [1400, 300] },
    hazard: { kind: 'void', level: 1092 },
    backgroundAsset: 'assets/maps/skyreach-background.svg',
  },
  hollow: {
    id: 'hollow', name: 'Glowcap Hollow', sizeLabel: 'Large · 4v4',
    description: 'A bioluminescent mushroom forest at night. Soft spongy ground that craters deep.',
    width: 2600, height: 1000,
    terrain: shape(700, [[34, 130, 2.4], [20, 57, 0.2], [9, 24, 1]], [[900, 120, 140], [1700, 140, 150]]),
    palette: { skyTop: '#0E0820', skyMid: '#2A1650', skyBot: '#5A3A86', far: '#2A1A48', mid: '#22143C', near: '#1A1030', grass: '#59D9A8', grassHi: '#A8FFD8', dirt: '#3E2C5A', dirtDark: '#2A1D40', rock: '#6E6390', foliage: '#FF7EB6', foliageDark: '#B07CF2', trunk: '#E6D9F2', fall: '#A8FFD8', cloud: '#7A5AA8', mote: '#D8FF8A', glow: '#A8FFD8' },
    spawns: { red: [220, 450, 680, 1000], blue: [2380, 2150, 1920, 1600] },
    props: { barrels: [1300], crates: [900, 1700] },
    hazard: { kind: 'void', level: 992 },
    backgroundAsset: 'assets/maps/hollow-background.svg',
  },
};

export const MAP_LIST = Object.values(MAPS);

/** Surface y of the pristine top edge at column x. */
export function terrainHeightAt(shape: TerrainShape, x: number): number {
  let y = shape.base;
  for (const w of shape.waves) y += w.amp * Math.sin(x / w.period + w.phase);
  for (const p of shape.peaks) y -= p.height * Math.exp(-Math.pow((x - p.x) / p.width, 2));
  return y;
}

export function inChasm(shape: TerrainShape, x: number): boolean {
  return shape.chasms.some((c) => Math.abs(x - c.x) < c.width / 2);
}

/** Distance from x to the nearest island edge (world edge or chasm edge). */
export function edgeDistance(shape: TerrainShape, worldWidth: number, x: number): number {
  let d = Math.min(x, worldWidth - x);
  for (const c of shape.chasms) d = Math.min(d, Math.abs(Math.abs(x - c.x) - c.width / 2));
  return d;
}

/** Underside of the ground at x (floating islands taper to a point at their edges). */
export function terrainBottomAt(shape: TerrainShape, worldWidth: number, worldHeight: number, x: number): number {
  if (!shape.thickness) return worldHeight;
  const k = Math.min(1, edgeDistance(shape, worldWidth, x) / 160);
  return terrainHeightAt(shape, x) + 6 + (shape.thickness + 30 * Math.sin(x / 70)) * Math.sqrt(k);
}
