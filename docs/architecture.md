# Architecture

Mini Doom is a browser raycaster with procedurally generated dungeons. No build step is required to play — open `index.html` directly. Vite is available for a hot-reload dev server during development.

## Module map

```
src/
  main.js        game loop (rAF), wires all modules together
  config.js      shared constants (TEXTURE_W)
  input.js       keydown/keyup → keys{}
  resize.js      canvas.width/height = viewport / 2  (pixelated CSS upscale)
  random.js      Mulberry32 seeded PRNG
  noise.js       4D Perlin noise factory
  textures.js    procedural texture generation (Uint8ClampedArray × 5)
  map.js         map + height-map state, walkability check
  dungeon.js     procedural dungeon generator
  player.js      position, direction, camera plane, movement, collision
  renderer.js    full-frame raycaster → single putImageData per frame
```

## Data flow per frame

```
initInput() ─────────────────────────────────── keys{}
                                                  │
requestAnimationFrame(loop)                       │
  │                                               │
  ├─ updatePlayer(dt, keys) ─── reads map.js ─── ┘
  │    moves player, lerps player.z to floor height
  │
  └─ render(ctx, canvas)
       Pass 1: ceiling scanline (all columns at once, fast step-vector walk)
       Pass 2: per-column DDA
                 → floor strips   (textured with drawFloorStripe)
                 → step-up faces  (stair / wall texture)
                 → wall           (textured column)
       ctx.putImageData (one call per frame)
```

## Coordinate system

- World units: 1 unit = 1 map tile
- Player position: float `(x, y)` within the tile grid
- Height: `player.z` tracks the floor height of the current tile (range −0.25 … 0.2 in generated dungeons)
- Eye height: `eyeH = 0.5 + player.z` — always half a unit above the floor
- Horizon: `horizon = h/2 − player.z × h × 0.5` — shifts up/down as the player climbs or descends

## Key invariants

| Invariant | Where enforced |
|-----------|---------------|
| `TEXTURE_W` must be a power of 2 | `& (TEXTURE_W − 1)` used for UV wrapping throughout renderer |
| `getCell` returns 1 for out-of-bounds | prevents DDA from walking off the map |
| height step > 0.3 units blocks movement | `isWalkable` in map.js |
| one `putImageData` per frame | renderer.js — never call per-pixel canvas API |
