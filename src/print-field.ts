import { CellType } from "./enums.js";
import type { Bomb, GameState, Player } from "./models.js";

const TILE_AIR = "  ";
const TILE_WALL = "🧱";
const TILE_BOX = "📦";
const TILE_BOMB = "💣";
const TILE_EXPLOSION = "💥";
const TILE_ME = "🤖";

const OPPONENT_ICONS = ["👾", "🏃", "🚶", "💃", "🕺", "🦊", "🐼", "🐸"];

/** Returns a console-friendly visualization of the current game board. */
export function renderField(state: GameState | null | undefined): string {
  if (!state) {
    return "<nil game state>\n";
  }

  const w = state.field.width;
  const h = state.field.height;
  if (w <= 0 || h <= 0) {
    return "<empty field>\n";
  }

  const grid: string[][] = [];
  for (let y = 0; y < h; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < w; x += 1) {
      const cell = state.field.cells[y]?.[x];
      if (cell === CellType.WALL) {
        row.push(TILE_WALL);
      } else if (cell === CellType.BOX) {
        row.push(TILE_BOX);
      } else {
        row.push(TILE_AIR);
      }
    }
    grid.push(row);
  }

  for (const exp of state.explosions) {
    if (inBounds(exp.x, exp.y, w, h)) {
      grid[exp.y][exp.x] = TILE_EXPLOSION;
    }
  }

  for (const bomb of state.bombs) {
    if (inBounds(bomb.pos.x, bomb.pos.y, w, h)) {
      grid[bomb.pos.y][bomb.pos.x] = TILE_BOMB;
    }
  }

  const icons = opponentIconMap(state);
  for (const opponent of state.opponents) {
    if (inBounds(opponent.pos.x, opponent.pos.y, w, h)) {
      grid[opponent.pos.y][opponent.pos.x] = icons.get(opponent.id) ?? TILE_AIR;
    }
  }

  if (state.me && inBounds(state.me.pos.x, state.me.pos.y, w, h)) {
    grid[state.me.pos.y][state.me.pos.x] = TILE_ME;
  }

  const out: string[] = [];
  out.push(`╔${"══".repeat(w)}╗`);
  for (let y = 0; y < h; y += 1) {
    out.push(`║${grid[y].join("")}║`);
  }
  out.push(`╚${"══".repeat(w)}╝`);

  appendPlayersSection(out, state, icons);
  appendBombsSection(out, state.bombs);

  out.push(
    "Legend: [space] AIR  🧱 WALL  📦 BOX  💣 BOMB  💥 EXPLOSION  🤖 ME",
  );
  return `${out.join("\n")}\n`;
}

/** Prints the current game board visualization to stdout. */
export function printField(state: GameState | null | undefined): void {
  process.stdout.write(renderField(state));
}

function appendPlayersSection(
  out: string[],
  state: GameState,
  icons: Map<string, string>,
): void {
  const players = stablePlayers(state);
  if (players.length === 0) {
    return;
  }

  out.push("--- PLAYERS ---");
  for (const player of players) {
    const icon =
      state.me && player.id === state.me.id
        ? TILE_ME
        : (icons.get(player.id) ?? TILE_AIR);
    out.push(
      `${icon} Player ${shortPlayerId(player.id)} | Health: ${player.health}, Score: ${player.score} | Pos: (${player.pos.x},${player.pos.y})`,
    );
  }
}

function appendBombsSection(out: string[], bombs: Bomb[]): void {
  if (bombs.length === 0) {
    return;
  }

  const sorted = [...bombs].sort((a, b) => {
    if (a.pos.y !== b.pos.y) {
      return a.pos.y - b.pos.y;
    }
    if (a.pos.x !== b.pos.x) {
      return a.pos.x - b.pos.x;
    }
    return a.fuse - b.fuse;
  });

  out.push("--- BOMBS ---");
  for (const bomb of sorted) {
    out.push(`💣 at (${bomb.pos.x},${bomb.pos.y}) | Fuse: ${bomb.fuse}`);
  }
}

function stablePlayers(state: GameState): Player[] {
  if (state.players.length > 0) {
    return [...state.players].sort((a, b) => a.id.localeCompare(b.id));
  }

  const players = [...state.opponents];
  if (state.me) {
    players.push(state.me);
  }
  return players.sort((a, b) => a.id.localeCompare(b.id));
}

function opponentIconMap(state: GameState): Map<string, string> {
  const icons = new Map<string, string>();
  const taken = new Set<string>();

  if (state.me) {
    taken.add(state.me.id);
  }

  const opponentIds: string[] = [];
  for (const opponent of state.opponents) {
    if (taken.has(opponent.id)) {
      continue;
    }
    taken.add(opponent.id);
    opponentIds.push(opponent.id);
  }
  opponentIds.sort((a, b) => a.localeCompare(b));

  for (let i = 0; i < opponentIds.length; i += 1) {
    icons.set(opponentIds[i], OPPONENT_ICONS[i % OPPONENT_ICONS.length]);
  }

  for (const player of stablePlayers(state)) {
    if (!icons.has(player.id)) {
      icons.set(player.id, OPPONENT_ICONS[icons.size % OPPONENT_ICONS.length]);
    }
  }

  return icons;
}

function shortPlayerId(id: string): string {
  if (!id) {
    return "<unknown>";
  }
  const n = 4;
  if (id.length <= n) {
    return id;
  }
  return `...${id.slice(-n)}`;
}

function inBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}
