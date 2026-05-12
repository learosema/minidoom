import { noise4 } from './noise.js';
import { TEXTURE_W } from './config.js';

// Seamlessly tileable via toroidal (torus) sampling in 4D noise.
//
// The trick: map each 2D texture axis onto a circle in noise space —
//   u = x/W  →  θ = u·2π  →  noise dims 0,1 = (cos θ, sin θ)·scale
//   v = y/W  →  φ = v·2π  →  noise dims 2,3 = (cos φ, sin φ)·scale
//
// Pixel 0 and pixel W land on the same point of the circle, so the texture
// is mathematically periodic — zero seam, no blending tricks needed.
//
//   offset : [d0,d1,d2,d3] shifts the torus centre in noise space (for variety)
//   scale  : circle radius — larger = more noise features per tile
//   baseColor / noiseColor : [r,g,b] endpoints of the colour ramp
export function generateNoiseTextureData({ offset = [0, 0, 0, 0], scale = 4, baseColor = [0, 0, 0], noiseColor = [255, 255, 255] } = {}) {
  const data = new Uint8ClampedArray(TEXTURE_W * TEXTURE_W * 4);
  const TAU = Math.PI * 2;
  for (let py = 0; py < TEXTURE_W; py++) {
    const phi = py / TEXTURE_W * TAU;
    const cz = Math.cos(phi) * scale + offset[2];
    const sz = Math.sin(phi) * scale + offset[3];
    for (let px = 0; px < TEXTURE_W; px++) {
      const theta = px / TEXTURE_W * TAU;
      const cx = Math.cos(theta) * scale + offset[0];
      const sx = Math.sin(theta) * scale + offset[1];
      const n = noise4(cx, sx, cz, sz) * 0.5 + 0.5;
      const i = (py * TEXTURE_W + px) * 4;
      data[i + 0] = Math.floor(baseColor[0] + n * (noiseColor[0] - baseColor[0]));
      data[i + 1] = Math.floor(baseColor[1] + n * (noiseColor[1] - baseColor[1]));
      data[i + 2] = Math.floor(baseColor[2] + n * (noiseColor[2] - baseColor[2]));
      data[i + 3] = 255;
    }
  }
  return data;
}

// Wall: chunky stone blocks — high contrast light/dark patches
export const wallTexData = generateNoiseTextureData({
  offset: [0, 0, 0, 0], scale: 1.8,
  baseColor: [40, 35, 30], noiseColor: [200, 185, 155]
});

// Floor: worn flagstones — warmer, mid-range contrast, slightly finer grain
export const floorTexData = generateNoiseTextureData({
  offset: [10, 0, 0, 0], scale: 2.4,
  baseColor: [55, 45, 30], noiseColor: [105, 90, 60]
});

// Ceiling: sooty plaster — very low contrast, stays dark so eye goes to walls
export const ceilTexData = generateNoiseTextureData({
  offset: [0, 0, 10, 0], scale: 1.5,
  baseColor: [18, 18, 24], noiseColor: [52, 50, 62]
});

// Water: dark blue-green, ripple-like noise
export const waterTexData = generateNoiseTextureData({
  offset: [20, 0, 0, 0], scale: 2.0,
  baseColor: [10, 25, 45], noiseColor: [30, 80, 110]
});

// Stairs/raised stone: lighter, slightly different grain
export const stairTexData = generateNoiseTextureData({
  offset: [30, 0, 0, 0], scale: 2.2,
  baseColor: [65, 60, 50], noiseColor: [140, 130, 110]
});
