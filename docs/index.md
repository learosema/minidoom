# Mini Doom — Developer Docs

A browser raycaster with procedurally generated dungeons, seamless noise textures, variable floor heights, and an AI-assisted CI pipeline.

## Contents

| Doc | What's in it |
|-----|-------------|
| [development.md](development.md) | Getting started, controls, project layout |
| [architecture.md](architecture.md) | Module map, data flow, coordinate system |
| [renderer.md](renderer.md) | DDA raycaster internals, floor/wall math |
| [dungeon.md](dungeon.md) | Procedural dungeon generation algorithm |
| [textures.md](textures.md) | Toroidal 4D noise, seamless texture generation |
| [testing.md](testing.md) | Test setup, canvas mock, adding scenarios |
| [ci.md](ci.md) | Dagger CI functions, multi-model AI agents |

## Quick start

```bash
npm install && npm run dev   # dev server with hot reload
npm test                     # renderer gap tests (Node.js, no browser)
dagger call test             # same tests, containerised
dagger call review           # AI code review (needs LLM API key)
```
