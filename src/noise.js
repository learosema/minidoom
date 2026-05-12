// 4D Perlin noise — lets us sample on a torus surface so textures tile seamlessly.
export function PerlinNoise4D() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor((i + 1) * Math.random());
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }

  function grad4(h, x, y, z, w) {
    h &= 31;
    const u = h < 24 ? x : y;
    const v = h < 16 ? y : z;
    const q = h < 8 ? z : w;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v) + ((h & 4) ? -q : q);
  }

  return function noise4(x, y, z, w) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255, W = Math.floor(w) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    z -= Math.floor(z); w -= Math.floor(w);
    const fx = fade(x), fy = fade(y), fz = fade(z), fw = fade(w);

    const A = perm[X] + Y, B = perm[X + 1] + Y;
    const AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const BA = perm[B] + Z, BB = perm[B + 1] + Z;
    const AAA = perm[AA] + W, AAB = perm[AA + 1] + W;
    const ABA = perm[AB] + W, ABB = perm[AB + 1] + W;
    const BAA = perm[BA] + W, BAB = perm[BA + 1] + W;
    const BBA = perm[BB] + W, BBB = perm[BB + 1] + W;

    return lerp(
      lerp(
        lerp(lerp(grad4(perm[AAA], x, y, z, w), grad4(perm[BAA], x - 1, y, z, w), fx),
             lerp(grad4(perm[ABA], x, y - 1, z, w), grad4(perm[BBA], x - 1, y - 1, z, w), fx), fy),
        lerp(lerp(grad4(perm[AAB], x, y, z - 1, w), grad4(perm[BAB], x - 1, y, z - 1, w), fx),
             lerp(grad4(perm[ABB], x, y - 1, z - 1, w), grad4(perm[BBB], x - 1, y - 1, z - 1, w), fx), fy), fz),
      lerp(
        lerp(lerp(grad4(perm[AAA + 1], x, y, z, w - 1), grad4(perm[BAA + 1], x - 1, y, z, w - 1), fx),
             lerp(grad4(perm[ABA + 1], x, y - 1, z, w - 1), grad4(perm[BBA + 1], x - 1, y - 1, z, w - 1), fx), fy),
        lerp(lerp(grad4(perm[AAB + 1], x, y, z - 1, w - 1), grad4(perm[BAB + 1], x - 1, y, z - 1, w - 1), fx),
             lerp(grad4(perm[ABB + 1], x, y, z - 1, w - 1), grad4(perm[BBB + 1], x - 1, y - 1, z - 1, w - 1), fx), fy), fz), fw);
  };
}

export const noise4 = PerlinNoise4D();
