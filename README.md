# bombahead-js

TypeScript SDK for building bots for BombAhead.

## What this SDK gives you

- A simple `run(bot)` entrypoint to connect your bot to the game server.
- Strong TypeScript models (`GameState`, `Position`, `Action`, `CellType`).
- Utility helpers for navigation/safety (`GameHelpers`).
- Runtime hardening against malformed data and invalid bot output (safe fallbacks instead of crashes).

---

## Installation

```bash
npm install bombahead-js
```

If you are developing inside this repo:

```bash
npm install
npm run build
```

---

## Quick Start

Create `bot.ts`:

```ts
import { Action, run, type IBot, type GameState, type GameHelpers } from "bombahead-js";

const bot: IBot = {
  getNextMove(state: GameState, helpers: GameHelpers): Action {
    // 1) Try to move to a nearby box
    const box = helpers.findNearestBox(state.me.pos);
    if (box) {
      return helpers.getNextActionTowards(state.me.pos, box);
    }

    // 2) If current tile is unsafe, move to nearest safe tile
    if (!helpers.isSafe(state.me.pos)) {
      const safe = helpers.getNearestSafePosition(state.me.pos);
      if (safe) {
        return helpers.getNextActionTowards(state.me.pos, safe);
      }
    }

    // 3) Default fallback
    return Action.DO_NOTHING;
  },
};

await run(bot);
```

## Bot Interface

```ts
interface IBot {
  getNextMove(state: GameState, helpers: GameHelpers): Action | Promise<Action>;
}
```

Your `getNextMove` can be sync or async.

### Important behavior

- If your bot throws, SDK falls back to `Action.DO_NOTHING`.
- If your bot returns an invalid action, SDK normalizes to `Action.DO_NOTHING`.
- If you pass an invalid bot object to `run(...)`, SDK uses a safe fallback bot.

This keeps the process alive even with faulty user code.

---

## Core Types

### `Action`

- `MOVE_UP`
- `MOVE_DOWN`
- `MOVE_LEFT`
- `MOVE_RIGHT`
- `PLACE_BOMB`
- `DO_NOTHING`

### `CellType`

- `AIR`
- `WALL`
- `BOX`

### `GameState`

Each tick provides:

- `currentTick`
- `me` (your player)
- `opponents`
- `players`
- `field` (`width`, `height`, `cells`)
- `bombs`
- `explosions`

---

## Using `GameHelpers`

`GameHelpers` wraps common game logic:

- `isWalkable(pos)`
  - In bounds, not wall/box, no bomb on tile.
- `getAdjacentWalkablePositions(pos)`
  - Valid movement neighbors in order: up, right, down, left.
- `getNextActionTowards(start, target)`
  - BFS-based first step toward target (obstacle-aware).
- `isSafe(pos)`
  - Checks bounds, current explosions, bombs, and bomb blast/chain-reaction risk.
- `getNearestSafePosition(start)`
  - BFS search for nearest reachable safe tile.
- `findNearestBox(start)`
  - BFS-based nearest reachable box target.

All helper methods are runtime-guarded and return safe defaults for invalid inputs.

---

## Safety and Data Validation

The SDK is defensive by design:

- Malformed server payload values (`null`, `NaN`, `Infinity`, wrong shapes) are sanitized.
- Unknown cell payloads default to `AIR`.
- Invalid numeric coordinates are clamped to safe integer defaults.
- WebSocket connect/send errors are caught and surfaced through error handlers instead of crashing.

This means raw user input or malformed wire data should not crash the SDK process.

---

## Recommended Project Structure

```txt
my-bot/
  src/
    bot.ts
  package.json
  tsconfig.json
```

Minimal `package.json` scripts idea:

```json
{
  "scripts": {
    "dev": "tsx src/bot.ts",
    "build": "tsc",
    "start": "node dist/bot.js"
  }
}
```

---

## Local SDK Development

Inside this repository:

```bash
npm run build
npm test
```

Current suite covers helpers, model behavior, client parsing/safety, and WebSocket client behavior.

---

## API Exports

```ts
export { run };
export type { IBot };
export { Action, CellType };
export { Position };
export type { Bomb, Field, GameState, Player };
export { GameHelpers };
```

---

## License

MIT
