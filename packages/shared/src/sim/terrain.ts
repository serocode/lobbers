import type { MapDef } from '../types.ts';
import { inChasm, terrainBottomAt, terrainHeightAt } from '../config/maps.ts';

/**
 * Destructible terrain as a 1-byte-per-pixel solidity mask (1 = solid).
 * This is the collision geometry: carving it IS the destruction, and every
 * collision query (projectiles, walking, falling) reads it.
 *
 * Network sync: the server sends `encodeRLE()` once at match start, then only
 * explosion events (integer x, y, r). Clients replay `carveCircle` with the same
 * integers and compare `hash()` with the server's per-turn hash.
 */
export class Terrain {
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;

  constructor(width: number, height: number, mask?: Uint8Array) {
    this.width = width;
    this.height = height;
    this.mask = mask ?? new Uint8Array(width * height);
  }

  static fromMap(map: MapDef): Terrain {
    const t = new Terrain(map.width, map.height);
    for (let x = 0; x < map.width; x++) {
      if (inChasm(map.terrain, x)) continue;
      const top = Math.max(0, Math.round(terrainHeightAt(map.terrain, x)));
      const bottom = Math.min(map.height, Math.round(terrainBottomAt(map.terrain, map.width, map.height, x)));
      for (let y = top; y < bottom; y++) t.mask[y * map.width + x] = 1;
    }
    return t;
  }

  isSolid(x: number, y: number): boolean {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
    return this.mask[iy * this.width + ix] === 1;
  }

  /** Removes every solid pixel inside the circle. Returns pixels removed. Inputs are rounded so all peers carve identically. */
  carveCircle(cx: number, cy: number, r: number): number {
    const x0 = Math.round(cx), y0 = Math.round(cy), rr = Math.round(r);
    if (rr <= 0) return 0;
    let removed = 0;
    const r2 = rr * rr;
    for (let dy = -rr; dy <= rr; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= this.height) continue;
      const half = Math.floor(Math.sqrt(r2 - dy * dy));
      const xa = Math.max(0, x0 - half), xb = Math.min(this.width - 1, x0 + half);
      const row = y * this.width;
      for (let x = xa; x <= xb; x++) {
        if (this.mask[row + x] === 1) { this.mask[row + x] = 0; removed++; }
      }
    }
    return removed;
  }

  /** First solid y at column x at or below fromY, or null if the column is open to the bottom. */
  surfaceBelow(x: number, fromY: number): number | null {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return null;
    for (let y = Math.max(0, Math.floor(fromY)); y < this.height; y++) {
      if (this.mask[y * this.width + ix] === 1) return y;
    }
    return null;
  }

  /** FNV-1a hash of the mask, for desync detection. */
  hash(): number {
    let h = 0x811c9dc5;
    const m = this.mask;
    for (let i = 0; i < m.length; i++) { h ^= m[i]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  /** Run lengths, alternating empty/solid, starting with empty. */
  encodeRLE(): number[] {
    const runs: number[] = [];
    let cur = 0, len = 0;
    for (let i = 0; i < this.mask.length; i++) {
      if (this.mask[i] === cur) len++;
      else { runs.push(len); cur = this.mask[i]; len = 1; }
    }
    runs.push(len);
    return runs;
  }

  static decodeRLE(width: number, height: number, runs: number[]): Terrain {
    const t = new Terrain(width, height);
    let i = 0, v = 0;
    for (const len of runs) { if (v === 1) t.mask.fill(1, i, i + len); i += len; v ^= 1; }
    if (i !== width * height) throw new Error(`RLE length ${i} does not match ${width}×${height}`);
    return t;
  }

  clone(): Terrain {
    return new Terrain(this.width, this.height, new Uint8Array(this.mask));
  }
}
