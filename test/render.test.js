import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

globalThis.performance ??= performance;

import { render } from '../src/renderer.js';
import { setMap } from '../src/map.js';
import { player } from '../src/player.js';

const W = 80, H = 60;

// Minimal mock of the canvas 2D context — only the four methods the renderer uses.
function makeCtx(w, h) {
  let pixels = new Uint8ClampedArray(w * h * 4);
  const canvas = { width: w, height: h };
  const ctx = {
    fillStyle: '',
    createImageData: (pw, ph) => ({ data: new Uint8ClampedArray(pw * ph * 4) }),
    getImageData:    (_x, _y, pw, ph) => ({ data: pixels.slice(0, pw * ph * 4) }),
    putImageData:    ({ data }) => { pixels = data; },
    fillRect: () => {
      const hex = ctx.fillStyle.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
      }
    },
  };
  return { canvas, ctx, pixels: () => pixels };
}

// ── Map builders ──────────────────────────────────────────────────────────────

function makeRoom(size, floorHeight = 0) {
  const grid = [], hmap = [];
  for (let y = 0; y < size; y++) {
    grid[y] = []; hmap[y] = [];
    for (let x = 0; x < size; x++) {
      const wall = y === 0 || y === size - 1 || x === 0 || x === size - 1;
      grid[y][x] = wall ? 1 : 0;
      hmap[y][x] = wall ? 0 : floorHeight;
    }
  }
  return { grid, hmap };
}

// Left columns get heightA, right columns get heightB, walls on border.
function makeMixedRoom(size, heightA, heightB) {
  const mid = Math.floor(size / 2);
  const grid = [], hmap = [];
  for (let y = 0; y < size; y++) {
    grid[y] = []; hmap[y] = [];
    for (let x = 0; x < size; x++) {
      const wall = y === 0 || y === size - 1 || x === 0 || x === size - 1;
      grid[y][x] = wall ? 1 : 0;
      hmap[y][x] = wall ? 0 : (x < mid ? heightA : heightB);
    }
  }
  return { grid, hmap };
}

// ── Test helper ───────────────────────────────────────────────────────────────

function countPink({ ctx, pixels, canvas }) {
  // Pre-fill pink so undrawn pixels stay #ff00ff.
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect();
  render(ctx, canvas, /* useExistingBuffer */ true);

  const px = pixels();
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255) n++;
  }
  return n;
}

function scenario({ grid, hmap }, px, py, pz, dirX = 1, dirY = 0) {
  setMap(grid, hmap);
  player.x = px; player.y = py; player.z = pz;
  player.dirX = dirX; player.dirY = dirY;
  player.planeX = -dirY * 0.66; player.planeY = dirX * 0.66;
  return makeCtx(W, H);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('normal floor → wall', () =>
  assert.equal(countPink(scenario(makeRoom(7, 0), 1.5, 3.5, 0)), 0));

test('water floor (−0.25) → wall', () =>
  assert.equal(countPink(scenario(makeRoom(7, -0.25), 1.5, 3.5, -0.25)), 0));

test('elevated floor (0.2) → wall', () =>
  assert.equal(countPink(scenario(makeRoom(7, 0.2), 1.5, 3.5, 0.2)), 0));

// Step-DOWN: player in water, corridor of normal floor, then wall.
test('water → normal floor → wall', () =>
  assert.equal(countPink(scenario(makeMixedRoom(9, -0.25, 0), 1.5, 4.5, -0.25)), 0));

// Step-UP: player on normal floor, elevated platform ahead, then wall.
test('normal floor → elevated floor → wall', () =>
  assert.equal(countPink(scenario(makeMixedRoom(9, 0, 0.2), 1.5, 4.5, 0)), 0));

// All four compass directions from an enclosed room.
for (const [dx, dy, label] of [[1, 0, '+X'], [-1, 0, '-X'], [0, 1, '+Y'], [0, -1, '-Y']]) {
  test(`enclosed room facing ${label}`, () =>
    assert.equal(countPink(scenario(makeRoom(7, 0), 3.5, 3.5, 0, dx, dy)), 0));
}
