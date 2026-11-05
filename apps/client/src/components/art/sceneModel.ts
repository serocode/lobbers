// Pure geometry for a map's art, ported from design/mockup/Scene.dc.html renderVals().
// Terrain shape + palette come from @lobbers/shared (MAPS); the decorative scatter (trees, rocks,
// pebbles, clouds, motes…) reproduces the mockup's seeded RNG call order exactly so the battlefield
// (Phaser) and the menu backdrops (SVG) look identical to the approved scene.
import { MAPS, edgeDistance, inChasm, terrainBottomAt, terrainHeightAt, type MapDef, type MapId, type MapPalette } from '@lobbers/shared';

export type TreeKind = 'puffy' | 'dead' | 'pine' | 'cactus' | 'shroom';
export interface Placed { x: number; y: number; scale: number }
export interface Tree extends Placed { dur: number; cap: string }
export interface Cloud { y: number; scale: number; dur: number; begin: number; op: number }
export interface Mote { x: number; y: number; r: number; from: number; to: number; dur: number; begin: number }

export interface SceneModel {
  map: MapDef;
  P: MapPalette;
  W: number;
  H: number;
  terrainD: string;
  topD: string;
  botD: string;
  isFloat: boolean;
  stars: Array<{ x: number; y: number; r: number; dur: number }>;
  clouds: Cloud[];
  farD: string;
  midD: string;
  nearD: string;
  midOp: number;
  nearOp: number;
  hazeY: number;
  hazeH: number;
  cel: { x: number; y: number };
  aurora: Array<{ a: string; b: string }>;
  volcanoes: Placed[];
  pyramids: Placed[];
  skyIsles: Placed[];
  bgShrooms: Array<Placed & { dur: number }>;
  islands: Array<Placed & { dur: number }>;
  treeKind: TreeKind;
  trees: Tree[];
  columns: Placed[];
  rocks: Placed[];
  pebbles: Array<{ x: number; y: number; r: number; ry: number }>;
  roots: string[];
  motes: Mote[];
  hazard: 'lava' | 'water' | null;
  hzY: number;
  hzWave: string;
}

const f1 = (v: number): string => v.toFixed(1);
const cache = new Map<MapId, SceneModel>();

export function sceneModel(id: MapId): SceneModel {
  const hit = cache.get(id);
  if (hit) return hit;
  const m = MAPS[id];
  const sh = m.terrain, W = m.width, H = m.height, P = m.palette;
  const topY = (x: number): number => terrainHeightAt(sh, x);
  const botY = (x: number): number => (sh.thickness ? terrainBottomAt(sh, W, H, x) : H + 20);
  const ok = (x: number): boolean => !inChasm(sh, x) && edgeDistance(sh, W, x) > 70;
  let seed = 7 + id.length * 13;
  const rnd = (): number => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  // Terrain: one closed sub-path per landmass (split at chasms; floating islands have an underside).
  const segs: Array<[number, number]> = [];
  let a = 0;
  for (const c of [...sh.chasms].sort((p, q) => p.x - q.x)) { segs.push([a, c.x - c.width / 2]); a = c.x + c.width / 2; }
  segs.push([a, W]);
  let terrainD = '', topD = '', botD = '';
  for (const [x0, x1] of segs) {
    const xs: number[] = [];
    for (let x = x0; x < x1; x += 8) xs.push(x);
    xs.push(x1);
    const tops = xs.map((x) => `${f1(x)} ${f1(topY(x))}`);
    topD += `M${tops.join(' L')} `;
    if (sh.thickness) {
      const bots = [...xs].reverse().map((x) => `${f1(x)} ${f1(botY(x))}`);
      terrainD += `M${tops.join(' L')} L${bots.join(' L')} Z `;
      botD += `M${bots.join(' L')} `;
    } else terrainD += `M${tops.join(' L')} L${f1(x1)} ${H + 20} L${f1(x0)} ${H + 20} Z `;
  }

  const night = id === 'ember' || id === 'glacier' || id === 'hollow';
  const stars = Array.from({ length: night ? Math.round(W / 45) : 6 }, () => ({ x: Math.round(rnd() * W), y: Math.round(rnd() * H * 0.36), r: +f1(0.8 + rnd() * 1.6), dur: +f1(2 + rnd() * 3) }));
  const nC = 4 + Math.round(W / 600) + (id === 'skyreach' ? 5 : 0);
  const clouds = Array.from({ length: nC }, (_, i): Cloud => {
    const y = 60 + (i % 5) * 70 + rnd() * 40, scale = 1 + rnd() * 1.6, dur = 110 + rnd() * 90;
    return { y: Math.round(y), scale: +scale.toFixed(2), dur: Math.round(dur), begin: -Math.round(dur * (i / nC)), op: id === 'skyreach' ? 0.95 : id === 'cobalt' || id === 'dunes' ? 0.85 : 0.35 };
  });
  const path = (fn: (x: number) => number, step: number): string => {
    let d = `M0 ${H}`;
    for (let x = 0; x <= W + step; x += step) d += ` L${x} ${f1(fn(x))}`;
    return `${d} L${W + step} ${H} Z`;
  };
  let farD: string;
  if (id === 'dunes') farD = path((x) => H * 0.5 - 80 * (Math.sin(x / 310) > 0.25 ? 1 : 0) - 46 * (Math.sin(x / 140 + 1) > 0.55 ? 1 : 0), 30);
  else if (id === 'skyreach') farD = '';
  else { let i = 0; farD = path((x) => H * 0.44 + 50 * Math.sin(x / 210 + id.length) + 36 * Math.sin(x / 77) + ((i++ % 2) ? -28 : 22), 90); }
  const midD = id === 'skyreach' ? path((x) => H * 0.8 - Math.abs(Math.sin(x / 90)) * 40, 15) : path((x) => H * 0.56 + 36 * Math.sin(x / 260 + 1) + 18 * Math.sin(x / 90), 20);
  const nearD = id === 'skyreach' ? path((x) => H * 0.88 - Math.abs(Math.sin(x / 70 + 1)) * 34, 15) : path((x) => H * 0.64 + 30 * Math.sin(x / 200 + 2) + 14 * Math.sin(x / 70), 20);
  const ISL: Record<MapId, Array<[number, number, number]>> = {
    cobalt: [[0.14, 0.24, 1], [0.5, 0.14, 0.7], [0.84, 0.26, 1.15]], ember: [[0.32, 0.22, 1], [0.6, 0.15, 0.7], [0.88, 0.25, 1]],
    glacier: [[0.2, 0.22, 1], [0.55, 0.13, 0.75], [0.85, 0.24, 1.1]], dunes: [],
    skyreach: [[0.08, 0.18, 0.8], [0.27, 0.1, 0.6], [0.44, 0.24, 1], [0.6, 0.12, 0.7], [0.76, 0.22, 0.9], [0.93, 0.1, 0.6]], hollow: [[0.3, 0.2, 0.8], [0.52, 0.12, 0.9]],
  };
  const islands = ISL[id].map(([fx, fy, s], i) => ({ x: Math.round(W * fx), y: Math.round(H * fy), scale: s, dur: +(5 + i * 0.8).toFixed(1) }));
  const CEL: Record<MapId, [number, number]> = { cobalt: [0.8, 0.17], ember: [0.68, 0.42], glacier: [0.8, 0.14], dunes: [0.6, 0.3], skyreach: [0.18, 0.14], hollow: [0.72, 0.16] };
  const aur = (k: number): { a: string; b: string } => {
    const pts = (o: number): string => `M-40 ${H * 0.15 + o} Q${W * 0.25} ${H * 0.06 - o} ${W * 0.5} ${H * 0.14 + o} T${W + 40} ${H * 0.11 - o}`;
    return { a: pts(0), b: pts(k) };
  };
  const treeStep = id === 'dunes' ? 330 : id === 'hollow' ? 150 : 200;
  const trees: Tree[] = [], columns: Placed[] = [];
  for (let x = 70 + rnd() * 60; x < W - 60; x += treeStep * (0.7 + rnd() * 0.7)) {
    if (!ok(x)) continue;
    if (id === 'dunes' && rnd() < 0.3) { columns.push({ x: Math.round(x), y: +f1(topY(x) + 6), scale: +(0.6 + rnd() * 0.5).toFixed(2) }); continue; }
    trees.push({ x: Math.round(x), y: +f1(topY(x) + 4), scale: +(0.65 + rnd() * 0.45).toFixed(2), dur: +(3 + rnd() * 2).toFixed(1), cap: rnd() < 0.5 ? P.foliage : P.foliageDark });
  }
  const rocks: Placed[] = [];
  for (let i = 0; i < Math.round(W / 320); i++) { const x = 60 + rnd() * (W - 120); if (ok(x)) rocks.push({ x: Math.round(x), y: +f1(topY(x) + 6), scale: +(0.7 + rnd() * 0.7).toFixed(2) }); }
  const pebbles: SceneModel['pebbles'] = [];
  for (let i = 0; i < Math.round(W / 50); i++) {
    const x = rnd() * W;
    if (inChasm(sh, x)) continue;
    const depth = sh.thickness ? (botY(x) - topY(x)) * 0.8 : 300;
    pebbles.push({ x: Math.round(x), y: Math.round(topY(x) + 30 + rnd() * Math.max(10, depth - 30)), r: +f1(4 + rnd() * 8), ry: +f1(3 + rnd() * 5) });
  }
  const roots: string[] = [];
  if (sh.thickness) for (let x = 40; x < W; x += 70 + rnd() * 60) { if (!ok(x)) continue; const b = botY(x); roots.push(`M${f1(x)} ${f1(b - 6)} Q${f1(x + 8)} ${f1(b + 20)} ${f1(x - 2)} ${f1(b + 30 + rnd() * 30)}`); }
  const motesN = id === 'hollow' ? 40 : id === 'skyreach' ? 10 : 22;
  const down = id === 'glacier';
  const motes = Array.from({ length: motesN }, (): Mote => {
    const x = rnd() * W, y0 = H * 0.25 + rnd() * H * 0.5, d = 5 + rnd() * 6, amp = id === 'hollow' ? 60 : 300;
    const r = +f1(1.5 + rnd() * 2.5);
    return { x: Math.round(x), y: Math.round(y0), r, from: Math.round(down ? y0 - amp : y0), to: Math.round(down ? y0 + amp * 0.6 : y0 - amp), dur: +d.toFixed(1), begin: -+(rnd() * d).toFixed(1) };
  });
  const hzY = H - 46;
  let hzWave = `M0 ${hzY}`;
  for (let x = 0; x <= W + 60; x += 30) hzWave += ` Q${x + 15} ${hzY + ((x / 30) % 2 ? 6 : -6)} ${x + 30} ${hzY}`;
  const bgShrooms = id === 'hollow' ? Array.from({ length: Math.round(W / 420) }, (_, i) => ({ x: Math.round(140 + i * 420 + rnd() * 120), y: Math.round(H * 0.72), scale: +(0.7 + rnd() * 0.6).toFixed(2), dur: +(2 + rnd() * 2).toFixed(1) })) : [];

  const TREE: Record<MapId, TreeKind> = { cobalt: 'puffy', skyreach: 'puffy', ember: 'dead', glacier: 'pine', dunes: 'cactus', hollow: 'shroom' };
  const model: SceneModel = {
    map: m, P, W, H, terrainD, topD, botD, isFloat: !!sh.thickness,
    stars, clouds, farD, midD, nearD, midOp: id === 'skyreach' ? 0.75 : 1, nearOp: id === 'skyreach' ? 0.9 : 1,
    hazeY: Math.round(H * 0.46), hazeH: Math.round(H * 0.3),
    cel: { x: Math.round(W * CEL[id][0]), y: Math.round(H * CEL[id][1]) },
    aurora: [aur(30), aur(-40)],
    volcanoes: [0.12, 0.46].map((fx, i) => ({ x: Math.round(W * fx), y: Math.round(H * 0.34), scale: i ? 2.1 : 2.6 })),
    pyramids: [0.26, 0.31].map((fx, i) => ({ x: Math.round(W * fx), y: Math.round(H * 0.5), scale: i ? 0.7 : 1 })),
    skyIsles: id === 'skyreach' ? Array.from({ length: 7 }, (_, i) => ({ x: Math.round(W * (0.06 + i * 0.145)), y: Math.round(H * (0.42 + (i % 3) * 0.06)), scale: 0.6 + (i % 2) * 0.5 })) : [],
    bgShrooms, islands, treeKind: TREE[id], trees, columns, rocks, pebbles, roots, motes,
    hazard: id === 'ember' ? 'lava' : id === 'glacier' ? 'water' : null, hzY, hzWave,
  };
  cache.set(id, model);
  return model;
}

export const translate = (p: Placed): string => `translate(${p.x} ${p.y}) scale(${p.scale})`;
