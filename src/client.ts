import { Action, CellType } from "./enums.js";
import type { IBot } from "./bot.js";
import { GameHelpers } from "./helpers.js";
import { Position } from "./models.js";
import type { Bomb, Field, GameState, Player } from "./models.js";
import { WsClient } from "./internal/ws-client.js";

const MSG_WELCOME = "welcome";
const MSG_BACK_TO_LOBBY = "back_to_lobby";
const MSG_UPDATE_LOBBY = "update_lobby";
const MSG_PLAYER_STATUS_UPDATE = "player_status_update";
const MSG_SERVER_ERROR = "error";
const MSG_CLASSIC_STATE = "classic_state";
const MSG_GAME_START = "game_start";

interface Envelope<T = unknown> {
  type: string;
  payload: T;
}

interface WirePosition {
  x: number;
  y: number;
}

interface WirePlayer {
  id: string;
  pos: WirePosition;
  health: number;
  score: number;
}

interface WireBomb {
  pos: WirePosition;
  fuse: number;
}

interface WireField {
  width: number;
  height: number;
  field: Array<CellType | number | string>;
}

interface ClassicStatePayload {
  currentTick?: number;
  players: WirePlayer[];
  field: WireField;
  bombs: WireBomb[];
  explosions: WirePosition[];
}

interface WelcomePayload {
  clientId: string;
}

/**
 * Starts the websocket game loop and delegates decisions to the user bot.
 */
export async function run(userBot: IBot): Promise<void> {
  const wsUrl = process.env.BOMBAHEAD_WS_URL ?? "ws://localhost:8038/ws";
  const token =
    process.env.BOMBAHEAD_TOKEN ??
    process.env.BOMBERMAN_CLIENT_AUTH_TOKEN ??
    "dev-token-local";

  const client = new WsClient({ url: wsUrl, token });
  const safeBot = toSafeBot(userBot);

  let myId = "";

  client.onConnect(() => {
    client.send(MSG_PLAYER_STATUS_UPDATE, { isReady: true, authToken: token });
  });

  client.onError((error) => {
    // eslint-disable-next-line no-console
    console.error("[bombahead-sdk] websocket error:", error.message);
  });

  client.onDisconnect(({ code, reason }) => {
    // eslint-disable-next-line no-console
    console.warn(
      `[bombahead-sdk] disconnected (${code}): ${reason || "no reason"}`,
    );
  });

  client.onMessage(async (raw) => {
    let message: Envelope;
    try {
      message = JSON.parse(raw) as Envelope;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[bombahead-sdk] invalid JSON from server", error);
      return;
    }

    switch (message.type) {
      case MSG_WELCOME: {
        const payload = message.payload as Partial<WelcomePayload> | null;
        if (
          typeof payload?.clientId === "string" &&
          payload.clientId.length > 0
        ) {
          myId = payload.clientId;
        }
        return;
      }
      case MSG_BACK_TO_LOBBY: {
        client.send(MSG_PLAYER_STATUS_UPDATE, { isReady: true });
        return;
      }
      case MSG_UPDATE_LOBBY:
      case MSG_GAME_START:
        return;
      case MSG_SERVER_ERROR: {
        // eslint-disable-next-line no-console
        console.error(
          "[bombahead-sdk] server error:",
          JSON.stringify(message.payload),
        );
        return;
      }
      case MSG_CLASSIC_STATE:
        break;
      default:
        return;
    }

    let state: GameState;
    try {
      state = toGameState(message.payload as ClassicStatePayload, myId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[bombahead-sdk] failed to transform game state", error);
      return;
    }

    const helpers = new GameHelpers(state);

    let action: Action;
    try {
      action = normalizeAction(await safeBot.getNextMove(state, helpers));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[bombahead-sdk] bot threw in getNextMove, fallback to nothing",
        error,
      );
      action = Action.DO_NOTHING;
    }

    client.sendAction(action);
  });

  try {
    client.connect();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[bombahead-sdk] failed to connect websocket", error);
  }
}

function toGameState(payload: ClassicStatePayload, myId: string): GameState {
  const players = (payload?.players ?? []).map(toPlayer);
  const me = players.find((p) => p.id === myId) ?? players[0];

  if (!me) {
    throw new Error("classic_state payload has no players");
  }

  const opponents = players.filter((p) => p.id !== me.id);

  const field: Field = {
    width: toNonNegativeInt(payload?.field?.width),
    height: toNonNegativeInt(payload?.field?.height),
    cells: to2dCells(payload?.field),
  };

  const bombs: Bomb[] = (payload?.bombs ?? []).map((b) => ({
    pos: toPosition(b?.pos),
    fuse: toNumberOr(b?.fuse, 0),
  }));

  const explosions = (payload?.explosions ?? []).map(toPosition);

  return {
    currentTick: toNumberOr(payload?.currentTick, 0),
    me,
    opponents,
    players,
    field,
    bombs,
    explosions,
  };
}

function toPlayer(p: WirePlayer | null | undefined): Player {
  return {
    id: typeof p?.id === "string" ? p.id : "",
    pos: toPosition(p?.pos),
    health: toNumberOr(p?.health, 0),
    score: toNumberOr(p?.score, 0),
  };
}

function to2dCells(field: WireField | null | undefined): CellType[][] {
  const width = toNonNegativeInt(field?.width);
  const height = toNonNegativeInt(field?.height);
  const flat = Array.isArray(field?.field) ? field.field : [];

  const rows: CellType[][] = [];

  for (let y = 0; y < height; y += 1) {
    const row: CellType[] = [];
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      row.push(decodeCell(flat[idx]));
    }
    rows.push(row);
  }

  return rows;
}

function decodeCell(input: CellType | number | string | undefined): CellType {
  if (input === CellType.AIR || input === "AIR") {
    return CellType.AIR;
  }
  if (input === CellType.WALL || input === "WALL") {
    return CellType.WALL;
  }
  if (input === CellType.BOX || input === "BOX") {
    return CellType.BOX;
  }

  if (typeof input === "number") {
    switch (input) {
      case 0:
        return CellType.WALL;
      case 1:
        return CellType.AIR;
      case 2:
        return CellType.BOX;
      default:
        return CellType.AIR;
    }
  }

  return CellType.AIR;
}

function toPosition(pos: WirePosition | null | undefined): Position {
  return new Position(toNonNegativeInt(pos?.x), toNonNegativeInt(pos?.y));
}

function toNumberOr(value: unknown, fallback: number): number {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return value;
}

function toNonNegativeInt(value: unknown): number {
  const n = toNumberOr(value, 0);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }

  return Math.floor(n);
}

function normalizeAction(value: unknown): Action {
  if (
    value === Action.MOVE_UP ||
    value === Action.MOVE_DOWN ||
    value === Action.MOVE_LEFT ||
    value === Action.MOVE_RIGHT ||
    value === Action.PLACE_BOMB ||
    value === Action.DO_NOTHING
  ) {
    return value;
  }

  return Action.DO_NOTHING;
}

function toSafeBot(userBot: IBot): IBot {
  if (typeof userBot?.getNextMove === "function") {
    return userBot;
  }

  // eslint-disable-next-line no-console
  console.error(
    "[bombahead-sdk] invalid bot object passed to run(), using safe DO_NOTHING fallback",
  );

  return {
    getNextMove: () => Action.DO_NOTHING,
  };
}

export const __internal = {
  toGameState,
  toPlayer,
  to2dCells,
  decodeCell,
  toPosition,
  toNumberOr,
  toNonNegativeInt,
  normalizeAction,
  toSafeBot,
};
