/**
 * Action values must match the game server protocol exactly.
 */
export enum Action {
  MOVE_UP = "move_up",
  MOVE_DOWN = "move_down",
  MOVE_LEFT = "move_left",
  MOVE_RIGHT = "move_right",
  PLACE_BOMB = "place_bomb",
  DO_NOTHING = "nothing",
}

/**
 * Cell values sent by the server. Numeric variants are supported while parsing.
 */
export enum CellType {
  AIR = "AIR",
  WALL = "WALL",
  BOX = "BOX",
}
