import { initInput, keys } from './input.js';
import { player, updatePlayer } from './player.js';
import { render } from './renderer.js';
import { initResize } from './resize.js';
import { setMap } from './map.js';
import { generateDungeon } from './dungeon.js';
import { seedRandom } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
initResize(canvas);
initInput();

// Generate a procedural dungeon
const seed = Date.now();
seedRandom(seed);
const dungeon = generateDungeon();
setMap(dungeon.grid, dungeon.heightMap);
player.x = dungeon.playerStart.x + 0.5;
player.y = dungeon.playerStart.y + 0.5;

let lastTime = performance.now();
function loop() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  updatePlayer(dt, keys);
  render(ctx, canvas);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
