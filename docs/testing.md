# Testing

## Running tests

```bash
npm test          # node --test
```

No browser, no native deps — pure Node.js with a hand-rolled canvas mock.

## How it works

The renderer writes every pixel it touches with `alpha = 255`. Any pixel it *doesn't* touch stays at the initial value. The test exploits this:

1. Pre-fill the canvas buffer with `#ff00ff` (pink).
2. Call `render(ctx, canvas, /* useExistingBuffer */ true)`.
   - The `true` flag makes the renderer call `ctx.getImageData` instead of `ctx.createImageData`, so the buffer starts pink rather than zeroed.
3. Count remaining pink pixels (`R=255, G=0, B=255`). Any non-zero count is a rendering gap.

### Canvas mock (`test/render.test.js`)

The renderer uses exactly four context methods. The mock implements only those:

```js
function makeCtx(w, h) {
  let pixels = new Uint8ClampedArray(w * h * 4);
  const canvas = { width: w, height: h };
  const ctx = {
    fillStyle: '',
    createImageData: (pw, ph) => ({ data: new Uint8ClampedArray(pw * ph * 4) }),
    getImageData:    (_x, _y, pw, ph) => ({ data: pixels.slice(0, pw * ph * 4) }),
    putImageData:    ({ data }) => { pixels = data; },
    fillRect: () => { /* parses ctx.fillStyle hex, fills pixels */ },
  };
  return { canvas, ctx, pixels: () => pixels };
}
```

No `canvas` npm package, no jsdom, no native bindings.

## Test scenarios

| Test | Setup | What it catches |
|------|-------|-----------------|
| Normal floor → wall | uniform flat floor | baseline coverage |
| Water floor → wall | `cellH = −0.25` | eye-height below normal; `wallBelowFloor` must account for negative `prevCellH` |
| Elevated floor → wall | `cellH = 0.2` | eye-height above normal; wall must not overshoot floor surface |
| Water → normal floor → wall | split room, player on water side | step-up face + subsequent wall gap regression |
| Normal → elevated → wall | split room, player on normal side | step-up face leaving gap at wall base |
| Enclosed room ×4 directions | small walled room | wall coverage in all facing directions |

## Adding a test

Create a map and height-map, set player position/direction, call `countPink`:

```js
test('my scenario', () => {
  const { grid, hmap } = makeRoom(7, 0);   // or makeMixedRoom(...)
  const canvas = renderScenario({ grid, hmap }, px, py, pz, dirX, dirY);
  assert.equal(countPink(canvas), 0);
});
```

`makeRoom(size, floorHeight)` — uniform floor, walls on the border.
`makeMixedRoom(size, heightA, heightB)` — left half `heightA`, right half `heightB`, walls on border.
