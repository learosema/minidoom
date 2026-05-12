import { TEXTURE_W } from './config.js';
import { wallTexData, floorTexData, ceilTexData, waterTexData, stairTexData } from './textures.js';
import { player } from './player.js';
import { getCell, getHeight, getMapWidth, getMapHeight } from './map.js';

export function render(ctx, canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const frameData = ctx.createImageData(w, h);
  const buf = frameData.data;
  const now = performance.now() * 0.001;
  const mw = getMapWidth();
  const mh = getMapHeight();
  const pz = player.z || 0;

  // Eye height above world floor (standard wall spans 0..1, eye at middle + pz)
  const eyeH = 0.5 + pz;

  // Horizon shifts with player height for visual feedback when climbing/descending
  const horizon = h / 2 - pz * h * 0.5;

  // Distance from eye to ceiling (ceiling is at world height 1.0)
  const ceilAbove = 1.0 - eyeH;

  // ── Ceiling: scanline-based (flat, no height variation) ──────────────────
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
        buf[i] = ceilTexData[ti] * light;
        buf[i + 1] = ceilTexData[ti + 1] * light;
        buf[i + 2] = ceilTexData[ti + 2] * light;
        buf[i + 3] = 255;
      }
    }
  }

  // ── Per-column: wall casting + column-based floor ────────────────────────
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
    else { sX = 1; sideDX = (mapX + 1 - player.x) * deltaDX; }
    if (rayDirY < 0) { sY = -1; sideDY = (player.y - mapY) * deltaDY; }
    else { sY = 1; sideDY = (mapY + 1 - player.y) * deltaDY; }

    // yBot: bottommost undrawn row (floor grows upward from here)
    let yBot = h - 1;
    let side;
    let hitWall = false;

    // Use actual cell height for the player's starting cell
    let prevCellH = getHeight(Math.floor(player.x), Math.floor(player.y));

    for (let dda = 0; dda < 128; dda++) {
      // Advance DDA
      if (sideDX < sideDY) { sideDX += deltaDX; mapX += sX; side = 0; }
      else { sideDY += deltaDY; mapY += sY; side = 1; }

      if (mapX < 0 || mapX >= mw || mapY < 0 || mapY >= mh) break;

      const perpDist = side === 0
        ? (mapX - player.x + (1 - sX) / 2) / rayDirX
        : (mapY - player.y + (1 - sY) / 2) / rayDirY;

      if (perpDist <= 0) continue;

      const cell = getCell(mapX, mapY);
      const lineH = h / perpDist;

      // Where the previous cell's floor appears at this distance
      const prevCamAbove = eyeH - prevCellH;
      const prevFloorLine = Math.round(horizon + prevCamAbove * lineH);

      // Draw previous cell's floor up to this boundary
      const floorDrawStart = Math.max(Math.ceil(horizon), prevFloorLine);
      if (floorDrawStart <= yBot) {
        drawFloorStripe(buf, x, floorDrawStart, yBot, w, h, horizon, eyeH, prevCellH, rayDirX, rayDirY, now);
        yBot = floorDrawStart - 1;
      }

      if (cell > 0) {
        // ── WALL HIT ─────────────────────────────────────────────────────
        const wallTop = Math.max(0, Math.round(horizon - lineH / 2));
        const wallBot = Math.min(h - 1, Math.round(horizon + lineH / 2));
        const drawWallTop = wallTop;
        const drawWallBot = wallBot;

        if (drawWallBot >= drawWallTop) {
          let wallFrac = side === 0
            ? player.y + perpDist * rayDirY
            : player.x + perpDist * rayDirX;
          wallFrac -= Math.floor(wallFrac);

          let texX = Math.floor(wallFrac * TEXTURE_W);
          if (side === 0 && rayDirX > 0) texX = TEXTURE_W - texX - 1;
          if (side === 1 && rayDirY < 0) texX = TEXTURE_W - texX - 1;

          const texStep = TEXTURE_W / lineH;
          let texPos = (drawWallTop - horizon + lineH / 2) * texStep;
          const shadeFactor = side === 1 ? 0.6 : 1.0;
          const light = shadeFactor / (1.0 + perpDist * perpDist * 0.002);

          for (let y = drawWallTop; y <= drawWallBot; y++) {
            const texY = Math.floor(texPos) & (TEXTURE_W - 1);
            texPos += texStep;
            const ti = (texY * TEXTURE_W + texX) * 4;
            const i = (y * w + x) * 4;
            buf[i] = Math.min(255, wallTexData[ti] * light);
            buf[i + 1] = Math.min(255, wallTexData[ti + 1] * light);
            buf[i + 2] = Math.min(255, wallTexData[ti + 2] * light);
            buf[i + 3] = 255;
          }
        }
        hitWall = true;
        break;
      }

      // ── FLOOR CELL: handle height transition ─────────────────────────
      const cellH = getHeight(mapX, mapY);

      if (cellH > prevCellH + 0.02) {
        // STEPPING UP: new floor is higher → step wall visible (like a short wall)
        const currCamAbove = eyeH - cellH;
        const currFloorLine = Math.round(horizon + currCamAbove * lineH);
        const stepWallTop = Math.max(Math.ceil(horizon), currFloorLine);
        const stepWallBot = Math.min(prevFloorLine, yBot);

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
            buf[i] = Math.min(255, texData[ti] * light);
            buf[i + 1] = Math.min(255, texData[ti + 1] * light);
            buf[i + 2] = Math.min(255, texData[ti + 2] * light);
            buf[i + 3] = 255;
          }

          yBot = stepWallTop - 1;
        }
      }
      // For stepping DOWN: the step wall is not visible in horizontal-look
      // raycasting — the close floor occludes it. The lower floor fills in
      // naturally as the DDA progresses to further distances.

      prevCellH = cellH;
      if (yBot < Math.ceil(horizon)) break;
    }

    // Fill any remaining floor below what was drawn (skip if wall was hit — wall already owns those pixels)
    if (!hitWall && yBot >= Math.ceil(horizon)) {
      drawFloorStripe(buf, x, Math.ceil(horizon), yBot, w, h, horizon, eyeH, prevCellH, rayDirX, rayDirY, now);
    }
  }

  ctx.putImageData(frameData, 0, 0);
}

// Draw a vertical stripe of floor texture for a single column.
// cellH is the height of the floor cell being drawn.
function drawFloorStripe(buf, x, yStart, yEnd, w, h, horizon, eyeH, cellH, rayDirX, rayDirY, now) {
  // Camera height above this floor surface
  const camAbove = eyeH - cellH;
  if (camAbove <= 0) return;

  // Select texture based on absolute cell height
  const isWater = cellH < -0.05;
  const isRaised = cellH > 0.05;
  const texData = isWater ? waterTexData : (isRaised ? stairTexData : floorTexData);

  for (let y = yStart; y <= yEnd; y++) {
    const rowDir = y - horizon;
    if (rowDir <= 0) continue;

    // Distance to floor point — this is the perpendicular distance
    // Derivation: floor at world height cellH projects to
    //   screenY = horizon + camAbove * h / perpDist
    // Solving for perpDist:
    //   perpDist = camAbove * h / (screenY - horizon)
    const rowDist = camAbove * h / rowDir;

    const fx = player.x + rowDist * rayDirX;
    const fy = player.y + rowDist * rayDirY;

    let tx, ty;
    if (isWater) {
      // Sinusoidal wobble for water animation
      const wobble = Math.sin(fx * 4 + now * 2) * 0.03
                   + Math.cos(fy * 3 + now * 1.5) * 0.03;
      tx = Math.floor((fx + wobble) * TEXTURE_W) & (TEXTURE_W - 1);
      ty = Math.floor((fy + wobble) * TEXTURE_W) & (TEXTURE_W - 1);
    } else {
      tx = Math.floor(fx * TEXTURE_W) & (TEXTURE_W - 1);
      ty = Math.floor(fy * TEXTURE_W) & (TEXTURE_W - 1);
    }

    const ti = (ty * TEXTURE_W + tx) * 4;
    const light = Math.max(0.15, 1.0 - rowDist * 0.07);
    const i = (y * w + x) * 4;
    buf[i] = texData[ti] * light;
    buf[i + 1] = texData[ti + 1] * light;
    buf[i + 2] = texData[ti + 2] * light;
    buf[i + 3] = 255;
  }
}
