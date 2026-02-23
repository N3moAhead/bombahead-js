import { CellType } from "./enums";

export class Position {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  /** Returns Manhattan distance to another position. */
  distanceTo(other: Position): number {
    return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
  }

  /** Compares two positions by coordinates. */
  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

export interface Player {
  id: string;
  pos: Position;
  health: number;
  score: number;
}

export interface Bomb {
  pos: Position;
  fuse: number;
}

export interface Field {
  width: number;
  height: number;
  cells: CellType[][];
}

export interface GameState {
  currentTick: number;
  me: Player;
  opponents: Player[];
  players: Player[];
  field: Field;
  bombs: Bomb[];
  explosions: Position[];
}
