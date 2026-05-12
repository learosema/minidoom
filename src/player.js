import { isWalkable, getHeight } from './map.js';

export const player = {
  x: 3.5, y: 3.5,
  z: 0,
  dirX: -1, dirY: 0,
  planeX: 0, planeY: 0.66,
  moveSpeed: 3.0,
  rotSpeed: 2.0
};

export function rotatePlayer(angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const oldDirX = player.dirX;
  player.dirX = player.dirX * cos - player.dirY * sin;
  player.dirY = oldDirX * sin + player.dirY * cos;
  const oldPlaneX = player.planeX;
  player.planeX = player.planeX * cos - player.planeY * sin;
  player.planeY = oldPlaneX * sin + player.planeY * cos;
}

export function updatePlayer(dt, keys) {
  if (keys['ArrowLeft']) rotatePlayer(player.rotSpeed * dt);
  if (keys['ArrowRight']) rotatePlayer(-player.rotSpeed * dt);

  let moveX = 0, moveY = 0;
  if (keys['ArrowUp'] || keys['w']) { moveX += player.dirX; moveY += player.dirY; }
  if (keys['ArrowDown'] || keys['s']) { moveX -= player.dirX; moveY -= player.dirY; }

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX = (moveX / len) * player.moveSpeed * dt;
    moveY = (moveY / len) * player.moveSpeed * dt;
    const nx = player.x + moveX;
    const ny = player.y + moveY;
    if (isWalkable(player.x, ny, player.z)) player.y = ny;
    if (isWalkable(nx, player.y, player.z)) player.x = nx;
  }

  // Update player height from the cell they're standing on
  const currentHeight = getHeight(Math.floor(player.x), Math.floor(player.y));
  // Smooth height transition for stairs feel
  const heightDiff = currentHeight - player.z;
  player.z += heightDiff * Math.min(1, dt * 8);
}
