import test from "node:test";
import assert from "node:assert/strict";

import { CellType } from "./enums.js";
import { Position } from "./models.js";
import type { GameState } from "./models.js";
import { printField, renderField } from "./print-field.js";

function makeState(params?: Partial<GameState>): GameState {
  const width = params?.field?.width ?? 4;
  const height = params?.field?.height ?? 3;
  const cells =
    params?.field?.cells ??
    Array.from({ length: height }, () =>
      Array.from({ length: width }, () => CellType.AIR),
    );

  return {
    currentTick: params?.currentTick ?? 0,
    me: params?.me ?? {
      id: "me",
      pos: new Position(0, 0),
      health: 3,
      score: 0,
    },
    opponents: params?.opponents ?? [],
    players: params?.players ?? [],
    field: {
      width,
      height,
      cells,
    },
    bombs: params?.bombs ?? [],
    explosions: params?.explosions ?? [],
  };
}

test("RenderField handles nil and empty fields", () => {
  assert.equal(renderField(undefined), "<nil game state>\n");
  assert.equal(
    renderField(makeState({ field: { width: 0, height: 3, cells: [] } })),
    "<empty field>\n",
  );
});

test("RenderField renders board, players and bombs in stable order", () => {
  const cells = [
    [CellType.AIR, CellType.WALL, CellType.AIR, CellType.AIR],
    [CellType.BOX, CellType.AIR, CellType.AIR, CellType.AIR],
    [CellType.AIR, CellType.AIR, CellType.AIR, CellType.AIR],
  ];

  const output = renderField(
    makeState({
      me: { id: "me", pos: new Position(3, 2), health: 2, score: 11 },
      opponents: [
        { id: "opp-b", pos: new Position(2, 1), health: 1, score: 7 },
        { id: "opp-a", pos: new Position(0, 2), health: 3, score: 9 },
      ],
      players: [
        { id: "opp-b", pos: new Position(2, 1), health: 1, score: 7 },
        { id: "me", pos: new Position(3, 2), health: 2, score: 11 },
        { id: "opp-a", pos: new Position(0, 2), health: 3, score: 9 },
      ],
      field: { width: 4, height: 3, cells },
      bombs: [
        { pos: new Position(2, 2), fuse: 5 },
        { pos: new Position(1, 1), fuse: 1 },
      ],
      explosions: [new Position(0, 0)],
    }),
  );

  assert.match(output, /^╔════════╗\n/);
  assert.match(output, /\n║💥🧱    ║\n/);
  assert.match(output, /\n║📦💣🏃  ║\n/);
  assert.match(output, /\n║👾  💣🤖║\n/);

  assert.ok(output.includes("--- PLAYERS ---\n"));
  const meIndex = output.indexOf(
    "🤖 Player me | Health: 2, Score: 11 | Pos: (3,2)",
  );
  const oppAIndex = output.indexOf(
    "👾 Player ...pp-a | Health: 3, Score: 9 | Pos: (0,2)",
  );
  const oppBIndex = output.indexOf(
    "🏃 Player ...pp-b | Health: 1, Score: 7 | Pos: (2,1)",
  );
  assert.ok(meIndex >= 0 && oppAIndex > meIndex && oppBIndex > oppAIndex);

  const bomb1 = output.indexOf("💣 at (1,1) | Fuse: 1");
  const bomb2 = output.indexOf("💣 at (2,2) | Fuse: 5");
  assert.ok(bomb1 >= 0 && bomb2 > bomb1);
});

test("PrintField writes rendered output to stdout", () => {
  const state = makeState();
  const writes: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array) => {
    writes.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    );
    return true;
  }) as typeof process.stdout.write;

  try {
    printField(state);
  } finally {
    process.stdout.write = originalWrite;
  }

  assert.equal(writes.join(""), renderField(state));
});
