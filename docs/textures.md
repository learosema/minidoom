# Texture System

`src/textures.js` + `src/noise.js`

All textures are `TEXTURE_W × TEXTURE_W` (32 × 32) `Uint8ClampedArray` RGBA buffers generated at startup. `TEXTURE_W` must be a power of 2 — the renderer uses `& (TEXTURE_W − 1)` for UV wrapping.

## Seamless tiling via toroidal 4D sampling

Standard 2D or 3D noise produces hard seams at texture edges. The fix maps each texture axis onto a **circle** in noise space:

```
u = px / TEXTURE_W   →   θ = u × 2π
v = py / TEXTURE_W   →   φ = v × 2π

sample = noise4(
  cos(θ) × scale + offset[0],   // dim 0
  sin(θ) × scale + offset[1],   // dim 1  — X wraps on this circle
  cos(φ) × scale + offset[2],   // dim 2
  sin(φ) × scale + offset[3]    // dim 3  — Y wraps on this circle
)
```

Pixel 0 and pixel `TEXTURE_W` land on the same point of each circle, so the texture is mathematically periodic — zero seam, no blending.

## `generateNoiseTextureData(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `offset` | `[0,0,0,0]` | Shifts the torus centre in 4D noise space. Use different offsets to get independent patterns from the same noise function. |
| `scale` | `4` | Circle radius. Keep between 1–3 for readable blobs; above 4 produces uniform static. |
| `baseColor` | `[0,0,0]` | RGB at noise value 0. |
| `noiseColor` | `[255,255,255]` | RGB at noise value 1. |

Output is linearly interpolated between `baseColor` and `noiseColor`.

## Current textures

| Export | offset | scale | base | noise | Use |
|--------|--------|-------|------|-------|-----|
| `wallTexData` | `[0,0,0,0]` | 1.8 | `[40,35,30]` | `[200,185,155]` | Solid walls |
| `floorTexData` | `[10,0,0,0]` | 2.4 | `[55,45,30]` | `[105,90,60]` | Normal floor |
| `ceilTexData` | `[0,0,10,0]` | 1.5 | `[18,18,24]` | `[52,50,62]` | Ceiling |
| `waterTexData` | `[20,0,0,0]` | 2.0 | `[10,25,45]` | `[30,80,110]` | Water floors (`cellH < −0.05`) |
| `stairTexData` | `[30,0,0,0]` | 2.2 | `[65,60,50]` | `[140,130,110]` | Raised floors + step faces (`cellH > 0.05`) |

## Adding a texture

```js
export const myTexData = generateNoiseTextureData({
  offset: [40, 0, 0, 0],   // pick an unused offset to get a different pattern
  scale: 2.0,
  baseColor: [20, 10, 5],
  noiseColor: [180, 120, 60],
});
```

Then import it in `renderer.js` and use it wherever you need it. The noise is seeded randomly at startup (the Fisher-Yates shuffle in `PerlinNoise4D` uses `Math.random()`), so texture patterns differ between page loads.

## 4D Perlin noise (`src/noise.js`)

Standard Perlin implementation extended to 4 dimensions. The module exports a single pre-built `noise4(x, y, z, w)` function. The permutation table is shuffled once at module load time using `Math.random()` (not the seeded PRNG, intentionally — texture appearance doesn't need to be reproducible).
