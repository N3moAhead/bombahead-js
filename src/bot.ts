import { Action } from "./enums";
import { GameHelpers } from "./helpers";
import { GameState } from "./models";

export interface IBot {
  getNextMove(state: GameState, helpers: GameHelpers): Action | Promise<Action>;
}
