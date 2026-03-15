import { Action, CellType } from "./enums.js";
import { Position } from "./models.js";
import type { Bomb, GameState } from "./models.js";

export class GameHelpers {
  constructor(private readonly state: GameState) {}

  /**
   * Checks whether the position is inside bounds and not blocked by wall/box/bomb.
   */
  isWalkable(pos: Position): boolean {
    if (!this.isValidPosition(pos) || !this.inBounds(pos)) {
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
    if (!this.isValidPosition(pos)) {
      return [];
    }

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
   * Uses BFS to find an obstacle-aware shortest path.
   */
  getNextActionTowards(start: Position, target: Position): Action {
    // Check if both given positions are valid
    if (!this.isValidPosition(start) || !this.isValidPosition(target)) {
      return Action.DO_NOTHING;
    }
    // No movement required if we are already
    // standing on the target
    if (start.equals(target)) {
      return Action.DO_NOTHING;
    }

    const visited = new Set<string>([this.posKey(target)]);
    const queue: Position[] = [target];

    while (queue.length > 0) {
      // Get the next element of the queue
      const current = queue.shift() as Position;

      for (const next of this.getAdjacentWalkablePositions(current)) {
        if (next.equals(start)) {
          return this.actionBetween(start, current);
        }

        const key = this.posKey(next);
        // Check if we have already visited the field
        // if so we can just skip it
        // otherwise we are going to walk in circles :(
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);
        queue.push(next);
      }
    }

    return Action.DO_NOTHING;
  }

  /**
   * Checks wether the position passed to the function
   * could be hit by a bomb that is currently on the grid
   *
   * To achieve the desired effect we simulate a field where each bomb explodes
   * afterwards we just check if the passed field is inside that explosion field
   */
  isSafe(pos: Position): boolean {
    if (!this.isValidPosition(pos) || !this.inBounds(pos)) {
      return false;
    }
    const dangerousPositions = this.getDangerousPositions();
    if (dangerousPositions.has(this.posKey(pos))) {
      return false;
    }
    return true;
  }

  /**
   * Finds nearest currently safe position from start.
   * Uses BFS over walkable cells to honor real movement constraints.
   */
  getNearestSafePosition(start: Position): Position | null {
    if (!this.isValidPosition(start)) {
      return null;
    }

    if (!this.isWalkable(start)) {
      return null;
    }

    const visited = new Set<string>([this.posKey(start)]);
    const queue: Position[] = [start];

    while (queue.length > 0) {
      const current = queue.shift() as Position;
      if (this.isSafe(current)) {
        return current;
      }

      for (const next of this.getAdjacentWalkablePositions(current)) {
        const key = this.posKey(next);
        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        queue.push(next);
      }
    }

    return null;
  }

  /**
   * Finds the nearest box position by path distance to an adjacent walkable cell
   */
  findNearestBox(start: Position): Position | null {
    if (!this.isValidPosition(start)) {
      return null;
    }

    const visited = new Set<string>([this.posKey(start)]);
    const queue: Position[] = [start];

    while (queue.length > 0) {
      const current = queue.shift() as Position;
      for (const adjacent of this.getAdjacentPositions(current)) {
        if (!this.inBounds(adjacent)) {
          continue;
        }

        const cell = this.state.field.cells[adjacent.y]?.[adjacent.x];
        if (cell === CellType.BOX) {
          return adjacent;
        }
      }

      for (const next of this.getAdjacentWalkablePositions(current)) {
        const key = this.posKey(next);
        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        queue.push(next);
      }
    }

    return null;
  }

  private getAdjacentPositions(pos: Position): Position[] {
    return [
      new Position(pos.x, pos.y - 1),
      new Position(pos.x + 1, pos.y),
      new Position(pos.x, pos.y + 1),
      new Position(pos.x - 1, pos.y),
    ];
  }

  private actionBetween(from: Position, to: Position): Action {
    if (to.x === from.x + 1) {
      return Action.MOVE_RIGHT;
    }
    if (to.x === from.x - 1) {
      return Action.MOVE_LEFT;
    }
    if (to.y === from.y + 1) {
      return Action.MOVE_DOWN;
    }
    return Action.MOVE_UP;
  }

  private getDangerousPositions(): Set<string> {
    const BOMB_EXPLOSION_RANGE = 2;

    const danger = new Set<string>();
    const directions = [
      [0, -1], // top
      [0, 1], // down
      [-1, 0], // left
      [1, 0], // right
    ];

    this.state.bombs.forEach((bomb) => {
      danger.add(this.posKey(bomb.pos));
      directions.forEach((dir) => {
        for (let step = 1; step <= BOMB_EXPLOSION_RANGE; step++) {
          const pos = new Position(
            bomb.pos.x + dir[0] * step,
            bomb.pos.y + dir[1] * step,
          );
          if (!this.inBounds(pos)) break;
          const tile = this.state.field.cells[pos.y][pos.x];
          if (tile == CellType.WALL) break;
          danger.add(this.posKey(pos));
          if (tile == CellType.BOX) break;
        }
      });
    });

    return danger;
  }

  private posKey(pos: Position): string {
    return `${pos.x},${pos.y}`;
  }

  private isValidPosition(pos: unknown): pos is Position {
    if (!pos || typeof pos !== "object") {
      return false;
    }

    const maybe = pos as { x?: unknown; y?: unknown };
    return (
      typeof maybe.x === "number" &&
      typeof maybe.y === "number" &&
      Number.isFinite(maybe.x) &&
      Number.isFinite(maybe.y)
    );
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
