import { TEXTURE_W } from './config.js';
import { wallTexData, floorTexData, ceilTexData, waterTexData, stairTexData } from './textures.js';
import { player } from './player.js';
import { getCell, getHeight, getMapWidth, getMapHeight } from './map.js';

// useExistingBuffer: when true, reads the canvas pixels as the initial buffer
// so any pixel the renderer doesn't write stays whatever colour was there before.
// Used by the regression tests (pre-fill with #f0f, then check for remaining pink).
export function render(ctx, canvas, useExistingBuffer = false) {
  const w = canvas.width;
  const h = canvas.height;
  const frameData = useExistingBuffer ? ctx.getImageData(0, 0, w, h) : ctx.createImageData(w, h);
  const buf = frameData.data;
  const now = performance.now() * 0.001;
  const mw = getMapWidth();
  const mh = getMapHeight();
  const pz = player.z || 0;

  const eyeH = 0.5 + pz;
  const horizon = h / 2 - pz * h * 0.5;
  const ceilAbove = 1.0 - eyeH;

  // ── Pass 1: Ceiling scanline ──────────────────────────────────────────────
  if (ceilAbove > 0) {
    for (let y = 0; y < h; y++) {
      if (y >= horizon) break;
      const rowDir = horizon - y;
      if (rowDir <= 0) continue;
      const rowDist = ceilAbove * h / rowDir;
      const stepX = rowDist * 2 * player.planeX / w;
      const stepY = rowDist * 2 * player.planeY / w;
      let fx = player.x + rowDist * (player.dirX - player.planeX);
      let fy = player.y + rowDist * (player.dirY - player.planeY);
      const light = Math.max(0.15, 1.0 - rowDist * 0.07);

      for (let x = 0; x < w; x++, fx += stepX, fy += stepY) {
        const tx = Math.floor(fx * TEXTURE_W) & (TEXTURE_W - 1);
        const ty = Math.floor(fy * TEXTURE_W) & (TEXTURE_W - 1);
        const ti = (ty * TEXTURE_W + tx) * 4;
        const i = (y * w + x) * 4;
        buf[i]     = ceilTexData[ti]     * light;
        buf[i + 1] = ceilTexData[ti + 1] * light;
        buf[i + 2] = ceilTexData[ti + 2] * light;
        buf[i + 3] = 255;
      }
    }
  }

  // ── Pass 2: Per-column wall + floor casting ───────────────────────────────
  // Floor is rendered per-column in the DDA loop using the known cell height,
  // which avoids the UV errors that plague scanline approaches with height variation.
  for (let x = 0; x < w; x++) {
    const cameraX = 2 * x / w - 1;
    const rayDirX = player.dirX + player.planeX * cameraX;
    const rayDirY = player.dirY + player.planeY * cameraX;

    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);

    const deltaDX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

    let sX, sY, sideDX, sideDY;
    if (rayDirX < 0) { sX = -1; sideDX = (player.x - mapX) * deltaDX; }
    else              { sX =  1; sideDX = (mapX + 1 - player.x) * deltaDX; }
    if (rayDirY < 0) { sY = -1; sideDY = (player.y - mapY) * deltaDY; }
    else              { sY =  1; sideDY = (mapY + 1 - player.y) * deltaDY; }

    // yBot: bottommost pixel not yet drawn; decrements toward horizon as we
    // draw floor strips for each successive (farther) cell.
    let yBot = h - 1;
    let hitWall = false;
    let side;
    let prevCellH = getHeight(Math.floor(player.x), Math.floor(player.y));

    for (let dda = 0; dda < 128; dda++) {
      if (sideDX < sideDY) { sideDX += deltaDX; mapX += sX; side = 0; }
      else                  { sideDY += deltaDY; mapY += sY; side = 1; }

      if (mapX < 0 || mapX >= mw || mapY < 0 || mapY >= mh) break;

      const perpDist = side === 0
        ? (mapX - player.x + (1 - sX) / 2) / rayDirX
        : (mapY - player.y + (1 - sY) / 2) / rayDirY;

      if (perpDist <= 0) continue;

      const cell = getCell(mapX, mapY);
      const lineH = h / perpDist;

      // ── Floor strip for the previous cell ────────────────────────────
      // prevFloorLine = where the previous cell's floor top projects at perpDist.
      // For floor cells: draw the strip and advance yBot upward.
      // For wall cells: draw the strip but leave yBot unchanged so the wall
      //   can still claim its full pixel range (including the boundary row).
      const prevCamAbove = eyeH - prevCellH;
      if (prevCamAbove > 0) {
        const prevFloorLine = Math.round(horizon + prevCamAbove * lineH);
        const floorDrawStart = Math.max(Math.ceil(horizon), prevFloorLine);
        if (floorDrawStart <= yBot) {
          drawFloorStripe(buf, x, floorDrawStart, yBot, w, h, horizon, eyeH, prevCellH, rayDirX, rayDirY, now);
          if (cell === 0) yBot = floorDrawStart - 1;
        }
      }

      if (cell > 0) {
        // ── WALL ─────────────────────────────────────────────────────────
        // wallAbove: distance from eye to ceiling (height 1.0).
        // wallBelowFloor: distance from eye down to the floor at the wall's
        // base (prevCellH), so the wall ends exactly at that floor surface.
        const wallAbove = 1.0 - eyeH;
        const wallBelowFloor = eyeH - prevCellH;
        const wallTop = Math.max(0, Math.round(horizon - wallAbove * lineH));
        const wallBot = Math.min(h - 1, Math.round(horizon + wallBelowFloor * lineH));
        const drawWallBot = Math.min(wallBot, yBot);

        if (drawWallBot >= wallTop) {
          let wallFrac = side === 0
            ? player.y + perpDist * rayDirY
            : player.x + perpDist * rayDirX;
          wallFrac -= Math.floor(wallFrac);

          let texX = Math.floor(wallFrac * TEXTURE_W);
          if (side === 0 && rayDirX > 0) texX = TEXTURE_W - texX - 1;
          if (side === 1 && rayDirY < 0) texX = TEXTURE_W - texX - 1;

          const texStep = TEXTURE_W / lineH;
          let texPos = (wallTop - horizon + wallAbove * lineH) * texStep;
          const shadeFactor = side === 1 ? 0.6 : 1.0;
          const light = shadeFactor / (1.0 + perpDist * perpDist * 0.002);

          for (let y = wallTop; y <= drawWallBot; y++) {
            const texY = Math.floor(texPos) & (TEXTURE_W - 1);
            texPos += texStep;
            const ti = (texY * TEXTURE_W + texX) * 4;
            const i = (y * w + x) * 4;
            buf[i]     = Math.min(255, wallTexData[ti]     * light);
            buf[i + 1] = Math.min(255, wallTexData[ti + 1] * light);
            buf[i + 2] = Math.min(255, wallTexData[ti + 2] * light);
            buf[i + 3] = 255;
          }
        }
        hitWall = true;
        break;
      }

      // ── Step-up face ──────────────────────────────────────────────────
      const cellH = getHeight(mapX, mapY);

      if (cellH > prevCellH + 0.02) {
        const currCamAbove = eyeH - cellH;
        const currFloorLine = Math.round(horizon + currCamAbove * lineH);
        const prevFloorLine2 = Math.round(horizon + (eyeH - prevCellH) * lineH);
        const stepWallTop = Math.max(Math.ceil(horizon), currFloorLine);
        const stepWallBot = Math.min(prevFloorLine2, yBot);

        if (stepWallBot >= stepWallTop) {
          const shadeFactor = side === 1 ? 0.5 : 0.65;
          const light = shadeFactor / (1.0 + perpDist * perpDist * 0.002);
          const texData = cellH > 0.05 ? stairTexData : wallTexData;

          let wallFrac = side === 0
            ? player.y + perpDist * rayDirY
            : player.x + perpDist * rayDirX;
          wallFrac -= Math.floor(wallFrac);
          const stTexX = Math.floor(wallFrac * TEXTURE_W) & (TEXTURE_W - 1);

          const stepH = stepWallBot - stepWallTop;
          for (let y = stepWallTop; y <= stepWallBot; y++) {
            const frac = stepH > 0 ? (y - stepWallTop) / stepH : 0;
            const stTexY = Math.floor(frac * TEXTURE_W) & (TEXTURE_W - 1);
            const ti = (stTexY * TEXTURE_W + stTexX) * 4;
            const i = (y * w + x) * 4;
            buf[i]     = Math.min(255, texData[ti]     * light);
            buf[i + 1] = Math.min(255, texData[ti + 1] * light);
            buf[i + 2] = Math.min(255, texData[ti + 2] * light);
            buf[i + 3] = 255;
          }
          yBot = stepWallTop - 1;
        }
      }

      prevCellH = cellH;
      if (yBot < Math.ceil(horizon)) break;
    }

    // Fill any remaining floor below the last drawn strip.
    // Skipped when a wall was hit — wall pixels already own those rows.
    if (!hitWall && yBot >= Math.ceil(horizon)) {
      const camAbove = eyeH - prevCellH;
      if (camAbove > 0) {
        drawFloorStripe(buf, x, Math.ceil(horizon), yBot, w, h, horizon, eyeH, prevCellH, rayDirX, rayDirY, now);
      }
    }
  }

  ctx.putImageData(frameData, 0, 0);
}

function drawFloorStripe(buf, x, yStart, yEnd, w, h, horizon, eyeH, cellH, rayDirX, rayDirY, now) {
  const camAbove = eyeH - cellH;
  if (camAbove <= 0) return;

  const isWater  = cellH < -0.05;
  const isRaised = cellH >  0.05;
  const texData  = isWater ? waterTexData : (isRaised ? stairTexData : floorTexData);

  for (let y = yStart; y <= yEnd; y++) {
    const rowDir = y - horizon;
    if (rowDir <= 0) continue;

    const rowDist = camAbove * h / rowDir;

    const fx = player.x + rowDist * rayDirX;
    const fy = player.y + rowDist * rayDirY;

    let tx, ty;
    if (isWater) {
      const wobble = Math.sin(fx * 4 + now * 2) * 0.03
                   + Math.cos(fy * 3 + now * 1.5) * 0.03;
      tx = Math.floor((fx + wobble) * TEXTURE_W) & (TEXTURE_W - 1);
      ty = Math.floor((fy + wobble) * TEXTURE_W) & (TEXTURE_W - 1);
    } else {
      tx = Math.floor(fx * TEXTURE_W) & (TEXTURE_W - 1);
      ty = Math.floor(fy * TEXTURE_W) & (TEXTURE_W - 1);
    }

    const light = Math.max(0.15, 1.0 - rowDist * 0.07);
    const ti = (ty * TEXTURE_W + tx) * 4;
    const i  = (y * w + x) * 4;
    buf[i]     = texData[ti]     * light;
    buf[i + 1] = texData[ti + 1] * light;
    buf[i + 2] = texData[ti + 2] * light;
    buf[i + 3] = 255;
  }
}
