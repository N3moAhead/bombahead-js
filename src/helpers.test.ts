import test from "node:test";
import assert from "node:assert/strict";

import { Action, CellType } from "./enums.js";
import { GameHelpers } from "./helpers.js";
import { Position } from "./models.js";
import type { GameState } from "./models.js";

function makeState(params?: Partial<GameState>): GameState {
  const width = params?.field?.width ?? 5;
  const height = params?.field?.height ?? 5;
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

test("isWalkable respects bounds, walls, boxes, and bombs", () => {
  const cells = [
    [CellType.AIR, CellType.WALL],
    [CellType.BOX, CellType.AIR],
  ];
  const state = makeState({
    field: { width: 2, height: 2, cells },
    bombs: [{ pos: new Position(1, 1), fuse: 3 }],
  });

  const h = new GameHelpers(state);
  assert.equal(h.isWalkable(new Position(-1, 0)), false);
  assert.equal(h.isWalkable(new Position(1, 0)), false);
  assert.equal(h.isWalkable(new Position(0, 1)), false);
  assert.equal(h.isWalkable(new Position(1, 1)), false);
  assert.equal(h.isWalkable(new Position(0, 0)), true);
});

test("getAdjacentWalkablePositions returns walkable neighbors in direction order", () => {
  const cells = [
    [CellType.AIR, CellType.AIR, CellType.AIR],
    [CellType.WALL, CellType.AIR, CellType.AIR],
    [CellType.AIR, CellType.BOX, CellType.AIR],
  ];
  const state = makeState({
    field: { width: 3, height: 3, cells },
    bombs: [{ pos: new Position(2, 1), fuse: 2 }],
  });

  const h = new GameHelpers(state);
  const result = h.getAdjacentWalkablePositions(new Position(1, 1));
  assert.deepEqual(
    result.map((p) => [p.x, p.y]),
    [[1, 0]],
  );
});

test("getNextActionTowards uses BFS pathing around obstacles", () => {
  const cells = [
    [CellType.AIR, CellType.WALL, CellType.AIR],
    [CellType.AIR, CellType.AIR, CellType.AIR],
    [CellType.AIR, CellType.AIR, CellType.AIR],
  ];
  const state = makeState({
    field: { width: 3, height: 3, cells },
  });

  const h = new GameHelpers(state);
  const action = h.getNextActionTowards(new Position(0, 0), new Position(2, 0));
  assert.equal(action, Action.MOVE_DOWN);
});

test("isSafe checks explosions, bomb occupancy, and chain-reaction blast tiles", () => {
  const cells = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => CellType.AIR),
  );
  const state = makeState({
    field: { width: 5, height: 5, cells },
    explosions: [new Position(0, 0)],
    bombs: [
      { pos: new Position(1, 1), fuse: 0 },
      { pos: new Position(3, 1), fuse: 4 },
    ],
  });

  const h = new GameHelpers(state);
  assert.equal(h.isSafe(new Position(0, 0)), false);
  assert.equal(h.isSafe(new Position(1, 1)), false);
  assert.equal(h.isSafe(new Position(4, 1)), false);
  assert.equal(h.isSafe(new Position(4, 4)), true);
});

test("getNearestSafePosition returns closest reachable safe tile", () => {
  const cells = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => CellType.AIR),
  );
  const state = makeState({
    me: { id: "me", pos: new Position(2, 2), health: 3, score: 0 },
    field: { width: 5, height: 5, cells },
    bombs: [{ pos: new Position(2, 2), fuse: 0 }],
  });

  const h = new GameHelpers(state);
  const safe = h.getNearestSafePosition(new Position(1, 2));
  assert.ok(safe);
  assert.equal(h.isSafe(safe as Position), true);
});

test("findNearestBox uses reachable path distance, not raw Manhattan scan", () => {
  const cells = [
    [CellType.AIR, CellType.WALL, CellType.BOX, CellType.AIR, CellType.AIR],
    [CellType.AIR, CellType.WALL, CellType.WALL, CellType.WALL, CellType.AIR],
    [CellType.AIR, CellType.AIR, CellType.AIR, CellType.AIR, CellType.AIR],
    [CellType.AIR, CellType.WALL, CellType.WALL, CellType.WALL, CellType.AIR],
    [CellType.AIR, CellType.AIR, CellType.BOX, CellType.AIR, CellType.AIR],
  ];

  const h = new GameHelpers(
    makeState({
      me: { id: "me", pos: new Position(0, 0), health: 3, score: 0 },
      field: { width: 5, height: 5, cells },
    }),
  );

  const box = h.findNearestBox(new Position(0, 0));
  assert.ok(box);
  assert.deepEqual([box?.x, box?.y], [2, 4]);
});

test("helper methods handle invalid position inputs without throwing", () => {
  const h = new GameHelpers(makeState());
  const bad = null as unknown as Position;

  assert.equal(h.isWalkable(bad), false);
  assert.deepEqual(h.getAdjacentWalkablePositions(bad), []);
  assert.equal(
    h.getNextActionTowards(bad, new Position(1, 1)),
    Action.DO_NOTHING,
  );
  assert.equal(h.isSafe(bad), false);
  assert.equal(h.getNearestSafePosition(bad), null);
  assert.equal(h.findNearestBox(bad), null);
});
