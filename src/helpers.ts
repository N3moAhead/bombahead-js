import { Action, CellType } from "./enums";
import { GameState, Position } from "./models";

export class GameHelpers {
  constructor(private readonly state: GameState) {}

  /**
   * Checks whether the position is inside bounds and not blocked by wall/box/bomb.
   */
  isWalkable(pos: Position): boolean {
    if (!this.inBounds(pos)) {
      return false;
    }

    const cell = this.state.field.cells[pos.y]?.[pos.x];
    if (cell === CellType.WALL || cell === CellType.BOX) {
      return false;
    }

    return !this.state.bombs.some((bomb) => bomb.pos.equals(pos));
  }

  /**
   * Returns adjacent walkable positions in order: up, right, down, left.
   */
  getAdjacentWalkablePositions(pos: Position): Position[] {
    const neighbors = [
      new Position(pos.x, pos.y - 1),
      new Position(pos.x + 1, pos.y),
      new Position(pos.x, pos.y + 1),
      new Position(pos.x - 1, pos.y),
    ];

    return neighbors.filter((p) => this.isWalkable(p));
  }

  /**
   * Computes the immediate action to move from start toward target.
   *
   * TODO: Replace greedy step selection with A* / BFS for obstacle-aware routing.
   */
  getNextActionTowards(start: Position, target: Position): Action {
    if (start.equals(target)) {
      return Action.DO_NOTHING;
    }

    const dx = target.x - start.x;
    const dy = target.y - start.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? Action.MOVE_RIGHT : Action.MOVE_LEFT;
    }

    return dy > 0 ? Action.MOVE_DOWN : Action.MOVE_UP;
  }

  /**
   * Checks whether a tile appears safe in the current tick.
   *
   * TODO: Add proper blast simulation with fuse timing and chain-reaction handling.
   */
  isSafe(pos: Position): boolean {
    if (!this.inBounds(pos)) {
      return false;
    }

    if (this.state.explosions.some((exp) => exp.equals(pos))) {
      return false;
    }

    return !this.state.bombs.some((bomb) => bomb.pos.equals(pos));
  }

  /**
   * Finds nearest currently safe position from start.
   *
   * TODO: Use BFS with hazard-cost heuristics when full danger model is implemented.
   */
  getNearestSafePosition(start: Position): Position | null {
    if (this.isWalkable(start) && this.isSafe(start)) {
      return start;
    }

    for (const p of this.getAdjacentWalkablePositions(start)) {
      if (this.isSafe(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Finds the nearest box position.
   *
   * TODO: Replace O(width*height) scan with BFS that respects walls for path length.
   */
  findNearestBox(start: Position): Position | null {
    let best: Position | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let y = 0; y < this.state.field.height; y += 1) {
      for (let x = 0; x < this.state.field.width; x += 1) {
        if (this.state.field.cells[y]?.[x] !== CellType.BOX) {
          continue;
        }

        const candidate = new Position(x, y);
        const dist = start.distanceTo(candidate);
        if (dist < bestDistance) {
          bestDistance = dist;
          best = candidate;
        }
      }
    }

    return best;
  }

  private inBounds(pos: Position): boolean {
    return (
      pos.x >= 0 &&
      pos.y >= 0 &&
      pos.x < this.state.field.width &&
      pos.y < this.state.field.height
    );
  }
}
