# Renderer

`src/renderer.js` — all rendering goes into a single `ImageData` buffer; one `ctx.putImageData` call per frame.

## Eye height and horizon

```
eyeH    = 0.5 + player.z          // eye is always half a unit above the floor
horizon = h/2 − player.z × h × 0.5  // horizon pixel row; shifts as player climbs
```

When the player is on flat ground (`player.z = 0`): `eyeH = 0.5`, `horizon = h/2`.
On an elevated tile (`player.z = 0.2`): `eyeH = 0.7`, `horizon` moves up by `0.1 × h`.

## Pass 1 — Ceiling (scanline)

Runs first, fills rows `0 .. ceil(horizon)−1`.

```
rowDir  = horizon − y           // pixels above horizon
rowDist = ceilAbove × h / rowDir
```

Uses a step-vector walk (one add per pixel) for speed. `ceilAbove = 1.0 − eyeH`.

## Pass 2 — Per-column DDA (floor + walls)

For each screen column `x`:

1. Cast a ray with DDA through the tile grid.
2. At every cell boundary, draw the **floor strip of the previous cell** and then handle the current cell.
3. `yBot` tracks the lowest undrawn pixel row; decrements toward horizon as floor strips are claimed.

### Floor strips

At each DDA step, before processing the new cell, we draw the floor of the **previous** cell up to the current distance. This gives correct UV projection for height-variable floors.

```
prevCamAbove = eyeH − prevCellH      // how far eye is above that floor
prevFloorLine = horizon + prevCamAbove × lineH   // screen row where that floor's top appears
```

`drawFloorStripe` is called with `yStart = max(ceil(horizon), prevFloorLine)` and `yEnd = yBot`.

Floor texture depends on `cellH`:

| `cellH` | Texture |
|---------|---------|
| `< −0.05` | `waterTexData` + wobble animation |
| `> 0.05` | `stairTexData` |
| otherwise | `floorTexData` |

### Step-up faces

When `cellH > prevCellH + 0.02`, a vertical "riser" face is rendered between the two floor levels:

```
currFloorLine = horizon + (eyeH − cellH) × lineH      // top of the new floor
stepWallTop   = max(ceil(horizon), currFloorLine)
stepWallBot   = min(horizon + (eyeH − prevCellH) × lineH, yBot)
```

The face uses `stairTexData` if the step height exceeds 0.05, otherwise `wallTexData`.

### Walls

```
wallAbove     = 1.0 − eyeH          // distance from eye to ceiling
wallBelowFloor = eyeH − prevCellH   // distance from eye to the floor at the wall's base
wallTop = horizon − wallAbove     × lineH
wallBot = horizon + wallBelowFloor × lineH
```

Using `prevCellH` (the floor height just in front of the wall) rather than a fixed `0.5` is what prevents black gaps when the floor height changes at the wall boundary.

Texture X coordinate:
```
wallFrac = fractional part of (player.y + perpDist×rayDirY)  // side=0
         = fractional part of (player.x + perpDist×rayDirX)  // side=1
texX     = floor(wallFrac × TEXTURE_W)
// mirror for correct facing direction:
if side=0 and rayDirX > 0: texX = TEXTURE_W − texX − 1
if side=1 and rayDirY < 0: texX = TEXTURE_W − texX − 1
```

Texture Y stepping:
```
texStep = TEXTURE_W / lineH
texPos  = (wallTop − horizon + wallAbove × lineH) × texStep  // = 0 at top of wall
```

Lighting: `shadeFactor = 0.6` for Y-side faces (north/south walls are 40% dimmer), then distance fog: `light = shadeFactor / (1 + perpDist² × 0.002)`.

### `yBot` invariants

- Initialised to `h − 1` per column.
- Decremented (`yBot = floorDrawStart − 1`) only when `cell === 0` (floor cells).
- **Not** decremented when `cell > 0` (wall) or when a step face is drawn — the wall rendering uses `drawWallBot = min(wallBot, yBot)` as a safety clamp against nearer step faces.
- Loop exits early when `yBot < ceil(horizon)`.

## Distance fog

Both floor and wall use: `light = max(0.15, 1.0 − rowDist × 0.07)`

## Adding a new wall type

1. Create a new `Uint8ClampedArray` texture in `textures.js`.
2. Assign tile values `≥ 2` in `getCell` (dungeon.js or map.js).
3. In the wall rendering block, index into an array of textures by `cell` value instead of always using `wallTexData`.
