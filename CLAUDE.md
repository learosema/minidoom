# Mini Doom Clone — Project Brief

Single-file raycaster (`index.html`) in plain HTML/JS/Canvas 2D. No build step, no dependencies.
Open the file directly in a browser to run.

---

## Architecture

Everything lives in one `<script>` block, structured in order:

```
CONFIGURATION       → MAP array, TEXTURE_W constant
PERLIN NOISE (4D)   → PerlinNoise4D() factory, returns noise4(x,y,z,w)
TEXTURE GENERATION  → generateNoiseTextureData({offset, scale, baseColor, noiseColor})
TEXTURE DEFINITIONS → wallTexData, floorTexData, ceilTexData  (Uint8ClampedArray)
GAME OBJECTS        → canvas/ctx setup, player state, key map
MAIN LOOP           → requestAnimationFrame → update(dt) → render()
UPDATE              → rotation, movement, AABB collision
RENDER              → floor/ceiling casting, then wall casting → single putImageData
RESIZE              → canvas.width/height = viewport / 8  (pixelated upscale via CSS)
```

---

## Renderer

Classic DDA raycaster. All rendering goes into a single `ImageData` buffer; one `ctx.putImageData` call per frame. No per-pixel canvas API calls.

**Walls** — per screen column:
1. Cast ray with DDA, find first wall hit
2. Compute perpendicular distance (fisheye-corrected)
3. Calculate wall stripe height, draw/top pixel
4. Compute `wallX` (fractional hit position along face) → `texX`
5. Mirror `texX` based on ray direction to fix diagonal-angle seam bug
6. Step through `texY` vertically, sample `wallTexData`
7. Apply distance fog + side-face darkening (Y-walls 40% dimmer)

**Floor & Ceiling** — per scanline row:
1. Compute `rowDist = (h/2) / rowDir` (distance to floor plane for this row)
2. Compute world-space step vector per pixel: `floorStep = rowDist * 2 * plane / w`
3. Walk `floorX/floorY` across the row, sample `floorTexData` or `ceilTexData`
4. Apply distance fog: `light = max(0.15, 1.0 - rowDist * 0.07)`

---

## Texture System

### Generation: `generateNoiseTextureData(options)`

| Parameter    | Type      | Default       | Description |
|-------------|-----------|---------------|-------------|
| `offset`    | `[d0,d1,d2,d3]` | `[0,0,0,0]` | Shifts torus centre in 4D noise space (gives each texture a unique pattern) |
| `scale`     | `number`  | `4`           | Circle radius on the torus — **keep between 1–3** for readable blobs |
| `baseColor` | `[r,g,b]` | `[0,0,0]`    | Color at noise value 0 |
| `noiseColor`| `[r,g,b]` | `[255,255,255]` | Color at noise value 1 |

Returns a `Uint8ClampedArray` of `TEXTURE_W × TEXTURE_W` RGBA pixels.

### Seamless Tiling (toroidal 4D sampling)

Standard 2D/3D noise produces hard seams at texture edges. The fix: map each texture axis onto a **circle** in noise space and sample 4D noise at those coordinates.

```
u = px / TEXTURE_W       theta = u * 2π
v = py / TEXTURE_W       phi   = v * 2π

noise4(
  cos(theta) * scale + offset[0],   // dim 0
  sin(theta) * scale + offset[1],   // dim 1  ← X wraps around this circle
  cos(phi)   * scale + offset[2],   // dim 2
  sin(phi)   * scale + offset[3]    // dim 3  ← Y wraps around this circle
)
```

Pixel 0 and pixel W are the same point on each circle → mathematically seamless, no blending needed.

### Scale tuning

`scale` is the **radius** of the torus circle, not a frequency multiplier.
- `scale > 4` → many noise periods crossed → uniform static, hard to read
- `scale 1–3` → 1–2 blob features per tile → readable stone/concrete look
- Current values: wall `1.8`, floor `2.4`, ceiling `1.5`

### Current texture definitions

```js
wallTexData   offset [0,0,0,0]   scale 1.8   base [40,35,30]   noise [200,185,155]
floorTexData  offset [10,0,0,0]  scale 2.4   base [55,45,30]   noise [105,90,60]
ceilTexData   offset [0,0,10,0]  scale 1.5   base [18,18,24]   noise [52,50,62]
```

---

## Player

```js
player = {
  x, y        // world position in map units (float)
  dirX, dirY  // unit direction vector
  planeX, planeY  // camera plane (perpendicular to dir, length = tan(FOV/2) ≈ 0.66)
  moveSpeed   // 3.0 units/sec
  rotSpeed    // 2.0 rad/sec
}
```

Collision: separate X and Y axis checks against `MAP[floor(y)][floor(x)] === 0`.

---

## Map

`MAP` is a 2D array of integers. `0` = floor, `1` = wall. Trivially extensible to multiple wall types (just check `> 0` for hit, use tile value to select texture).

```js
const MAP = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,1,0,1,0,1,0,0,1],
  ...
];
```

---

## Controls

| Key | Action |
|-----|--------|
| `ArrowUp` / `W` | Move forward |
| `ArrowDown` / `S` | Move backward |
| `ArrowLeft` | Rotate left |
| `ArrowRight` | Rotate right |

---

## Known limitations / good next steps

- No sprites or enemies
- Single wall texture (MAP only has tile type 1 — could use values 1–N to index different textures)
- No minimap
- No mouse look
- Floor/ceiling fog falloff is linear — could use a proper depth fog curve
- `TEXTURE_W` must be a power of 2 (bitwise `& (TEXTURE_W - 1)` used for wrapping)
