# Development

## Running locally

```bash
# Open directly — no server needed
open index.html

# Or with Vite for hot reload
npm install
npm run dev
```

The canvas is rendered at half the viewport resolution and CSS-upscaled 2× (`image-rendering: pixelated`), giving the chunky pixel aesthetic. To change the scale, edit `src/resize.js`.

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move forward |
| `S` / `↓` | Move backward |
| `←` | Rotate left |
| `→` | Rotate right |

## Project structure

```
index.html           entry point (loads src/main.js as an ES module)
src/                 game source (plain ES modules, no bundler required)
test/
  render.test.js     Node.js gap-detection tests
dagger/
  main.py            Dagger CI + AI agent functions
.github/
  workflows/ci.yml   GitHub Actions (test + AI review on PRs)
docs/                this directory
.env.local.example   LLM provider config template
```

## Regenerating the dungeon

Each page load uses `Date.now()` as the PRNG seed. To pin a specific layout for debugging:

```js
// src/main.js
const seed = 1234567890;   // fixed seed
seedRandom(seed);
```

## Texture tuning

Textures are generated at startup from `src/textures.js`. Adjust `scale` (1–3 for readable patterns) and `baseColor`/`noiseColor` to change appearance. Changes take effect on the next page load — no build step needed.

See [textures.md](textures.md) for the full parameter reference.

## Adding a tile type

1. Add a texture in `src/textures.js`.
2. Assign values `≥ 2` to tiles in `dungeon.js` (or set them manually in the `map` array in `map.js`).
3. In `renderer.js`, replace the hardcoded `wallTexData` reference with an array lookup: `wallTextures[cell - 1]`.

## Running tests

```bash
npm test
```

See [testing.md](testing.md) for how to add new test scenarios.
