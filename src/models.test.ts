import test from "node:test";
import assert from "node:assert/strict";

import { Position } from "./models.js";

test("Position.distanceTo returns Manhattan distance", () => {
  const a = new Position(1, 2);
  const b = new Position(4, 6);
  assert.equal(a.distanceTo(b), 7);
});

test("Position.equals compares coordinates", () => {
  const a = new Position(3, 5);
  assert.equal(a.equals(new Position(3, 5)), true);
  assert.equal(a.equals(new Position(3, 4)), false);
});
