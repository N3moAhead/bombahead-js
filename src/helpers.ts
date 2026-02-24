import { Action, CellType } from "./enums.js";
import { Position } from "./models.js";
import type { Bomb, GameState } from "./models.js";

export class GameHelpers {
  constructor(private readonly state: GameState) {}

  /**
   * Checks whether the position is inside bounds and not blocked by wall/box/bomb.
   */
  isWalkable(pos: Position): boolean {
    if (!this.isValidPosition(pos)) {
      return false;
    }

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
    if (!this.isValidPosition(start) || !this.isValidPosition(target)) {
      return Action.DO_NOTHING;
    }

    if (start.equals(target)) {
      return Action.DO_NOTHING;
    }

    if (!this.isWalkable(start) || !this.isWalkable(target)) {
      return Action.DO_NOTHING;
    }

    const firstSteps = new Map<string, Action>();
    const visited = new Set<string>([this.posKey(start)]);
    const queue: Position[] = [start];

    while (queue.length > 0) {
      const current = queue.shift() as Position;
      const currentKey = this.posKey(current);

      for (const next of this.getAdjacentWalkablePositions(current)) {
        const key = this.posKey(next);
        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        queue.push(next);

        if (current.equals(start)) {
          firstSteps.set(key, this.actionBetween(current, next));
        } else {
          firstSteps.set(key, firstSteps.get(currentKey) as Action);
        }

        if (next.equals(target)) {
          return firstSteps.get(key) ?? Action.DO_NOTHING;
        }
      }
    }

    return Action.DO_NOTHING;
  }

  /**
   * Checks whether a tile appears safe in the current tick.
   * Simulates active bomb chain reactions and blast propagation.
   */
  isSafe(pos: Position): boolean {
    if (!this.isValidPosition(pos)) {
      return false;
    }

    if (!this.inBounds(pos)) {
      return false;
    }

    if (this.state.explosions.some((exp) => exp.equals(pos))) {
      return false;
    }

    if (this.state.bombs.some((bomb) => bomb.pos.equals(pos))) {
      return false;
    }

    const imminentBombs = this.getImminentExplosionBombs();
    const blastTiles = this.getBlastTiles(imminentBombs);

    return !blastTiles.has(this.posKey(pos));
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
   * Finds the nearest box position by path distance to an adjacent walkable cell.
   */
  findNearestBox(start: Position): Position | null {
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

  private getImminentExplosionBombs(): Bomb[] {
    const bombs = this.state.bombs;
    const explodingKeys = new Set<string>();
    const queue: Bomb[] = [];

    for (const bomb of bombs) {
      if (bomb.fuse <= 0) {
        explodingKeys.add(this.posKey(bomb.pos));
        queue.push(bomb);
      }
    }

    if (queue.length === 0) {
      return [];
    }

    const byKey = new Map<string, Bomb>();
    for (const bomb of bombs) {
      byKey.set(this.posKey(bomb.pos), bomb);
    }

    while (queue.length > 0) {
      const bomb = queue.shift() as Bomb;
      for (const key of this.getBlastTiles([bomb])) {
        const triggeredBomb = byKey.get(key);
        if (!triggeredBomb) {
          continue;
        }
        if (explodingKeys.has(key)) {
          continue;
        }

        explodingKeys.add(key);
        queue.push(triggeredBomb);
      }
    }

    return bombs.filter((bomb) => explodingKeys.has(this.posKey(bomb.pos)));
  }

  private getBlastTiles(bombs: Bomb[]): Set<string> {
    const blast = new Set<string>();

    for (const bomb of bombs) {
      blast.add(this.posKey(bomb.pos));

      const dirs = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      for (const [dx, dy] of dirs) {
        for (let step = 1; step <= 3; step += 1) {
          const p = new Position(
            bomb.pos.x + dx * step,
            bomb.pos.y + dy * step,
          );
          if (!this.inBounds(p)) {
            break;
          }

          const cell = this.state.field.cells[p.y]?.[p.x];
          if (cell === CellType.WALL) {
            break;
          }

          blast.add(this.posKey(p));

          if (cell === CellType.BOX) {
            break;
          }
        }
      }
    }

    return blast;
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
