import test from "node:test";
import assert from "node:assert/strict";

import { WebSocketServer } from "ws";

import { Action, CellType } from "./enums.js";
import { __internal, run } from "./client.js";
import type { IBot } from "./bot.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("client internals decode and sanitize values", () => {
  assert.equal(__internal.decodeCell("WALL"), CellType.WALL);
  assert.equal(__internal.decodeCell(2), CellType.BOX);
  assert.equal(__internal.decodeCell("invalid"), CellType.AIR);

  assert.equal(__internal.toNumberOr(NaN, 7), 7);
  assert.equal(__internal.toNumberOr("x", 7), 7);
  assert.equal(__internal.toNumberOr(Infinity, 7), 7);
  assert.equal(__internal.toNumberOr(9, 7), 9);

  assert.equal(__internal.toNonNegativeInt(-1), 0);
  assert.equal(__internal.toNonNegativeInt(Infinity), 0);
  assert.equal(__internal.toNonNegativeInt(3.9), 3);

  assert.equal(__internal.normalizeAction(Action.MOVE_LEFT), Action.MOVE_LEFT);
  assert.equal(__internal.normalizeAction("BAD"), Action.DO_NOTHING);
});

test("toSafeBot returns fallback bot for invalid input", async () => {
  const safeBot = __internal.toSafeBot({} as IBot);
  const action = await safeBot.getNextMove({} as never, {} as never);
  assert.equal(action, Action.DO_NOTHING);
});

test("to2dCells and toGameState handle malformed numbers safely", () => {
  const cells = __internal.to2dCells({
    width: 2,
    height: 2,
    field: [0, 1, "BOX", "x"],
  });
  assert.deepEqual(cells, [
    [CellType.WALL, CellType.AIR],
    [CellType.BOX, CellType.AIR],
  ]);

  const state = __internal.toGameState(
    {
      currentTick: Number.NaN,
      players: [
        {
          id: "me",
          pos: { x: Number.NaN, y: 3 },
          health: Number.NaN,
          score: 5,
        },
      ],
      field: {
        width: 3,
        height: 3,
        field: new Array(9).fill("AIR"),
      },
      bombs: [{ pos: { x: 1, y: Number.NaN }, fuse: Number.NaN }],
      explosions: [{ x: Number.NaN, y: 1 }],
    },
    "me",
  );

  assert.equal(state.currentTick, 0);
  assert.deepEqual([state.me.pos.x, state.me.pos.y], [0, 3]);
  assert.equal(state.me.health, 0);
  assert.equal(state.bombs[0]?.fuse, 0);
  assert.deepEqual([state.bombs[0]?.pos.x, state.bombs[0]?.pos.y], [1, 0]);
  assert.deepEqual([state.explosions[0]?.x, state.explosions[0]?.y], [0, 1]);
});

test("toGameState throws when players are missing", () => {
  assert.throws(
    () =>
      __internal.toGameState(
        {
          currentTick: 1,
          players: [],
          field: { width: 0, height: 0, field: [] },
          bombs: [],
          explosions: [],
        },
        "me",
      ),
    /no players/,
  );
});

test("run sends ready state and bot action via websocket", async () => {
  const wss = new WebSocketServer({ port: 0 });
  const address = wss.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind websocket server");
  }

  process.env.BOMBAHEAD_WS_URL = `ws://127.0.0.1:${address.port}`;
  process.env.BOMBAHEAD_TOKEN = "token-123";

  const received: Array<{ type: string; payload: unknown }> = [];

  const done = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("timed out waiting for messages")),
      3000,
    );

    wss.on("connection", (socket) => {
      socket.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          payload: unknown;
        };
        received.push(msg);

        if (msg.type === "player_status_update") {
          socket.send(
            JSON.stringify({ type: "welcome", payload: { clientId: "me" } }),
          );
          socket.send(
            JSON.stringify({
              type: "classic_state",
              payload: {
                currentTick: 1,
                players: [
                  { id: "me", pos: { x: 1, y: 1 }, health: 3, score: 0 },
                  { id: "other", pos: { x: 2, y: 2 }, health: 3, score: 0 },
                ],
                field: { width: 3, height: 3, field: new Array(9).fill("AIR") },
                bombs: [],
                explosions: [],
              },
            }),
          );
        }

        if (msg.type === "classic_input") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  });

  const bot: IBot = {
    getNextMove: async () => Action.MOVE_UP,
  };

  await run(bot);
  await done;

  assert.equal(received[0]?.type, "player_status_update");
  assert.deepEqual(received[1], {
    type: "classic_input",
    payload: { move: Action.MOVE_UP },
  });

  for (const client of wss.clients) {
    client.close();
  }
  wss.close();
  await delay(20);
});
