import { Action } from "./enums.js";
import { GameHelpers } from "./helpers.js";
import type { GameState } from "./models.js";

export interface IBot {
  getNextMove(state: GameState, helpers: GameHelpers): Action | Promise<Action>;
}
