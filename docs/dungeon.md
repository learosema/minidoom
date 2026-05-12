# Dungeon Generator

`src/dungeon.js` — produces a `{ grid, heightMap, rooms, mainRooms, playerStart }` object consumed by `map.js` and `main.js`.

## Algorithm

### 1. Room placement

`roomCount` (default 30) rooms are placed at random positions within a circle of `circleRadius` tiles centred on the grid. Each room has a random width and height in `[roomMinSize, roomMaxSize]`.

### 2. Separation

Rooms are pushed apart iteratively (up to 150 passes) by resolving the smallest overlap axis between every overlapping pair. This produces a non-overlapping spread without grid snapping.

### 3. Main room selection

Rooms wider than `mean × 1.25` **and** taller than `mean × 1.25` are flagged as "main". If fewer than 2 qualify, the largest rooms are promoted until at least 4 are main rooms.

### 4. Connectivity — MST + extra edges

A minimum spanning tree (Prim's algorithm, O(n²)) connects all main rooms by Euclidean centre distance. `extraEdgeChance` (default 10%) additional edges are added to create loops.

### 5. Carving

- Main rooms are carved first.
- Corridors between connected room pairs are L-shaped (random horizontal-first or vertical-first), width `hallwayWidth` (default 2).
- Non-main rooms that overlap any already-carved floor tile are then carved in, naturally creating alcoves and side passages.

### 6. Height map

Main rooms are assigned heights:

| Probability | Height | Effect |
|-------------|--------|--------|
| 30% | −0.25 | Water pit (animated blue floor) |
| 20% | 0.2  | Raised platform (stone floor) |
| 50% | 0.0  | Normal floor |

The start room (first main room) is always height 0.

Corridors connecting rooms at different heights use `graduateCorridor`, which interpolates heights with a smoothstep curve quantised to 0.05-unit steps — producing visible stair steps the player can walk up/down.

### 7. Player start

Centre of the first main room (always height 0).

## Parameters

```js
generateDungeon({
  gridWidth    = 64,
  gridHeight   = 64,
  roomCount    = 30,
  roomMinSize  = 4,
  roomMaxSize  = 10,
  circleRadius = 20,   // rooms spawn within this radius of the grid centre
  hallwayWidth = 2,
  extraEdgeChance = 0.1
})
```

## Seeding

`main.js` seeds the PRNG with `Date.now()` before calling `generateDungeon()`. To reproduce a dungeon, call `seedRandom(seed)` with the same integer. The seed is not currently shown in the UI, but `console.log(seed)` in `main.js` is enough to capture it.

## Height walkability

`isWalkable` in `map.js` blocks movement if the height difference exceeds 0.3 units. Graduated corridors stay within this limit (max single step is 0.05), so they're always traversable.
