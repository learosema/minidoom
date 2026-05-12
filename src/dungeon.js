import { random, randomInt } from './random.js';

// Generate a procedural dungeon as a 2D tile grid.
// Convention: 0 = walkable floor, 1 = solid wall.
export function generateDungeon({
  gridWidth = 64,
  gridHeight = 64,
  roomCount = 30,
  roomMinSize = 4,
  roomMaxSize = 10,
  circleRadius = 20,
  hallwayWidth = 2,
  extraEdgeChance = 0.1
} = {}) {
  // Initialize grid as all walls
  const grid = [];
  for (let y = 0; y < gridHeight; y++) {
    grid[y] = new Array(gridWidth).fill(1);
  }

  const cx = Math.floor(gridWidth / 2);
  const cy = Math.floor(gridHeight / 2);

  // ── Step 1: Generate rooms ────────────────────────────────────────────────
  const rooms = [];
  for (let i = 0; i < roomCount; i++) {
    const w = randomInt(roomMinSize, roomMaxSize);
    const h = randomInt(roomMinSize, roomMaxSize);
    const [px, py] = randomPointInCircle(circleRadius);
    const x = Math.round(cx + px - w / 2);
    const y = Math.round(cy + py - h / 2);
    rooms.push({ id: i, x, y, width: w, height: h, isMain: false });
  }

  // ── Step 2: Separate overlapping rooms ────────────────────────────────────
  for (let iter = 0; iter < 150; iter++) {
    let moved = false;
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the smaller overlap axis
          if (overlapX < overlapY) {
            const push = Math.ceil(overlapX / 2);
            if (a.x < b.x) { a.x -= push; b.x += push; }
            else { a.x += push; b.x -= push; }
          } else {
            const push = Math.ceil(overlapY / 2);
            if (a.y < b.y) { a.y -= push; b.y += push; }
            else { a.y += push; b.y -= push; }
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Clamp rooms to grid bounds (leave 1-tile border)
  for (const room of rooms) {
    room.x = Math.max(1, Math.min(room.x, gridWidth - room.width - 1));
    room.y = Math.max(1, Math.min(room.y, gridHeight - room.height - 1));
  }

  // ── Step 3: Select main rooms ─────────────────────────────────────────────
  let meanW = 0, meanH = 0;
  for (const r of rooms) { meanW += r.width; meanH += r.height; }
  meanW /= rooms.length;
  meanH /= rooms.length;

  const mainRooms = [];
  for (const room of rooms) {
    if (room.width >= meanW * 1.25 && room.height >= meanH * 1.25) {
      room.isMain = true;
      mainRooms.push(room);
    }
  }

  // Need at least 2 main rooms; if not enough, pick the largest ones
  if (mainRooms.length < 2) {
    const sorted = [...rooms].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    for (let i = 0; i < Math.min(4, sorted.length); i++) {
      if (!sorted[i].isMain) {
        sorted[i].isMain = true;
        mainRooms.push(sorted[i]);
      }
    }
  }

  // ── Step 4: Connect main rooms via MST + extra edges ──────────────────────
  const edges = buildMST(mainRooms);

  // Add some extra edges for loops
  for (let i = 0; i < mainRooms.length; i++) {
    for (let j = i + 1; j < mainRooms.length; j++) {
      if (random() < extraEdgeChance) {
        const hasEdge = edges.some(e =>
          (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i));
        if (!hasEdge) edges.push([i, j]);
      }
    }
  }

  // ── Step 5: Carve rooms ───────────────────────────────────────────────────
  // First carve all main rooms
  for (const room of mainRooms) {
    carveRoom(grid, room, gridWidth, gridHeight);
  }

  // ── Step 6: Carve corridors ───────────────────────────────────────────────
  for (const [i, j] of edges) {
    const a = mainRooms[i], b = mainRooms[j];
    const ax = Math.floor(a.x + a.width / 2);
    const ay = Math.floor(a.y + a.height / 2);
    const bx = Math.floor(b.x + b.width / 2);
    const by = Math.floor(b.y + b.height / 2);
    carveCorridor(grid, ax, ay, bx, by, hallwayWidth, gridWidth, gridHeight);
  }

  // Carve non-main rooms that overlap with any carved floor
  for (const room of rooms) {
    if (room.isMain) continue;
    if (roomOverlapsFloor(grid, room)) {
      carveRoom(grid, room, gridWidth, gridHeight);
    }
  }

  // ── Step 7: Generate height map ──────────────────────────────────────────
  const heightMap = [];
  for (let y = 0; y < gridHeight; y++) {
    heightMap[y] = new Array(gridWidth).fill(0);
  }

  // Assign heights to main rooms (skip the first — that's the player start)
  const roomHeights = new Map();
  for (const room of mainRooms) {
    roomHeights.set(room.id, 0);
  }

  // Designate ~30% of non-start main rooms as water, ~20% as elevated
  for (let i = 1; i < mainRooms.length; i++) {
    const roll = random();
    if (roll < 0.3) {
      roomHeights.set(mainRooms[i].id, -0.25);
    } else if (roll < 0.5) {
      roomHeights.set(mainRooms[i].id, 0.2);
    }
  }

  // Apply room heights
  for (const room of mainRooms) {
    const h = roomHeights.get(room.id) || 0;
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (x > 0 && x < gridWidth - 1 && y > 0 && y < gridHeight - 1 && grid[y][x] === 0) {
          heightMap[y][x] = h;
        }
      }
    }
  }

  // Non-main carved rooms inherit height 0 (already default)

  // Create graduated heights in corridors connecting rooms at different levels
  for (const [i, j] of edges) {
    const a = mainRooms[i], b = mainRooms[j];
    const hA = roomHeights.get(a.id) || 0;
    const hB = roomHeights.get(b.id) || 0;
    if (Math.abs(hA - hB) > 0.01) {
      const ax = Math.floor(a.x + a.width / 2);
      const ay = Math.floor(a.y + a.height / 2);
      const bx = Math.floor(b.x + b.width / 2);
      const by = Math.floor(b.y + b.height / 2);
      graduateCorridor(heightMap, grid, ax, ay, bx, by, hA, hB, hallwayWidth, gridWidth, gridHeight);
    }
  }

  // ── Find player start: center of first main room ──────────────────────────
  const startRoom = mainRooms[0];
  const playerStart = {
    x: Math.floor(startRoom.x + startRoom.width / 2),
    y: Math.floor(startRoom.y + startRoom.height / 2)
  };

  return { grid, heightMap, rooms, mainRooms, playerStart, width: gridWidth, height: gridHeight };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomPointInCircle(radius) {
  const t = 2 * Math.PI * random();
  const u = random() + random();
  const r = u > 1 ? 2 - u : u;
  return [radius * r * Math.cos(t), radius * r * Math.sin(t)];
}

function roomCenter(room) {
  return [room.x + room.width / 2, room.y + room.height / 2];
}

function dist(a, b) {
  const [ax, ay] = roomCenter(a);
  const [bx, by] = roomCenter(b);
  return Math.hypot(ax - bx, ay - by);
}

function buildMST(rooms) {
  if (rooms.length <= 1) return [];
  const n = rooms.length;
  const inMST = new Array(n).fill(false);
  const minCost = new Array(n).fill(Infinity);
  const minEdge = new Array(n).fill(-1);
  const edges = [];

  minCost[0] = 0;

  for (let count = 0; count < n; count++) {
    // Pick cheapest node not yet in MST
    let u = -1;
    for (let i = 0; i < n; i++) {
      if (!inMST[i] && (u === -1 || minCost[i] < minCost[u])) u = i;
    }
    inMST[u] = true;
    if (minEdge[u] !== -1) edges.push([minEdge[u], u]);

    // Update costs
    for (let v = 0; v < n; v++) {
      if (!inMST[v]) {
        const d = dist(rooms[u], rooms[v]);
        if (d < minCost[v]) {
          minCost[v] = d;
          minEdge[v] = u;
        }
      }
    }
  }

  return edges;
}

function carveRoom(grid, room, gw, gh) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x > 0 && x < gw - 1 && y > 0 && y < gh - 1) {
        grid[y][x] = 0;
      }
    }
  }
}

function carveCorridor(grid, x1, y1, x2, y2, width, gw, gh) {
  const half = Math.floor(width / 2);

  // Randomly choose horizontal-first or vertical-first
  if (random() < 0.5) {
    carveHLine(grid, x1, x2, y1, half, gw, gh);
    carveVLine(grid, x2, y1, y2, half, gw, gh);
  } else {
    carveVLine(grid, x1, y1, y2, half, gw, gh);
    carveHLine(grid, x1, x2, y2, half, gw, gh);
  }
}

function carveHLine(grid, x1, x2, y, half, gw, gh) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    for (let dy = -half; dy <= half; dy++) {
      const yy = y + dy;
      if (x > 0 && x < gw - 1 && yy > 0 && yy < gh - 1) {
        grid[yy][x] = 0;
      }
    }
  }
}

function carveVLine(grid, x, y1, y2, half, gw, gh) {
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    for (let dx = -half; dx <= half; dx++) {
      const xx = x + dx;
      if (xx > 0 && xx < gw - 1 && y > 0 && y < gh - 1) {
        grid[y][xx] = 0;
      }
    }
  }
}

function graduateCorridor(heightMap, grid, x1, y1, x2, y2, hA, hB, width, gw, gh) {
  const half = Math.floor(width / 2);
  // Collect all corridor cells along the L-shaped path, then interpolate heights
  const cells = [];

  // Horizontal segment first, then vertical
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    for (let dy = -half; dy <= half; dy++) {
      const yy = y1 + dy;
      if (x > 0 && x < gw - 1 && yy > 0 && yy < gh - 1 && grid[yy][x] === 0) {
        const t = maxX === minX ? 0 : (x - minX) / (maxX - minX) * 0.5;
        cells.push({ x, y: yy, t });
      }
    }
  }

  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    for (let dx = -half; dx <= half; dx++) {
      const xx = x2 + dx;
      if (xx > 0 && xx < gw - 1 && y > 0 && y < gh - 1 && grid[y][xx] === 0) {
        const t = maxY === minY ? 0.5 : 0.5 + ((y - minY) / (maxY - minY)) * 0.5;
        cells.push({ x: xx, y, t });
      }
    }
  }

  // Quantize to discrete steps (0.05 increments) for clean visual stair steps
  const stepSize = 0.05;
  for (const cell of cells) {
    const s = cell.t * cell.t * (3 - 2 * cell.t);
    const raw = hA + (hB - hA) * s;
    heightMap[cell.y][cell.x] = Math.round(raw / stepSize) * stepSize;
  }
}

function roomOverlapsFloor(grid, room) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
        if (grid[y][x] === 0) return true;
      }
    }
  }
  return false;
}
