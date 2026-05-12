let map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

let heightMap = null;
let mapWidth = map[0].length;
let mapHeight = map.length;

export function setMap(newMap, newHeightMap = null) {
  map = newMap;
  heightMap = newHeightMap;
  mapWidth = map[0].length;
  mapHeight = map.length;
}

export function getMapWidth() { return mapWidth; }
export function getMapHeight() { return mapHeight; }

export function getCell(x, y) {
  if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return 1;
  return map[y][x];
}

export function getHeight(x, y) {
  if (!heightMap || x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return 0;
  return heightMap[y][x];
}

export function isWalkable(x, y, fromHeight) {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (getCell(ix, iy) !== 0) return false;
  if (fromHeight !== undefined) {
    const targetHeight = getHeight(ix, iy);
    if (Math.abs(targetHeight - fromHeight) > 0.3) return false;
  }
  return true;
}
